import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from './migrations';

const DATABASE_NAME = 'mediacare.db';

let opening: Promise<SQLiteDatabase> | null = null;

/** The catalog database, opened and migrated once per app launch. */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!opening) {
    opening = openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
    // A failed open shouldn't poison later attempts.
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}

async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= MIGRATIONS.length) return;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let version = current; version < MIGRATIONS.length; version += 1) {
      await txn.execAsync(MIGRATIONS[version]);
    }
    // PRAGMA can't take a bound parameter; the value is our own integer.
    await txn.execAsync(`PRAGMA user_version = ${MIGRATIONS.length}`);
  });
}
