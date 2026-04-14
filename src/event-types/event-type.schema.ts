import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventTypeDocument = EventType & Document;

@Schema({ collection: 'eventtypes', timestamps: true })
export class EventType {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, default: null })
  schoolId: string | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const EventTypeSchema = SchemaFactory.createForClass(EventType);
EventTypeSchema.index({ schoolId: 1, isActive: 1 });
