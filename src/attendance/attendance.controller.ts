import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { SubmitAttendanceDto } from './submit-attendance.dto';
import { ManualAttendanceDto } from './manual-attendance.dto';
import { UpdateAttendanceDto } from './update-attendance.dto';

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

  /** Teacher manually entering a complete attendance record. */
  @Post('manual')
  manual(@Body() dto: ManualAttendanceDto) {
    return this.service.createManual(dto);
  }

  @Get('state')
  @ApiQuery({ name: 'eventId', required: true })
  @ApiQuery({ name: 'email', required: true })
  getState(@Query('eventId') eventId: string, @Query('email') email: string) {
    return this.service.getState(eventId, email);
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

  /** Teacher updating an existing attendance record. */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
