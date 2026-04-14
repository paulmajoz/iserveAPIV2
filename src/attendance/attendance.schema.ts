import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AttendanceDocument = Attendance & Document;

@Schema({ collection: 'v2attendance', timestamps: true })
export class Attendance {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  eventId: Types.ObjectId;

  @Prop({ required: true })
  studentEmail: string;

  @Prop() studentFirstName?: string;
  @Prop() studentLastName?: string;
  @Prop() studentId?: string;
  @Prop() studentGrade?: string;
  @Prop() studentClass?: string;
  @Prop() schoolId?: string;

  @Prop({ default: Date.now })
  timeIn: Date;

  @Prop()
  timeOut?: Date;

  @Prop({ type: Number, default: null })
  hours: number | null;

  @Prop({ enum: ['self', 'assisted'], required: true })
  source: 'self' | 'assisted';

  @Prop() locationIn?: string;
  @Prop() locationOut?: string;
  @Prop() description?: string;
  @Prop() reflection?: string;
  @Prop() unitAmount?: number;

  @Prop({ default: 0 })
  pointsAwarded: number;

  @Prop() teacherEmail?: string;

  @Prop({ default: Date.now })
  scannedAt: Date;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ eventId: 1, studentEmail: 1, scannedAt: 1 });
AttendanceSchema.index({ studentEmail: 1, scannedAt: 1 });
