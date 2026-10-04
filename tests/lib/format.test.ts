import { describe, expect, it } from 'vitest';
import { fuzzyDays } from '@/lib/format';

describe('fuzzyDays', () => {
  it('counts days up to 10, then weeks up to 6, then months, rounded', () => {
    expect(fuzzyDays(1)).toEqual({ count: 1, unit: 'day' });
    expect(fuzzyDays(10)).toEqual({ count: 10, unit: 'days' });
    expect(fuzzyDays(11)).toEqual({ count: 2, unit: 'weeks' });
    expect(fuzzyDays(48)).toEqual({ count: 7, unit: 'weeks' });
    expect(fuzzyDays(49)).toEqual({ count: 2, unit: 'months' });
    expect(fuzzyDays(365)).toEqual({ count: 12, unit: 'months' });
  });
});
