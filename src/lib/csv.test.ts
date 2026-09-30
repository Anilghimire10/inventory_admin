import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

const lines = (csv: string) => csv.replace('﻿', '').split('\r\n');

describe('toCsv', () => {
  it('starts with a BOM so Excel reads Nepali text as UTF-8', () => {
    expect(toCsv(['Name'], [['पसल']]).charCodeAt(0)).toBe(0xfeff);
    expect(lines(toCsv(['Name'], [['पसल']]))[1]).toBe('पसल');
  });

  it('quotes cells with commas, quotes or line breaks', () => {
    const [, row] = lines(toCsv(['a', 'b', 'c'], [['Ram, Sita', 'say "hi"', 'two\nlines']]));
    expect(row).toBe('"Ram, Sita","say ""hi""","two\nlines"');
  });

  it("neutralises a leading = + - @ so a shop name can't run as a formula", () => {
    const [, row] = lines(toCsv(['n', 'm', 'o', 'p'], [['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)']]));
    expect(row).toBe(`"'=HYPERLINK(""x"")",'+1,'-2,'@SUM(A1)`);
  });

  it('writes blanks for null and undefined, and ISO for dates', () => {
    const [, row] = lines(toCsv(['a', 'b', 'c'], [[null, undefined, new Date('2026-09-28T10:00:00.000Z')]]));
    expect(row).toBe(',,2026-09-28T10:00:00.000Z');
  });
});
