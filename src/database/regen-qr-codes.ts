/**
 * ═══════════════════════════════════════════════════════════════
 *  iServe  —  QR Code Regeneration Script
 *
 *  Re-generates qrCodeIn / qrCodeOut data-URL images for every
 *  event in v2events that is missing them (migrated V1 events
 *  typically had no stored QR images — they were only emailed).
 *
 *  URL format written:
 *    {PUBLIC_UI_BASE_URL}/submit/{eventId}?direction=in
 *    {PUBLIC_UI_BASE_URL}/submit/{eventId}?direction=out
 *
 *  Usage:
 *    npm run regen-qr
 *
 *  Dry-run (inspect only, nothing written):
 *    DRY_RUN=true npm run regen-qr
 *
 *  SAFE TO RE-RUN — only events where qrCodeIn is null/missing
 *  are touched; events that already have QR images are skipped.
 * ═══════════════════════════════════════════════════════════════
 */

import mongoose, { Schema } from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as QRCode from 'qrcode';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/iserveza';
const BASE_URL  = process.env.PUBLIC_UI_BASE_URL ?? 'https://iserve.royalh.co.za';
const DRY_RUN   = process.env.DRY_RUN === 'true';

const EventSchema = new Schema({}, { strict: false, collection: 'v2events' });

async function generateQr(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
  });
}

async function regenQrCodes() {
  console.log('\n' + '═'.repeat(60));
  console.log('  iServe — QR Code Regeneration');
  if (DRY_RUN) console.log('  ⚠️   DRY RUN — nothing will be written');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log('═'.repeat(60));

  console.log('\n📡  Connecting to DB…');
  const conn = await mongoose.createConnection(MONGO_URI).asPromise();
  console.log('    ✔ Connected');

  const EventModel = conn.model('Event', EventSchema);

  // Only fetch events that are missing qrCodeIn
  const events = await EventModel.find({
    $or: [
      { qrCodeIn: null },
      { qrCodeIn: { $exists: false } },
    ],
  }).lean() as any[];

  const total = await EventModel.countDocuments();
  console.log(`\n📊  Total events: ${total}  |  Missing QR codes: ${events.length}`);

  if (events.length === 0) {
    console.log('\n✅  All events already have QR codes — nothing to do.');
    await conn.close();
    return;
  }

  let updated = 0;

  for (const ev of events) {
    const id     = ev._id.toString();
    const qrMode = ev.qrMode ?? 'once-off';

    const inUrl  = `${BASE_URL}/submit/${id}?direction=in`;
    const outUrl = qrMode === 'in-out' ? `${BASE_URL}/submit/${id}?direction=out` : null;

    if (!DRY_RUN) {
      const newQrIn  = await generateQr(inUrl);
      const newQrOut = outUrl ? await generateQr(outUrl) : undefined;

      const update: any = { qrCodeIn: newQrIn };
      if (newQrOut) update.qrCodeOut = newQrOut;

      await EventModel.updateOne({ _id: ev._id }, { $set: update });
    }

    updated++;
    if (updated % 10 === 0) process.stdout.write('.');
  }

  console.log(`\n\n    ✔ ${DRY_RUN ? 'Would update' : 'Updated'}: ${updated} events`);

  console.log('\n' + '═'.repeat(60));
  if (DRY_RUN) {
    console.log('  DRY RUN COMPLETE — no data was written.');
    console.log('  Remove DRY_RUN=true to regenerate the QR codes.');
  } else {
    console.log('  ✅  QR regeneration complete!');
    console.log(`  ${updated} events now have fresh V2-format QR codes.`);
    console.log(`  URL format: ${BASE_URL}/submit/:id?direction=in`);
    console.log('  ℹ️   Old printed QR codes still work via the /Submit-Attendance/ route alias.');
  }
  console.log('═'.repeat(60) + '\n');

  await conn.close();
}

regenQrCodes().catch(err => {
  console.error('\n❌  QR regeneration failed:', err.message ?? err);
  process.exit(1);
});
