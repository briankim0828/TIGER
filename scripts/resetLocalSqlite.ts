// Dev utility: wipe the Expo SQLite database so that tables are recreated
// with the latest FK constraints on next app start.
// Usage (node): ts-node scripts/resetLocalSqlite.ts (if ts-node available) or compile.
// In Expo context you typically delete via device filesystem; this script is
// mainly for future Node-based tooling / CI smoke flows.

import fs from 'fs';
import path from 'path';

// Default filename used in provider.tsx
const DB_FILENAME = 'pr_app.db';

// Common search roots (adjust if you relocate the db storage path)
const candidateDirs = [
  process.cwd(),
  path.join(process.cwd(), 'data'),
];

let removed = false;
for (const dir of candidateDirs) {
  const p = path.join(dir, DB_FILENAME);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { force: true });
    console.log(`[resetLocalSqlite] Removed ${p}`);
    removed = true;
  }
}

if (!removed) {
  console.log('[resetLocalSqlite] No local SQLite file found (may already be clean, or stored in device sandbox).');
} else {
  console.log('[resetLocalSqlite] Next app launch will recreate schema & re-seed.');
}
