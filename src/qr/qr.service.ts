import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

@Injectable()
export class QrService {
  async toDataUrl(text: string): Promise<string> {
    return QRCode.toDataURL(text, { width: 400, margin: 2 });
  }

  async generateEventPdf(opts: {
    eventName: string;
    eventType: string;
    direction: 'IN' | 'OUT' | 'SCAN';
    qrDataUrl: string;
    schoolName: string;
    primaryColor: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primary = opts.primaryColor || '#2c698d';
      const pageW = doc.page.width;

      // Header band
      doc.rect(0, 0, pageW, 80).fill(primary);
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
        .text(opts.schoolName, 48, 26, { width: pageW - 96, align: 'center' });

      // Event name
      doc.fillColor('#1a1a1a').fontSize(16).font('Helvetica-Bold')
        .text(opts.eventName, 48, 100, { width: pageW - 96, align: 'center' });

      // Direction badge
      const badgeColor =
        opts.direction === 'IN' ? '#22c55e' :
        opts.direction === 'OUT' ? '#ef4444' : primary;
      const badgeLabel =
        opts.direction === 'IN' ? 'SIGN IN' :
        opts.direction === 'OUT' ? 'SIGN OUT' : 'SCAN TO ATTEND';

      const badgeW = 160;
      const badgeX = (pageW - badgeW) / 2;
      doc.rect(badgeX, 128, badgeW, 32).fill(badgeColor);
      doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
        .text(badgeLabel, badgeX, 136, { width: badgeW, align: 'center' });

      // QR code image
      const qrBase64 = opts.qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuf = Buffer.from(qrBase64, 'base64');
      const qrSize = 280;
      const qrX = (pageW - qrSize) / 2;
      doc.image(qrBuf, qrX, 174, { width: qrSize, height: qrSize });

      // Footer
      doc.rect(0, doc.page.height - 40, pageW, 40).fill(primary);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica')
        .text('iServe — Attendance & Community Service Tracking', 48, doc.page.height - 26,
          { width: pageW - 96, align: 'center' });

      doc.end();
    });
  }
}
