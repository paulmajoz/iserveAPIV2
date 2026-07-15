import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './event.schema';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { QrModule } from '../qr/qr.module';
import { EmailModule } from '../email/email.module';
import { EventTypesModule } from '../event-types/event-types.module';
import { EventCategoriesModule } from '../event-categories/event-categories.module';
import { SchoolsModule } from '../schools/schools.module';
import { NinoxModule } from '../ninox/ninox.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    QrModule,
    EmailModule,
    EventTypesModule,
    EventCategoriesModule,
    SchoolsModule,
    NinoxModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
