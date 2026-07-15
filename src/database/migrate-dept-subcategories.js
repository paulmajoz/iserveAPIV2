/**
 * migrate-dept-subcategories.js
 *
 * Converts the schools.departments field from a flat string[]  →  { name, subcategories: [] }[]
 *
 * Run with:
 *   mongosh "mongodb://admin:<password>@localhost:27017/iserveza?authSource=admin" migrate-dept-subcategories.js
 *
 * Safe to run multiple times — skips schools already in the new format.
 */

db = db.getSiblingDB('iserveza');

let migrated = 0;
let skipped  = 0;

db.schools.find({}).forEach(school => {
  const depts = school.departments;

  // Nothing to migrate
  if (!Array.isArray(depts) || depts.length === 0) {
    skipped++;
    return;
  }

  // Already migrated (first element is an object, not a string)
  if (typeof depts[0] === 'object' && depts[0] !== null) {
    skipped++;
    print('Already migrated: ' + (school.name ?? school._id));
    return;
  }

  // Convert string[] → { name, subcategories: [] }[]
  const newDepts = depts.map(name => ({
    name,
    subcategories: [],
  }));

  db.schools.updateOne(
    { _id: school._id },
    { $set: { departments: newDepts } }
  );

  migrated++;
  print('Migrated: ' + (school.name ?? school._id) + ' (' + newDepts.length + ' depts)');
});

print('');
print('Done — migrated: ' + migrated + ', skipped (no change needed): ' + skipped);
