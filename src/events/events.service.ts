import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from './event.schema';
import { CreateEventDto } from './create-event.dto';
import { QrService } from '../qr/qr.service';
import { EmailService } from '../email/email.service';
import { EventTypesService } from '../event-types/event-types.service';
import { EventCategoriesService } from '../event-categories/event-categories.service';
import { SchoolsService } from '../schools/schools.service';
import { NinoxService } from '../ninox/ninox.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private model: Model<EventDocument>,
    private readonly qr: QrService,
    private readonly email: EmailService,
    private readonly eventTypes: EventTypesService,
    private readonly eventCategories: EventCategoriesService,
    private readonly schools: SchoolsService,
    private readonly config: ConfigService,
    private readonly ninox: NinoxService,
  ) {}

  async create(dto: CreateEventDto): Promise<EventDocument> {
    const base = this.config.get<string>('publicUiBaseUrl') ?? 'https://iserve.royalh.co.za';

    const event = await this.model.create({
      ...dto,
      eventTypeId: dto.eventTypeId ? new Types.ObjectId(dto.eventTypeId) : null,
      eventCategoryId: dto.eventCategoryId ? new Types.ObjectId(dto.eventCategoryId) : null,
    });

    const eventId = (event as any)._id.toString();
    const qrInUrl = `${base}/submit/${eventId}?direction=in`;
    const qrOutUrl = dto.qrMode === 'in-out' ? `${base}/submit/${eventId}?direction=out` : undefined;

    event.qrCodeIn = await this.qr.toDataUrl(qrInUrl);
    if (qrOutUrl) event.qrCodeOut = await this.qr.toDataUrl(qrOutUrl);
    await event.save();

    // Fire-and-forget: sync to Ninox and send email without blocking response
    this.ninox.syncEvent(event).catch(() => {});
    this.sendEventEmail(event, qrInUrl, qrOutUrl).catch(() => {});

    return event;
  }

  private async sendEventEmail(
    event: EventDocument,
    qrInUrl: string,
    qrOutUrl?: string,
    recipients?: string[],
  ) {
    let eventTypeName = 'General';
    let eventCategoryName = 'General';
    let primaryColor = '#2c698d';
    let schoolName = event.school;
    let schoolLogoUrl: string | undefined;

    try {
      if (event.eventTypeId) {
        const et = await this.eventTypes.findById(event.eventTypeId.toString());
        if (et) eventTypeName = et.name;
      }
      if (event.eventCategoryId) {
        const ec = await this.eventCategories.findById(event.eventCategoryId.toString());
        if (ec) eventCategoryName = ec.name;
      }
      const school = await this.schools.findBySchoolId(+event.school).catch(() => null);
      if (school) {
        primaryColor = school.themeColors?.primary ?? primaryColor;
        schoolName = school.name;
        schoolLogoUrl = school.logoPath || undefined;
      }
    } catch {}

    // Default to the event teacher when no explicit recipients were provided.
    const to = (recipients && recipients.length > 0)
      ? recipients
      : [event.teacherEmail];

    await this.email.sendEventEmail({
      recipients: to,
      teacherName: event.teacher,
      eventName: event.eventName,
      eventType: eventTypeName,
      eventCategory: eventCategoryName,
      schoolName,
      schoolLogoUrl,
      primaryColor,
      qrMode: event.qrMode,
      qrCodeInUrl: qrInUrl,
      qrCodeOutUrl: qrOutUrl,
      pointsEnabled: event.pointsEnabled,
      pointsValue: event.pointsValue,
      hourMode: event.hourMode,
    });
  }

  findAll() {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<EventDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`"${id}" is not a valid event ID`);
    }
    const event = await this.model.findById(id).exec();
    if (!event) throw new NotFoundException(`Event ${id} not found`);
    return event;
  }

  findByPerson(schoolId: string, email: string, role: string) {
    const filter: any = {};
    const normRole = (role ?? '').toLowerCase();

    if (normRole === 'serviceadmin') {
      // Service admins see every event at the school they're viewing.
      // (No teacher restriction — they're an admin for the whole school.)
      if (schoolId) filter.school = String(schoolId);
    } else if (normRole === 'staff') {
      // Teachers only see events they personally created.
      filter.teacherEmail = new RegExp(`^${email}$`, 'i');
    } else {
      // Student or unknown role — scope to the school so they only see
      // events that belong to their school.
      filter.school = String(schoolId);
    }
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }

  async update(id: string, dto: Partial<Event>): Promise<EventDocument> {
    const event = await this.model.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!event) throw new NotFoundException(`Event ${id} not found`);
    return event;
  }

  async remove(id: string) {
    await this.model.findByIdAndDelete(id).exec();
    return { deleted: true };
  }

  async getQrPdf(id: string, direction: 'in' | 'out'): Promise<Buffer> {
    const event = await this.findById(id);
    const base = this.config.get<string>('publicUiBaseUrl') ?? 'https://iserve.royalh.co.za';
    const url = `${base}/submit/${id}?direction=${direction}`;
    const dataUrl = await this.qr.toDataUrl(url);

    const school = await this.schools.findBySchoolId(+event.school).catch(() => null);
    const primaryColor = school?.themeColors?.primary ?? '#2c698d';
    const schoolName = school?.name ?? event.school;
    const schoolLogoUrl = school?.logoPath || undefined;

    return this.qr.generateEventPdf({
      eventName: event.eventName,
      eventType: event.hourMode,
      direction: direction === 'in' ? (event.qrMode === 'once-off' ? 'SCAN' : 'IN') : 'OUT',
      qrDataUrl: dataUrl,
      schoolName,
      schoolLogoUrl,
      primaryColor,
    });
  }

  /**
   * Email the event's QR codes.
   * @param recipients Optional list. Falls back to the event teacher.
   */
  async sendEmail(id: string, recipients?: string[]) {
    const event = await this.findById(id);
    const base = this.config.get<string>('publicUiBaseUrl') ?? 'https://iserve.royalh.co.za';
    const qrInUrl = `${base}/submit/${id}?direction=in`;
    const qrOutUrl = event.qrMode === 'in-out' ? `${base}/submit/${id}?direction=out` : undefined;
    await this.sendEventEmail(event, qrInUrl, qrOutUrl, recipients);
    return { sent: true, recipients: recipients && recipients.length ? recipients : [event.teacherEmail] };
  }
}
