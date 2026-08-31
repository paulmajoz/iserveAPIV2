/**
 * migrate-subcategory-limits.js
 *
 * Converts schools.departments[].subcategories from a flat string[]  →  { name, hoursLimit, pointsLimit }[]
 *
 * Run with:
 *   mongosh "mongodb://admin:<password>@localhost:27017/iserveza?authSource=admin" migrate-subcategory-limits.js
 *
 * Safe to run multiple times — skips departments already in the new format.
 */

db = db.getSiblingDB('iserveza');

let migrated = 0;
let skipped  = 0;

db.schools.find({}).forEach(school => {
  const depts = school.departments;

  // Nothing to migrate (not yet on the {name, subcategories} dept shape)
  if (!Array.isArray(depts) || depts.length === 0) {
    skipped++;
    return;
  }

  let changed = false;

  const newDepts = depts.map(dept => {
    const subs = dept.subcategories;

    if (!Array.isArray(subs) || subs.length === 0) {
      return dept;
    }

    // Already migrated (first element is an object, not a string)
    if (typeof subs[0] === 'object' && subs[0] !== null) {
      return dept;
    }

    changed = true;
    return {
      ...dept,
      subcategories: subs.map(name => ({
        name,
        hoursLimit: null,
        pointsLimit: null,
      })),
    };
  });

  if (!changed) {
    skipped++;
    print('Already migrated: ' + (school.name ?? school._id));
    return;
  }

  db.schools.updateOne(
    { _id: school._id },
    { $set: { departments: newDepts } }
  );

  migrated++;
  print('Migrated: ' + (school.name ?? school._id));
});

print('');
print('Done — migrated: ' + migrated + ', skipped (no change needed): ' + skipped);
