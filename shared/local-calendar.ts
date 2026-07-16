// ABOUTME: Converts stored timestamps into the local calendar parts shown throughout Movie Log.
// ABOUTME: Keeps diary headings and statistics buckets aligned without rewriting persisted ISO timestamps.

export interface LocalCalendarParts {
  dateKey: string;
  day: number;
  month: number;
  monthKey: string;
  year: number;
}

function readDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function readLocalCalendarParts(value: Date | string): LocalCalendarParts {
  const date = readDate(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');

  return {
    dateKey: `${year}-${monthText}-${dayText}`,
    day,
    month,
    monthKey: `${year}-${monthText}`,
    year
  };
}

export function readLocalCalendarDateKey(value: Date | string): string {
  return readLocalCalendarParts(value).dateKey;
}

export function readLocalCalendarMonthKey(value: Date | string): string {
  return readLocalCalendarParts(value).monthKey;
}

export function readLocalCalendarYear(value: Date | string): number {
  return readLocalCalendarParts(value).year;
}

export function createLocalCalendarDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year as number, (month as number) - 1, day as number, 12);
}
