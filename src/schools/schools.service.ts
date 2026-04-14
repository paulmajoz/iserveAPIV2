import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School, SchoolDocument } from './school.schema';

@Injectable()
export class SchoolsService {
  constructor(@InjectModel(School.name) private model: Model<SchoolDocument>) {}

  create(dto: Partial<School>) {
    return this.model.create(dto);
  }

  findAll() {
    return this.model.find().exec();
  }

  async findBySchoolId(schoolId: number) {
    const school = await this.model.findOne({ schoolId }).exec();
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);
    return school;
  }

  async getTheme(schoolId: number) {
    const school = await this.findBySchoolId(schoolId);
    return school.themeColors;
  }

  async update(schoolId: number, dto: Partial<School>) {
    const school = await this.model.findOneAndUpdate({ schoolId }, dto, { new: true }).exec();
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);
    return school;
  }
}
