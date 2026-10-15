import { SAVING_TYPES, type Account, type Category, type Goal, type Transaction } from '../db'
import { addMonths, fromISO, periodFor, toISO, today } from './dates'

export function inPeriod(t: Transaction, start: string, end: string) {
  return t.date >= start && t.date <= end
}

export function isSavingAccount(a: Account | undefined) {
  return !!a && SAVING_TYPES.includes(a.type)
}

/** Текущие балансы всех счетов. */
export function balances(accounts: Account[], txs: Transaction[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const a of accounts) m.set(a.id, a.initialBalance)
  const add = (id: number | undefined, v: number) => {
    if (id === undefined) return
    m.set(id, (m.get(id) ?? 0) + v)
  }
  for (const t of txs) {
    switch (t.type) {
      case 'expense':
        add(t.accountId, -t.amount)
        break
      case 'income':
      case 'interest':
        add(t.accountId, t.amount)
        break
      case 'transfer':
        add(t.accountId, -t.amount)
        add(t.toAccountId, t.amount)
        break
    }
  }
  return m
}

/** Перевод считается «отложено», если деньги ушли с повседневного счёта на накопительный. */
export function isSavingTransfer(t: Transaction, accById: Map<number, Account>) {
  if (t.type !== 'transfer') return false
  const from = accById.get(t.accountId)
  const to = accById.get(t.toAccountId ?? -1)
  return isSavingAccount(to) && !isSavingAccount(from)
}

/** Снятие с накоплений на повседневный счёт. */
export function isUnsavingTransfer(t: Transaction, accById: Map<number, Account>) {
  if (t.type !== 'transfer') return false
  const from = accById.get(t.accountId)
  const to = accById.get(t.toAccountId ?? -1)
  return isSavingAccount(from) && !isSavingAccount(to)
}

export interface MonthStats {
  funSpent: number
  groceries: number
  fixed: number
  other: number
  spent: number
  income: number
  interest: number
  saved: number
  savingsRate: number
  byCategory: Map<number, number>
}

export function monthStats(txs: Transaction[], categories: Category[], accounts: Account[], start: string, end: string): MonthStats {
  const catById = new Map(categories.map((c) => [c.id, c]))
  const accById = new Map(accounts.map((a) => [a.id, a]))
  const s: MonthStats = { funSpent: 0, groceries: 0, fixed: 0, other: 0, spent: 0, income: 0, interest: 0, saved: 0, savingsRate: 0, byCategory: new Map() }
  for (const t of txs) {
    if (!inPeriod(t, start, end)) continue
    if (t.type === 'expense') {
      s.spent += t.amount
      const kind = catById.get(t.categoryId ?? -1)?.kind ?? 'other'
      if (kind === 'fun') s.funSpent += t.amount
      else if (kind === 'groceries') s.groceries += t.amount
      else if (kind === 'fixed') s.fixed += t.amount
      else s.other += t.amount
      if (t.categoryId !== undefined) s.byCategory.set(t.categoryId, (s.byCategory.get(t.categoryId) ?? 0) + t.amount)
    } else if (t.type === 'income') s.income += t.amount
    else if (t.type === 'interest') s.interest += t.amount
    else if (isSavingTransfer(t, accById)) s.saved += t.amount
    else if (isUnsavingTransfer(t, accById)) s.saved -= t.amount
  }
  const totalIn = s.income + s.interest
  s.savingsRate = totalIn > 0 ? Math.max(0, s.saved) / totalIn : 0
  return s
}

export interface GoalProgress {
  saved: number
  remaining: number
  ratio: number
  /** Средний взнос в месяц за последние 3 периода. */
  pace: number
  /** Прогноз даты достижения при текущем темпе. */
  eta?: string
  /** Сколько нужно откладывать в месяц, чтобы успеть к дедлайну. */
  needPerMonth?: number
  monthsToDeadline?: number
}

export function goalProgress(goal: Goal, txs: Transaction[], accounts: Account[], monthStartDay: number): GoalProgress {
  const accById = new Map(accounts.map((a) => [a.id, a]))
  const contribs = txs.filter((t) => t.goalId === goal.id && t.type === 'transfer')
  const signed = (t: Transaction) => (isUnsavingTransfer(t, accById) ? -t.amount : t.amount)
  const saved = contribs.reduce((s, t) => s + signed(t), 0)
  const remaining = Math.max(0, goal.target - saved)
  const ratio = goal.target > 0 ? Math.min(1, saved / goal.target) : 0

  // Темп: среднее по последним 3 периодам, начиная с первого взноса.
  const now = new Date()
  let months = 0
  let sum = 0
  const firstDate = contribs.length ? contribs.map((t) => t.date).sort()[0] : undefined
  for (let i = 0; i < 3; i++) {
    const p = periodFor(now, monthStartDay, -i)
    if (firstDate && p.end < firstDate) break
    months++
    sum += contribs.filter((t) => inPeriod(t, p.start, p.end)).reduce((s, t) => s + signed(t), 0)
  }
  const pace = months > 0 ? sum / months : 0

  const r: GoalProgress = { saved, remaining, ratio, pace }
  if (remaining > 0 && pace > 0) {
    const n = Math.ceil(remaining / pace)
    r.eta = toISO(addMonths(now, n))
  }
  if (goal.deadline && remaining > 0) {
    const days = Math.max(0, (fromISO(goal.deadline).getTime() - fromISO(today()).getTime()) / 86400000)
    const m = Math.max(1, Math.round(days / 30.4))
    r.monthsToDeadline = m
    r.needPerMonth = remaining / m
  }
  return r
}

/** Ожидаемые проценты в месяц по ставке. */
export function monthlyInterest(balance: number, rate?: number) {
  if (!rate || balance <= 0) return 0
  return (balance * rate) / 100 / 12
}
