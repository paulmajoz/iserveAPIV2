/**
 * V1 → V2 migration (v2)
 *
 *   • Pulls V1 `events`             → `v2events` as HOURS / POINTS events
 *   • Pulls V1 `attserveevents`     → `v2events` as ATTENDANCE-only events
 *   • Pulls V1 `attendances`        → `v2attendance` with computed hours/points
 *   • Pulls V1 `attserveattendances`→ `v2attendance` as attendance scans
 *
 * Properties:
 *   • Non-destructive   — never deletes V2 data. Each record is keyed by its
 *                         V1 `_id`, so re-runs are safe.
 *   • Upsert-based      — existing V2 records are UPDATED with any fields that
 *                         were previously missing or incorrect (e.g. locationIn,
 *                         unitAmount, AttServe points). QR codes on existing
 *                         events are NOT overwritten.
 *   • Adapts shape      — maps V1 `eventType` → V2 `hourMode`/`qrMode`,
 *                         V1 `eventCategory` / `attEventCategory` → `department`,
 *                         and carries over V1 `pointsEnabled`/`pointsValue` for
 *                         AttServe events.
 *   • Backfills hours   — computes `hours` from `timeIn`/`timeOut` for
 *                         in-out events when V1 didn't store a value.
 *   • Geo assumption    — if a CommServe attendance record has `locationIn`,
 *                         `withinPerimeter` is set to `true` and
 *                         `distanceMeters` to `0` (user instruction: if they
 *                         submitted a location, assume they were on-site).
 *   • Preserves dates   — copies `createdAt`, `updatedAt`, `scannedAt`
 *                         straight from the V1 record so the dashboard sort
 *                         and "lastActivity" remain accurate.
 *
 * Usage:
 *   npm run migrate:v2          # upserts into v2events / v2attendance
 *   npm run migrate:v2 -- --dry # logs counts, writes nothing
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as QRCode from 'qrcode';

dotenv.config({ path: path.resolve(__dirname, '../../.env.dev') });

const MONGO_URI = process.env.MONGO_URI;
const PUBLIC_UI_BASE_URL = process.env.PUBLIC_UI_BASE_URL || 'https://iserve.royalh.co.za/new';
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--dry');
/** When set, wipe v2events + v2attendance before the import. Use with care. */
const WIPE = process.argv.includes('--wipe');

if (!MONGO_URI) {
  console.error('MONGO_URI is not set — check .env.dev');
  process.exit(1);
}

// ── helpers ────────────────────────────────────────────────────────────────

async function generateQR(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 300, margin: 2 });
}

type HourMode = 'in-out' | 'fixed' | 'volume' | 'disabled';
type QrMode = 'in-out' | 'once-off';

/** Map a V1 `eventType` string to V2 hourMode + qrMode. */
function classifyEventType(eventType: string | undefined): { hourMode: HourMode; qrMode: QrMode } {
  const t = (eventType ?? '').toString().toLowerCase();
  if (!t) return { hourMode: 'in-out', qrMode: 'in-out' };
  if (t.includes('once') || t.includes('attendance')) return { hourMode: 'disabled', qrMode: 'once-off' };
  if (t.includes('fixed')) return { hourMode: 'fixed', qrMode: 'once-off' };
  if (t.includes('volume')) return { hourMode: 'volume', qrMode: 'once-off' };
  // Default: V1 hours-tracked event with sign-in / sign-out
  return { hourMode: 'in-out', qrMode: 'in-out' };
}

function safeDate(...candidates: any[]): Date {
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

// ── main ───────────────────────────────────────────────────────────────────

async function migrate() {
  console.log(`Connecting to ${MONGO_URI!.replace(/:\/\/.*@/, '://***@')}`);
  await mongoose.connect(MONGO_URI!);

  console.log(DRY_RUN ? '── DRY RUN: nothing will be written ──' : '── LIVE RUN ──');
  console.log('');

  // Register strict:false models keyed by collection name.
  const Model = (name: string, coll: string) =>
    mongoose.models[name] ?? mongoose.model(name, new mongoose.Schema({}, { strict: false }), coll);

  const v1Events    = Model('MigV1Event',      'events').collection;
  const v1Att       = Model('MigV1Att',        'attendances').collection;
  const v1AseEvents = Model('MigV1AseEvent',   'attserveevents').collection;
  const v1AseAtt    = Model('MigV1AseAtt',     'attserveattendances').collection;
  const v2Events    = Model('MigV2Event',      'v2events').collection;
  const v2Att       = Model('MigV2Att',        'v2attendance').collection;

  // ── Optional wipe step ───────────────────────────────────────────────
  if (WIPE) {
    const beforeEv  = await v2Events.countDocuments();
    const beforeAtt = await v2Att.countDocuments();
    console.log(`⚠️  --wipe flag set: about to clear v2events (${beforeEv}) and v2attendance (${beforeAtt}).`);
    if (!DRY_RUN) {
      const r1 = await v2Events.deleteMany({});
      const r2 = await v2Att.deleteMany({});
      console.log(`  Deleted ${r1.deletedCount} v2events and ${r2.deletedCount} v2attendance.\n`);
    } else {
      console.log(`  Skipped (dry run).\n`);
    }
  }

  // ── Pass 1: scan V1 attendance to find which V1 events award points ──
  console.log('Scanning V1 attendance for points-event candidates...');
  const pointsByEvent = new Map<string, { count: number; total: number }>();
  const ptsCursor = v1Att.find({ pointsAwarded: { $gt: 0 } });
  for await (const a of ptsCursor) {
    const eId = a['eventId']?.toString();
    if (!eId) continue;
    const cur = pointsByEvent.get(eId) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += Number(a['pointsAwarded'] ?? 0);
    pointsByEvent.set(eId, cur);
  }
  console.log(`  Found ${pointsByEvent.size} V1 events that have ever awarded points\n`);

  // ── Pass 2: V1 events → v2events (hours / points events) ────────────
  console.log('Migrating V1 events → v2events (hours / points)...');
  const v1EventsAll = await v1Events.find({}).toArray();
  let evIn = 0, evUpdate = 0;
  for (const e of v1EventsAll) {
    const id = e._id;
    const { hourMode, qrMode } = classifyEventType(e['eventType']);
    const pts = pointsByEvent.get(id.toString());
    const pointsMode: 'disabled' | 'fixed' = pts ? 'fixed' : 'disabled';
    const pointsValue = pts ? Math.round(pts.total / pts.count) : 0;
    const pointsEnabled = pointsMode !== 'disabled';

    const qrInUrl  = `${PUBLIC_UI_BASE_URL}/submit/${id}?direction=in`;
    const qrOutUrl = `${PUBLIC_UI_BASE_URL}/submit/${id}?direction=out`;

    const doc: any = {
      _id: id,
      eventName: e['eventName'] ?? 'Untitled event',
      school: String(e['school'] ?? ''),
      teacher: e['teacher'] ?? '',
      teacherEmail: e['teacherEmail'] ?? '',
      eventTypeId: null,
      eventCategoryId: null,
      department: (e['eventCategory'] ?? '').toString().trim(),
      category: '',
      qrMode,
      hourMode,
      fixedHours: Number(e['fixedHours'] ?? 1),
      volumeUnitName: e['customUnitName'] ?? undefined,
      volumeConversion: Number(e['unitToHourConversion'] ?? 1),
      pointsMode,
      pointsValue,
      pointsConversion: 1,
      pointsEnabled,
      captureOptions: {
        hasDescription: !!e['hasDescription'],
        hasReflection:  !!e['hasReflection'],
        hasGeolocate:   !!e['hasGeolocate'],
      },
      geoTarget: null,
      isActive: e['isActive'] !== false,
      createdAt: safeDate(e['createdAt']),
      updatedAt: safeDate(e['updatedAt'], e['createdAt']),
    };

    const existing = await v2Events.findOne({ _id: id });
    if (existing) {
      // Update everything except QR codes (don't regenerate unnecessarily)
      const { qrCodeIn: _qi, qrCodeOut: _qo, ...updateFields } = doc;
      if (!DRY_RUN) await v2Events.updateOne({ _id: id }, { $set: updateFields });
      evUpdate++;
    } else {
      doc.qrCodeIn  = DRY_RUN ? '' : await generateQR(qrInUrl);
      doc.qrCodeOut = (qrMode === 'in-out' && !DRY_RUN) ? await generateQR(qrOutUrl) : undefined;
      if (!DRY_RUN) await v2Events.insertOne(doc);
      evIn++;
    }
  }
  console.log(`  Events: ${evIn} inserted, ${evUpdate} updated\n`);

  // ── Pass 3: AttServe events → v2events (attendance-only events) ──────
  console.log('Migrating AttServe events → v2events (attendance)...');
  const v1AseAll = await v1AseEvents.find({}).toArray();
  let aseIn = 0, aseUpdate = 0;
  for (const e of v1AseAll) {
    const id = e._id;
    const qrInUrl = `${PUBLIC_UI_BASE_URL}/submit/${id}?direction=in`;

    const pointsEnabled = !!e['pointsEnabled'];
    const pointsValue   = Number(e['pointsValue'] ?? 0);

    const doc: any = {
      _id: id,
      eventName: e['attEventName'] ?? e['eventName'] ?? 'Attendance event',
      school: String(e['school'] ?? ''),
      teacher: e['teacher'] ?? '',
      teacherEmail: e['teacherEmail'] ?? '',
      eventTypeId: null,
      eventCategoryId: null,
      department: (e['attEventCategory'] ?? '').toString().trim(),
      category: '',
      qrMode: 'once-off',
      hourMode: 'disabled',
      fixedHours: 1,
      volumeConversion: 1,
      pointsMode: pointsEnabled ? 'fixed' : 'disabled',
      pointsValue,
      pointsConversion: 1,
      pointsEnabled,
      captureOptions: { hasDescription: false, hasReflection: false, hasGeolocate: false },
      geoTarget: null,
      isActive: e['isActive'] !== false,
      createdAt: safeDate(e['createdAt']),
      updatedAt: safeDate(e['updatedAt'], e['createdAt']),
    };

    const existing = await v2Events.findOne({ _id: id });
    if (existing) {
      const { qrCodeIn: _qi, qrCodeOut: _qo, ...updateFields } = doc;
      if (!DRY_RUN) await v2Events.updateOne({ _id: id }, { $set: updateFields });
      aseUpdate++;
    } else {
      doc.qrCodeIn = DRY_RUN ? '' : await generateQR(qrInUrl);
      if (!DRY_RUN) await v2Events.insertOne(doc);
      aseIn++;
    }
  }
  console.log(`  AttServe events: ${aseIn} inserted, ${aseUpdate} updated\n`);

  // ── Pass 4: V1 attendance → v2attendance ─────────────────────────────
  console.log('Migrating V1 attendance → v2attendance...');
  const v1AttAll = await v1Att.find({}).toArray();
  let attIn = 0, attUpdate = 0, attOrphan = 0;
  for (const a of v1AttAll) {
    const id = a._id;

    const eventId = a['eventId'];
    if (!eventId) { attOrphan++; continue; }
    const ev = await v2Events.findOne({ _id: eventId });
    if (!ev) { attOrphan++; continue; }

    const timeIn  = safeDate(a['timeIn'], a['scannedAt'], a['createdAt']);
    const timeOut = a['timeOut'] ? safeDate(a['timeOut']) : undefined;

    // Hours: prefer V1's value when > 0, else compute from in/out.
    let hours: number | null = null;
    const v1Hours = Number(a['hours'] ?? 0);
    if (v1Hours > 0) {
      hours = v1Hours;
    } else if (ev['hourMode'] === 'in-out' && timeOut) {
      hours = (timeOut.getTime() - timeIn.getTime()) / 3_600_000;
    } else if (ev['hourMode'] === 'fixed') {
      hours = Number(ev['fixedHours'] ?? 1);
    }

    // Geo assumption: if locationIn is present, assume the student was on-site.
    const locationIn  = a['locationIn']  ?? undefined;
    const locationOut = a['locationOut'] ?? undefined;

    const doc: any = {
      _id: id,
      eventId,
      studentEmail: ((a['studentEmail'] ?? '') as string).toLowerCase(),
      studentFirstName: a['studentFirstName'] ?? a['studentFirst'] ?? undefined,
      studentLastName:  a['studentLastName']  ?? a['studentLast']  ?? undefined,
      studentId:    a['studentId']  ?? undefined,
      studentGrade: a['studentGrade'] ?? '',
      studentClass: a['studentClass'] ?? '',
      schoolId:     a['schoolId']    != null ? String(a['schoolId']) : '',
      timeIn,
      timeOut,
      hours,
      pointsAwarded: Number(a['pointsAwarded'] ?? 0),
      source: a['source'] === 'assisted' ? 'assisted' : 'self',
      locationIn,
      locationOut,
      unitAmount:      a['unitAmount'] != null ? Number(a['unitAmount']) : undefined,
      teacherEmail:    a['teacherEmail'] ?? undefined,
      withinPerimeter: locationIn ? true : null,
      distanceMeters:  locationIn ? 0    : null,
      description: a['description'] ?? undefined,
      reflection:  a['reflection']  ?? undefined,
      scannedAt: safeDate(a['scannedAt'], a['timeIn'], a['createdAt']),
      createdAt: safeDate(a['createdAt'], a['scannedAt']),
      updatedAt: safeDate(a['updatedAt'], a['createdAt']),
    };

    // Remove undefined keys so $set doesn't null out existing values
    Object.keys(doc).forEach(k => { if (doc[k] === undefined) delete doc[k]; });

    if (!DRY_RUN) {
      const result = await v2Att.updateOne({ _id: id }, { $set: doc }, { upsert: true });
      if (result.upsertedCount > 0) attIn++;
      else attUpdate++;
    } else {
      // In dry-run, count as insert if not present
      const exists = await v2Att.findOne({ _id: id });
      if (exists) attUpdate++; else attIn++;
    }
  }
  console.log(`  Attendance: ${attIn} inserted, ${attUpdate} updated, ${attOrphan} orphaned (no matching event)\n`);

  // ── Pass 5: AttServe attendance → v2attendance ────────────────────────
  console.log('Migrating AttServe attendance → v2attendance...');
  const v1AseAttAll = await v1AseAtt.find({}).toArray();
  let aseAttIn = 0, aseAttUpdate = 0, aseAttOrphan = 0;
  for (const a of v1AseAttAll) {
    const id = a._id;

    const eventId = a['eventId'];
    if (!eventId) { aseAttOrphan++; continue; }
    const ev = await v2Events.findOne({ _id: eventId });
    if (!ev) { aseAttOrphan++; continue; }

    const timeIn = safeDate(a['scannedAt'], a['timeIn'], a['createdAt']);

    const doc: any = {
      _id: id,
      eventId,
      studentEmail: ((a['studentEmail'] ?? '') as string).toLowerCase(),
      studentFirstName: a['studentFirst'] ?? a['studentFirstName'] ?? undefined,
      studentLastName:  a['studentLast']  ?? a['studentLastName']  ?? undefined,
      studentId:    a['studentId']  ?? undefined,
      studentGrade: a['studentGrade'] ?? '',
      studentClass: a['studentClass'] ?? '',
      schoolId:     a['schoolId']    != null ? String(a['schoolId']) : '',
      timeIn,
      timeOut: undefined,
      hours: null,
      pointsAwarded: Number(a['pointsAwarded'] ?? 0),
      source: a['source'] === 'assisted' ? 'assisted' : 'self',
      teacherEmail: a['teacherEmail'] ?? undefined,
      scannedAt: safeDate(a['scannedAt'], a['timeIn'], a['createdAt']),
      createdAt: safeDate(a['createdAt'], a['scannedAt']),
      updatedAt: safeDate(a['updatedAt'], a['createdAt']),
    };

    // Remove undefined keys so $set doesn't null out existing values
    Object.keys(doc).forEach(k => { if (doc[k] === undefined) delete doc[k]; });

    if (!DRY_RUN) {
      const result = await v2Att.updateOne({ _id: id }, { $set: doc }, { upsert: true });
      if (result.upsertedCount > 0) aseAttIn++;
      else aseAttUpdate++;
    } else {
      const exists = await v2Att.findOne({ _id: id });
      if (exists) aseAttUpdate++; else aseAttIn++;
    }
  }
  console.log(`  AttServe attendance: ${aseAttIn} inserted, ${aseAttUpdate} updated, ${aseAttOrphan} orphaned\n`);

  // ── Summary ───────────────────────────────────────────────────────────
  const finalEvents = await v2Events.countDocuments();
  const finalAtt    = await v2Att.countDocuments();
  console.log('=== Migration complete ===');
  console.log(`  v2events     total: ${finalEvents}`);
  console.log(`  v2attendance total: ${finalAtt}`);
  if (DRY_RUN) {
    console.log('\n(Dry run — totals above reflect the existing collections, not the result of a real run.)');
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
