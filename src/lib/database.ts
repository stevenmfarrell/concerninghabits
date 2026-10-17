import { prisma } from './prisma';

// Switches the SQLite database to its write-ahead log, so pages can keep reading while an entry or a
// reminder is being written, rather than waiting on it (Prisma already waits up to 5 seconds for a
// lock instead of failing). The setting is kept in the database file, so after the first start this
// only confirms it. A database on a network share (NFS, SMB) can't use it, as SQLite needs shared
// memory on the same machine; that's reported and the default journal is kept. Server-only.
export async function enableWriteAheadLog() {
  try {
    const [row] = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode = WAL');
    if (row?.journal_mode?.toLowerCase() !== 'wal') {
      console.warn(`The database stayed in "${row?.journal_mode}" journal mode rather than WAL. Is it on a network share? Keep /app/data on a local disk.`);
    }
  } catch (error) {
    console.error('Couldn\'t switch the database to WAL', error);
  }
}
