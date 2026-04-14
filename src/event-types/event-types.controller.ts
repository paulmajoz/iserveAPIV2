import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventTypesService } from './event-types.service';
import { EventType } from './event-type.schema';

@ApiTags('Event Types')
@Controller('event-types')
export class EventTypesController {
  constructor(private readonly service: EventTypesService) {}

  @Post()
  create(@Body() dto: Partial<EventType>) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('schoolId') schoolId?: string) {
    return this.service.findAll(schoolId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<EventType>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
