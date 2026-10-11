import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, toCsv, toJson, type Backup } from '@/lib/backup';

const backup: Backup = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: '2026-10-11T12:00:00.000Z',
  preferences: { bedtime: '01:00', weekStartsOn: 'monday', useEmojiTitle: true, unitSystem: 'metric', emojiModifier: null },
  categories: [
    { id: 'c1', name: 'Fitness', icon: 'Dumbbell', parentId: null, order: 0, cadence: { type: 'none' } },
    { id: 'c2', name: 'Cardio, "outdoor"', icon: null, parentId: 'c1', order: 1, cadence: { type: 'calendarWeek', times: 3 } },
  ],
  habits: [{
    id: 'h1', name: 'Running', description: 'Notes, with\na line break',
    schema: { type: 'object', properties: { distance: { type: 'number', title: 'Distance' } }, required: ['distance'] },
    cadence: { type: 'weekdays', days: [1, 3, 5] }, calculatedFields: [], charts: [], publishToMqtt: false,
    createdAt: '2026-09-01T08:00:00.000Z', categoryId: 'c2', order: 2, aiContext: null, remind: true, remindAt: '07:30',
  }],
  entries: [{ id: 'e1', habitId: 'h1', createdAt: '2026-10-07T23:14:00.000Z', values: { distance: 3 } }],
  habitSkips: [{ habitId: 'h1', day: '2026-10-09' }],
  categorySkips: [{ categoryId: 'c2', day: '2026-10-05' }],
  vacations: [{ from: '2026-12-20', to: null }, { from: '2026-07-01', to: '2026-07-04' }],
};

describe('backups', () => {
  it('come back the same from JSON', () => {
    expect(parseBackup(toJson(backup))).toEqual({ backup });
  });

  it('come back the same from CSV, quoting included', () => {
    const csv = toCsv(backup);
    expect(csv.split('\r\n')[0]).toBe('record,id,parent,name,date,data');
    expect(parseBackup(csv)).toEqual({ backup });
  });

  it('read a CSV with a byte order mark, as a spreadsheet may save it', () => {
    expect(parseBackup('﻿' + toCsv(backup))).toEqual({ backup });
  });

  it('fill in what a backup leaves out as nothing', () => {
    const minimal = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: backup.exportedAt };
    expect(parseBackup(JSON.stringify(minimal))).toEqual({ backup: { ...minimal, preferences: {}, categories: [], habits: [], entries: [], habitSkips: [], categorySkips: [], vacations: [] } });
  });

  it('say why a file can\'t be restored', () => {
    expect(parseBackup('{ not json')).toEqual({ problem: 'This file isn\'t valid JSON' });
    expect(parseBackup(JSON.stringify({ ...backup, format: 'something-else' }))).toEqual({ problem: 'This isn\'t a Concerning Habits backup' });
    expect(parseBackup(JSON.stringify({ ...backup, version: 2 }))).toEqual({ problem: 'This backup is from a newer version of the app' });
    expect(parseBackup('Date,Distance\n2026-01-01,3\n')).toMatchObject({ problem: expect.stringMatching(/^This isn't a backup/) });
    expect(parseBackup('record,id,parent,name,date,data\nwidget,,,,,\n')).toEqual({ problem: 'Row 2: "widget" isn\'t something a backup has' });
    expect(parseBackup(JSON.stringify({ ...backup, habitSkips: [{ habitId: 'h1', day: 'yesterday' }] }))).toMatchObject({ problem: expect.stringContaining('habitSkips.0.day') });
  });
});
