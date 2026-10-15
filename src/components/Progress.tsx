export function Progress({ ratio, color = 'var(--color-mint)' }: { ratio: number; color?: string }) {
  const v = Math.min(1, Math.max(0, ratio))
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  )
}
