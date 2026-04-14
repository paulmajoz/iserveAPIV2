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

  @Prop({ type: Types.ObjectId, ref: 'EventType', default: null })
  eventTypeId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'EventCategory', default: null })
  eventCategoryId: Types.ObjectId | null;

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

  @Prop({ default: false })
  pointsEnabled: boolean;

  @Prop({ default: 0 })
  pointsValue: number;

  @Prop({
    type: Object,
    default: { hasGeolocate: false, hasDescription: false, hasReflection: false },
  })
  captureOptions: {
    hasGeolocate: boolean;
    hasDescription: boolean;
    hasReflection: boolean;
  };

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
