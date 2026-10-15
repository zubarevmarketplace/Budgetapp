import { chromium } from 'playwright-core'
const OUT = process.argv[2]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text() + ' ' + m.location().url))
await page.goto('http://localhost:4173/Budgetapp/')
await page.waitForSelector('text=на ништяки')
await page.screenshot({ path: `${OUT}/01-home-empty.png` })

async function addExpense(amount, category, note) {
  await page.getByRole('button', { name: 'Добавить' }).click()
  await page.getByPlaceholder('0').fill(String(amount))
  await page.getByRole('button', { name: category }).click()
  if (note) await page.getByPlaceholder('необязательно').fill(note)
  await page.getByRole('button', { name: 'Записать' }).click()
  await page.waitForSelector('text=Новая трата', { state: 'hidden' })
}
await addExpense(350, '☕ Кафе и кофе', 'латте')
await addExpense(1200, '👗 Одежда')
await addExpense(2800, '🛒 Продукты', 'Лента')
await addExpense(900, '🚌 Транспорт')
await page.screenshot({ path: `${OUT}/02-home-some.png` })

// Income 80 000 to card
await page.getByRole('button', { name: 'Добавить' }).click()
await page.getByRole('button', { name: 'Доход' }).click()
await page.getByPlaceholder('0').fill('80000')
await page.getByPlaceholder('необязательно').fill('зарплата')
await page.getByRole('button', { name: 'Записать' }).click()
await page.waitForSelector('text=Новый доход', { state: 'hidden' })

// Interest
await page.getByRole('button', { name: 'Добавить' }).click()
await page.getByRole('button', { name: 'Доход' }).click()
await page.getByPlaceholder('0').fill('312')
await page.getByRole('button', { name: /Накопительный счёт/ }).click()
await page.getByText('Это проценты по вкладу').click()
await page.getByRole('button', { name: 'Записать' }).click()

// Goal
await page.getByRole('button', { name: 'Цели' }).click()
await page.getByRole('button', { name: '+ Цель' }).click()
await page.getByPlaceholder('Телефон').fill('Телефон')
await page.getByPlaceholder('80 000').fill('80000')
await page.locator('input[type=date]').fill('2026-12-31')
await page.getByRole('button', { name: 'Сохранить' }).click()
await page.screenshot({ path: `${OUT}/03-goal-new.png` })

// Contribute 25 000
await page.getByRole('button', { name: 'Отложить на цель' }).click()
await page.getByPlaceholder('0').fill('25000')
await page.getByRole('button', { name: 'Записать' }).click()
await page.waitForSelector('text=Перевод', { state: 'hidden' })
await page.screenshot({ path: `${OUT}/04-goal-progress.png` })
const goalText = await page.locator('section.card').first().innerText()
console.log('GOAL:', goalText.replace(/\n/g, ' | '))

// Over the fun limit: 4000 more
await page.getByRole('button', { name: 'Месяц' }).click()
await addExpense(4000, '🎬 Развлечения', 'концерт')
await page.screenshot({ path: `${OUT}/05-home-over.png` })
console.log('HOME:', (await page.locator('main').innerText()).replace(/\n/g, ' | ').slice(0, 600))

await page.getByRole('button', { name: 'Счета' }).click()
await page.screenshot({ path: `${OUT}/06-accounts.png` })
console.log('ACCOUNTS:', (await page.locator('main').innerText()).replace(/\n/g, ' | '))

await page.getByRole('button', { name: 'История' }).click()
await page.screenshot({ path: `${OUT}/07-history.png` })
// edit first entry: delete it
page.once('dialog', (d) => d.accept())
await page.locator('main button:has-text("Развлечения")').first().click()
await page.getByRole('button', { name: 'Удалить' }).click()
await page.waitForSelector('text=Изменить запись', { state: 'hidden' })
console.log('HISTORY after delete has концерт?', (await page.locator('main').innerText()).includes('концерт'))

await page.getByRole('button', { name: 'Ещё' }).click()
await page.screenshot({ path: `${OUT}/08-more.png` })
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Сохранить копию' }).click()])
const path = await dl.path()
const json = JSON.parse((await import('node:fs')).readFileSync(path, 'utf8'))
console.log('BACKUP:', json.transactions.length, 'tx,', json.goals.length, 'goals,', json.accounts.length, 'accounts')

// restore into a fresh profile (empty IndexedDB)
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' })
const page2 = await ctx2.newPage()
page2.on('console', (m) => m.type() === 'error' && errors.push('console2: ' + m.text() + ' ' + m.location().url))
await page2.goto('http://localhost:4173/Budgetapp/')
await page2.waitForSelector('text=на ништяки')
console.log('fresh profile, has Телефон goal?', (await page2.locator('main').innerText()).replace(/\s/g, ' ').includes('25 000 ₽ / 80 000 ₽'))
await page2.getByRole('button', { name: 'Ещё' }).click()
page2.once('dialog', (d) => d.accept())
await page2.locator('input[type=file]').setInputFiles(path)
await page2.waitForSelector('text=Данные восстановлены')
await page2.getByRole('button', { name: 'Месяц' }).click()
await page2.waitForTimeout(500)
const t2 = (await page2.locator('main').innerText()).replace(/\s/g, ' ')
console.log('after restore, has Телефон goal?', t2.includes('25 000 ₽ / 80 000 ₽'))
if (!t2.includes('25 000 ₽ / 80 000 ₽')) console.log('RESTORED HOME:', t2.replace(/\n/g, ' | ').slice(0, 500))
await ctx2.close()

// dark mode shot
await page.emulateMedia({ colorScheme: 'dark' })
await page.screenshot({ path: `${OUT}/09-home-dark.png` })

console.log('ERRORS:', errors.length ? errors : 'none')
await browser.close()
