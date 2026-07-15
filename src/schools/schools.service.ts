import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School, SchoolDocument } from './school.schema';
import { Event, EventDocument } from '../events/event.schema';
import { Attendance, AttendanceDocument } from '../attendance/attendance.schema';

export interface SchoolContact {
  email: string;
  name?: string;
  role: 'Staff' | 'Student';
  grade?: string;
  studentClass?: string;
}

@Injectable()
export class SchoolsService {
  constructor(
    @InjectModel(School.name) private model: Model<SchoolDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
  ) {}

  create(dto: Partial<School>) {
    return this.model.create(dto);
  }

  findAll() {
    return this.model.find().exec();
  }

  async findBySchoolId(schoolId: number) {
    const school = await this.model.findOne({ schoolId }).exec();
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);
    return school;
  }

  async getTheme(schoolId: number) {
    const school = await this.findBySchoolId(schoolId);
    return school.themeColors;
  }

  async getLookup(schoolId: number) {
    const school = await this.findBySchoolId(schoolId);
    return {
      departments: (school.departments ?? []) as { name: string; subcategories: string[] }[],
    };
  }

  async update(schoolId: number, dto: Partial<School>) {
    const school = await this.model.findOneAndUpdate({ schoolId }, dto, { new: true }).exec();
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);
    return school;
  }

  /**
   * Returns the unique set of people who could plausibly receive an email
   * about an event at this school — pulled from the data we already have:
   *
   *   - **teachers**: distinct `teacherEmail` on `events` for this school
   *   - **students**: distinct `studentEmail` on `attendance` for this school
   *
   * Used by the QR-email recipient picker. Returned shape includes the most
   * recent display name we've seen for each address so the picker can show
   * "Sarah Naidoo (snaidoo@…)" rather than just the email.
   */
  async getContacts(schoolId: number): Promise<{ teachers: SchoolContact[]; students: SchoolContact[] }> {
    const schoolStr = String(schoolId);

    // ── Teachers — aggregate by email, keep the most recent teacher name
    const teacherAgg = await this.eventModel.aggregate<{
      _id: string;
      name: string;
    }>([
      { $match: { school: schoolStr, teacherEmail: { $exists: true, $ne: '' } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { $toLower: '$teacherEmail' }, name: { $first: '$teacher' } } },
      { $sort: { name: 1 } },
    ]).exec();

    const teachers: SchoolContact[] = teacherAgg.map((t) => ({
      email: t._id,
      name: (t.name ?? '').trim() || undefined,
      role: 'Staff',
    }));

    // ── Students — aggregate by email, keep the latest scanned name/grade
    const studentAgg = await this.attendanceModel.aggregate<{
      _id: string;
      first?: string;
      last?: string;
      grade?: string;
      cls?: string;
    }>([
      { $match: { schoolId: schoolStr, studentEmail: { $exists: true, $ne: '' } } },
      { $sort: { scannedAt: -1 } },
      {
        $group: {
          _id: { $toLower: '$studentEmail' },
          first: { $first: '$studentFirstName' },
          last:  { $first: '$studentLastName' },
          grade: { $first: '$studentGrade' },
          cls:   { $first: '$studentClass' },
        },
      },
      { $sort: { first: 1, last: 1 } },
    ]).exec();

    const students: SchoolContact[] = studentAgg.map((s) => ({
      email: s._id,
      name: [s.first, s.last].filter(Boolean).join(' ').trim() || undefined,
      role: 'Student',
      grade: s.grade,
      studentClass: s.cls,
    }));

    return { teachers, students };
  }
}
