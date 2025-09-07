/* Smoke test for exercise_catalog integrity.
   Run with ts-node or tsx after build environment is ready. */
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { exerciseCatalog } from '../../src/db/sqlite/schema';
import { EXERCISE_MODALITIES, BODY_PARTS } from '../../src/db/catalog/enums';

(async () => {
  const db = await SQLite.openDatabaseAsync('pr_app.db');
  const orm = drizzle(db as any);
  const rows = await orm.select().from(exerciseCatalog);
  const modalitySet = new Set(EXERCISE_MODALITIES);
  const bodySet = new Set(BODY_PARTS);
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  let badSlug = 0; let badModality = 0; let badBody = 0; let missingSlug = 0;
  for (const r of rows) {
    if (!r.slug) missingSlug++;
    else if (!slugRegex.test(r.slug)) badSlug++;
    if (r.modality && !modalitySet.has(r.modality as any)) badModality++;
    if (r.bodyPart && !bodySet.has(r.bodyPart as any)) badBody++;
  }

  const pass = rows.length >= 10 && badSlug === 0 && badModality === 0 && badBody === 0 && missingSlug === 0;
  if (pass) {
    console.log(`[smoke] exercise_catalog OK (rows=${rows.length})`);
  } else {
    console.error('[smoke] FAIL', { rows: rows.length, missingSlug, badSlug, badModality, badBody });
    process.exit(1);
  }
})();
