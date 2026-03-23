// ABOUTME: Converts stored ISO timestamps into local calendar keys used by filters and trends.
// ABOUTME: Keeps local day and week semantics consistent across notebook search and analytics.
export function toLocalDateKey(
  value: string,
  timeZone = getTimeZone(),
): string {
  const date = new Date(value)
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    return value.slice(0, 10)
  }

  return `${year}-${month}-${day}`
}

export function getLocalWeekStart(
  value: string,
  timeZone = getTimeZone(),
): string {
  return shiftDateKeyToMonday(toLocalDateKey(value, timeZone))
}

export function formatDateKey(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

function shiftDateKeyToMonday(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  const dayOfWeek = date.getUTCDay()
  const shift = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  date.setUTCDate(date.getUTCDate() + shift)

  return date.toISOString().slice(0, 10)
}

function getTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
