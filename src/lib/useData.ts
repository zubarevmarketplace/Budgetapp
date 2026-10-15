import { useLiveQuery } from 'dexie-react-hooks'
import { DEFAULT_SETTINGS, db, type Account, type Category, type Goal, type Settings, type Transaction } from '../db'

export interface Data {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  goals: Goal[]
  settings: Settings
  ready: boolean
}

const EMPTY: never[] = []

/** Живые данные всех таблиц. Объёмы личного бюджета маленькие, поэтому грузим всё целиком. */
export function useData(): Data {
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [])
  const goals = useLiveQuery(() => db.goals.orderBy('order').toArray(), [])
  const settings = useLiveQuery(() => db.settings.get(1), [])
  return {
    accounts: accounts ?? EMPTY,
    categories: categories ?? EMPTY,
    transactions: transactions ?? EMPTY,
    goals: goals ?? EMPTY,
    settings: settings ?? DEFAULT_SETTINGS,
    ready: !!accounts && !!categories && !!transactions && !!goals && !!settings,
  }
}

export const LAST_ACCOUNT_KEY = 'kopilka:lastAccount'
