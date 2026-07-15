import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

interface GenerateEventPdfOpts {
  eventName: string;
  eventType: string;
  direction: 'IN' | 'OUT' | 'SCAN';
  qrDataUrl: string;
  schoolName: string;
  primaryColor: string;
  /** Optional URL to the school's logo. Fetched at PDF render time. */
  schoolLogoUrl?: string;
}

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  async toDataUrl(text: string): Promise<string> {
    return QRCode.toDataURL(text, { width: 400, margin: 2 });
  }

  /**
   * Fetch an image URL and return a Buffer suitable for PDFKit's `doc.image()`.
   * Resolves to null on any error (network, non-image content, etc.) so the
   * caller can render the PDF without the logo rather than failing.
   */
  private async fetchImage(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const buf = Buffer.from(arr);
      // PDFKit only supports JPEG and PNG. Quick sniff so we don't break the
      // document if someone uploaded a webp / svg / gif.
      const isPng  = buf.length > 8  && buf[0] === 0x89 && buf[1] === 0x50;
      const isJpeg = buf.length > 3  && buf[0] === 0xff && buf[1] === 0xd8;
      if (!isPng && !isJpeg) {
        this.logger.warn(`School logo at ${url} is not PNG/JPEG — skipping.`);
        return null;
      }
      return buf;
    } catch (err) {
      this.logger.warn(`Failed to fetch school logo (${url}): ${(err as Error).message}`);
      return null;
    }
  }

  async generateEventPdf(opts: GenerateEventPdfOpts): Promise<Buffer> {
    // Try to fetch the logo BEFORE opening the PDF stream (we need it
    // synchronously when drawing the header).
    const logoBuf = opts.schoolLogoUrl ? await this.fetchImage(opts.schoolLogoUrl) : null;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primary = opts.primaryColor || '#2c698d';
      const pageW = doc.page.width;

      // Header band — taller when we have a logo so it has room to breathe
      const headerH = logoBuf ? 110 : 80;
      doc.rect(0, 0, pageW, headerH).fill(primary);

      if (logoBuf) {
        // Logo on the left, school name centred to its right.
        const logoBoxH = 72;
        const logoX = 32;
        const logoY = (headerH - logoBoxH) / 2;
        try {
          doc.image(logoBuf, logoX, logoY, { fit: [88, logoBoxH] });
        } catch (err) {
          this.logger.warn(`PDFKit rejected school logo: ${(err as Error).message}`);
        }
        doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
          .text(opts.schoolName, 48, (headerH - 22) / 2 - 2,
            { width: pageW - 96, align: 'center' });
      } else {
        doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
          .text(opts.schoolName, 48, (headerH - 22) / 2,
            { width: pageW - 96, align: 'center' });
      }

      // Event name (below header)
      const eventNameY = headerH + 22;
      doc.fillColor('#1a1a1a').fontSize(16).font('Helvetica-Bold')
        .text(opts.eventName, 48, eventNameY, { width: pageW - 96, align: 'center' });

      // Direction badge
      const badgeColor =
        opts.direction === 'IN' ? '#22c55e' :
        opts.direction === 'OUT' ? '#ef4444' : primary;
      const badgeLabel =
        opts.direction === 'IN' ? 'SIGN IN' :
        opts.direction === 'OUT' ? 'SIGN OUT' : 'SCAN TO ATTEND';

      const badgeY = eventNameY + 30;
      const badgeW = 160;
      const badgeX = (pageW - badgeW) / 2;
      doc.rect(badgeX, badgeY, badgeW, 32).fill(badgeColor);
      doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
        .text(badgeLabel, badgeX, badgeY + 8, { width: badgeW, align: 'center' });

      // QR code image
      const qrBase64 = opts.qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuf = Buffer.from(qrBase64, 'base64');
      const qrSize = 280;
      const qrX = (pageW - qrSize) / 2;
      const qrY = badgeY + 46;
      doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });

      // Footer
      doc.rect(0, doc.page.height - 40, pageW, 40).fill(primary);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica')
        .text('iServe — Attendance & Community Service Tracking', 48, doc.page.height - 26,
          { width: pageW - 96, align: 'center' });

      doc.end();
    });
  }
}
