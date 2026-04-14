import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { School, SchoolSchema } from './school.schema';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: School.name, schema: SchoolSchema }])],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
