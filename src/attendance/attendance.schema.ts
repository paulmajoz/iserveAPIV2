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
  @Prop() studentHouse?: string;
  @Prop() studentTutor?: string;
  @Prop() customField1?: string;
  @Prop() customField2?: string;
  @Prop() customField3?: string;
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

  /** Distance (in metres) from event.geoTarget at scan time. Null when not measured. */
  @Prop({ type: Number, default: null }) distanceMeters?: number | null;
  /** True when the captured location was within event.geoTarget.radiusMeters. */
  @Prop({ type: Boolean, default: null }) withinPerimeter?: boolean | null;
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
