const EMOJIS = ['📱', '🚗', '✈️', '🏠', '💻', '🎧', '👜', '💍', '🎓', '🛋️', '🚲', '🏖️', '🎁', '💳', '💵', '🏦', '🐷', '💎', '🧸', '🍰', '☕', '👗', '🎬', '🛒', '📦', '💊', '🏋️', '🐱', '🌱', '⭐']

export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className={`h-10 w-10 rounded-xl text-xl transition active:scale-90 ${value === e ? 'bg-ink/10 ring-2 ring-ink dark:bg-white/15 dark:ring-white' : 'bg-black/5 dark:bg-white/10'}`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
