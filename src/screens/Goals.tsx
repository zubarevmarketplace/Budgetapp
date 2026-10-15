import { useState } from 'react'
import type { TxDraft } from '../components/AddSheet'
import { ConfirmButton } from '../components/ConfirmButton'
import { EmojiPicker } from '../components/EmojiPicker'
import { Progress } from '../components/Progress'
import { Sheet } from '../components/Sheet'
import { db, type Goal } from '../db'
import { formatDateLong, fromISO, formatMonthPrep } from '../lib/dates'
import { money, parseAmount } from '../lib/format'
import { goalProgress, isSavingAccount } from '../lib/stats'
import type { Data } from '../lib/useData'

interface Props {
  data: Data
  openAdd: (draft?: TxDraft) => void
}

export function Goals({ data, openAdd }: Props) {
  const { goals, transactions, accounts, settings } = data
  const [editing, setEditing] = useState<Partial<Goal> | null>(null)
  const active = goals.filter((g) => !g.done)
  const done = goals.filter((g) => g.done)
  const savingAccount = accounts.find((a) => !a.archived && isSavingAccount(a))

  function contribute(g: Goal) {
    openAdd({ type: 'transfer', goalId: g.id, toAccountId: savingAccount?.id })
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Цели</h1>
        <button type="button" onClick={() => setEditing({})} className="btn-primary px-3 py-2 text-sm">
          + Цель
        </button>
      </header>

      {active.length === 0 && (
        <div className="card text-sm muted">
          Пока нет целей. Добавь первую — например, «Телефон 80 000 ₽ до 31 декабря» — и откладывай на неё переводами на накопительный счёт.
        </div>
      )}

      {active.map((g) => {
        const p = goalProgress(g, transactions, accounts, settings.monthStartDay)
        const reached = p.remaining <= 0
        return (
          <section key={g.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => setEditing(g)} className="text-left">
                <div className="text-lg font-bold">
                  {g.emoji} {g.name}
                </div>
                <div className="text-sm muted">
                  {money(g.target)}
                  {g.deadline && ` · до ${formatDateLong(g.deadline)}`}
                </div>
              </button>
              <div className="text-right">
                <div className="text-lg font-bold text-mint">{money(p.saved)}</div>
                <div className="text-xs muted">{Math.round(p.ratio * 100)} %</div>
              </div>
            </div>
            <Progress ratio={p.ratio} color={reached ? 'var(--color-sun)' : 'var(--color-mint)'} />
            <div className="text-sm">
              {reached ? (
                <span className="font-semibold">🎉 Накоплено! Можно покупать.</span>
              ) : (
                <>
                  <div>
                    Осталось <b>{money(p.remaining)}</b>
                  </div>
                  {p.needPerMonth !== undefined && (
                    <div className="muted">
                      Чтобы успеть: ≈ <b className="text-ink dark:text-white">{money(p.needPerMonth)}</b> в месяц
                      {p.monthsToDeadline !== undefined && ` (${p.monthsToDeadline} мес.)`}
                    </div>
                  )}
                  {p.eta ? (
                    <div className="muted">
                      При темпе {money(p.pace)}/мес накопишь <b className="text-ink dark:text-white">{formatMonthPrep(fromISO(p.eta))}</b>
                    </div>
                  ) : (
                    <div className="muted">Отложи первый взнос — посчитаю, когда накопишь.</div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              {reached ? (
                <button type="button" onClick={() => db.goals.update(g.id, { done: true })} className="btn-primary flex-1">
                  Закрыть цель
                </button>
              ) : (
                <button type="button" onClick={() => contribute(g)} className="btn-primary flex-1" disabled={!savingAccount}>
                  Отложить на цель
                </button>
              )}
            </div>
            {!savingAccount && <p className="text-xs text-accent">Сначала добавь накопительный счёт или вклад во вкладке «Счета».</p>}
          </section>
        )
      })}

      {done.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-bold">Достигнуто</h2>
          <ul className="space-y-1 text-sm">
            {done.map((g) => (
              <li key={g.id} className="flex justify-between">
                <span>
                  {g.emoji} {g.name}
                </span>
                <button type="button" onClick={() => db.goals.update(g.id, { done: false })} className="text-xs muted underline">
                  вернуть
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <GoalSheet goal={editing} onClose={() => setEditing(null)} nextOrder={goals.length} />
    </div>
  )
}

function GoalSheet({ goal, onClose, nextOrder }: { goal: Partial<Goal> | null; onClose: () => void; nextOrder: number }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📱')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState('')
  const [key, setKey] = useState<Partial<Goal> | null>(null)

  if (goal !== key) {
    setKey(goal)
    setName(goal?.name ?? '')
    setEmoji(goal?.emoji ?? '📱')
    setTarget(goal?.target ? String(goal.target) : '')
    setDeadline(goal?.deadline ?? '')
    setError('')
  }

  async function save() {
    const t = parseAmount(target)
    if (!name.trim()) return setError('Как назовём цель?')
    if (t <= 0) return setError('Укажи сумму')
    const rec = { name: name.trim(), emoji, target: t, deadline: deadline || undefined }
    if (goal?.id !== undefined) await db.goals.update(goal.id, rec)
    else await db.goals.add({ ...rec, order: nextOrder } as Goal)
    onClose()
  }

  async function remove() {
    if (goal?.id === undefined) return
    await db.goals.delete(goal.id)
    onClose()
  }

  return (
    <Sheet open={goal !== null} onClose={onClose} title={goal?.id !== undefined ? 'Изменить цель' : 'Новая цель'}>
      <span className="label">Название</span>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Телефон" className="field" autoFocus />
      <span className="label mt-4">Иконка</span>
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <span className="label">Сумма, ₽</span>
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="80 000" className="field" />
        </div>
        <div>
          <span className="label">Срок</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="field" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-accent">{error}</p>}
      <div className="mt-5 flex gap-3">
        {goal?.id !== undefined && <ConfirmButton label="Удалить" confirmLabel="Точно удалить?" onConfirm={remove} className="btn-ghost text-accent" />}
        <button type="button" onClick={save} className="btn-primary flex-1">
          Сохранить
        </button>
      </div>
    </Sheet>
  )
}
