import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { SubmitAttendanceDto } from './submit-attendance.dto';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('submit')
  submit(@Body() dto: SubmitAttendanceDto) {
    return this.service.submit(dto, 'self');
  }

  @Post('scan')
  assistedScan(@Body() dto: SubmitAttendanceDto) {
    return this.service.submit(dto, 'assisted');
  }

  @Get('event/:eventId')
  getByEvent(@Param('eventId') eventId: string) {
    return this.service.getByEvent(eventId);
  }

  @Get('student/:email')
  getByStudent(@Param('email') email: string) {
    return this.service.getByStudent(email);
  }

  @Get('summary/:email')
  @ApiQuery({ name: 'schoolId', required: false })
  getSummary(@Param('email') email: string, @Query('schoolId') schoolId?: string) {
    return this.service.getSummary(email, schoolId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
