import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns'

export function now(): string {
  return new Date().toISOString()
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return format(parseISO(iso), 'd MMM yyyy')
  } catch {
    return iso
  }
}

export function parseDate(str: string): Date | null {
  try {
    return parseISO(str)
  } catch {
    return null
  }
}

export function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false
  return isBefore(parseISO(dateStr), startOfDay(new Date()))
}

export function isDueToday(dateStr: string): boolean {
  if (!dateStr) return false
  return isToday(parseISO(dateStr))
}

export function formatMonthYear(yyyyMm: string): string {
  try {
    return format(parseISO(`${yyyyMm}-01`), 'MMMM yyyy')
  } catch {
    return yyyyMm
  }
}

export function currentMonthISO(): string {
  return format(new Date(), 'yyyy-MM')
}
