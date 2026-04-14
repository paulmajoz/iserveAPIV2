import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Attendance, AttendanceSchema } from './attendance.schema';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { EventsModule } from '../events/events.module';
import { EventTypesModule } from '../event-types/event-types.module';
import { EventCategoriesModule } from '../event-categories/event-categories.module';
import { SchoolsModule } from '../schools/schools.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Attendance.name, schema: AttendanceSchema }]),
    EventsModule,
    EventTypesModule,
    EventCategoriesModule,
    SchoolsModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
