import { useCallback, useState } from 'react'
import { AddSheet, type TxDraft } from './components/AddSheet'
import { useData } from './lib/useData'
import { Accounts } from './screens/Accounts'
import { Goals } from './screens/Goals'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { More } from './screens/More'

type Tab = 'home' | 'goals' | 'accounts' | 'history' | 'more'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Месяц', icon: '◎' },
  { id: 'goals', label: 'Цели', icon: '🎯' },
  { id: 'accounts', label: 'Счета', icon: '🏦' },
  { id: 'history', label: 'История', icon: '☰' },
  { id: 'more', label: 'Ещё', icon: '⋯' },
]

export default function App() {
  const data = useData()
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<{ open: boolean; draft?: TxDraft }>({ open: false })

  const openAdd = useCallback((draft?: TxDraft) => setSheet({ open: true, draft }), [])
  const closeAdd = useCallback(() => setSheet((s) => ({ ...s, open: false })), [])

  if (!data.ready) return null

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="safe-top flex-1 px-4 pb-28 pt-4">
        {tab === 'home' && <Home data={data} openAdd={openAdd} goTo={setTab} />}
        {tab === 'goals' && <Goals data={data} openAdd={openAdd} />}
        {tab === 'accounts' && <Accounts data={data} openAdd={openAdd} />}
        {tab === 'history' && <History data={data} openAdd={openAdd} />}
        {tab === 'more' && <More data={data} />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-paper/90 backdrop-blur dark:border-white/10 dark:bg-neutral-950/90">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${tab === t.id ? 'text-ink dark:text-white' : 'muted'}`}
            >
              <span className={`text-xl leading-none ${tab === t.id ? '' : 'grayscale opacity-70'}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <AddSheet open={sheet.open} onClose={closeAdd} data={data} initial={sheet.draft} />
    </div>
  )
}
