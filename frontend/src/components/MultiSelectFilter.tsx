import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

export type MultiSelectOption = {
  label: string
  value: string
}

type MultiSelectFilterProps = {
  label: string
  options: MultiSelectOption[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'All',
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!open) return
      const target = event.target as Node
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])

  const selectedLabels = useMemo(
    () =>
      options
        .filter((option) => selectedSet.has(option.value))
        .map((option) => option.label),
    [options, selectedSet],
  )

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(q),
    )
  }, [options, search])

  const summaryText = useMemo(() => {
    if (!selectedLabels.length) return placeholder
    if (selectedLabels.length === 1) return selectedLabels[0]
    if (selectedLabels.length <= 3) return selectedLabels.join(', ')
    return `${selectedLabels.length} selected`
  }, [placeholder, selectedLabels])

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((item) => item !== value))
      return
    }
    onChange([...selectedValues, value])
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((prev) => !prev)
      return
    }
    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={`multi-filter ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="multi-filter-trigger"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onMenuKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="multi-filter-label">{label}</span>
        <span className="multi-filter-value">{summaryText}</span>
        <ChevronDown size={15} className="multi-filter-chevron" />
      </button>

      {open ? (
        <div className="multi-filter-popover">
          <div className="multi-filter-search">
            <Search size={15} />
            <input
              type="text"
              value={search}
              placeholder="Search here"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="multi-filter-actions">
            <button type="button" onClick={() => onChange([])}>
              Clear
            </button>
            <button
              type="button"
              onClick={() => onChange(options.map((option) => option.value))}
            >
              Select all
            </button>
          </div>

          <div className="multi-filter-options" role="listbox" aria-multiselectable>
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const checked = selectedSet.has(option.value)
                return (
                  <button
                    type="button"
                    key={option.value}
                    className={`multi-filter-option ${checked ? 'checked' : ''}`}
                    onClick={() => toggleValue(option.value)}
                  >
                    <span className="multi-filter-checkbox" aria-hidden>
                      {checked ? <Check size={13} /> : null}
                    </span>
                    <span className="multi-filter-option-label">{option.label}</span>
                  </button>
                )
              })
            ) : (
              <p className="multi-filter-empty">No options found.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
