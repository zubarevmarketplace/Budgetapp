import { useRef, useState } from 'react'
import type { Backup } from '../db'
import { db, exportBackup, importBackup, isBackup, type Category, type CategoryKind } from '../db'
import { parseAmount } from '../lib/format'
import type { Data } from '../lib/useData'

const KIND_LABEL: Record<CategoryKind, string> = { fun: 'Ништяки (лимит)', groceries: 'Продукты', fixed: 'Обязательные', other: 'Другое' }

export function More({ data }: { data: Data }) {
  const { settings, categories } = data
  const [funLimit, setFunLimit] = useState(String(settings.funLimit))
  const [startDay, setStartDay] = useState(String(settings.monthStartDay))
  const [msg, setMsg] = useState('')
  const [newCat, setNewCat] = useState({ name: '', emoji: '🍰', kind: 'fun' as CategoryKind })
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Backup | null>(null)

  async function saveSettings() {
    const limit = Math.max(0, parseAmount(funLimit))
    const day = Math.min(28, Math.max(1, Math.round(parseAmount(startDay)) || 1))
    await db.settings.update(1, { funLimit: limit, monthStartDay: day })
    setFunLimit(String(limit))
    setStartDay(String(day))
    flash('Сохранено')
  }

  async function doExport() {
    const b = await exportBackup()
    const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kopilka-${b.exportedAt.slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    await db.settings.update(1, { lastBackupAt: Date.now() })
    flash('Файл с копией сохранён')
  }

  async function doImport(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isBackup(parsed)) throw new Error('Это не файл копии Копилки')
      setPending(parsed)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Не удалось прочитать файл')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function confirmImport() {
    if (!pending) return
    await importBackup(pending)
    setPending(null)
    flash('Данные восстановлены')
  }

  async function addCategory() {
    if (!newCat.name.trim()) return
    await db.categories.add({ name: newCat.name.trim(), emoji: newCat.emoji, kind: newCat.kind, order: categories.length + 100 } as Category)
    setNewCat({ name: '', emoji: '🍰', kind: 'fun' })
  }

  function flash(s: string) {
    setMsg(s)
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ещё</h1>
      {msg && <div className="card bg-mint-soft text-sm font-medium dark:bg-mint/20">{msg}</div>}

      <section className="card space-y-3">
        <h2 className="font-bold">Бюджет</h2>
        <div>
          <span className="label">Лимит на ништяки в месяц, ₽</span>
          <input inputMode="decimal" value={funLimit} onChange={(e) => setFunLimit(e.target.value)} className="field" />
          <p className="mt-1 text-xs muted">Сюда попадают траты из категорий с пометкой «ништяки». Продукты и обязательные платежи не считаются.</p>
        </div>
        <div>
          <span className="label">Месяц начинается с числа</span>
          <input inputMode="numeric" value={startDay} onChange={(e) => setStartDay(e.target.value)} className="field" />
          <p className="mt-1 text-xs muted">Если зарплата 10-го, поставь 10 — лимит будет считаться с зарплаты до зарплаты.</p>
        </div>
        <button type="button" onClick={saveSettings} className="btn-primary w-full">
          Сохранить
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Копия данных</h2>
        <p className="text-sm muted">
          Все записи хранятся только в этом телефоне. Раз в месяц сохраняй файл копии (например, в «Файлы» или в избранное Telegram), чтобы ничего не потерять при смене телефона.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={doExport} className="btn-primary flex-1">
            Сохранить копию
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost flex-1">
            Восстановить
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </div>
        {pending && (
          <div className="rounded-xl border border-accent/40 bg-accent-soft p-3 text-sm dark:bg-accent/20">
            <p>
              Заменить все данные копией от <b>{pending.exportedAt.slice(0, 10)}</b>? Текущие записи ({data.transactions.length}) будут удалены.
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={confirmImport} className="btn-accent flex-1 py-2">
                Да, заменить
              </button>
              <button type="button" onClick={() => setPending(null)} className="btn-ghost flex-1 py-2">
                Отмена
              </button>
            </div>
          </div>
        )}
        {settings.lastBackupAt && <p className="text-xs muted">Последняя копия: {new Date(settings.lastBackupAt).toLocaleDateString('ru-RU')}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Категории трат</h2>
        <ul className="space-y-1 text-sm">
          {categories.map((c) => (
            <li key={c.id} className={`flex items-center gap-2 ${c.archived ? 'opacity-40' : ''}`}>
              <span className="w-7 text-center text-lg">{c.emoji}</span>
              <span className="flex-1">
                {c.name} <span className="text-xs muted">· {KIND_LABEL[c.kind]}</span>
              </span>
              <button type="button" onClick={() => db.categories.update(c.id, { archived: !c.archived })} className="text-xs muted underline">
                {c.archived ? 'вернуть' : 'скрыть'}
              </button>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-[3rem_1fr] gap-2">
          <input value={newCat.emoji} onChange={(e) => setNewCat({ ...newCat, emoji: e.target.value.slice(-2) || '🍰' })} className="field px-0 text-center" aria-label="Эмодзи" />
          <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="Новая категория" className="field" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABEL) as CategoryKind[]).map((k) => (
            <button key={k} type="button" onClick={() => setNewCat({ ...newCat, kind: k })} className={`chip ${newCat.kind === k ? 'chip-on' : ''}`}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <button type="button" onClick={addCategory} className="btn-ghost w-full" disabled={!newCat.name.trim()}>
          Добавить категорию
        </button>
      </section>

      <section className="card text-sm muted">
        <p>
          <b className="text-ink dark:text-white">Копилка</b> — приложение без сервера и регистрации. Чтобы оно было как обычное приложение, открой эту страницу в браузере телефона и выбери «Добавить на экран „Домой“».
        </p>
      </section>
    </div>
  )
}
