/** Локальная дата в формате YYYY-MM-DD. */
export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): string {
  return toISO(new Date())
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

export interface Period {
  /** включительно */
  start: string
  /** включительно */
  end: string
  label: string
}

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре']
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

/**
 * Бюджетный период, в который попадает дата `ref`, сдвинутый на `offset` месяцев.
 * При startDay = 1 это календарный месяц; при 10 — с 10-го по 9-е следующего.
 */
export function periodFor(ref: Date, startDay: number, offset = 0): Period {
  const day = Math.min(Math.max(1, startDay), 28)
  let start = new Date(ref.getFullYear(), ref.getMonth(), day)
  if (ref.getDate() < day) start = addMonths(start, -1)
  start = addMonths(start, offset)
  const next = addMonths(start, 1)
  const end = new Date(next.getTime() - 86400000)
  const label =
    day === 1
      ? capitalize(MONTHS[start.getMonth()]) + (start.getFullYear() !== ref.getFullYear() ? ` ${start.getFullYear()}` : '')
      : `${start.getDate()} ${MONTHS_GEN[start.getMonth()]} – ${end.getDate()} ${MONTHS_GEN[end.getMonth()]}`
  return { start: toISO(start), end: toISO(end), label }
}

export function formatDateLong(iso: string): string {
  const d = fromISO(iso)
  const t = new Date()
  const y = new Date(t.getTime() - 86400000)
  if (iso === toISO(t)) return 'Сегодня'
  if (iso === toISO(y)) return 'Вчера'
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}` + (d.getFullYear() !== t.getFullYear() ? ` ${d.getFullYear()}` : '')
}

/** «в январе 2027» */
export function formatMonthPrep(d: Date): string {
  return `в ${MONTHS_PREP[d.getMonth()]} ${d.getFullYear()}`
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000)
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
