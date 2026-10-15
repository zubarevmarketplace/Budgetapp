import { useEffect, useMemo, useState } from 'react'
import { db, type Transaction, type TxType } from '../db'
import { today } from '../lib/dates'
import { parseAmount } from '../lib/format'
import { isSavingAccount } from '../lib/stats'
import { LAST_ACCOUNT_KEY, type Data } from '../lib/useData'
import { Sheet } from './Sheet'

export type TxDraft = Partial<Transaction>

interface Props {
  open: boolean
  onClose: () => void
  data: Data
  /** Полная запись для редактирования (с id) или подсказка полей для новой. */
  initial?: TxDraft
}

type Mode = 'expense' | 'income' | 'transfer'

export function AddSheet({ open, onClose, data, initial }: Props) {
  const { accounts, categories, goals } = data
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts])
  const activeCategories = useMemo(() => categories.filter((c) => !c.archived), [categories])
  const activeGoals = useMemo(() => goals.filter((g) => !g.done), [goals])

  const [mode, setMode] = useState<Mode>('expense')
  const [isInterest, setIsInterest] = useState(false)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [accountId, setAccountId] = useState<number | undefined>()
  const [toAccountId, setToAccountId] = useState<number | undefined>()
  const [goalId, setGoalId] = useState<number | undefined>()
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  // Сброс формы при каждом открытии.
  useEffect(() => {
    if (!open) return
    const t = initial ?? {}
    const type: TxType = t.type ?? 'expense'
    setMode(type === 'interest' ? 'income' : type)
    setIsInterest(type === 'interest')
    setAmount(t.amount ? String(t.amount) : '')
    setCategoryId(t.categoryId ?? activeCategories[0]?.id)
    const last = Number(localStorage.getItem(LAST_ACCOUNT_KEY))
    const defaultAcc = activeAccounts.find((a) => a.id === last && !isSavingAccount(a))?.id ?? activeAccounts.find((a) => !isSavingAccount(a))?.id ?? activeAccounts[0]?.id
    setAccountId(t.accountId ?? defaultAcc)
    setToAccountId(t.toAccountId ?? activeAccounts.find((a) => isSavingAccount(a))?.id)
    setGoalId(t.goalId)
    setDate(t.date ?? today())
    setNote(t.note ?? '')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const editing = initial?.id !== undefined
  const toAccount = activeAccounts.find((a) => a.id === toAccountId)
  const showGoals = mode === 'transfer' && isSavingAccount(toAccount) && activeGoals.length > 0

  async function save() {
    const value = parseAmount(amount)
    if (value <= 0) return setError('Введите сумму')
    if (accountId === undefined) return setError('Выберите счёт')
    if (mode === 'expense' && categoryId === undefined) return setError('Выберите категорию')
    if (mode === 'transfer' && (toAccountId === undefined || toAccountId === accountId)) return setError('Выберите, куда перевести')

    const type: TxType = mode === 'income' ? (isInterest ? 'interest' : 'income') : mode
    const tx: Omit<Transaction, 'id'> = {
      date,
      type,
      amount: Math.round(value * 100) / 100,
      accountId,
      toAccountId: mode === 'transfer' ? toAccountId : undefined,
      categoryId: mode === 'expense' ? categoryId : undefined,
      goalId: showGoals ? goalId : undefined,
      note: note.trim() || undefined,
      createdAt: initial?.createdAt ?? Date.now(),
    }
    if (editing) await db.transactions.update(initial!.id!, tx)
    else await db.transactions.add(tx as Transaction)
    if (mode === 'expense') localStorage.setItem(LAST_ACCOUNT_KEY, String(accountId))
    onClose()
  }

  async function remove() {
    if (!editing) return
    if (!confirm('Удалить запись?')) return
    await db.transactions.delete(initial!.id!)
    onClose()
  }

  const title = editing ? 'Изменить запись' : mode === 'expense' ? 'Новая трата' : mode === 'income' ? 'Новый доход' : 'Перевод'

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
        {(
          [
            ['expense', 'Трата'],
            ['income', 'Доход'],
            ['transfer', 'Перевод'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${mode === m ? 'bg-white shadow dark:bg-neutral-800' : 'muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 dark:bg-neutral-900">
        <input
          autoFocus
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent text-4xl font-bold outline-none"
        />
        <span className="text-3xl font-semibold muted">₽</span>
      </div>

      {mode === 'expense' && (
        <>
          <span className="label">Категория</span>
          <Chips
            items={activeCategories.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}`, hint: c.kind === 'fun' ? 'ништяки' : undefined }))}
            value={categoryId}
            onChange={setCategoryId}
          />
          <span className="label mt-4">Откуда</span>
          <Chips items={activeAccounts.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} value={accountId} onChange={setAccountId} />
        </>
      )}

      {mode === 'income' && (
        <>
          <span className="label">Куда</span>
          <Chips items={activeAccounts.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} value={accountId} onChange={setAccountId} />
          <label className="mt-4 flex items-center gap-3 rounded-xl bg-white px-4 py-3 dark:bg-neutral-900">
            <input type="checkbox" checked={isInterest} onChange={(e) => setIsInterest(e.target.checked)} className="h-5 w-5 accent-mint" />
            <span>
              Это проценты по вкладу <span className="muted">— покажу «заработано на процентах»</span>
            </span>
          </label>
        </>
      )}

      {mode === 'transfer' && (
        <>
          <span className="label">Откуда</span>
          <Chips items={activeAccounts.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} value={accountId} onChange={setAccountId} />
          <span className="label mt-4">Куда</span>
          <Chips items={activeAccounts.filter((a) => a.id !== accountId).map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))} value={toAccountId} onChange={setToAccountId} />
          {showGoals && (
            <>
              <span className="label mt-4">На цель</span>
              <Chips items={[{ id: -1, label: 'Без цели' }, ...activeGoals.map((g) => ({ id: g.id, label: `${g.emoji} ${g.name}` }))]} value={goalId ?? -1} onChange={(v) => setGoalId(v === -1 ? undefined : v)} />
            </>
          )}
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <span className="label">Дата</span>
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="field" />
        </div>
        <div>
          <span className="label">Заметка</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="необязательно" className="field" />
        </div>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-accent">{error}</p>}

      <div className="mt-5 flex gap-3">
        {editing && (
          <button type="button" onClick={remove} className="btn-ghost text-accent">
            Удалить
          </button>
        )}
        <button type="button" onClick={save} className="btn-primary flex-1">
          {editing ? 'Сохранить' : 'Записать'}
        </button>
      </div>
    </Sheet>
  )
}

function Chips({ items, value, onChange }: { items: { id: number; label: string; hint?: string }[]; value?: number; onChange: (id: number) => void }) {
  if (items.length === 0) return <p className="muted text-sm">Пока пусто</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button key={it.id} type="button" onClick={() => onChange(it.id)} className={`chip ${value === it.id ? 'chip-on' : ''}`}>
          {it.label}
        </button>
      ))}
    </div>
  )
}
