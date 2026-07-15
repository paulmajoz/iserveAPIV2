import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Res,
} from '@nestjs/common';
import { IsArray, IsEmail, ArrayMinSize, IsOptional } from 'class-validator';
import { ApiTags, ApiQuery, ApiProperty } from '@nestjs/swagger';
import { Response } from 'express';
import { EventsService } from './events.service';
import { CreateEventDto } from './create-event.dto';
import { Event } from './event.schema';

class SendEmailDto {
  /** One or more recipient email addresses. */
  @ApiProperty({ type: [String], required: false })
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsEmail({}, { each: true })
  recipients?: string[];
}

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('by-person')
  @ApiQuery({ name: 'schoolId', required: true })
  @ApiQuery({ name: 'email', required: true })
  @ApiQuery({ name: 'role', required: false })
  findByPerson(
    @Query('schoolId') schoolId: string,
    @Query('email') email: string,
    @Query('role') role = 'Staff',
  ) {
    return this.service.findByPerson(schoolId, email, role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<Event>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/qr-pdf')
  @ApiQuery({ name: 'direction', enum: ['in', 'out'], required: false })
  async getQrPdf(
    @Param('id') id: string,
    @Query('direction') direction: 'in' | 'out' = 'in',
    @Res() res: Response,
  ) {
    const pdf = await this.service.getQrPdf(id, direction);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="event_qr_${direction}.pdf"`,
    });
    res.send(pdf);
  }

  @Post(':id/send-email')
  sendEmail(@Param('id') id: string, @Body() body: SendEmailDto = {}) {
    return this.service.sendEmail(id, body.recipients);
  }
}
