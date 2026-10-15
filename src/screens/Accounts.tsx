import { useMemo, useState } from 'react'
import type { TxDraft } from '../components/AddSheet'
import { EmojiPicker } from '../components/EmojiPicker'
import { Sheet } from '../components/Sheet'
import { db, type Account, type AccountType } from '../db'
import { money, parseAmount } from '../lib/format'
import { balances, isSavingAccount, monthlyInterest } from '../lib/stats'
import type { Data } from '../lib/useData'

const TYPE_LABEL: Record<AccountType, string> = { card: 'Карта', cash: 'Наличные', deposit: 'Вклад', savings: 'Накопительный счёт' }

interface Props {
  data: Data
  openAdd: (draft?: TxDraft) => void
}

export function Accounts({ data, openAdd }: Props) {
  const { accounts, transactions } = data
  const [editing, setEditing] = useState<Partial<Account> | null>(null)
  const bal = useMemo(() => balances(accounts, transactions), [accounts, transactions])
  const active = accounts.filter((a) => !a.archived)
  const everyday = active.filter((a) => !isSavingAccount(a))
  const savings = active.filter((a) => isSavingAccount(a))
  const sum = (list: Account[]) => list.reduce((s, a) => s + (bal.get(a.id) ?? 0), 0)
  const expectedInterest = savings.reduce((s, a) => s + monthlyInterest(bal.get(a.id) ?? 0, a.rate), 0)

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Счета</h1>
        <button type="button" onClick={() => setEditing({})} className="btn-primary px-3 py-2 text-sm">
          + Счёт
        </button>
      </header>

      <section className="card">
        <div className="label">Всего денег</div>
        <div className="text-3xl font-bold">{money(sum(active))}</div>
        <div className="mt-1 text-sm muted">
          из них в накоплениях <b className="text-mint">{money(sum(savings))}</b>
          {expectedInterest > 0 && <> · ≈ {money(expectedInterest)}/мес процентов</>}
        </div>
      </section>

      <Group title="Накопления" list={savings} bal={bal} onEdit={setEditing} empty="Добавь вклад или накопительный счёт — сюда будут уходить сбережения." showRate />
      <Group title="Повседневные" list={everyday} bal={bal} onEdit={setEditing} empty="Нет повседневных счетов." />

      {savings.length > 0 && everyday.length > 0 && (
        <button type="button" onClick={() => openAdd({ type: 'transfer', accountId: everyday[0].id, toAccountId: savings[0].id })} className="btn-accent w-full">
          Отложить в накопления
        </button>
      )}

      <AccountSheet account={editing} onClose={() => setEditing(null)} currentBalance={editing?.id !== undefined ? (bal.get(editing.id) ?? 0) : 0} nextOrder={accounts.length} />
    </div>
  )
}

function Group({ title, list, bal, onEdit, empty, showRate }: { title: string; list: Account[]; bal: Map<number, number>; onEdit: (a: Account) => void; empty: string; showRate?: boolean }) {
  return (
    <section>
      <h2 className="label mb-2">{title}</h2>
      <div className="space-y-2">
        {list.length === 0 && <div className="card text-sm muted">{empty}</div>}
        {list.map((a) => {
          const b = bal.get(a.id) ?? 0
          const mi = monthlyInterest(b, a.rate)
          return (
            <button key={a.id} type="button" onClick={() => onEdit(a)} className="card flex w-full items-center gap-3 text-left">
              <span className="text-2xl">{a.emoji}</span>
              <span className="flex-1">
                <span className="block font-semibold">{a.name}</span>
                <span className="block text-xs muted">
                  {[a.name !== TYPE_LABEL[a.type] ? TYPE_LABEL[a.type] : '', showRate && a.rate ? `${a.rate} % годовых` : ''].filter(Boolean).join(' · ') || '\u00a0'}
                </span>
              </span>
              <span className="text-right">
                <span className={`block font-bold ${b < 0 ? 'text-accent' : ''}`}>{money(b)}</span>
                {showRate && mi > 0 && <span className="block text-xs text-mint">+{money(mi)}/мес</span>}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function AccountSheet({ account, onClose, currentBalance, nextOrder }: { account: Partial<Account> | null; onClose: () => void; currentBalance: number; nextOrder: number }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💳')
  const [type, setType] = useState<AccountType>('card')
  const [balance, setBalance] = useState('')
  const [rate, setRate] = useState('')
  const [error, setError] = useState('')
  const [key, setKey] = useState<Partial<Account> | null>(null)

  if (account !== key) {
    setKey(account)
    setName(account?.name ?? '')
    setEmoji(account?.emoji ?? '💳')
    setType(account?.type ?? 'card')
    setBalance(account?.id !== undefined ? String(currentBalance) : '')
    setRate(account?.rate ? String(account.rate) : '')
    setError('')
  }

  const isSaving = type === 'deposit' || type === 'savings'

  async function save() {
    if (!name.trim()) return setError('Как назовём счёт?')
    const wanted = parseAmount(balance)
    const r = parseAmount(rate) || undefined
    if (account?.id !== undefined) {
      // Корректировка: сдвигаем стартовый баланс так, чтобы текущий стал равен введённому.
      const shift = wanted - currentBalance
      await db.accounts.update(account.id, { name: name.trim(), emoji, type, rate: isSaving ? r : undefined, initialBalance: (account.initialBalance ?? 0) + shift })
    } else {
      await db.accounts.add({ name: name.trim(), emoji, type, rate: isSaving ? r : undefined, initialBalance: wanted, order: nextOrder } as Account)
    }
    onClose()
  }

  async function archive() {
    if (account?.id === undefined) return
    if (!confirm('Скрыть счёт? История останется.')) return
    await db.accounts.update(account.id, { archived: true })
    onClose()
  }

  return (
    <Sheet open={account !== null} onClose={onClose} title={account?.id !== undefined ? 'Изменить счёт' : 'Новый счёт'}>
      <span className="label">Название</span>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Вклад в Сбере" className="field" autoFocus />
      <span className="label mt-4">Тип</span>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TYPE_LABEL) as AccountType[]).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={`chip ${type === t ? 'chip-on' : ''}`}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <span className="label mt-4">Иконка</span>
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <span className="label">{account?.id !== undefined ? 'Текущий баланс, ₽' : 'Сейчас на счёте, ₽'}</span>
          <input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" className="field" />
        </div>
        {isSaving && (
          <div>
            <span className="label">Ставка, % годовых</span>
            <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="16" className="field" />
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-accent">{error}</p>}
      <div className="mt-5 flex gap-3">
        {account?.id !== undefined && (
          <button type="button" onClick={archive} className="btn-ghost text-accent">
            Скрыть
          </button>
        )}
        <button type="button" onClick={save} className="btn-primary flex-1">
          Сохранить
        </button>
      </div>
    </Sheet>
  )
}
