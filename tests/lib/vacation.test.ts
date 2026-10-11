import { describe, expect, it } from 'vitest';
import { currentVacation, describeVacation, endVacation, vacationProblem } from '@/lib/vacation';

const today = '2026-10-10';

describe('currentVacation', () => {
  it('finds the one going on, then the next one coming up', () => {
    const past = { id: 'past', from: '2026-09-01', to: '2026-09-05' };
    const ongoing = { id: 'ongoing', from: '2026-10-08', to: null };
    const later = { id: 'later', from: '2026-12-20', to: '2026-12-27' };
    const soon = { id: 'soon', from: '2026-11-01', to: '2026-11-02' };
    expect(currentVacation([past, ongoing, later], today)).toEqual({ ...ongoing, active: true });
    expect(currentVacation([past, later, soon], today)).toEqual({ ...soon, active: false });
    expect(currentVacation([past], today)).toBeNull();
    expect(currentVacation([{ id: 'last day', from: '2026-10-01', to: today }], today)?.active).toBe(true);
  });
});

describe('endVacation', () => {
  it('keeps the days taken, through yesterday', () => {
    expect(endVacation({ from: '2026-10-05', to: null }, today)).toEqual({ to: '2026-10-09' });
    expect(endVacation({ from: '2026-10-05', to: '2026-10-20' }, today)).toEqual({ to: '2026-10-09' });
  });

  it('removes one that hasn\'t started, or only started today', () => {
    expect(endVacation({ from: today, to: null }, today)).toEqual({ remove: true });
    expect(endVacation({ from: '2026-11-01', to: '2026-11-05' }, today)).toEqual({ remove: true });
  });
});

describe('vacationProblem', () => {
  it('allows one from today or later, ending on or after it starts, or not at all', () => {
    expect(vacationProblem(today, null, today)).toBeNull();
    expect(vacationProblem(today, today, today)).toBeNull();
    expect(vacationProblem('2026-10-12', '2026-10-20', today)).toBeNull();
    expect(vacationProblem('2026-10-09', null, today)).toMatch(/past/);
    expect(vacationProblem('2026-10-12', '2026-10-11', today)).toMatch(/before it starts/);
    expect(vacationProblem('nope', null, today)).toMatch(/valid/);
  });
});

describe('describeVacation', () => {
  it('says when it ends while it\'s on, and when it runs before it starts', () => {
    expect(describeVacation({ from: '2026-10-08', to: '2026-10-20', active: true })).toBe('On vacation until Oct 20');
    expect(describeVacation({ from: '2026-10-08', to: null, active: true })).toBe('On vacation until you end it');
    expect(describeVacation({ from: '2026-10-15', to: '2026-10-20', active: false })).toBe('Vacation from Oct 15 to Oct 20');
    expect(describeVacation({ from: '2026-10-15', to: null, active: false })).toBe('Vacation from Oct 15');
  });
});

