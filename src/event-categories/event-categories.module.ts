import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventCategory, EventCategorySchema } from './event-category.schema';
import { EventCategoriesController } from './event-categories.controller';
import { EventCategoriesService } from './event-categories.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: EventCategory.name, schema: EventCategorySchema }])],
  controllers: [EventCategoriesController],
  providers: [EventCategoriesService],
  exports: [EventCategoriesService],
})
export class EventCategoriesModule {}
