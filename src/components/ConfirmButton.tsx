import { useEffect, useState } from 'react'

interface Props {
  label: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  className?: string
}

/** Кнопка «в два нажатия»: первое показывает вопрос, второе выполняет действие. */
export function ConfirmButton({ label, confirmLabel = 'Точно?', onConfirm, className = '' }: Props) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`${className} ${armed ? 'bg-accent! text-white!' : ''}`}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
