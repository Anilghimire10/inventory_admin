import { describe, expect, it } from 'vitest';
import { dayEnd, dayStart } from './date-range';

describe('day range', () => {
  it('covers the whole local day, start to last millisecond', () => {
    const start = new Date(dayStart('2026-09-28')!);
    const end = new Date(dayEnd('2026-09-28')!);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('an empty box means no bound', () => {
    expect(dayStart('')).toBeUndefined();
    expect(dayEnd('')).toBeUndefined();
  });
});
