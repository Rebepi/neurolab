import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  description?: string
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
  ariaLabel?: string
}

const SIZE_CLASSES: Record<NonNullable<SystemSelectProps['size']>, string> = {
  xs: 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5',
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
  ariaLabel,
}: SystemSelectProps) {
  const [open, setOpen] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState(-1)
  const [menuStyle, setMenuStyle] = useState<{
    top: number
    left: number
    width: number
    maxHeight: number
  }>({ top: 0, left: 0, width: 220, maxHeight: 260 })

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()

  const selectedOption = options.find(opt => opt.value === value)
  const selectedIdx = options.findIndex(opt => opt.value === value)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const width = Math.min(viewportW - 16, Math.max(rect.width, menuMinWidth))
    const estimatedHeight = Math.min(268, options.length * 42 + 16)
    const spaceBelow = viewportH - rect.bottom - 10
    const spaceAbove = rect.top - 10
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
    const maxHeight = Math.max(120, Math.min(268, openUpward ? spaceAbove : spaceBelow))
    const top = openUpward
      ? Math.max(8, rect.top - Math.min(estimatedHeight, maxHeight) - 6)
      : rect.bottom + 6

    const rawLeft = align === 'right' ? rect.right - width : rect.left
    const left = Math.max(8, Math.min(rawLeft, viewportW - width - 8))

    setMenuStyle({ top, left, width, maxHeight })
  }, [align, menuMinWidth, options.length])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

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
        e.preventDefault()
        setHighlightedIdx(prev => (prev + 1 < options.length ? prev + 1 : 0))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIdx(prev => (prev - 1 >= 0 ? prev - 1 : options.length - 1))
        return
      }
      if (e.key === 'Home') {
        e.preventDefault()
        setHighlightedIdx(0)
        return
      }
      if (e.key === 'End') {
        e.preventDefault()
        setHighlightedIdx(options.length - 1)
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (highlightedIdx >= 0 && options[highlightedIdx]) {
          e.preventDefault()
          onChange(options[highlightedIdx].value)
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
  }, [highlightedIdx, onChange, open, options, updatePosition])

  useEffect(() => {
    if (!open || highlightedIdx < 0) return
    optionRefs.current[highlightedIdx]?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIdx, open])

  function handleTriggerClick() {
    if (disabled) return
    setOpen(prev => {
      const next = !prev
      if (next) {
        setHighlightedIdx(selectedIdx >= 0 ? selectedIdx : 0)
      }
      return next
    })
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setHighlightedIdx(selectedIdx >= 0 ? selectedIdx : 0)
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
        className={`w-full flex items-center justify-between text-left bg-slate-950/75 hover:bg-slate-900/90 border text-slate-100 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? 'border-indigo-500/80 ring-2 ring-indigo-500/20'
            : 'border-slate-800 hover:border-slate-700'
        } ${SIZE_CLASSES[size]} ${triggerClassName}`}
      >
        <span className={`truncate ${selectedOption ? '' : 'text-slate-500'} ${selectedOption?.mono ? 'font-mono' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-400' : ''}`}
        />
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
            className="fixed z-[10050] nl-surface rounded-2xl border border-slate-700/70 p-1.5 shadow-2xl overflow-y-auto animate-pop-in"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-slate-500 text-center">
                Sin opciones disponibles
              </div>
            ) : (
              <div className="space-y-0.5">
                {options.map((opt, idx) => {
                  const isSelected = opt.value === value
                  const isHighlighted = idx === highlightedIdx
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      ref={el => { optionRefs.current[idx] = el }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIdx(idx)}
                      onClick={() => {
                        onChange(opt.value)
                        setOpen(false)
                        triggerRef.current?.focus()
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-slate-800 text-white font-semibold border border-slate-700/80'
                          : isHighlighted
                            ? 'bg-slate-800/65 text-white border border-transparent'
                            : 'text-slate-300 hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`truncate ${opt.mono ? 'font-mono' : ''}`}>{opt.label}</p>
                        {opt.description && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{opt.description}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}

