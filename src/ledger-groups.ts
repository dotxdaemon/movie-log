// ABOUTME: Groups visible history entries into local calendar-day sections for the ledger.
// ABOUTME: Labels each section Today, Yesterday, or the full local date for older days.
import type { WatchEntry } from '../shared/types.js';

export interface LedgerDayGroup {
  entries: WatchEntry[];
  key: string;
  label: string;
}

const dayLabelFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });

function readDayKey(time: Date): string {
  return `${time.getFullYear()}-${time.getMonth()}-${time.getDate()}`;
}

function readDayLabel(time: Date, now: Date): string {
  const dayKey = readDayKey(time);

  if (dayKey === readDayKey(now)) {
    return 'Today';
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  if (dayKey === readDayKey(yesterday)) {
    return 'Yesterday';
  }

  return dayLabelFormatter.format(time);
}

export function groupEntriesByDay(entries: WatchEntry[], now: Date): LedgerDayGroup[] {
  const groups: LedgerDayGroup[] = [];
  let currentGroup: LedgerDayGroup | null = null;
  let currentKey = '';

  for (const entry of entries) {
    const watchedTime = new Date(entry.watchedAt);
    const dayKey = readDayKey(watchedTime);

    if (!currentGroup || dayKey !== currentKey) {
      currentKey = dayKey;
      currentGroup = { entries: [], key: dayKey, label: readDayLabel(watchedTime, now) };
      groups.push(currentGroup);
    }

    currentGroup.entries.push(entry);
  }

  return groups;
}
