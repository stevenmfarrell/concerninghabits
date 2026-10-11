import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/auth';
import { MAX_BACKUP_BYTES, parseBackup, toCsv, toJson, type BackupFormat } from '@/lib/backup';
import { collectBackup, restoreBackup } from '@/app/actions/backupStore';
import { todayKeyFor } from '@/lib/timezone';
import { prisma } from '@/lib/prisma';

// The signed-in user's backup (see src/lib/backup.ts): GET downloads it, as JSON or (with
// ?format=csv) CSV; POST restores one, the file's text as the body. A route rather than server
// actions, since a backup can be bigger than a server action's request may be. The proxy doesn't
// run here, so each checks the session itself; its cookie is SameSite=Lax, so another site can't
// post here as the user.

export async function GET(request: Request) {
  const session = await verifySession();
  if (!session) return new Response('Signed out', { status: 401 });
  const format: BackupFormat = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json';

  const backup = await collectBackup(session.userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { timeZone: true, bedtime: true } });
  const day = todayKeyFor({ timeZone: user.timeZone ?? 'UTC', bedtime: user.bedtime });
  return new Response(format === 'csv' ? toCsv(backup) : toJson(backup), {
    headers: {
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="concerning-habits-backup-${day}.${format}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  const session = await verifySession();
  if (!session) return Response.json({ error: 'You\'re signed out' }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BACKUP_BYTES) return Response.json({ error: 'This file is too big to restore' }, { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BACKUP_BYTES) return Response.json({ error: 'This file is too big to restore' }, { status: 413 });

  const parsed = parseBackup(text);
  if ('problem' in parsed) return Response.json({ error: parsed.problem }, { status: 400 });
  const result = await restoreBackup(session.userId, parsed.backup);
  // Anything can have changed, everywhere
  revalidatePath('/', 'layout');
  return Response.json(result);
}
