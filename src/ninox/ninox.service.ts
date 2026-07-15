import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { EventDocument } from '../events/event.schema';
import { AttendanceDocument } from '../attendance/attendance.schema';

@Injectable()
export class NinoxService {
  private readonly logger = new Logger(NinoxService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    const teamId = this.config.get<string>('ninoxTeamId');
    const databaseId = this.config.get<string>('ninoxDatabaseId');
    this.apiKey = this.config.get<string>('ninoxApiKey') ?? '';
    this.baseUrl = `https://api.ninox.com/v1/teams/${teamId}/databases/${databaseId}/tables`;
  }

  async syncEvent(event: EventDocument): Promise<void> {
    try {
      const captureOptions: Record<string, any> = (event as any).captureOptions ?? {};
      const fields: Record<string, any> = {
        A: (event as any)._id.toString(),
        B: event.eventName,
        C: Number(event.school),
        D: event.teacher,
        E: event.teacherEmail,
        F: event.eventTypeId?.toString() ?? '',
        G: event.eventCategoryId?.toString() ?? '',
        H: (event as any).department ?? '',
        I: (event as any).category ?? '',
        J: event.qrMode,
        M: event.hourMode,
        N: event.fixedHours,
        O: event.volumeConversion,
        P: (event as any).pointsMode ?? '',
        Q: (event as any).pointsConversion ?? 0,
        R: String(event.pointsEnabled ?? false),
        S: String(captureOptions.hasDescription ?? false),
        V: (event as any).pointsValue ?? 0,
        W: String(captureOptions.hasReflection ?? false),
        X: String(captureOptions.hasGeolocate ?? false),
        Y: (event as any).geoTarget ? JSON.stringify((event as any).geoTarget) : '',
        Z: event.qrCodeIn ?? '',
        A1: String((event as any).isActive ?? true),
        B1: (event as any).createdAt,
        C1: (event as any).updatedAt,
        D1: event.qrCodeOut ?? '',
      };

      await this.post('G', fields);
      this.logger.log(`Synced event ${fields.A} to Ninox`);
    } catch (err) {
      this.logger.error(`Failed to sync event to Ninox: ${(err as Error).message}`);
    }
  }

  async syncAttendance(record: AttendanceDocument): Promise<void> {
    try {
      const fields: Record<string, any> = {
        // ── Core identifiers ──────────────────────────────────────────────
        A:  record.eventId.toString(),
        B:  (record as any)._id.toString(),
        // ── Student identity ──────────────────────────────────────────────
        C:  record.studentFirstName,
        D:  record.studentEmail,
        E:  record.studentLastName,
        F:  record.studentGrade,
        G:  record.studentClass,
        P:  record.studentId,
        L1: (record as any).studentHouse,
        M1: (record as any).studentTutor,
        N1: (record as any).customField1,
        O1: (record as any).customField2,
        P1: (record as any).customField3,
        // ── School ───────────────────────────────────────────────────────
        H:  record.schoolId ? Number(record.schoolId) : undefined,
        // ── Timing ───────────────────────────────────────────────────────
        I:  record.timeIn,
        J:  record.timeOut,
        R:  (record as any).scannedAt,
        S:  (record as any).createdAt,
        T:  (record as any).updatedAt,
        // ── Outcomes ─────────────────────────────────────────────────────
        Q:  record.hours,
        L:  record.pointsAwarded,
        // ── Metadata ─────────────────────────────────────────────────────
        M:  record.source,
        W:  record.teacherEmail,
        // ── Capture fields ────────────────────────────────────────────────
        N:  record.description,
        O:  record.reflection,
        // ── Geolocation ───────────────────────────────────────────────────
        X:  record.locationIn,
        Y:  record.locationOut,
        U:  record.distanceMeters,
        V:  String(record.withinPerimeter ?? ''),
      };

      await this.post('H', fields);
      this.logger.log(`Synced attendance ${fields.B} to Ninox`);
    } catch (err) {
      this.logger.error(`Failed to sync attendance to Ninox: ${(err as Error).message}`);
    }
  }

  private post(tableId: string, fields: Record<string, any>): Promise<void> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify([{ fields }]);
      const path = `/v1/teams/${this.config.get('ninoxTeamId')}/databases/${this.config.get('ninoxDatabaseId')}/tables/${tableId}/records`;

      const req = https.request(
        {
          hostname: 'api.ninox.com',
          path,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`Ninox API ${res.statusCode}: ${data}`));
            }
          });
        },
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
