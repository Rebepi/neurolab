import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  description?: string
  badge?: string
  keywords?: string
  mono?: boolean
}

interface SystemSelectProps {
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md'
  className?: string
  triggerClassName?: string
  menuMinWidth?: number
  align?: 'left' | 'right'
  searchable?: boolean
  searchPlaceholder?: string
  maxVisibleOptions?: number
  icon?: ReactNode
  ariaLabel?: string
}

const SIZE_CLASSES: Record<NonNullable<SystemSelectProps['size']>, string> = {
  xs: 'px-2.5 py-1.5 text-xs rounded-xl gap-1.5',
  sm: 'px-3 py-2 text-xs rounded-xl gap-2',
  md: 'px-3.5 py-2.5 text-sm rounded-xl gap-2',
}

export function SystemSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  disabled = false,
  size = 'sm',
  className = '',
  triggerClassName = '',
  menuMinWidth = 0,
  align = 'left',
  searchable,
  searchPlaceholder = 'Filtrar opciones...',
  maxVisibleOptions = 30,
  icon,
  ariaLabel,
}: SystemSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [visibleLimit, setVisibleLimit] = useState(maxVisibleOptions)
  const [highlightedIdx, setHighlightedIdx] = useState(-1)
  const [menuStyle, setMenuStyle] = useState<{
    top: number
    left: number
    width: number
    maxHeight: number
  }>({ top: 0, left: 0, width: 220, maxHeight: 280 })

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()

  const showSearch = searchable ?? options.length >= 6
  const normalizedQuery = query.trim().toLowerCase()

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options
    return options.filter(
      opt =>
        opt.label.toLowerCase().includes(normalizedQuery) ||
        (opt.description || '').toLowerCase().includes(normalizedQuery) ||
        (opt.badge || '').toLowerCase().includes(normalizedQuery) ||
        (opt.keywords || '').toLowerCase().includes(normalizedQuery)
    )
  }, [normalizedQuery, options])

  const selectedOption = useMemo(
    () => options.find(opt => opt.value === value),
    [options, value]
  )

  const visibleOptions = useMemo(() => {
    if (filteredOptions.length <= visibleLimit) {
      return filteredOptions
    }
    if (!normalizedQuery && selectedOption) {
      const selectedIdxInFiltered = filteredOptions.findIndex(
        opt => opt.value === selectedOption.value
      )
      if (selectedIdxInFiltered >= visibleLimit) {
        return [
          selectedOption,
          ...filteredOptions
            .filter(opt => opt.value !== selectedOption.value)
            .slice(0, Math.max(0, visibleLimit - 1)),
        ]
      }
    }
    return filteredOptions.slice(0, visibleLimit)
  }, [filteredOptions, normalizedQuery, selectedOption, visibleLimit])

  const remainingCount = Math.max(0, filteredOptions.length - visibleOptions.length)
  const selectedVisibleIdx = visibleOptions.findIndex(opt => opt.value === value)

  useEffect(() => {
    optionRefs.current.length = visibleOptions.length
  }, [visibleOptions.length])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const width = Math.min(viewportW - 16, Math.max(rect.width, menuMinWidth))
    const searchExtra = showSearch ? 46 : 0
    const footerExtra = remainingCount > 0 ? 38 : 0
    const estimatedHeight = Math.min(
      340,
      visibleOptions.length * 44 + 20 + searchExtra + footerExtra
    )
    const spaceBelow = viewportH - rect.bottom - 10
    const spaceAbove = rect.top - 10
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
    const maxHeight = Math.max(140, Math.min(340, openUpward ? spaceAbove : spaceBelow))
    const top = openUpward
      ? Math.max(8, rect.top - Math.min(estimatedHeight, maxHeight) - 6)
      : rect.bottom + 6

    const rawLeft = align === 'right' ? rect.right - width : rect.left
    const left = Math.max(8, Math.min(rawLeft, viewportW - width - 8))

    setMenuStyle({ top, left, width, maxHeight })
  }, [align, menuMinWidth, remainingCount, showSearch, visibleOptions.length])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setVisibleLimit(maxVisibleOptions)
      return
    }
    setVisibleLimit(maxVisibleOptions)
    if (showSearch) {
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 20)
      return () => window.clearTimeout(id)
    }
  }, [maxVisibleOptions, open, showSearch])

  useEffect(() => {
    if (!open) return

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key === 'ArrowDown') {
        if (visibleOptions.length === 0) return
        e.preventDefault()
        setHighlightedIdx(prev => (prev + 1 < visibleOptions.length ? prev + 1 : 0))
        return
      }
      if (e.key === 'ArrowUp') {
        if (visibleOptions.length === 0) return
        e.preventDefault()
        setHighlightedIdx(prev => (prev - 1 >= 0 ? prev - 1 : visibleOptions.length - 1))
        return
      }
      if (e.key === 'Home') {
        if (document.activeElement === searchInputRef.current || visibleOptions.length === 0) return
        e.preventDefault()
        setHighlightedIdx(0)
        return
      }
      if (e.key === 'End') {
        if (document.activeElement === searchInputRef.current || visibleOptions.length === 0) return
        e.preventDefault()
        setHighlightedIdx(visibleOptions.length - 1)
        return
      }
      if (e.key === 'Enter' || (e.key === ' ' && document.activeElement !== searchInputRef.current)) {
        if (highlightedIdx >= 0 && visibleOptions[highlightedIdx]) {
          e.preventDefault()
          onChange(visibleOptions[highlightedIdx].value)
          setOpen(false)
          triggerRef.current?.focus()
        }
      }
    }

    function handleViewportChange(e: Event) {
      if (e.type === 'scroll' && menuRef.current?.contains(e.target as Node)) {
        return
      }
      updatePosition()
    }

    document.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [highlightedIdx, onChange, open, updatePosition, visibleOptions])

  useEffect(() => {
    if (!open || highlightedIdx < 0) return
    optionRefs.current[highlightedIdx]?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIdx, open])

  function handleTriggerClick() {
    if (disabled) return
    setOpen(prev => {
      const next = !prev
      if (next) {
        setHighlightedIdx(selectedVisibleIdx >= 0 ? selectedVisibleIdx : 0)
      }
      return next
    })
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setHighlightedIdx(selectedVisibleIdx >= 0 ? selectedVisibleIdx : 0)
      setOpen(true)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full flex items-center justify-between text-left bg-[#071123]/90 hover:bg-[#0b1933]/95 backdrop-blur-md border text-slate-100 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-inner ${
          open
            ? 'border-teal-400/80 ring-2 ring-teal-400/20 shadow-[0_0_18px_rgba(45,212,191,0.18)]'
            : 'border-cyan-500/25 hover:border-cyan-400/50'
        } ${SIZE_CLASSES[size]} ${triggerClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="shrink-0 text-teal-400">{icon}</span>}
          <span
            className={`truncate ${
              selectedOption ? 'font-medium text-slate-100' : 'text-slate-500'
            } ${selectedOption?.mono ? 'font-mono' : ''}`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOption?.badge && (
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30">
              {selectedOption.badge}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-cyan-400/80 shrink-0 transition-transform duration-200 ${
              open ? 'rotate-180 text-teal-300' : ''
            }`}
          />
        </div>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
              maxHeight: menuStyle.maxHeight,
            }}
            className="fixed z-[10050] bg-[#060f21]/95 backdrop-blur-xl rounded-2xl border border-cyan-500/35 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.75),0_0_24px_rgba(20,184,166,0.16)] overflow-hidden flex flex-col animate-pop-in"
          >
            {showSearch && (
              <div className="p-1.5 pb-2 border-b border-slate-800/80 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-cyan-400/70 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={e => {
                      setQuery(e.target.value)
                      setVisibleLimit(maxVisibleOptions)
                      setHighlightedIdx(0)
                    }}
                    placeholder={searchPlaceholder}
                    className="w-full pl-8 pr-16 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 focus:border-teal-400/70 text-xs text-slate-100 placeholder-slate-500 outline-none"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {query && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('')
                          setVisibleLimit(maxVisibleOptions)
                          setHighlightedIdx(0)
                          searchInputRef.current?.focus()
                        }}
                        aria-label="Limpiar búsqueda"
                        className="p-0.5 rounded text-slate-400 hover:text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-400">
                      {normalizedQuery
                        ? `${filteredOptions.length}/${options.length}`
                        : options.length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-0.5 space-y-0.5">
              {visibleOptions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-500 text-center">
                  Sin opciones disponibles
                </div>
              ) : (
                visibleOptions.map((opt, idx) => {
                  const isSelected = opt.value === value
                  const isHighlighted = idx === highlightedIdx
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      ref={el => {
                        optionRefs.current[idx] = el
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIdx(idx)}
                      onClick={() => {
                        onChange(opt.value)
                        setOpen(false)
                        triggerRef.current?.focus()
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-teal-500/20 to-indigo-500/20 text-white font-semibold border border-teal-400/45 shadow-sm'
                          : isHighlighted
                            ? 'bg-slate-800/75 text-white border border-cyan-500/20'
                            : 'text-slate-300 hover:bg-slate-800/55 border border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`truncate ${opt.mono ? 'font-mono' : ''}`}>{opt.label}</p>
                          {opt.badge && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-950/80 text-cyan-300 border border-cyan-500/25 shrink-0">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.description && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {opt.description}
                          </p>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-teal-300 shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>

            {remainingCount > 0 && (
              <div className="shrink-0 px-2.5 py-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-400 truncate">
                  Mostrando{' '}
                  <span className="text-slate-200 font-mono font-semibold">
                    {visibleOptions.length}
                  </span>{' '}
                  de{' '}
                  <span className="text-slate-200 font-mono font-semibold">
                    {filteredOptions.length}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setVisibleLimit(prev => prev + maxVisibleOptions)}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/35 text-cyan-300 font-mono font-semibold transition-colors shrink-0"
                >
                  Ver +{Math.min(maxVisibleOptions, remainingCount)}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
