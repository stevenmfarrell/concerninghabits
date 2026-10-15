import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, connectSignedInUserTo } from '../setup';
import { deleteCalculatedField, saveCalculatedField } from '@/app/actions/charts';
import { saveHabit, setHabitSharing, updateHabit } from '@/app/actions/habits';
import { parseCalculatedFields, type CalculatedField } from '@/lib/calculatedFields';
import type { HabitSchema } from '@/lib/types';

const runSchema: HabitSchema = {
  type: 'object',
  properties: {
    distance: { type: 'number', title: 'Distance', 'x-unit': 'miles' } as HabitSchema,
    duration: { type: 'number', title: 'Duration', 'x-widget': 'duration' } as HabitSchema,
  },
};

const pace = { title: 'Pace', expression: 'duration / distance', unit: 'min/mile', format: 'duration' as const };

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date('2100-01-01') },
  });
  return { user, sessionId: session.id };
}

async function storedFields(habitId: string) {
  return parseCalculatedFields((await prisma.habit.findUniqueOrThrow({ where: { id: habitId } })).calculatedFields);
}

describe('calculated fields', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let habitId: string;

  beforeEach(async () => {
    owner = await createTestUser('Owner');
    setSessionCookie(owner.sessionId);
    habitId = (await saveHabit('Run', '', runSchema)).id;
  });

  it('adds one under a key made from its title, then changes it in place', async () => {
    const saved = await saveCalculatedField(habitId, null, pace);
    expect(saved).toEqual({ key: 'pace', ...pace });

    await saveCalculatedField(habitId, 'pace', { ...pace, title: 'Pace per mile' });
    expect(await storedFields(habitId)).toEqual([{ key: 'pace', ...pace, title: 'Pace per mile' }]);

    await deleteCalculatedField(habitId, 'pace');
    expect(await storedFields(habitId)).toEqual([]);
  });

  it("makes a key unlike the form's and the other calculated fields'", async () => {
    const distance = await saveCalculatedField(habitId, null, { title: 'Distance', expression: 'distance * 1.609', unit: 'km', format: 'number' });
    expect(distance.key).toBe('distance2');
    expect((await saveCalculatedField(habitId, null, { ...pace, title: 'Distance' })).key).toBe('distance3');
  });

  it("rejects a formula that doesn't work with the form", async () => {
    await expect(saveCalculatedField(habitId, null, { ...pace, expression: 'duration / pace' })).rejects.toThrow("the form doesn't have");
    await expect(saveCalculatedField(habitId, null, { ...pace, expression: 'duration /' })).rejects.toThrow();
    await expect(saveCalculatedField(habitId, 'missing', pace)).rejects.toThrow('no longer exists');
  });

  it('saves them with the whole habit, and leaves them alone when an update leaves them out', async () => {
    const fields: CalculatedField[] = [{ key: 'pace', ...pace }];
    const habit = await saveHabit('Ride', '', runSchema, undefined, undefined, false, undefined, fields);
    expect(await storedFields(habit.id)).toEqual(fields);

    await updateHabit(habit.id, 'Ride', '', runSchema);
    expect(await storedFields(habit.id)).toEqual(fields);

    // One whose field was removed from the form is kept, to be fixed in the editor
    const withoutDistance: HabitSchema = { type: 'object', properties: { duration: runSchema.properties!.duration } };
    await updateHabit(habit.id, 'Ride', '', withoutDistance, undefined, undefined, false, undefined, fields);
    expect(await storedFields(habit.id)).toEqual(fields);

    await updateHabit(habit.id, 'Ride', '', runSchema, undefined, undefined, false, undefined, []);
    expect(await storedFields(habit.id)).toEqual([]);
  });

  it("rejects a key that clashes with a form field's, or a list that isn't valid", async () => {
    await expect(updateHabit(habitId, 'Run', '', runSchema, undefined, undefined, false, undefined, [{ key: 'distance', ...pace }])).rejects.toThrow('same key as a form field');
    await expect(updateHabit(habitId, 'Run', '', runSchema, undefined, undefined, false, undefined, [{ key: 'pace', ...pace, expression: '(' }])).rejects.toThrow();
  });

  it('only lets the owner change them, even on a shared habit', async () => {
    await saveCalculatedField(habitId, null, pace);
    const member = await createTestUser('Member');
    await connectSignedInUserTo(member.user.id);
    await setHabitSharing(habitId, [member.user.id]);

    setSessionCookie(member.sessionId);
    await expect(saveCalculatedField(habitId, null, { ...pace, title: 'Mine' })).rejects.toThrow('Unauthorized');
    await expect(saveCalculatedField(habitId, 'pace', { ...pace, title: 'Mine' })).rejects.toThrow('Unauthorized');
    await expect(deleteCalculatedField(habitId, 'pace')).rejects.toThrow('Unauthorized');
    expect((await storedFields(habitId)).map(f => f.title)).toEqual(['Pace']);
  });
});
