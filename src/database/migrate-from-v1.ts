/**
 * Migration script: V1 events/attendance → v2events/v2attendance
 * Run via: npm run migrate
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as QRCode from 'qrcode';

dotenv.config({ path: path.resolve(__dirname, '../../.env.dev') });

const MONGO_URI = process.env.MONGO_URI!;
const PUBLIC_UI_BASE_URL = process.env.PUBLIC_UI_BASE_URL || 'https://iserve.royalh.co.za/new';

// ── Schemas ──────────────────────────────────────────────────────────────────

const V1EventSchema = new mongoose.Schema({}, { strict: false, collection: 'events' });
const AttServeEventSchema = new mongoose.Schema({}, { strict: false, collection: 'attserveevents' });
const V1AttendanceSchema = new mongoose.Schema({}, { strict: false, collection: 'attendances' });
const AttServeAttendanceSchema = new mongoose.Schema({}, { strict: false, collection: 'attserveattendances' });
const LookupSchema = new mongoose.Schema({ name: String, schoolId: String, isActive: Boolean }, { strict: false });
const V2EventSchema = new mongoose.Schema({}, { strict: false, collection: 'v2events' });
const V2AttendanceSchema = new mongoose.Schema({}, { strict: false, collection: 'v2attendance' });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateQR(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 300, margin: 2 });
}

function mapQrMode(eventType: string): string {
  if (!eventType) return 'once-off';
  const t = eventType.toUpperCase();
  if (t.includes('IN') && t.includes('OUT')) return 'in-out';
  return 'once-off';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const V1Event = mongoose.model('V1Event', V1EventSchema);
  const AttServeEvent = mongoose.model('AttServeEvent', AttServeEventSchema);
  const V1Attendance = mongoose.model('V1Attendance', V1AttendanceSchema);
  const AttServeAttendance = mongoose.model('AttServeAttendance', AttServeAttendanceSchema);
  const EventType = mongoose.model('EventType', LookupSchema, 'eventtypes');
  const EventCategory = mongoose.model('EventCategory', LookupSchema, 'eventcategories');
  const V2Event = mongoose.model('V2Event', V2EventSchema);
  const V2Attendance = mongoose.model('V2Attendance', V2AttendanceSchema);

  // ── Step 1: Clear v2 collections ─────────────────────────────────────────
  console.log('Clearing v2events and v2attendance...');
  const deletedEvents = await V2Event.deleteMany({});
  const deletedAtt = await V2Attendance.deleteMany({});
  console.log(`  Deleted ${deletedEvents.deletedCount} v2events`);
  console.log(`  Deleted ${deletedAtt.deletedCount} v2attendance\n`);

  // ── Step 2: Load lookup tables ────────────────────────────────────────────
  const eventTypes = await EventType.find({});
  const eventCategories = await EventCategory.find({});

  function findTypeId(name: string): mongoose.Types.ObjectId | null {
    const match = eventTypes.find(t => t.get('name')?.toLowerCase() === name?.toLowerCase());
    return match ? match._id as mongoose.Types.ObjectId : null;
  }

  function findCategoryId(name: string): mongoose.Types.ObjectId | null {
    const match = eventCategories.find(c => c.get('name')?.toLowerCase() === name?.toLowerCase());
    return match ? match._id as mongoose.Types.ObjectId : null;
  }

  // ── Step 3: Migrate V1 events ─────────────────────────────────────────────
  const v1Events = await V1Event.find({});
  console.log(`Migrating ${v1Events.length} V1 events...`);

  const eventIdMap = new Map<string, mongoose.Types.ObjectId>(); // old _id → new _id

  for (const e of v1Events) {
    const oldId = (e._id as mongoose.Types.ObjectId).toString();
    const newId = new mongoose.Types.ObjectId();
    eventIdMap.set(oldId, newId);

    const qrMode = mapQrMode(e.get('eventType'));
    const qrInUrl = `${PUBLIC_UI_BASE_URL}/submit/${newId}?direction=in`;
    const qrOutUrl = `${PUBLIC_UI_BASE_URL}/submit/${newId}?direction=out`;
    const qrCodeIn = await generateQR(qrInUrl);
    const qrCodeOut = qrMode === 'in-out' ? await generateQR(qrOutUrl) : undefined;

    await V2Event.create({
      _id: newId,
      eventName: e.get('eventName'),
      school: e.get('school'),
      teacher: e.get('teacher'),
      teacherEmail: e.get('teacherEmail'),
      qrMode,
      hourMode: 'in-out',
      fixedHours: 1,
      pointsEnabled: false,
      pointsValue: 0,
      captureOptions: {
        hasDescription: e.get('hasDescription') ?? false,
        hasReflection: e.get('hasReflection') ?? false,
        hasGeolocate: e.get('hasGeolocate') ?? false,
      },
      eventTypeId: findTypeId(e.get('eventType') || 'Once-Off Attendance'),
      eventCategoryId: findCategoryId(e.get('eventCategory') || 'In Person'),
      isActive: true,
      qrCodeIn,
      ...(qrCodeOut ? { qrCodeOut } : {}),
      createdAt: e.get('createdAt'),
      updatedAt: e.get('updatedAt'),
    });
  }
  console.log(`  Migrated ${v1Events.length} V1 events\n`);

  // ── Step 4: Migrate AttServe events ───────────────────────────────────────
  const attEvents = await AttServeEvent.find({});
  console.log(`Migrating ${attEvents.length} AttServe events...`);

  for (const e of attEvents) {
    const oldId = (e._id as mongoose.Types.ObjectId).toString();
    const newId = new mongoose.Types.ObjectId();
    eventIdMap.set(oldId, newId);

    const qrInUrl = `${PUBLIC_UI_BASE_URL}/submit/${newId}?direction=in`;
    const qrCodeIn = await generateQR(qrInUrl);

    await V2Event.create({
      _id: newId,
      eventName: e.get('attEventName'),
      school: e.get('school'),
      teacher: e.get('teacher'),
      teacherEmail: e.get('teacherEmail'),
      qrMode: 'once-off',
      hourMode: 'in-out',
      fixedHours: 1,
      pointsEnabled: false,
      pointsValue: 0,
      captureOptions: { hasDescription: false, hasReflection: false, hasGeolocate: false },
      eventTypeId: findTypeId('Once-Off Attendance'),
      eventCategoryId: findCategoryId('In Person'),
      isActive: true,
      qrCodeIn,
      createdAt: e.get('createdAt'),
      updatedAt: e.get('updatedAt'),
    });
  }
  console.log(`  Migrated ${attEvents.length} AttServe events\n`);

  // ── Step 5: Migrate V1 attendance ─────────────────────────────────────────
  const v1Att = await V1Attendance.find({});
  console.log(`Migrating ${v1Att.length} V1 attendance records...`);

  let migratedAtt = 0;
  for (const a of v1Att) {
    const oldEventId = a.get('eventId')?.toString();
    const newEventId = oldEventId ? eventIdMap.get(oldEventId) : null;
    if (!newEventId) continue; // skip orphaned records

    await V2Attendance.create({
      eventId: newEventId,
      studentEmail: a.get('studentEmail'),
      studentFirstName: a.get('studentFirstName'),
      studentLastName: a.get('studentLastName'),
      studentGrade: a.get('studentGrade') || '',
      studentClass: a.get('studentClass') || '',
      schoolId: a.get('schoolId') || 0,
      timeIn: a.get('timeIn'),
      timeOut: a.get('timeOut'),
      hours: a.get('hours') || 0,
      pointsAwarded: a.get('pointsAwarded') || 0,
      direction: a.get('direction') || 'in',
      source: a.get('source') || 'self',
      description: a.get('description'),
      reflection: a.get('reflection'),
      createdAt: a.get('createdAt'),
      updatedAt: a.get('updatedAt'),
    });
    migratedAtt++;
  }
  console.log(`  Migrated ${migratedAtt} / ${v1Att.length} V1 attendance records\n`);

  // ── Step 6: Migrate AttServe attendance ───────────────────────────────────
  const attAtt = await AttServeAttendance.find({});
  console.log(`Migrating ${attAtt.length} AttServe attendance records...`);

  let migratedAttServe = 0;
  for (const a of attAtt) {
    const oldEventId = a.get('eventId')?.toString();
    const newEventId = oldEventId ? eventIdMap.get(oldEventId) : null;
    if (!newEventId) continue;

    await V2Attendance.create({
      eventId: newEventId,
      studentEmail: a.get('studentEmail'),
      studentFirstName: a.get('studentFirst') || a.get('studentFirstName'),
      studentLastName: a.get('studentLast') || a.get('studentLastName'),
      studentGrade: a.get('studentGrade') || '',
      studentClass: a.get('studentClass') || '',
      schoolId: a.get('schoolId') || 0,
      timeIn: a.get('scannedAt') || a.get('timeIn'),
      hours: 0,
      pointsAwarded: 0,
      direction: 'in',
      source: a.get('source') || 'self',
      createdAt: a.get('createdAt'),
      updatedAt: a.get('updatedAt'),
    });
    migratedAttServe++;
  }
  console.log(`  Migrated ${migratedAttServe} / ${attAtt.length} AttServe attendance records\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const finalEvents = await V2Event.countDocuments();
  const finalAtt = await V2Attendance.countDocuments();
  console.log('=== Migration Complete ===');
  console.log(`  v2events:     ${finalEvents}`);
  console.log(`  v2attendance: ${finalAtt}`);

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
