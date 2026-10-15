import { useMemo, useState } from 'react'
import type { TxDraft } from '../components/AddSheet'
import type { Transaction } from '../db'
import { formatDateLong } from '../lib/dates'
import { money } from '../lib/format'
import { isSavingTransfer, isUnsavingTransfer } from '../lib/stats'
import type { Data } from '../lib/useData'

interface Props {
  data: Data
  openAdd: (draft?: TxDraft) => void
}

export function History({ data, openAdd }: Props) {
  const { transactions, categories, accounts, goals } = data
  const [q, setQ] = useState('')
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals])

  function describe(t: Transaction): { emoji: string; title: string; sub: string; amount: number; color: string } {
    const acc = accById.get(t.accountId)
    const to = accById.get(t.toAccountId ?? -1)
    if (t.type === 'expense') {
      const c = catById.get(t.categoryId ?? -1)
      return { emoji: c?.emoji ?? '📦', title: c?.name ?? 'Трата', sub: [acc?.name, t.note].filter(Boolean).join(' · '), amount: -t.amount, color: '' }
    }
    if (t.type === 'income') return { emoji: '💰', title: 'Доход', sub: [acc?.name, t.note].filter(Boolean).join(' · '), amount: t.amount, color: 'text-mint' }
    if (t.type === 'interest') return { emoji: '🌱', title: 'Проценты', sub: [acc?.name, t.note].filter(Boolean).join(' · '), amount: t.amount, color: 'text-mint' }
    const g = goalById.get(t.goalId ?? -1)
    const saving = isSavingTransfer(t, accById)
    const unsaving = isUnsavingTransfer(t, accById)
    return {
      emoji: g?.emoji ?? (saving ? '🐷' : '🔁'),
      title: g ? `На цель «${g.name}»` : saving ? 'Отложено' : unsaving ? 'Снято с накоплений' : 'Перевод',
      sub: [`${acc?.name ?? '?'} → ${to?.name ?? '?'}`, t.note].filter(Boolean).join(' · '),
      amount: t.amount,
      color: saving ? 'text-mint' : unsaving ? 'text-accent' : 'muted',
    }
  }

  const rows = useMemo(() => {
    const list = transactions.map((t) => ({ t, d: describe(t) }))
    const needle = q.trim().toLowerCase()
    const filtered = needle ? list.filter(({ d }) => `${d.title} ${d.sub}`.toLowerCase().includes(needle)) : list
    const groups = new Map<string, typeof filtered>()
    for (const r of filtered) {
      const arr = groups.get(r.t.date) ?? []
      arr.push(r)
      groups.set(r.t.date, arr)
    }
    return [...groups.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, q, catById, accById, goalById])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">История</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: кофе, продукты, карта…" className="field" />
      {rows.length === 0 && <div className="card text-sm muted">{transactions.length === 0 ? 'Записей пока нет. Нажми «+» на главной.' : 'Ничего не найдено.'}</div>}
      {rows.map(([date, items]) => (
        <section key={date}>
          <h2 className="label mb-2 flex justify-between">
            <span>{formatDateLong(date)}</span>
            <span>{money(items.filter(({ t }) => t.type === 'expense').reduce((s, { t }) => s + t.amount, 0))}</span>
          </h2>
          <div className="card divide-y divide-black/5 p-0 dark:divide-white/10">
            {items.map(({ t, d }) => (
              <button key={t.id} type="button" onClick={() => openAdd(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="w-8 text-center text-xl">{d.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.title}</span>
                  {d.sub && <span className="block truncate text-xs muted">{d.sub}</span>}
                </span>
                <span className={`font-semibold ${d.color}`}>{money(d.amount, { sign: t.type !== 'expense', cents: true })}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
