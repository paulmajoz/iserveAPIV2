/**
 * ═══════════════════════════════════════════════════════════════
 *  iServe  —  V1 → V2 Migration Script
 *
 *  Copies old `events` + `attendances` into `v2events` + `v2attendance`
 *  while preserving every document's original _id so that all
 *  existing printed QR codes remain valid.
 *
 *  Usage:
 *    npm run migrate
 *
 *  Dry-run (inspect only, nothing written):
 *    DRY_RUN=true npm run migrate
 *
 *  SAFE TO RE-RUN — already-migrated docs are skipped via upsert.
 * ═══════════════════════════════════════════════════════════════
 */

import mongoose, { Schema, model, Types, Document } from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─────────────────────────────────────────────────────────────
//  CONFIG  — edit these two lines if your DBs are different
// ─────────────────────────────────────────────────────────────
const SOURCE_URI = process.env.MONGO_URI_V1 ?? process.env.MONGO_URI ?? 'mongodb://localhost:27017/iserveza';
const DEST_URI   = process.env.MONGO_URI    ?? 'mongodb://localhost:27017/iserveza';
const DRY_RUN    = process.env.DRY_RUN === 'true';
// ─────────────────────────────────────────────────────────────

// ── Old (V1) schemas ─────────────────────────────────────────

interface V1Event {
  _id: Types.ObjectId;
  eventName: string;
  eventType: 'IN/OUT' | 'VOLUME' | 'IN ONLY';
  eventCategory: string;
  hasGeolocate?: boolean;
  hasDescription?: boolean;
  hasReflection?: boolean;
  customUnitName?: string;
  unitToHourConversion?: number;
  teacher: string;
  teacherEmail: string;
  school: string;
  qrCodeIn?: string;
  qrCodeOut?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface V1Attendance {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  studentEmail: string;
  studentFirstName?: string;
  studentLastName?: string;
  timeIn: Date;
  timeOut?: Date;
  locationIn?: string;
  locationOut?: string;
  unitAmount?: number;
  description?: string;
  reflection?: string;
  hours?: number | null;
  createdAt?: Date;
}

const V1EventSchema = new Schema({}, { strict: false, collection: 'events' });
const V1AttendanceSchema = new Schema({}, { strict: false, collection: 'attendances' });

// ── New (V2) schemas ─────────────────────────────────────────

const V2EventSchema = new Schema({
  eventName:        String,
  school:           String,
  teacher:          String,
  teacherEmail:     String,
  qrMode:           String,
  hourMode:         String,
  fixedHours:       Number,
  volumeUnitName:   String,
  volumeConversion: Number,
  pointsEnabled:    Boolean,
  pointsValue:      Number,
  captureOptions:   Object,
  eventTypeId:      Schema.Types.ObjectId,
  eventCategoryId:  Schema.Types.ObjectId,
  qrCodeIn:         String,
  qrCodeOut:        String,
  isActive:         Boolean,
}, { strict: false, collection: 'v2events', timestamps: true });

const V2AttendanceSchema = new Schema({
  eventId:          Schema.Types.ObjectId,
  studentEmail:     String,
  studentFirstName: String,
  studentLastName:  String,
  studentGrade:     String,
  studentClass:     String,
  schoolId:         String,
  timeIn:           Date,
  timeOut:          Date,
  hours:            Number,
  source:           String,
  locationIn:       String,
  locationOut:      String,
  description:      String,
  reflection:       String,
  unitAmount:       Number,
  pointsAwarded:    Number,
}, { strict: false, collection: 'v2attendance', timestamps: true });

// ── Field mappers ────────────────────────────────────────────

/**
 * V1 eventType → V2 qrMode + hourMode
 *
 *  IN/OUT   → qrMode: in-out,    hourMode: in-out
 *  IN ONLY  → qrMode: once-off,  hourMode: disabled
 *  VOLUME   → qrMode: once-off,  hourMode: volume
 */
function mapEventType(v1Type: string): { qrMode: string; hourMode: string } {
  switch ((v1Type ?? '').toUpperCase().trim()) {
    case 'IN/OUT':   return { qrMode: 'in-out',   hourMode: 'in-out'   };
    case 'IN ONLY':  return { qrMode: 'once-off',  hourMode: 'disabled' };
    case 'VOLUME':   return { qrMode: 'once-off',  hourMode: 'volume'   };
    default:         return { qrMode: 'once-off',  hourMode: 'disabled' };
  }
}

function mapEvent(v1: V1Event): object {
  const { qrMode, hourMode } = mapEventType(v1.eventType);

  return {
    _id:          v1._id,           // ← preserve original _id (keeps QR codes valid)
    eventName:    v1.eventName,
    school:       String(v1.school),
    teacher:      v1.teacher,
    teacherEmail: v1.teacherEmail,
    qrMode,
    hourMode,
    // Volume fields
    volumeUnitName:   hourMode === 'volume' ? (v1.customUnitName ?? null) : undefined,
    volumeConversion: hourMode === 'volume' ? (v1.unitToHourConversion ?? 1) : undefined,
    // Points didn't exist in V1 — default off
    pointsEnabled: false,
    pointsValue:   0,
    // Capture options were top-level booleans in V1
    captureOptions: {
      hasDescription: v1.hasDescription ?? false,
      hasReflection:  v1.hasReflection  ?? false,
      hasGeolocate:   v1.hasGeolocate   ?? false,
    },
    // QR code images — kept as-is so old printed codes still work
    qrCodeIn:  v1.qrCodeIn  ?? null,
    qrCodeOut: v1.qrCodeOut ?? null,
    isActive: true,
    // Preserve original timestamps
    createdAt: v1.createdAt ?? new Date(),
    updatedAt: v1.updatedAt ?? new Date(),
  };
}

function mapAttendance(v1: V1Attendance, schoolId: string): object {
  return {
    _id:              v1._id,           // ← preserve original _id
    eventId:          v1.eventId,
    studentEmail:     (v1.studentEmail ?? '').toLowerCase().trim(),
    studentFirstName: v1.studentFirstName ?? null,
    studentLastName:  v1.studentLastName  ?? null,
    schoolId,
    timeIn:           v1.timeIn  ?? new Date(),
    timeOut:          v1.timeOut ?? null,
    hours:            v1.hours   ?? null,
    source:           'self',           // V1 didn't track source — assume self
    locationIn:       v1.locationIn   ?? null,
    locationOut:      v1.locationOut  ?? null,
    description:      v1.description  ?? null,
    reflection:       v1.reflection   ?? null,
    unitAmount:       v1.unitAmount   ?? null,
    pointsAwarded:    0,                // V1 had no points
    createdAt:        v1.createdAt    ?? new Date(),
  };
}

// ── Main ─────────────────────────────────────────────────────

async function migrate() {
  console.log('\n' + '═'.repeat(60));
  console.log('  iServe V1 → V2 Migration');
  if (DRY_RUN) console.log('  ⚠️   DRY RUN — nothing will be written');
  console.log('═'.repeat(60));

  const isSameDb = SOURCE_URI === DEST_URI;

  // Connect source
  console.log('\n📡  Connecting to source DB…');
  const sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise();
  console.log('    ✔ Source connected');

  // Connect destination (may be same connection)
  let destConn: mongoose.Connection;
  if (isSameDb) {
    destConn = sourceConn;
    console.log('    ✔ Destination = same database');
  } else {
    console.log('📡  Connecting to destination DB…');
    destConn = await mongoose.createConnection(DEST_URI).asPromise();
    console.log('    ✔ Destination connected');
  }

  const V1EventModel      = sourceConn.model('V1Event',      V1EventSchema);
  const V1AttendanceModel = sourceConn.model('V1Attendance', V1AttendanceSchema);
  const V2EventModel      = destConn.model('V2Event',        V2EventSchema);
  const V2AttendanceModel = destConn.model('V2Attendance',   V2AttendanceSchema);

  // ── Inspect source counts ──────────────────────────────
  const totalEvents      = await V1EventModel.countDocuments();
  const totalAttendances = await V1AttendanceModel.countDocuments();

  console.log(`\n📊  Found in source:`);
  console.log(`    ${totalEvents.toLocaleString()} events     (collection: events)`);
  console.log(`    ${totalAttendances.toLocaleString()} attendances (collection: attendances)`);

  const alreadyEvents  = await V2EventModel.countDocuments();
  const alreadyAttend  = await V2AttendanceModel.countDocuments();
  console.log(`\n📊  Already in destination:`);
  console.log(`    ${alreadyEvents.toLocaleString()} events     (collection: v2events)`);
  console.log(`    ${alreadyAttend.toLocaleString()} attendances (collection: v2attendance)`);

  if (totalEvents === 0) {
    console.log('\n⚠️   No V1 events found — is the SOURCE_URI correct?\n');
    await sourceConn.close();
    if (!isSameDb) await destConn.close();
    process.exit(0);
  }

  // ── Migrate events ─────────────────────────────────────
  console.log('\n─'.repeat(60));
  console.log('📅  Migrating events…');

  const v1Events = await V1EventModel.find({}).lean() as unknown as V1Event[];

  // Infer schoolId from the first event (all events share one school per deployment)
  const inferredSchoolId = String((v1Events[0] as any).school ?? '');

  let eventsMigrated = 0;
  let eventsSkipped  = 0;

  for (const v1 of v1Events) {
    const mapped = mapEvent(v1);

    if (!DRY_RUN) {
      const result = await V2EventModel.updateOne(
        { _id: (mapped as any)._id },
        { $setOnInsert: mapped },
        { upsert: true },
      );
      if (result.upsertedCount > 0) {
        eventsMigrated++;
      } else {
        eventsSkipped++;
      }
    } else {
      eventsMigrated++;
    }

    // Progress dot every 50 records
    if ((eventsMigrated + eventsSkipped) % 50 === 0) process.stdout.write('.');
  }

  console.log(`\n    ✔ Migrated: ${eventsMigrated}  |  Skipped (already exist): ${eventsSkipped}`);

  // ── Migrate attendance ─────────────────────────────────
  console.log('\n─'.repeat(60));
  console.log('🙋  Migrating attendance records…');

  const BATCH = 500;
  let attendMigrated = 0;
  let attendSkipped  = 0;
  let offset = 0;

  while (true) {
    const batch = await V1AttendanceModel
      .find({})
      .skip(offset)
      .limit(BATCH)
      .lean() as unknown as V1Attendance[];

    if (batch.length === 0) break;

    for (const v1 of batch) {
      const mapped = mapAttendance(v1, inferredSchoolId);

      if (!DRY_RUN) {
        const result = await V2AttendanceModel.updateOne(
          { _id: (mapped as any)._id },
          { $setOnInsert: mapped },
          { upsert: true },
        );
        if (result.upsertedCount > 0) {
          attendMigrated++;
        } else {
          attendSkipped++;
        }
      } else {
        attendMigrated++;
      }
    }

    offset += BATCH;
    process.stdout.write(`\r    Processing: ${offset} / ${totalAttendances}`);
  }

  console.log(`\n    ✔ Migrated: ${attendMigrated}  |  Skipped (already exist): ${attendSkipped}`);

  // ── Summary ────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  if (DRY_RUN) {
    console.log('  DRY RUN COMPLETE — no data was written.');
    console.log('  Remove DRY_RUN=true to run the real migration.');
  } else {
    console.log('  ✅  Migration complete!');
    console.log(`  Events    : ${eventsMigrated} migrated, ${eventsSkipped} skipped`);
    console.log(`  Attendance: ${attendMigrated} migrated, ${attendSkipped} skipped`);
    console.log('\n  ℹ️   Old QR codes are still valid — _id values were preserved.');
    console.log('  ℹ️   Points defaulted to 0 (not in V1). Update via the UI if needed.');
  }
  console.log('═'.repeat(60) + '\n');

  await sourceConn.close();
  if (!isSameDb) await destConn.close();
}

migrate().catch((err) => {
  console.error('\n❌  Migration failed:', err.message ?? err);
  process.exit(1);
});
