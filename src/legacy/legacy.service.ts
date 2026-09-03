import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LegacyEvent, LegacyEventDocument } from './schemas/legacy-event.schema';
import { LegacyAttendance, LegacyAttendanceDocument } from './schemas/legacy-attendance.schema';
import { LegacySubmitAttendanceDto } from './dto/legacy-submit-attendance.dto';

/**
 * Reads/writes the V1 `events`/`attendances` collections directly — same
 * physical MongoDB the old iserveAPI already uses, just a second doorway
 * into it. The old codebase is never touched or called.
 *
 * `submitAttendance` is a byte-for-byte port of V1's own
 * commServeAttendance/attendance.service.ts submitAttendance() — same
 * same-day dedup window, same two branches, same error messages.
 */
@Injectable()
export class LegacyService {
  constructor(
    @InjectModel(LegacyEvent.name) private readonly eventModel: Model<LegacyEventDocument>,
    @InjectModel(LegacyAttendance.name) private readonly attendanceModel: Model<LegacyAttendanceDocument>,
  ) {}

  async getEventById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`"${id}" is not a valid event ID`);
    }
    const event = await this.eventModel.findById(id).lean().exec();
    if (!event) {
      throw new NotFoundException(`Legacy event ${id} not found`);
    }
    return { ...event, id: (event._id as Types.ObjectId).toString(), legacy: true as const };
  }

  async submitAttendance(dto: LegacySubmitAttendanceDto) {
    const {
      eventId,
      studentEmail,
      studentFirstName,
      studentLastName,
      direction,
      unitAmount,
      locationIn,
      locationOut,
      eventType,
      description,
      reflection,
    } = dto;

    const { start, end } = getStartAndEndOfDay(new Date());

    if (direction === 'in') {
      const exists = await this.attendanceModel.findOne({
        eventId,
        studentEmail,
        timeIn: { $gte: start, $lte: end },
      });
      if (exists) throw new BadRequestException('Already signed in today.');

      return this.attendanceModel.create({
        eventId,
        studentEmail,
        studentFirstName,
        studentLastName,
        timeIn: new Date(),
        locationIn,
        eventType,
      });
    }

    // direction === 'out'
    if (eventType === 'VOLUME' && unitAmount == null) {
      throw new BadRequestException('unitAmount required for VOLUME events');
    }

    const record = await this.attendanceModel.findOne({
      eventId,
      studentEmail,
      timeIn: { $gte: start, $lte: end },
      timeOut: { $exists: false },
    });
    if (!record) throw new NotFoundException('No check-in record found for today.');

    record.timeOut = new Date();
    record.locationOut = locationOut ?? record.locationOut;
    record.unitAmount = unitAmount ?? record.unitAmount;
    record.eventType = eventType ?? record.eventType;
    record.description = description ?? record.description;
    record.reflection = reflection ?? record.reflection;
    record.studentFirstName = record.studentFirstName ?? studentFirstName;
    record.studentLastName = record.studentLastName ?? studentLastName;

    return record.save();
  }
}

function getStartAndEndOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
