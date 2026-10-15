import Dexie, { type EntityTable } from 'dexie'

export type AccountType = 'card' | 'cash' | 'deposit' | 'savings'
export const SAVING_TYPES: AccountType[] = ['deposit', 'savings']

export interface Account {
  id: number
  name: string
  emoji: string
  type: AccountType
  /** Баланс на момент создания счёта; текущий баланс = initialBalance + движения. */
  initialBalance: number
  /** Ставка, % годовых (для вкладов и накопительных). */
  rate?: number
  archived?: boolean
  order: number
}

export type CategoryKind = 'fun' | 'groceries' | 'fixed' | 'other'

export interface Category {
  id: number
  name: string
  emoji: string
  kind: CategoryKind
  archived?: boolean
  order: number
}

export type TxType = 'expense' | 'income' | 'interest' | 'transfer'

export interface Transaction {
  id: number
  /** YYYY-MM-DD (локальная дата). */
  date: string
  type: TxType
  amount: number
  /** Счёт списания (для expense/transfer) или зачисления (для income/interest). */
  accountId: number
  /** Счёт зачисления для transfer. */
  toAccountId?: number
  categoryId?: number
  /** Перевод «на цель». */
  goalId?: number
  note?: string
  createdAt: number
}

export interface Goal {
  id: number
  name: string
  emoji: string
  target: number
  /** YYYY-MM-DD */
  deadline?: string
  done?: boolean
  order: number
}

export interface Settings {
  id: number
  funLimit: number
  /** День месяца, с которого считается «бюджетный месяц» (1 = календарный). */
  monthStartDay: number
  lastBackupAt?: number
}

export const db = new Dexie('kopilka') as Dexie & {
  accounts: EntityTable<Account, 'id'>
  categories: EntityTable<Category, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  goals: EntityTable<Goal, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  accounts: '++id, type, order',
  categories: '++id, kind, order',
  transactions: '++id, date, type, accountId, toAccountId, categoryId, goalId',
  goals: '++id, order',
  settings: 'id',
})

export const DEFAULT_SETTINGS: Settings = { id: 1, funLimit: 5000, monthStartDay: 1 }

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Ништяки', emoji: '🍰', kind: 'fun', order: 0 },
  { name: 'Кафе и кофе', emoji: '☕', kind: 'fun', order: 1 },
  { name: 'Одежда', emoji: '👗', kind: 'fun', order: 2 },
  { name: 'Развлечения', emoji: '🎬', kind: 'fun', order: 3 },
  { name: 'Подарки', emoji: '🎁', kind: 'fun', order: 4 },
  { name: 'Продукты', emoji: '🛒', kind: 'groceries', order: 10 },
  { name: 'Жильё', emoji: '🏠', kind: 'fixed', order: 20 },
  { name: 'Связь', emoji: '📱', kind: 'fixed', order: 21 },
  { name: 'Транспорт', emoji: '🚌', kind: 'fixed', order: 22 },
  { name: 'Здоровье', emoji: '💊', kind: 'fixed', order: 23 },
  { name: 'Спорт', emoji: '🏋️', kind: 'fixed', order: 24 },
  { name: 'Другое', emoji: '📦', kind: 'other', order: 30 },
]

const DEFAULT_ACCOUNTS: Omit<Account, 'id'>[] = [
  { name: 'Карта', emoji: '💳', type: 'card', initialBalance: 0, order: 0 },
  { name: 'Наличные', emoji: '💵', type: 'cash', initialBalance: 0, order: 1 },
  { name: 'Накопительный счёт', emoji: '🏦', type: 'savings', initialBalance: 0, rate: 10, order: 2 },
]

/** Заполняет базу стартовыми данными при первом запуске. */
export async function seedIfEmpty() {
  await db.transaction('rw', db.settings, db.categories, db.accounts, async () => {
    if (!(await db.settings.get(1))) await db.settings.add(DEFAULT_SETTINGS)
    if ((await db.categories.count()) === 0) await db.categories.bulkAdd(DEFAULT_CATEGORIES as Category[])
    if ((await db.accounts.count()) === 0) await db.accounts.bulkAdd(DEFAULT_ACCOUNTS as Account[])
  })
}

export interface Backup {
  app: 'kopilka'
  version: 1
  exportedAt: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  goals: Goal[]
  settings: Settings[]
}

export async function exportBackup(): Promise<Backup> {
  const [accounts, categories, transactions, goals, settings] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.goals.toArray(),
    db.settings.toArray(),
  ])
  return { app: 'kopilka', version: 1, exportedAt: new Date().toISOString(), accounts, categories, transactions, goals, settings }
}

export function isBackup(x: unknown): x is Backup {
  if (!x || typeof x !== 'object') return false
  const b = x as Partial<Backup>
  return b.app === 'kopilka' && Array.isArray(b.accounts) && Array.isArray(b.categories) && Array.isArray(b.transactions) && Array.isArray(b.goals)
}

/** Полностью заменяет данные содержимым бэкапа. */
export async function importBackup(b: Backup) {
  await db.transaction('rw', db.accounts, db.categories, db.transactions, db.goals, db.settings, async () => {
    await Promise.all([db.accounts.clear(), db.categories.clear(), db.transactions.clear(), db.goals.clear(), db.settings.clear()])
    await db.accounts.bulkAdd(b.accounts)
    await db.categories.bulkAdd(b.categories)
    await db.transactions.bulkAdd(b.transactions)
    await db.goals.bulkAdd(b.goals)
    const settings = b.settings?.[0] ?? DEFAULT_SETTINGS
    await db.settings.add({ ...settings, id: 1, lastBackupAt: Date.now() })
  })
}
