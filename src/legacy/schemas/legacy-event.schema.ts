import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Mirrors the V1 `Event` schema (iserveAPI, branch `enviro`,
 * src/commServe/events/schemas/event.schema.ts) — same collection, same
 * fields. Read-only mirror: this app never modifies the V1 codebase, it
 * just knows how to read/write the collection V1 already owns.
 */
export type LegacyEventDocument = LegacyEvent & Document;

@Schema({ collection: 'events', timestamps: true })
export class LegacyEvent {
  @Prop({ required: true }) eventName: string;

  @Prop({ required: true, enum: ['IN/OUT', 'VOLUME', 'IN ONLY'] })
  eventType: 'IN/OUT' | 'VOLUME' | 'IN ONLY';

  @Prop({ required: true, enum: ['Environmental', 'In Kind', 'In Person', 'In Service'] })
  eventCategory: string;

  @Prop({ default: false }) hasGeolocate: boolean;
  @Prop({ default: false }) hasDescription: boolean;
  @Prop({ default: false }) hasReflection: boolean;

  @Prop() customUnitName?: string;
  @Prop() unitToHourConversion?: number;

  @Prop({ required: true }) teacher: string;
  @Prop({ required: true }) teacherEmail: string;
  @Prop({ required: true }) school: string;

  @Prop({ default: 0 }) totalStudents?: number;
  @Prop({ default: 0 }) totalComplete?: number;

  @Prop() qrCodeIn?: string;
  @Prop() qrCodeOut?: string;
}

export const LegacyEventSchema = SchemaFactory.createForClass(LegacyEvent);
