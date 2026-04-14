import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventType, EventTypeDocument } from './event-type.schema';

@Injectable()
export class EventTypesService {
  constructor(@InjectModel(EventType.name) private model: Model<EventTypeDocument>) {}

  create(dto: Partial<EventType>) {
    return this.model.create(dto);
  }

  findAll(schoolId?: string) {
    const filter: any = { isActive: true };
    if (schoolId) filter.$or = [{ schoolId }, { schoolId: null }];
    return this.model.find(filter).exec();
  }

  findById(id: string) {
    return this.model.findById(id).exec();
  }

  update(id: string, dto: Partial<EventType>) {
    return this.model.findByIdAndUpdate(id, dto, { new: true }).exec();
  }

  remove(id: string) {
    return this.model.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }
}
