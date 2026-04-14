/**
 * ═══════════════════════════════════════════════════════
 *  iServeAPIV2 — Database Seed Script
 *  Run:  npm run seed
 *
 *  IDEMPOTENT — safe to re-run; existing records are
 *  updated in-place, nothing is duplicated.
 *
 *  Seeded collections
 *  ──────────────────
 *  schools           1 school record (schoolId 11338)
 *  eventtypes        10 global + 3 school-specific
 *  eventcategories   10 global + 3 school-specific
 *  v2events          6 sample events for schoolId 11338
 *  v2attendance      ~20 sample attendance records
 * ═══════════════════════════════════════════════════════
 */

import mongoose, { Schema, model, Types } from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// ── Load .env.dev ────────────────────────────────────────
dotenv.config({ path: path.resolve(__dirname, '../../.env.dev') });

const MONGO_URI =
  process.env.MONGO_URI ?? 'mongodb://localhost:27017/iserveza';

// ════════════════════════════════════════════════════════
//  Inline Mongoose schemas (mirrors the NestJS schemas)
// ════════════════════════════════════════════════════════

// ── School ───────────────────────────────────────────────
const SchoolSchema = new Schema(
  {
    schoolId: { type: Number, required: true, unique: true },
    name:     { type: String, required: true },
    address:  String,
    website:  String,
    email:    String,
    logoPath: String,
    themeColors: {
      type: Object,
      default: {
        primary:    '#2c698d',
        secondary:  '#272643',
        accent:     '#bae8e8',
        surface:    '#e3f6f5',
        background: '#ffffff',
      },
    },
    featureFlags: {
      type: Object,
      default: { allowInOutQR: true, pointsEnabled: true },
    },
    gradeTargetHours:   { type: Object, default: {} },
    honoursTargetHours: { type: Object, default: {} },
  },
  { collection: 'schools', timestamps: true },
);

// ── EventType ────────────────────────────────────────────
const EventTypeSchema = new Schema(
  {
    name:     { type: String, required: true },
    schoolId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { collection: 'eventtypes', timestamps: true },
);
EventTypeSchema.index({ schoolId: 1, isActive: 1 });

// ── EventCategory ────────────────────────────────────────
const EventCategorySchema = new Schema(
  {
    name:     { type: String, required: true },
    schoolId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { collection: 'eventcategories', timestamps: true },
);
EventCategorySchema.index({ schoolId: 1, isActive: 1 });

// ── Event ────────────────────────────────────────────────
const EventSchema = new Schema(
  {
    eventName:       { type: String, required: true },
    school:          String,
    teacher:         String,
    teacherEmail:    String,
    qrMode:          { type: String, default: 'once-off' },
    hourMode:        { type: String, default: 'in-out' },
    fixedHours:      Number,
    volumeUnitName:  String,
    volumeConversion: Number,
    pointsEnabled:   { type: Boolean, default: false },
    pointsValue:     { type: Number, default: 0 },
    captureOptions: {
      hasDescription: { type: Boolean, default: false },
      hasReflection:  { type: Boolean, default: false },
      hasGeolocate:   { type: Boolean, default: false },
    },
    eventTypeId:     { type: Schema.Types.ObjectId, ref: 'EventType' },
    eventCategoryId: { type: Schema.Types.ObjectId, ref: 'EventCategory' },
    qrCodeIn:        String,
    qrCodeOut:       String,
    isActive:        { type: Boolean, default: true },
  },
  { collection: 'v2events', timestamps: true },
);

// ── Attendance ───────────────────────────────────────────
const AttendanceSchema = new Schema(
  {
    eventId:          { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    studentEmail:     { type: String, required: true },
    studentFirstName: String,
    studentLastName:  String,
    studentGrade:     String,
    studentClass:     String,
    schoolId:         Number,
    timeIn:           Date,
    timeOut:          Date,
    hours:            Number,
    pointsAwarded:    Number,
    direction:        String,
    source:           { type: String, default: 'self' },
  },
  { collection: 'v2attendance', timestamps: true },
);

const SchoolModel      = model('School',        SchoolSchema);
const EventTypeModel   = model('EventType',     EventTypeSchema);
const EventCatModel    = model('EventCategory', EventCategorySchema);
const EventModel       = model('Event',         EventSchema);
const AttendanceModel  = model('Attendance',    AttendanceSchema);

// ════════════════════════════════════════════════════════
//  Seed data definitions
// ════════════════════════════════════════════════════════

const SCHOOL_ID = 11338;
const SCHOOL_ID_STR = String(SCHOOL_ID);

// ── Event Types ──────────────────────────────────────────
// schoolId: null  →  global (visible to ALL schools)
// schoolId: "11338"  →  only visible to that school
const EVENT_TYPES: Array<{ name: string; schoolId: string | null }> = [
  // ── Global ──
  { name: 'Community Service',  schoolId: null },
  { name: 'Environmental',      schoolId: null },
  { name: 'Sports & Recreation',schoolId: null },
  { name: 'Arts & Culture',     schoolId: null },
  { name: 'Academic Support',   schoolId: null },
  { name: 'Fundraising',        schoolId: null },
  { name: 'Leadership',         schoolId: null },
  { name: 'Healthcare & Wellness', schoolId: null },
  { name: 'Food Security',      schoolId: null },
  { name: 'Animal Welfare',     schoolId: null },
  // ── School-specific (11338) ──
  { name: 'Chapel Service',     schoolId: SCHOOL_ID_STR },
  { name: 'House Event',        schoolId: SCHOOL_ID_STR },
  { name: 'School Outreach',    schoolId: SCHOOL_ID_STR },
];

// ── Event Categories ─────────────────────────────────────
const EVENT_CATEGORIES: Array<{ name: string; schoolId: string | null }> = [
  // ── Global ──
  { name: 'Local Community',         schoolId: null },
  { name: 'School Community',        schoolId: null },
  { name: 'Elderly Care',            schoolId: null },
  { name: 'Youth Development',       schoolId: null },
  { name: 'Disability Support',      schoolId: null },
  { name: 'Environmental Conservation', schoolId: null },
  { name: 'Disaster Relief',         schoolId: null },
  { name: 'Homeless Outreach',       schoolId: null },
  { name: 'Literacy & Education',    schoolId: null },
  { name: 'Religious / Spiritual',   schoolId: null },
  // ── School-specific (11338) ──
  { name: 'Term 1 Project',          schoolId: SCHOOL_ID_STR },
  { name: 'Term 2 Project',          schoolId: SCHOOL_ID_STR },
  { name: 'Royal House Outreach',    schoolId: SCHOOL_ID_STR },
];

// ════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursLater(base: Date, h: number): Date {
  return new Date(base.getTime() + h * 3_600_000);
}

// ════════════════════════════════════════════════════════
//  Main
// ════════════════════════════════════════════════════════

async function seed() {
  console.log('\n🌱  Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected\n');

  // ── 1. School ──────────────────────────────────────────
  console.log('📚  Seeding school…');
  await SchoolModel.updateOne(
    { schoolId: SCHOOL_ID },
    {
      $setOnInsert: {
        schoolId: SCHOOL_ID,
        name:     'Kingsmead College',
        address:  '1 Kingsmead Way, Durban, 4001',
        website:  'https://www.kingsmead.co.za',
        email:    'info@kingsmead.co.za',
        logoPath: '',
        themeColors: {
          primary:    '#1a3a5c',
          secondary:  '#0d2137',
          accent:     '#e8a838',
          surface:    '#eaf1fb',
          background: '#ffffff',
        },
        featureFlags: {
          allowInOutQR: true,
          pointsEnabled: true,
        },
        gradeTargetHours: {
          grade8:  10,
          grade9:  15,
          grade10: 20,
          grade11: 25,
          grade12: 30,
        },
        honoursTargetHours: {
          bronze:   20,
          silver:   40,
          gold:     80,
        },
      },
    },
    { upsert: true },
  );
  console.log('   ✔ School 11338 — Kingsmead College\n');

  // ── 2. Event Types ─────────────────────────────────────
  console.log('🏷️   Seeding event types…');
  const typeIdMap: Record<string, Types.ObjectId> = {};
  for (const et of EVENT_TYPES) {
    const doc = await EventTypeModel.findOneAndUpdate(
      { name: et.name, schoolId: et.schoolId ?? null },
      { $set: { name: et.name, schoolId: et.schoolId ?? null, isActive: true } },
      { upsert: true, returnDocument: 'after' },
    );
    typeIdMap[et.name] = doc!._id as Types.ObjectId;
    const scope = et.schoolId ? `school ${et.schoolId}` : 'global';
    console.log(`   ✔ [${scope}] ${et.name}`);
  }

  // ── 3. Event Categories ────────────────────────────────
  console.log('\n🗂️   Seeding event categories…');
  const catIdMap: Record<string, Types.ObjectId> = {};
  for (const ec of EVENT_CATEGORIES) {
    const doc = await EventCatModel.findOneAndUpdate(
      { name: ec.name, schoolId: ec.schoolId ?? null },
      { $set: { name: ec.name, schoolId: ec.schoolId ?? null, isActive: true } },
      { upsert: true, returnDocument: 'after' },
    );
    catIdMap[ec.name] = doc!._id as Types.ObjectId;
    const scope = ec.schoolId ? `school ${ec.schoolId}` : 'global';
    console.log(`   ✔ [${scope}] ${ec.name}`);
  }

  // ── 4. Sample Events ───────────────────────────────────
  console.log('\n📅  Seeding sample events…');

  // Only seed events if none exist for this school yet
  const existingEventCount = await EventModel.countDocuments({ school: SCHOOL_ID_STR });
  if (existingEventCount > 0) {
    console.log(`   ⚠  ${existingEventCount} events already exist for school ${SCHOOL_ID} — skipping event seed`);
  } else {
    const SAMPLE_EVENTS = [
      {
        eventName:    'Beach Cleanup 2025',
        school:       SCHOOL_ID_STR,
        teacher:      'Ms Sarah Naidoo',
        teacherEmail: 'snaidoo@kingsmead.co.za',
        qrMode:       'once-off',
        hourMode:     'fixed',
        fixedHours:   3,
        pointsEnabled: true,
        pointsValue:  30,
        eventTypeId:  typeIdMap['Environmental'],
        eventCategoryId: catIdMap['Environmental Conservation'],
        captureOptions: { hasDescription: true, hasReflection: false, hasGeolocate: true },
        createdAt:    daysAgo(60),
      },
      {
        eventName:    'Elderly Home Visits — Term 1',
        school:       SCHOOL_ID_STR,
        teacher:      'Mr John Pillay',
        teacherEmail: 'jpillay@kingsmead.co.za',
        qrMode:       'in-out',
        hourMode:     'in-out',
        pointsEnabled: true,
        pointsValue:  20,
        eventTypeId:  typeIdMap['Community Service'],
        eventCategoryId: catIdMap['Elderly Care'],
        captureOptions: { hasDescription: false, hasReflection: true, hasGeolocate: false },
        createdAt:    daysAgo(45),
      },
      {
        eventName:    'Food Bank Volunteering',
        school:       SCHOOL_ID_STR,
        teacher:      'Ms Sarah Naidoo',
        teacherEmail: 'snaidoo@kingsmead.co.za',
        qrMode:       'once-off',
        hourMode:     'volume',
        volumeUnitName:  'food parcels packed',
        volumeConversion: 0.25,
        pointsEnabled: false,
        pointsValue:  0,
        eventTypeId:  typeIdMap['Food Security'],
        eventCategoryId: catIdMap['Homeless Outreach'],
        captureOptions: { hasDescription: false, hasReflection: false, hasGeolocate: false },
        createdAt:    daysAgo(30),
      },
      {
        eventName:    'Literacy Tutoring — Grade 5s',
        school:       SCHOOL_ID_STR,
        teacher:      'Mr James Coetzee',
        teacherEmail: 'jcoetzee@kingsmead.co.za',
        qrMode:       'in-out',
        hourMode:     'in-out',
        pointsEnabled: true,
        pointsValue:  15,
        eventTypeId:  typeIdMap['Academic Support'],
        eventCategoryId: catIdMap['Literacy & Education'],
        captureOptions: { hasDescription: true, hasReflection: true, hasGeolocate: false },
        createdAt:    daysAgo(20),
      },
      {
        eventName:    'Chapel Service — Term 2',
        school:       SCHOOL_ID_STR,
        teacher:      'Mr John Pillay',
        teacherEmail: 'jpillay@kingsmead.co.za',
        qrMode:       'once-off',
        hourMode:     'fixed',
        fixedHours:   1,
        pointsEnabled: true,
        pointsValue:  10,
        eventTypeId:  typeIdMap['Chapel Service'],
        eventCategoryId: catIdMap['Religious / Spiritual'],
        captureOptions: { hasDescription: false, hasReflection: false, hasGeolocate: false },
        createdAt:    daysAgo(14),
      },
      {
        eventName:    'Habitat for Humanity Build Day',
        school:       SCHOOL_ID_STR,
        teacher:      'Ms Sarah Naidoo',
        teacherEmail: 'snaidoo@kingsmead.co.za',
        qrMode:       'in-out',
        hourMode:     'in-out',
        pointsEnabled: true,
        pointsValue:  50,
        eventTypeId:  typeIdMap['Community Service'],
        eventCategoryId: catIdMap['Local Community'],
        captureOptions: { hasDescription: true, hasReflection: true, hasGeolocate: true },
        createdAt:    daysAgo(7),
      },
    ];

    const insertedEvents = await EventModel.insertMany(SAMPLE_EVENTS);
    console.log(`   ✔ Inserted ${insertedEvents.length} sample events`);

    // ── 5. Sample Attendance ─────────────────────────────
    console.log('\n🙋  Seeding sample attendance…');

    const STUDENTS = [
      { email: 'alice.smith@student.kingsmead.co.za',   firstName: 'Alice',   lastName: 'Smith',   grade: '10', class: '10A' },
      { email: 'bob.jones@student.kingsmead.co.za',     firstName: 'Bob',     lastName: 'Jones',   grade: '10', class: '10B' },
      { email: 'chloe.nkosi@student.kingsmead.co.za',   firstName: 'Chloe',   lastName: 'Nkosi',   grade: '11', class: '11A' },
      { email: 'david.patel@student.kingsmead.co.za',   firstName: 'David',   lastName: 'Patel',   grade: '11', class: '11B' },
      { email: 'emma.coetzee@student.kingsmead.co.za',  firstName: 'Emma',    lastName: 'Coetzee', grade: '9',  class: '9A'  },
    ];

    const attendanceRecords: any[] = [];

    for (const ev of insertedEvents) {
      const evAny = ev as any;
      const eventDate = evAny.createdAt as Date;

      // Each event gets 3–5 students attending
      const attendingStudents = STUDENTS.slice(0, Math.floor(randomBetween(3, 6)));

      for (const student of attendingStudents) {
        const timeIn = new Date(eventDate.getTime() + 1 * 3_600_000); // 1 hr after creation

        let timeOut: Date | undefined;
        let hours: number | undefined;

        if (evAny.hourMode === 'in-out') {
          const durationHours = parseFloat(randomBetween(1, 4).toFixed(2));
          timeOut = hoursLater(timeIn, durationHours);
          hours = parseFloat(((timeOut.getTime() - timeIn.getTime()) / 3_600_000).toFixed(2));
        } else if (evAny.hourMode === 'fixed') {
          hours = evAny.fixedHours ?? 1;
        } else if (evAny.hourMode === 'volume') {
          const units = Math.floor(randomBetween(2, 10));
          hours = parseFloat((units * (evAny.volumeConversion ?? 0.25)).toFixed(2));
        }

        const pointsAwarded = evAny.pointsEnabled ? evAny.pointsValue : 0;

        attendanceRecords.push({
          eventId:          ev._id,
          studentEmail:     student.email,
          studentFirstName: student.firstName,
          studentLastName:  student.lastName,
          studentGrade:     student.grade,
          studentClass:     student.class,
          schoolId:         SCHOOL_ID,
          timeIn,
          timeOut,
          hours,
          pointsAwarded,
          direction: 'in',
          source:    'self',
        });
      }
    }

    await AttendanceModel.insertMany(attendanceRecords);
    console.log(`   ✔ Inserted ${attendanceRecords.length} attendance records across ${insertedEvents.length} events`);
  }

  // ── Done ───────────────────────────────────────────────
  console.log('\n✅  Seed complete!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Useful test links (replace email as needed)');
  console.log('───────────────────────────────────────────────────');
  console.log('  Teacher:');
  console.log('  http://localhost:4200/teacher/events?email=snaidoo@kingsmead.co.za&role=Staff&schoolId=11338');
  console.log('');
  console.log('  Student (Alice Smith, Grade 10):');
  console.log('  http://localhost:4200/student/dashboard?email=alice.smith@student.kingsmead.co.za&role=Student&schoolId=11338&first=Alice&last=Smith&grade=10&class=10A');
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
