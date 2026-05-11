import { useEffect, useState, type ReactNode } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

export type MobileTabItem<T extends string = string> = {
  id: T
  label: string
  icon?: ReactNode
  badge?: number
}

type Props<T extends string> = {
  items: MobileTabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** Optional title shown at the top of the bottom sheet */
  title?: string
  /** Optional CSS class for the pill button (in addition to default) */
  className?: string
}

/**
 * Mobile-only pill selector that replaces a horizontal tab row or sidebar.
 *
 * Visible only at ≤ 1024 px (desktop CSS hides it).
 * Shows the current tab's icon + label + chevron in a full-width pill.
 * Tap → bottom sheet with all options. Tap an item → switches and closes.
 */
export function MobileTabSelector<T extends string>({
  items,
  value,
  onChange,
  title = 'Sections',
  className = '',
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const current = items.find((i) => i.id === value) ?? items[0]

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const totalBadge = items.reduce((sum, i) => sum + (i.badge ?? 0), 0)

  return (
    <>
      <button
        type="button"
        className={`mobile-tab-selector ${className}`}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="mts-current">
          {current?.icon}
          <span className="mts-label">{current?.label}</span>
          {totalBadge > 0 ? <span className="mts-total-badge">{totalBadge}</span> : null}
        </span>
        <ChevronDown size={18} />
      </button>

      {open ? (
        <div className="mts-sheet-backdrop" onClick={() => setOpen(false)}>
          <div
            className="mts-sheet"
            role="listbox"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mts-sheet-head">
              <span>{title}</span>
              <button
                type="button"
                className="mts-sheet-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>
            <ul className="mts-sheet-list">
              {items.map((item) => {
                const isActive = item.id === value
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`mts-sheet-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => {
                        onChange(item.id)
                        setOpen(false)
                      }}
                    >
                      <span className="mts-sheet-item-left">
                        {item.icon}
                        <span>{item.label}</span>
                        {item.badge && item.badge > 0 ? (
                          <span className="mts-sheet-item-badge">{item.badge}</span>
                        ) : null}
                      </span>
                      {isActive ? <Check size={16} /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
