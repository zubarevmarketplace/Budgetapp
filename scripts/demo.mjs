// Собирает демо-версию в один HTML-файл (без service worker), чтобы её можно было
// опубликовать на любом хостинге одной страницей. Запуск: node scripts/demo.mjs
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'

execSync('npx vite build --outDir dist-demo', { stdio: 'inherit', env: { ...process.env, BASE_PATH: './', VITE_DEMO: '1' } })
let html = readFileSync('dist-demo/index.html', 'utf8')
const assets = readdirSync('dist-demo/assets')
for (const f of assets) {
  const code = readFileSync(`dist-demo/assets/${f}`, 'utf8')
  if (f.endsWith('.css')) html = html.replace(new RegExp(`<link[^>]*href="./assets/${f}"[^>]*>`), `<style>${code}</style>`)
  if (f.endsWith('.js')) html = html.replace(new RegExp(`<script[^>]*src="./assets/${f}"[^>]*></script>`), () => `<script type="module">${code.replace(/<\/script/g, '<\\/script')}</script>`)
}
const svg = readFileSync('public/icon.svg', 'utf8')
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`).replace(/<link rel="apple-touch-icon"[^>]*>/, '')
// Для публикации как страницы в обёртке: только содержимое head+body без html/head/body.
const inner = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/g, '')
  .replace(/<\/?head>/g, '')
  .replace(/<\/?body>/g, '')
  .replace(/<meta charset[^>]*>/, '')
  .replace(/<meta name="viewport"[^>]*>/, '')
  .trim()
mkdirSync('dist-demo', { recursive: true })
writeFileSync('dist-demo/kopilka-demo.html', inner)
console.log('wrote dist-demo/kopilka-demo.html', Math.round(inner.length / 1024), 'KB')
