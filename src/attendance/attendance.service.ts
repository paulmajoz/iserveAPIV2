import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from './attendance.schema';
import { SubmitAttendanceDto } from './submit-attendance.dto';
import { EventsService } from '../events/events.service';
import { EventTypesService } from '../event-types/event-types.service';
import { EventCategoriesService } from '../event-categories/event-categories.service';
import { SchoolsService } from '../schools/schools.service';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private model: Model<AttendanceDocument>,
    private readonly events: EventsService,
    private readonly eventTypes: EventTypesService,
    private readonly eventCategories: EventCategoriesService,
    private readonly schools: SchoolsService,
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

      const pointsAwarded = event.pointsEnabled ? Number(event.pointsValue ?? 0) : 0;

      const record = await this.model.create({
        eventId: eventObjectId,
        studentEmail: emailLower,
        studentFirstName: dto.studentFirstName,
        studentLastName: dto.studentLastName,
        studentId: dto.studentId,
        studentGrade: dto.studentGrade,
        studentClass: dto.studentClass,
        schoolId: dto.schoolId,
        source,
        locationIn: dto.locationIn,
        description: dto.description,
        reflection: dto.reflection,
        unitAmount: dto.unitAmount,
        pointsAwarded,
        teacherEmail: dto.teacherEmail,
        hours: event.hourMode === 'fixed' ? event.fixedHours :
               event.hourMode === 'volume' && dto.unitAmount
                 ? dto.unitAmount * (event.volumeConversion ?? 1)
                 : null,
      });

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

    if (event.hourMode === 'in-out') {
      const ms = record.timeOut.getTime() - record.timeIn.getTime();
      record.hours = ms / 3_600_000;
    }

    await record.save();
    return record;
  }

  getByEvent(eventId: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException(`"${eventId}" is not a valid event ID`);
    }
    return this.model.find({ eventId: new Types.ObjectId(eventId) }).sort({ scannedAt: -1 }).exec();
  }

  getByStudent(email: string) {
    return this.model
      .find({ studentEmail: new RegExp(`^${email}$`, 'i') })
      .sort({ scannedAt: -1 })
      .exec();
  }

  async getSummary(email: string, schoolId?: string) {
    const records = await this.getByStudent(email);

    let totalHours = 0;
    let totalPoints = 0;
    const hoursByType: Record<string, number> = {};
    const hoursByCategory: Record<string, number> = {};

    for (const rec of records) {
      totalPoints += rec.pointsAwarded ?? 0;
      if (rec.hours) {
        totalHours += rec.hours;

        // Enrich with event type/category
        try {
          const event = await this.events.findById(rec.eventId.toString());

          let typeName = 'General';
          let catName = 'General';

          if (event.eventTypeId) {
            const et = await this.eventTypes.findById(event.eventTypeId.toString());
            if (et) typeName = et.name;
          }
          if (event.eventCategoryId) {
            const ec = await this.eventCategories.findById(event.eventCategoryId.toString());
            if (ec) catName = ec.name;
          }

          hoursByType[typeName] = (hoursByType[typeName] ?? 0) + rec.hours;
          hoursByCategory[catName] = (hoursByCategory[catName] ?? 0) + rec.hours;
        } catch {}
      }
    }

    // Get school targets if schoolId provided
    let gradeTargetHours: Record<string, number> = {};
    let honoursTargetHours: Record<string, number> = {};
    if (schoolId) {
      const school = await this.schools.findBySchoolId(+schoolId).catch(() => null);
      if (school) {
        gradeTargetHours = school.gradeTargetHours ?? {};
        honoursTargetHours = school.honoursTargetHours ?? {};
      }
    }

    return {
      studentEmail: email,
      totalHours,
      totalPoints,
      hoursByType,
      hoursByCategory,
      gradeTargetHours,
      honoursTargetHours,
      totalRecords: records.length,
    };
  }

  remove(id: string) {
    return this.model.findByIdAndDelete(id).exec();
  }
}
