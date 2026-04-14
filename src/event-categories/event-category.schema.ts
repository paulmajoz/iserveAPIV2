import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventCategoryDocument = EventCategory & Document;

@Schema({ collection: 'eventcategories', timestamps: true })
export class EventCategory {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, default: null })
  schoolId: string | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const EventCategorySchema = SchemaFactory.createForClass(EventCategory);
EventCategorySchema.index({ schoolId: 1, isActive: 1 });
