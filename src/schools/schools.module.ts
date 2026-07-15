import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { School, SchoolSchema } from './school.schema';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { Event, EventSchema } from '../events/event.schema';
import { Attendance, AttendanceSchema } from '../attendance/attendance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      // Event + Attendance models are needed for the /contacts endpoint
      // (distinct teacher emails from events, student emails from attendance).
      { name: Event.name, schema: EventSchema },
      { name: Attendance.name, schema: AttendanceSchema },
    ]),
  ],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
