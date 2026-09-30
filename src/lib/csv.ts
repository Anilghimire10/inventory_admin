import type { Paginated } from '@/lib/api';

/** The API's page size cap. */
const PAGE = 100;
/** Stop here rather than hammer the API; the toast says the file was cut short. */
export const EXPORT_CAP = 10_000;

/**
 * Fetch every page of a list with the filters the screen is showing, up to
 * EXPORT_CAP rows. The lists are paginated at 100 a page on the API, so a
 * few thousand rows is a few dozen requests -- fine for an export button.
 */
export async function fetchAll<T>(fetchPage: (page: number, limit: number) => Promise<Paginated<T>>) {
  const rows: T[] = [];
  let page = 1;
  let total = 0;
  for (;;) {
    const res = await fetchPage(page, PAGE);
    total = res.meta.total;
    rows.push(...res.data);
    if (page >= res.meta.pages || rows.length >= EXPORT_CAP) break;
    page++;
  }
  return { rows: rows.slice(0, EXPORT_CAP), total, truncated: total > EXPORT_CAP };
}

/**
 * One CSV cell. Quoted when it has to be, and a leading = + - @ is
 * neutralised: a shop name like "=HYPERLINK(...)" must not run as a formula
 * when the file is opened in Excel.
 */
function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The file's text: a BOM (so Excel reads Nepali text as UTF-8), then CRLF rows. */
export function toCsv(headers: string[], rows: unknown[][]) {
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Build a CSV and download it. */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = toCsv(headers, rows);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 2026-09-28, for file names. */
export const today = () => new Date().toISOString().slice(0, 10);
