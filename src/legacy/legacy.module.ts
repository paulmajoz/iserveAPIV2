import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LegacyController } from './legacy.controller';
import { LegacyService } from './legacy.service';
import { LegacyEvent, LegacyEventSchema } from './schemas/legacy-event.schema';
import { LegacyAttendance, LegacyAttendanceSchema } from './schemas/legacy-attendance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LegacyEvent.name, schema: LegacyEventSchema },
      { name: LegacyAttendance.name, schema: LegacyAttendanceSchema },
    ]),
  ],
  controllers: [LegacyController],
  providers: [LegacyService],
})
export class LegacyModule {}
