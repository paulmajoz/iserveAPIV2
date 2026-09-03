import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LegacyService } from './legacy.service';
import { LegacySubmitAttendanceDto } from './dto/legacy-submit-attendance.dto';

@ApiTags('Legacy (V1 events/attendances)')
@Controller('legacy')
export class LegacyController {
  constructor(private readonly service: LegacyService) {}

  @Get('events/:id')
  getEvent(@Param('id') id: string) {
    return this.service.getEventById(id);
  }

  @Post('attendance/submit')
  submit(@Body() dto: LegacySubmitAttendanceDto) {
    return this.service.submitAttendance(dto);
  }
}
