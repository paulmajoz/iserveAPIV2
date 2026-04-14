import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventCategoriesService } from './event-categories.service';
import { EventCategory } from './event-category.schema';

@ApiTags('Event Categories')
@Controller('event-categories')
export class EventCategoriesController {
  constructor(private readonly service: EventCategoriesService) {}

  @Post()
  create(@Body() dto: Partial<EventCategory>) {
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
  update(@Param('id') id: string, @Body() dto: Partial<EventCategory>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
