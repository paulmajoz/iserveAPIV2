import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventDocument = Event & Document;

export type QrMode = 'in-out' | 'once-off';
export type HourMode = 'in-out' | 'fixed' | 'volume' | 'disabled';

@Schema({ collection: 'v2events', timestamps: true })
export class Event {
  @Prop({ required: true })
  eventName: string;

  @Prop({ required: true })
  school: string;

  @Prop({ required: true })
  teacher: string;

  @Prop({ required: true })
  teacherEmail: string;

  /** Legacy ObjectId refs — kept for backward compatibility with migrated V1 events */
  @Prop({ type: Types.ObjectId, ref: 'EventType', default: null })
  eventTypeId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'EventCategory', default: null })
  eventCategoryId: Types.ObjectId | null;

  /** School-defined department & category (plain strings sourced from schools.departments / categories) */
  @Prop({ type: String, default: '' })
  department: string;

  @Prop({ type: String, default: '' })
  category: string;

  @Prop({ enum: ['in-out', 'once-off'], default: 'once-off' })
  qrMode: QrMode;

  @Prop({ enum: ['in-out', 'fixed', 'volume', 'disabled'], default: 'in-out' })
  hourMode: HourMode;

  @Prop({ default: 1 })
  fixedHours: number;

  @Prop()
  volumeUnitName?: string;

  @Prop({ default: 1 })
  volumeConversion: number;

  /**
   * How points are calculated per attendance record.
   * disabled → 0 pts  |  fixed → pointsValue per scan
   * volume → unitAmount × pointsConversion
   * Legacy events may not have this field — fall back to pointsEnabled.
   */
  @Prop({ enum: ['disabled', 'in-out', 'fixed', 'volume'], default: 'disabled' })
  pointsMode: string;

  /** Points awarded per scan (fixed mode) */
  @Prop({ default: 0 })
  pointsValue: number;

  /** Points per unit (volume mode). Same unit as volumeUnitName. */
  @Prop({ default: 1 })
  pointsConversion: number;

  /** Derived / legacy — true when pointsMode !== 'disabled' */
  @Prop({ default: false })
  pointsEnabled: boolean;

  @Prop({
    type: Object,
    default: { hasGeolocate: false, hasDescription: false, hasReflection: false },
  })
  captureOptions: {
    hasGeolocate: boolean;
    hasDescription: boolean;
    hasReflection: boolean;
  };

  /**
   * Optional geofence target. Set when captureOptions.hasGeolocate is true and
   * the teacher has chosen a target on the map. The API computes the student's
   * distance from this point on submit and flags `withinPerimeter`.
   */
  @Prop({
    type: Object,
    default: null,
  })
  geoTarget?: {
    lat: number;
    lon: number;
    radiusMeters: number;
    label?: string;
  } | null;

  @Prop()
  qrCodeIn?: string;

  @Prop()
  qrCodeOut?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.index({ teacherEmail: 1 });
EventSchema.index({ school: 1 });
