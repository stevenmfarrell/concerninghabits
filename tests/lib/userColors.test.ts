import { describe, expect, it } from 'vitest';
import { assignUserColors } from '@/lib/userColors';

const GREEN = '#10b981';
const BLUE = '#0ea5e9';
const AMBER = '#f59e0b';

const users = [
  { id: 'first', name: 'First' },
  { id: 'second', name: 'Second' },
  { id: 'third', name: 'Third' },
];

describe('assignUserColors', () => {
  it('makes the viewer green and gives everyone else the other colors in account order', () => {
    const colors = assignUserColors(users, 'first');
    expect(colors.first.color).toBe(GREEN);
    expect(colors.second.color).toBe(BLUE);
    expect(colors.third.color).toBe(AMBER);
  });

  it('keeps others in account order around a viewer who isn\'t the first account', () => {
    const colors = assignUserColors(users, 'second');
    expect(colors.second.color).toBe(GREEN);
    expect(colors.first.color).toBe(BLUE);
    expect(colors.third.color).toBe(AMBER);
  });

  it('never gives anyone but the viewer green, even with more people than colors', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `u${i}`, name: `User ${i}` }));
    const colors = assignUserColors(many, 'u5');
    const greens = Object.values(colors).filter(p => p.color === GREEN).map(p => p.id);
    expect(greens).toEqual(['u5']);
  });
});
