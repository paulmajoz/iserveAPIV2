import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { School } from './school.schema';

@ApiTags('Schools')
@Controller('schools')
export class SchoolsController {
  constructor(private readonly service: SchoolsService) {}

  @Post()
  create(@Body() dto: Partial<School>) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('id/:schoolId')
  findOne(@Param('schoolId') schoolId: string) {
    return this.service.findBySchoolId(+schoolId);
  }

  @Get('id/:schoolId/theme')
  getTheme(@Param('schoolId') schoolId: string) {
    return this.service.getTheme(+schoolId);
  }

  @Patch('id/:schoolId')
  update(@Param('schoolId') schoolId: string, @Body() dto: Partial<School>) {
    return this.service.update(+schoolId, dto);
  }
}
