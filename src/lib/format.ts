const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const rubCents = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export function money(n: number, opts: { cents?: boolean; sign?: boolean } = {}): string {
  const f = opts.cents ? rubCents : rub
  const s = f.format(Math.abs(n)) + ' ₽'
  if (opts.sign) return (n < 0 ? '−' : n > 0 ? '+' : '') + s
  return (n < 0 ? '−' : '') + s
}

export function pct(n: number): string {
  return Math.round(n * 100) + ' %'
}

/** Парсит «1 500,50» → 1500.5 */
export function parseAmount(s: string): number {
  const v = Number(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
