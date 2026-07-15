/**
 * ═══════════════════════════════════════════════════════════════
 *  Seed departments + categories onto every school document
 *
 *  Only fills in the fields if they are currently empty —
 *  safe to re-run without overwriting custom values.
 *
 *  Usage (from iserveAPIV2/):
 *    npm run seed-lookups
 * ═══════════════════════════════════════════════════════════════
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/iserveza';

const DEFAULT_DEPARTMENTS = [
  'Community Service',
  'Sport',
  'Arts & Culture',
  'Environment',
  'Academic',
  'Leadership',
  'Faith & Chaplaincy',
  'Other',
];

const DEFAULT_CATEGORIES = [
  'Outreach',
  'Fundraising',
  'Awareness',
  'Competition',
  'Workshop',
  'Cultural',
  'Volunteering',
  'Other',
];

async function run() {
  console.log('Connecting to:', MONGO_URI.replace(/:\/\/.*@/, '://***@'));
  await mongoose.connect(MONGO_URI);

  const db = mongoose.connection.db;
  if (!db) throw new Error('No DB connection');

  const schools = await db.collection('schools').find({}).toArray();
  console.log(`Found ${schools.length} school(s)\n`);

  let updated = 0;
  let skipped = 0;

  for (const school of schools) {
    const hasDepts = Array.isArray(school.departments) && school.departments.length > 0;
    const hasCats  = Array.isArray(school.categories)  && school.categories.length  > 0;

    if (hasDepts && hasCats) {
      console.log(`  SKIP  schoolId=${school.schoolId}  "${school.name}" — already has values`);
      skipped++;
      continue;
    }

    const $set: any = {};
    if (!hasDepts) $set.departments = DEFAULT_DEPARTMENTS;
    if (!hasCats)  $set.categories  = DEFAULT_CATEGORIES;

    await db.collection('schools').updateOne({ _id: school._id }, { $set });

    console.log(`  SET   schoolId=${school.schoolId}  "${school.name}"`);
    if (!hasDepts) console.log(`         departments → [${DEFAULT_DEPARTMENTS.join(', ')}]`);
    if (!hasCats)  console.log(`         categories  → [${DEFAULT_CATEGORIES.join(', ')}]`);
    updated++;
  }

  console.log(`\nDone — ${updated} updated, ${skipped} skipped.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
