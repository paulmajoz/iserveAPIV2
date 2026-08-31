import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from './attendance.schema';
import { SubmitAttendanceDto } from './submit-attendance.dto';
import { ManualAttendanceDto } from './manual-attendance.dto';
import { UpdateAttendanceDto } from './update-attendance.dto';
import { EventsService } from '../events/events.service';
import { EventTypesService } from '../event-types/event-types.service';
import { EventCategoriesService } from '../event-categories/event-categories.service';
import { SchoolsService } from '../schools/schools.service';
import { NinoxService } from '../ninox/ninox.service';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private model: Model<AttendanceDocument>,
    private readonly events: EventsService,
    private readonly eventTypes: EventTypesService,
    private readonly eventCategories: EventCategoriesService,
    private readonly schools: SchoolsService,
    private readonly ninox: NinoxService,
  ) {}

  async submit(dto: SubmitAttendanceDto, source: 'self' | 'assisted'): Promise<AttendanceDocument> {
    const event = await this.events.findById(dto.eventId);
    const emailLower = dto.studentEmail.toLowerCase();
    const eventObjectId = new Types.ObjectId(dto.eventId);

    if (dto.direction === 'in' || event.qrMode === 'once-off') {
      // Check if already signed in today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const existing = await this.model.findOne({
        eventId: eventObjectId,
        studentEmail: new RegExp(`^${emailLower}$`, 'i'),
        timeIn: { $gte: todayStart },
      }).exec();

      if (existing && event.qrMode === 'once-off') {
        return existing; // idempotent for once-off
      }
      if (existing && dto.direction === 'in') {
        throw new BadRequestException('Student already signed in for this event today');
      }

      // ── Points calculation (sign-in / once-off) ───────────────────────
      // New events use pointsMode; legacy events fall back to pointsEnabled.
      let pointsAwarded = 0;
      const pMode = (event as any).pointsMode as string | undefined;
      if (pMode === 'fixed') {
        pointsAwarded = Number(event.pointsValue ?? 0);
      } else if (pMode === 'in-out') {
        // Points awarded only on sign-out, not sign-in
        pointsAwarded = 0;
      } else if (pMode === 'volume' && dto.unitAmount != null) {
        pointsAwarded = dto.unitAmount * ((event as any).pointsConversion ?? 1);
      } else if (!pMode && event.pointsEnabled) {
        // legacy — no pointsMode field
        pointsAwarded = Number(event.pointsValue ?? 0);
      }

      // ── Geofence evaluation (sign-in / once-off) ──────────────────────
      const geo = this.evaluateGeofence((event as any).geoTarget, dto.locationIn);

      const record = await this.model.create({
        eventId: eventObjectId,
        studentEmail: emailLower,
        studentFirstName: dto.studentFirstName,
        studentLastName: dto.studentLastName,
        studentId: dto.studentId,
        studentGrade: dto.studentGrade,
        studentClass: dto.studentClass,
        studentHouse: dto.studentHouse,
        studentTutor: dto.studentTutor,
        customField1: dto.customField1,
        customField2: dto.customField2,
        customField3: dto.customField3,
        schoolId: dto.schoolId,
        source,
        locationIn: dto.locationIn,
        description: dto.description,
        reflection: dto.reflection,
        unitAmount: dto.unitAmount,
        pointsAwarded,
        teacherEmail: dto.teacherEmail,
        distanceMeters: geo.distanceMeters,
        withinPerimeter: geo.withinPerimeter,
        hours: event.hourMode === 'fixed' ? event.fixedHours :
               event.hourMode === 'volume' && dto.unitAmount
                 ? dto.unitAmount * (event.volumeConversion ?? 1)
                 : null,
      });

      this.ninox.syncAttendance(record).catch(() => {});
      return record;
    }

    // direction === 'out'
    const record = await this.model.findOne({
      eventId: eventObjectId,
      studentEmail: new RegExp(`^${emailLower}$`, 'i'),
      timeOut: { $exists: false },
    }).sort({ timeIn: -1 }).exec();

    if (!record) throw new NotFoundException('No open sign-in found for this student');

    record.timeOut = new Date();
    record.locationOut = dto.locationOut;

    // ── Geofence evaluation (sign-out) ──────────────────────────────────
    // For in-out events the perimeter is checked at sign-out (where the
    // student fills in the form). Overwrites any earlier IN reading.
    const geoOut = this.evaluateGeofence((event as any).geoTarget, dto.locationOut);
    if (geoOut.distanceMeters !== null) {
      record.distanceMeters = geoOut.distanceMeters;
      record.withinPerimeter = geoOut.withinPerimeter;
    }

    if (event.hourMode === 'in-out') {
      const ms = record.timeOut.getTime() - record.timeIn.getTime();
      record.hours = ms / 3_600_000;
    }

    // Award points on sign-out for in-out points mode
    const pModeOut = (event as any).pointsMode as string | undefined;
    if (pModeOut === 'in-out') {
      record.pointsAwarded = (record.pointsAwarded ?? 0) + Number(event.pointsValue ?? 0);
    }

    await record.save();
    this.ninox.syncAttendance(record).catch(() => {});
    return record;
  }

  /**
   * Teacher-driven manual creation of a complete attendance record.
   * Unlike `submit`, this does NOT branch on scan direction — it creates
   * the record outright with the supplied timestamps, computes hours /
   * points based on the event's tracking mode, and evaluates geofence.
   *
   * Always written with `source: 'assisted'`.
   */
  async createManual(dto: ManualAttendanceDto): Promise<AttendanceDocument> {
    if (!Types.ObjectId.isValid(dto.eventId)) {
      throw new BadRequestException(`"${dto.eventId}" is not a valid event ID`);
    }
    const event = await this.events.findById(dto.eventId);
    const eventObjectId = new Types.ObjectId(dto.eventId);

    const timeIn = new Date(dto.timeIn);
    if (Number.isNaN(timeIn.getTime())) {
      throw new BadRequestException('timeIn is not a valid date');
    }
    const timeOut = dto.timeOut ? new Date(dto.timeOut) : undefined;
    if (timeOut && Number.isNaN(timeOut.getTime())) {
      throw new BadRequestException('timeOut is not a valid date');
    }
    if (timeOut && timeOut < timeIn) {
      throw new BadRequestException('timeOut must be later than timeIn');
    }

    // ── Hours ─────────────────────────────────────────────────────────────
    let hours: number | null = null;
    if (event.hourMode === 'fixed') {
      hours = event.fixedHours ?? 1;
    } else if (event.hourMode === 'volume' && dto.unitAmount != null) {
      hours = dto.unitAmount * (event.volumeConversion ?? 1);
    } else if (event.hourMode === 'in-out' && timeOut) {
      hours = (timeOut.getTime() - timeIn.getTime()) / 3_600_000;
    }

    // ── Points ────────────────────────────────────────────────────────────
    let pointsAwarded = 0;
    const pMode = (event as any).pointsMode as string | undefined;
    if (pMode === 'fixed') {
      pointsAwarded = Number(event.pointsValue ?? 0);
    } else if (pMode === 'in-out') {
      // Points only awarded when the record has a timeOut (i.e. student has signed out).
      pointsAwarded = timeOut ? Number(event.pointsValue ?? 0) : 0;
    } else if (pMode === 'volume' && dto.unitAmount != null) {
      pointsAwarded = dto.unitAmount * ((event as any).pointsConversion ?? 1);
    } else if (!pMode && event.pointsEnabled) {
      pointsAwarded = Number(event.pointsValue ?? 0);
    }

    // ── Geofence — prefer the "more meaningful" measurement (out > in) ────
    const geoIn  = this.evaluateGeofence((event as any).geoTarget, dto.locationIn);
    const geoOut = this.evaluateGeofence((event as any).geoTarget, dto.locationOut);
    const distanceMeters   = geoOut.distanceMeters   ?? geoIn.distanceMeters   ?? null;
    const withinPerimeter  = geoOut.withinPerimeter  ?? geoIn.withinPerimeter  ?? null;

    const record = await this.model.create({
      eventId: eventObjectId,
      studentEmail: dto.studentEmail.toLowerCase(),
      studentFirstName: dto.studentFirstName,
      studentLastName:  dto.studentLastName,
      studentId:        dto.studentId,
      studentGrade:     dto.studentGrade,
      studentClass:     dto.studentClass,
      studentHouse:     dto.studentHouse,
      studentTutor:     dto.studentTutor,
      customField1:     dto.customField1,
      customField2:     dto.customField2,
      customField3:     dto.customField3,
      schoolId:         dto.schoolId,
      source: 'assisted',
      timeIn,
      timeOut,
      hours,
      pointsAwarded,
      description: dto.description,
      reflection:  dto.reflection,
      unitAmount:  dto.unitAmount,
      locationIn:  dto.locationIn,
      locationOut: dto.locationOut,
      distanceMeters,
      withinPerimeter,
      teacherEmail: dto.teacherEmail,
    });

    this.ninox.syncAttendance(record).catch(() => {});
    return record;
  }

  async update(id: string, dto: UpdateAttendanceDto): Promise<AttendanceDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`"${id}" is not a valid attendance ID`);
    }
    const record = await this.model.findByIdAndUpdate(
      id,
      { $set: dto },
      { new: true },
    ).exec();
    if (!record) throw new NotFoundException(`Attendance record ${id} not found`);
    this.ninox.syncAttendance(record).catch(() => {});
    return record;
  }

  /**
   * Compare a captured "lat,lon" string against the event's geoTarget.
   * Returns null distance/within when either side is missing.
   */
  private evaluateGeofence(
    target: { lat: number; lon: number; radiusMeters: number } | null | undefined,
    captured: string | undefined,
  ): { distanceMeters: number | null; withinPerimeter: boolean | null } {
    if (!target || !captured) return { distanceMeters: null, withinPerimeter: null };
    const parts = captured.split(',').map((p) => Number(p.trim()));
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) {
      return { distanceMeters: null, withinPerimeter: null };
    }
    const [lat, lon] = parts;
    const distanceMeters = Math.round(this.haversine(target.lat, target.lon, lat, lon));
    return {
      distanceMeters,
      withinPerimeter: distanceMeters <= (target.radiusMeters ?? 0),
    };
  }

  /** Great-circle distance in metres between two lat/lon points. */
  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6_371_000; // Earth radius in metres
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  async getState(
    eventId: string,
    email: string,
  ): Promise<{
    status: 'fresh' | 'open' | 'closed';
    direction: 'in' | 'out' | null;
    qrMode: string;
    timeIn?: Date;
    timeOut?: Date;
  }> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException(`"${eventId}" is not a valid event ID`);
    }
    const event = await this.events.findById(eventId);
    const eventObjectId = new Types.ObjectId(eventId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const record = await this.model.findOne({
      eventId: eventObjectId,
      studentEmail: new RegExp(`^${email.toLowerCase()}$`, 'i'),
      timeIn: { $gte: todayStart },
    }).sort({ timeIn: -1 }).exec();

    if (event.qrMode === 'once-off') {
      if (record) return { status: 'closed', direction: null, qrMode: event.qrMode, timeIn: record.timeIn };
      return { status: 'fresh', direction: 'in', qrMode: event.qrMode };
    }

    if (!record) return { status: 'fresh', direction: 'in', qrMode: event.qrMode };
    if (!record.timeOut) return { status: 'open', direction: 'out', qrMode: event.qrMode, timeIn: record.timeIn };
    return { status: 'closed', direction: null, qrMode: event.qrMode, timeIn: record.timeIn, timeOut: record.timeOut };
  }

  /**
   * Attendance records for an event. Each record is back-filled with the
   * most-recently-known first/last/grade/class for that student email, so
   * older rows that were saved before we had a name still display one.
   */
  async getByEvent(eventId: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException(`"${eventId}" is not a valid event ID`);
    }
    return this.model.aggregate([
      { $match: { eventId: new Types.ObjectId(eventId) } },
      { $sort: { scannedAt: -1 } },
      // Self-join: latest record for this email that DOES have a name
      {
        $lookup: {
          from: 'v2attendance',
          let: { e: '$studentEmail' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$studentEmail', '$$e'] },
                studentFirstName: { $exists: true, $nin: [null, ''] },
              },
            },
            { $sort: { scannedAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                studentFirstName: 1,
                studentLastName: 1,
                studentGrade: 1,
                studentClass: 1,
                studentHouse: 1,
                studentTutor: 1,
                customField1: 1,
                customField2: 1,
                customField3: 1,
              },
            },
          ],
          as: '_n',
        },
      },
      { $unwind: { path: '$_n', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          studentFirstName: {
            $cond: [
              { $in: [{ $ifNull: ['$studentFirstName', ''] }, [null, '']] },
              '$_n.studentFirstName',
              '$studentFirstName',
            ],
          },
          studentLastName: {
            $cond: [
              { $in: [{ $ifNull: ['$studentLastName', ''] }, [null, '']] },
              '$_n.studentLastName',
              '$studentLastName',
            ],
          },
          studentGrade: {
            $cond: [
              { $in: [{ $ifNull: ['$studentGrade', ''] }, [null, '']] },
              '$_n.studentGrade',
              '$studentGrade',
            ],
          },
          studentClass: {
            $cond: [
              { $in: [{ $ifNull: ['$studentClass', ''] }, [null, '']] },
              '$_n.studentClass',
              '$studentClass',
            ],
          },
          studentHouse: {
            $cond: [
              { $in: [{ $ifNull: ['$studentHouse', ''] }, [null, '']] },
              '$_n.studentHouse',
              '$studentHouse',
            ],
          },
          studentTutor: {
            $cond: [
              { $in: [{ $ifNull: ['$studentTutor', ''] }, [null, '']] },
              '$_n.studentTutor',
              '$studentTutor',
            ],
          },
          customField1: {
            $cond: [
              { $in: [{ $ifNull: ['$customField1', ''] }, [null, '']] },
              '$_n.customField1',
              '$customField1',
            ],
          },
          customField2: {
            $cond: [
              { $in: [{ $ifNull: ['$customField2', ''] }, [null, '']] },
              '$_n.customField2',
              '$customField2',
            ],
          },
          customField3: {
            $cond: [
              { $in: [{ $ifNull: ['$customField3', ''] }, [null, '']] },
              '$_n.customField3',
              '$customField3',
            ],
          },
        },
      },
      { $project: { _n: 0 } },
    ]).exec();
  }

  /**
   * Attendance records for a student, decorated with the parent event's
   * name / department / category so the UI doesn't need a second round-trip.
   * Done via `$lookup` so we hit the DB once.
   */
  getByStudent(email: string) {
    return this.model.aggregate([
      { $match: { studentEmail: new RegExp(`^${email}$`, 'i') } },
      { $sort: { scannedAt: -1 } },
      {
        $lookup: {
          from: 'v2events',
          localField: 'eventId',
          foreignField: '_id',
          as: '_event',
        },
      },
      { $unwind: { path: '$_event', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          eventName:         '$_event.eventName',
          eventDepartment:   '$_event.department',
          eventCategory:     '$_event.category',
          eventQrMode:       '$_event.qrMode',
          eventHourMode:     '$_event.hourMode',
          eventPointsEnabled: '$_event.pointsEnabled',
        },
      },
      { $project: { _event: 0 } },
    ]).exec();
  }

  async getSummary(email: string, schoolId?: string) {
    const records = await this.getByStudent(email) as Array<any>;

    let totalHours = 0;
    let totalPoints = 0;
    let firstActivity: Date | undefined;
    let lastActivity: Date | undefined;
    const uniqueEvents = new Set<string>();

    const hoursByDepartment: Record<string, number>  = {};
    const hoursByCategory:   Record<string, number>  = {};
    const pointsByDepartment: Record<string, number> = {};
    const pointsByCategory:   Record<string, number> = {};
    const eventsByDepartment: Record<string, number> = {};

    // Nested department -> subcategory breakdown (fixes hoursByCategory /
    // pointsByCategory above collapsing same-named subcategories that live
    // under different departments).
    interface SubcategoryBreakdown {
      name: string;
      hours: number;
      points: number;
      hoursLimit?: number;
      pointsLimit?: number;
    }
    interface DepartmentBreakdown {
      name: string;
      hours: number;
      points: number;
      subcategories: SubcategoryBreakdown[];
    }
    const departmentBreakdownMap = new Map<string, {
      hours: number;
      points: number;
      subcategories: Map<string, { hours: number; points: number }>;
    }>();

    // Legacy V1 aggregations — still populated for backward compat with any
    // consumer that hasn't migrated to the new department/category names.
    const hoursByType: Record<string, number> = {};
    const legacyHoursByCategory: Record<string, number> = {};

    for (const rec of records) {
      const points = Number(rec.pointsAwarded ?? 0);
      totalPoints += points;
      uniqueEvents.add(String(rec.eventId));
      if (rec.timeIn) {
        const t = new Date(rec.timeIn);
        if (!firstActivity || t < firstActivity) firstActivity = t;
        if (!lastActivity  || t > lastActivity)  lastActivity  = t;
      }

      const dept = (rec.eventDepartment ?? '').trim() || 'General';
      const cat  = (rec.eventCategory   ?? '').trim() || 'General';

      eventsByDepartment[dept] = (eventsByDepartment[dept] ?? 0) + 1;

      if (!departmentBreakdownMap.has(dept)) {
        departmentBreakdownMap.set(dept, { hours: 0, points: 0, subcategories: new Map() });
      }
      const deptEntry = departmentBreakdownMap.get(dept)!;
      if (!deptEntry.subcategories.has(cat)) {
        deptEntry.subcategories.set(cat, { hours: 0, points: 0 });
      }
      const subEntry = deptEntry.subcategories.get(cat)!;

      if (points > 0) {
        pointsByDepartment[dept] = (pointsByDepartment[dept] ?? 0) + points;
        pointsByCategory[cat]    = (pointsByCategory[cat]    ?? 0) + points;
        deptEntry.points += points;
        subEntry.points  += points;
      }

      if (rec.hours) {
        totalHours += rec.hours;
        hoursByDepartment[dept] = (hoursByDepartment[dept] ?? 0) + rec.hours;
        hoursByCategory[cat]    = (hoursByCategory[cat]    ?? 0) + rec.hours;
        deptEntry.hours += rec.hours;
        subEntry.hours  += rec.hours;

        // ── Legacy V1 type / category lookups (kept for compatibility) ──
        try {
          const event = await this.events.findById(String(rec.eventId));
          let typeName = 'General';
          let catName  = 'General';
          if (event.eventTypeId) {
            const et = await this.eventTypes.findById(event.eventTypeId.toString());
            if (et) typeName = et.name;
          }
          if (event.eventCategoryId) {
            const ec = await this.eventCategories.findById(event.eventCategoryId.toString());
            if (ec) catName = ec.name;
          }
          hoursByType[typeName] = (hoursByType[typeName] ?? 0) + rec.hours;
          legacyHoursByCategory[catName] = (legacyHoursByCategory[catName] ?? 0) + rec.hours;
        } catch {}
      }
    }

    // Get school targets + subcategory limits if schoolId provided
    let gradeTargetHours: Record<string, number> = {};
    let honoursTargetHours: Record<string, number> = {};
    let schoolDepartments: { name: string; subcategories: { name: string; hoursLimit?: number; pointsLimit?: number }[] }[] = [];
    if (schoolId) {
      const school = await this.schools.findBySchoolId(+schoolId).catch(() => null);
      if (school) {
        gradeTargetHours = school.gradeTargetHours ?? {};
        honoursTargetHours = school.honoursTargetHours ?? {};
        schoolDepartments = (school.departments ?? []) as typeof schoolDepartments;
      }
    }

    const findLimits = (deptName: string, subName: string): { hoursLimit?: number; pointsLimit?: number } => {
      const dept = schoolDepartments.find(
        (d) => (d.name ?? '').trim().toLowerCase() === deptName.trim().toLowerCase(),
      );
      if (!dept) return {};
      const sub = (dept.subcategories ?? []).find(
        (s: any) => (typeof s === 'string' ? s : s.name ?? '').trim().toLowerCase() === subName.trim().toLowerCase(),
      ) as any;
      if (!sub || typeof sub === 'string') return {};
      return {
        hoursLimit: sub.hoursLimit ?? undefined,
        pointsLimit: sub.pointsLimit ?? undefined,
      };
    };

    const departmentBreakdown: DepartmentBreakdown[] = Array.from(departmentBreakdownMap.entries()).map(
      ([deptName, deptEntry]) => ({
        name: deptName,
        hours: deptEntry.hours,
        points: deptEntry.points,
        subcategories: Array.from(deptEntry.subcategories.entries()).map(([subName, subEntry]) => ({
          name: subName,
          hours: subEntry.hours,
          points: subEntry.points,
          ...findLimits(deptName, subName),
        })),
      }),
    );

    return {
      studentEmail: email,
      totalHours,
      totalPoints,
      totalRecords: records.length,
      uniqueEvents: uniqueEvents.size,
      firstActivity,
      lastActivity,

      // V2 department / category breakdowns
      hoursByDepartment,
      hoursByCategory,
      pointsByDepartment,
      pointsByCategory,
      eventsByDepartment,

      // Nested breakdown (department -> subcategories), with per-subcategory
      // hours/points limits attached where the school has configured one.
      departmentBreakdown,

      // Targets
      gradeTargetHours,
      honoursTargetHours,

      // Legacy fields — kept so older clients don't break.
      hoursByType,
    };
  }

  remove(id: string) {
    return this.model.findByIdAndDelete(id).exec();
  }
}
