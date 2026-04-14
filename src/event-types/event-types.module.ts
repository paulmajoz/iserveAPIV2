import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventType, EventTypeSchema } from './event-type.schema';
import { EventTypesController } from './event-types.controller';
import { EventTypesService } from './event-types.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: EventType.name, schema: EventTypeSchema }])],
  controllers: [EventTypesController],
  providers: [EventTypesService],
  exports: [EventTypesService],
})
export class EventTypesModule {}
