import { useMemo, useState } from 'react'
import { Progress } from '../components/Progress'
import { Ring } from '../components/Ring'
import { periodFor } from '../lib/dates'
import { money, pct } from '../lib/format'
import { goalProgress, monthStats } from '../lib/stats'
import type { Data } from '../lib/useData'
import type { TxDraft } from '../components/AddSheet'

interface Props {
  data: Data
  openAdd: (draft?: TxDraft) => void
  goTo: (tab: 'goals' | 'more') => void
}

export function Home({ data, openAdd, goTo }: Props) {
  const { transactions, categories, accounts, goals, settings } = data
  const [offset, setOffset] = useState(0)
  const period = useMemo(() => periodFor(new Date(), settings.monthStartDay, offset), [settings.monthStartDay, offset])
  const s = useMemo(() => monthStats(transactions, categories, accounts, period.start, period.end), [transactions, categories, accounts, period])

  const limit = settings.funLimit
  const left = limit - s.funSpent
  const ratio = limit > 0 ? s.funSpent / limit : 0
  const ringColor = ratio >= 1 ? 'var(--color-accent)' : ratio >= 0.8 ? 'var(--color-sun)' : 'var(--color-mint)'

  const activeGoals = goals.filter((g) => !g.done).slice(0, 3)
  const needBackup = transactions.length >= 10 && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > 30 * 86400000)

  const topCats = [...s.byCategory.entries()]
    .map(([id, sum]) => ({ cat: categories.find((c) => c.id === id), sum }))
    .filter((x) => x.cat)
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 5)

  return (
    <div className="space-y-4 pb-16">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => setOffset(offset - 1)} className="btn-ghost h-10 w-10 rounded-full p-0" aria-label="Предыдущий месяц">
          ‹
        </button>
        <h1 className="text-xl font-bold">{period.label}</h1>
        <button type="button" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} className="btn-ghost h-10 w-10 rounded-full p-0" aria-label="Следующий месяц">
          ›
        </button>
      </header>

      {needBackup && (
        <button type="button" onClick={() => goTo('more')} className="card w-full border border-sun/40 bg-sun-soft text-left text-sm dark:bg-sun/20">
          💾 Давно не было бэкапа. Данные живут только на этом телефоне — <span className="font-semibold underline">сохранить копию</span>
        </button>
      )}

      <section className="card flex flex-col items-center">
        <Ring ratio={ratio} color={ringColor}>
          <span className="text-xs font-medium uppercase tracking-wide muted">{left >= 0 ? 'осталось' : 'перебор'}</span>
          <span className="text-3xl font-bold">{money(Math.abs(left))}</span>
          <span className="text-xs muted">из {money(limit)} на ништяки</span>
        </Ring>
        <p className="mt-3 text-sm muted">
          {ratio >= 1 ? 'Лимит на ништяки исчерпан. Держись!' : ratio >= 0.8 ? 'Осталось меньше 20 % — аккуратнее.' : s.funSpent === 0 ? 'На ништяки ещё ничего не потрачено.' : `Потрачено ${money(s.funSpent)} — всё под контролем.`}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Отложено" value={money(s.saved)} accent="mint" sub={s.income + s.interest > 0 ? `${pct(s.savingsRate)} от дохода` : undefined} />
        <Stat label="На процентах" value={money(s.interest)} accent="mint" sub="капает само" />
        <Stat label="Доход" value={money(s.income)} />
        <Stat label="Потрачено всего" value={money(s.spent)} sub={`продукты ${money(s.groceries)}`} />
      </section>

      {activeGoals.length > 0 ? (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Цели</h2>
            <button type="button" onClick={() => goTo('goals')} className="text-sm font-medium text-accent">
              все →
            </button>
          </div>
          {activeGoals.map((g) => {
            const p = goalProgress(g, transactions, accounts, settings.monthStartDay)
            return (
              <div key={g.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">
                    {g.emoji} {g.name}
                  </span>
                  <span className="muted">
                    {money(p.saved)} / {money(g.target)}
                  </span>
                </div>
                <Progress ratio={p.ratio} />
              </div>
            )
          })}
        </section>
      ) : (
        <button type="button" onClick={() => goTo('goals')} className="card w-full text-left">
          <div className="font-bold">🎯 Добавь цель</div>
          <div className="text-sm muted">Например, «Телефон до Нового года». Покажу прогресс и когда накопишь.</div>
        </button>
      )}

      {topCats.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-bold">Куда ушли деньги</h2>
          <ul className="space-y-2">
            {topCats.map(({ cat, sum }) => (
              <li key={cat!.id} className="flex items-center gap-3 text-sm">
                <span className="w-7 text-center text-lg">{cat!.emoji}</span>
                <span className="flex-1">{cat!.name}</span>
                <span className="font-semibold">{money(sum)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => openAdd()}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-5 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-4xl leading-none text-white shadow-lg transition active:scale-95"
        aria-label="Добавить"
      >
        +
      </button>
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'mint' }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`text-xl font-bold ${accent === 'mint' ? 'text-mint' : ''}`}>{value}</div>
      {sub && <div className="text-xs muted">{sub}</div>}
    </div>
  )
}
