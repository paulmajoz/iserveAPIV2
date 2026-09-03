import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Mirrors the V1 `Attendance` schema (iserveAPI, branch `enviro`,
 * src/commServe/commServeAttendance/schemas/attendance.schema.ts) — same
 * collection, same fields. No points, no geofencing — those never existed
 * in V1; `hours` is never computed at write time there either (only
 * derived at read time), so we don't compute it here either.
 */
export type LegacyAttendanceDocument = LegacyAttendance & Document;

@Schema({ collection: 'attendances', timestamps: true })
export class LegacyAttendance {
  @Prop({ type: Types.ObjectId, ref: 'LegacyEvent', required: true })
  eventId: Types.ObjectId;

  @Prop({ required: true }) studentEmail: string;
  @Prop() studentFirstName?: string;
  @Prop() studentLastName?: string;

  @Prop({ default: Date.now }) timeIn: Date;
  @Prop() timeOut?: Date;

  @Prop() locationIn?: string;
  @Prop() locationOut?: string;

  @Prop() unitAmount?: number;
  @Prop() eventType?: string;
  @Prop() description?: string;
  @Prop() reflection?: string;

  @Prop({ type: Number, required: false, default: null })
  hours?: number | null;
}

export const LegacyAttendanceSchema = SchemaFactory.createForClass(LegacyAttendance);
