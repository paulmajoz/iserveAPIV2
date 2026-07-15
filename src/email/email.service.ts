import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { QrService } from '../qr/qr.service';

interface EventEmailOptions {
  /** Recipients of the email. Must be non-empty. */
  recipients: string[];
  teacherName: string;
  eventName: string;
  eventType: string;
  eventCategory: string;
  schoolName: string;
  /** Optional URL — embedded in PDF + email header when set. */
  schoolLogoUrl?: string;
  primaryColor: string;
  qrMode: 'in-out' | 'once-off';
  qrCodeInUrl: string;
  qrCodeOutUrl?: string;
  pointsEnabled: boolean;
  pointsValue: number;
  hourMode: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly qr: QrService,
  ) {}

  async sendEventEmail(opts: EventEmailOptions): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.config.get('smtp.host'),
      port: this.config.get<number>('smtp.port'),
      secure: true,
      auth: {
        user: this.config.get('smtp.user'),
        pass: this.config.get('smtp.pass'),
      },
    });

    const inDataUrl = await this.qr.toDataUrl(opts.qrCodeInUrl);
    const inPdf = await this.qr.generateEventPdf({
      eventName: opts.eventName,
      eventType: opts.eventType,
      direction: opts.qrMode === 'once-off' ? 'SCAN' : 'IN',
      qrDataUrl: inDataUrl,
      schoolName: opts.schoolName,
      schoolLogoUrl: opts.schoolLogoUrl,
      primaryColor: opts.primaryColor,
    });

    const attachments: Attachment[] = [
      {
        filename: `${opts.eventName.replace(/\s+/g, '_')}_QR_IN.pdf`,
        content: inPdf,
        contentType: 'application/pdf',
      },
    ];

    let outPdf: Buffer | undefined;
    if (opts.qrMode === 'in-out' && opts.qrCodeOutUrl) {
      const outDataUrl = await this.qr.toDataUrl(opts.qrCodeOutUrl);
      outPdf = await this.qr.generateEventPdf({
        eventName: opts.eventName,
        eventType: opts.eventType,
        direction: 'OUT',
        qrDataUrl: outDataUrl,
        schoolName: opts.schoolName,
        schoolLogoUrl: opts.schoolLogoUrl,
        primaryColor: opts.primaryColor,
      });
      attachments.push({
        filename: `${opts.eventName.replace(/\s+/g, '_')}_QR_OUT.pdf`,
        content: outPdf,
        contentType: 'application/pdf',
      });
    }

    const html = this.buildEmailHtml(opts, inDataUrl, outPdf ? await this.qr.toDataUrl(opts.qrCodeOutUrl!) : undefined);

    const recipientList = (opts.recipients ?? [])
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    if (recipientList.length === 0) {
      throw new Error('No recipients supplied for event email');
    }

    const mailOptions = {
      from: `"iServe" <${this.config.get('smtp.user')}>`,
      to: recipientList.join(', '),
      subject: `iServe Event: ${opts.eventName}`,
      html,
      attachments,
    };

    try {
      await transporter.sendMail(mailOptions);
      this.logger.log(`Event email sent to ${recipientList.join(', ')}`);
    } catch (err) {
      this.logger.error('Failed to send event email', err);
      throw err;
    }
  }

  private buildEmailHtml(opts: EventEmailOptions, inDataUrl: string, outDataUrl?: string): string {
    const primary = opts.primaryColor || '#2c698d';
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:${primary};padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">${opts.schoolName}</h1>
      <p style="color:#fff;margin:8px 0 0;opacity:0.85;">New Event Created</p>
    </div>
    <div style="padding:24px;">
      <h2 style="color:#1a1a1a;">${opts.eventName}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;color:#666;">Type</td><td style="color:#1a1a1a;">${opts.eventType}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Category</td><td style="color:#1a1a1a;">${opts.eventCategory}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">QR Mode</td><td style="color:#1a1a1a;">${opts.qrMode}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Hours</td><td style="color:#1a1a1a;">${opts.hourMode}</td></tr>
        ${opts.pointsEnabled ? `<tr><td style="padding:6px 0;color:#666;">Points</td><td style="color:#1a1a1a;">${opts.pointsValue} per scan</td></tr>` : ''}
      </table>
      <p style="color:#555;">QR code PDFs are attached. Please print or share them with students.</p>
      <div style="display:flex;gap:16px;margin-top:20px;">
        <div style="text-align:center;">
          <p style="margin:0 0 8px;font-weight:bold;color:${primary};">${opts.qrMode === 'once-off' ? 'SCAN TO ATTEND' : 'SIGN IN'}</p>
          <img src="${inDataUrl}" width="180" style="border:1px solid #eee;border-radius:4px;"/>
        </div>
        ${outDataUrl ? `
        <div style="text-align:center;">
          <p style="margin:0 0 8px;font-weight:bold;color:#ef4444;">SIGN OUT</p>
          <img src="${outDataUrl}" width="180" style="border:1px solid #eee;border-radius:4px;"/>
        </div>` : ''}
      </div>
    </div>
    <div style="background:#f4f4f4;padding:16px;text-align:center;">
      <p style="margin:0;color:#999;font-size:12px;">iServe — Attendance &amp; Community Service Tracking</p>
    </div>
  </div>
</body>
</html>`;
  }
}
