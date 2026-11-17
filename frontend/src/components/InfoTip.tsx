import { useState, useRef, useEffect, useLayoutEffect, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

type Side = 'top' | 'bottom' | 'left' | 'right'

interface FloatingPopoverProps {
  triggerRef: RefObject<HTMLElement | null>
  initialRect: DOMRect
  title?: string
  text: string
  hint?: string
  preferredSide?: Side
  interactive?: boolean
}

function FloatingPopover({
  triggerRef,
  initialRect,
  title,
  text,
  hint,
  preferredSide = 'top',
  interactive = false,
}: FloatingPopoverProps) {
  const outerRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const arrowRef = useRef<HTMLSpanElement | null>(null)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const card = cardRef.current
    const body = bodyRef.current
    const arrow = arrowRef.current
    if (!outer || !card || !body || !arrow) return

    const reposition = () => {
      const triggerEl = triggerRef.current
      const rect = triggerEl && triggerEl.isConnected ? triggerEl.getBoundingClientRect() : initialRect
      const vw = document.documentElement.clientWidth || window.innerWidth
      const vh = document.documentElement.clientHeight || window.innerHeight
      const margin = 10
      const gap = 10

      if (rect.width === 0 && rect.height === 0) {
        outer.style.visibility = 'hidden'
        return
      }

      const availTop = Math.max(0, rect.top - margin - gap)
      const availBottom = Math.max(0, vh - rect.bottom - margin - gap)
      const availLeft = Math.max(0, rect.left - margin - gap)
      const availRight = Math.max(0, vw - rect.right - margin - gap)
      const maxViewportW = Math.max(160, vw - margin * 2)
      const maxViewportH = Math.max(80, vh - margin * 2)

      const measureAt = (maxW: number) => {
        outer.style.maxWidth = `${maxW}px`
        body.style.maxHeight = 'none'
        body.style.overflowY = 'visible'
        const r = outer.getBoundingClientRect()
        return { w: r.width, h: r.height }
      }

      const compactMaxW = Math.min(310, maxViewportW)
      const expandedMaxW = Math.min(440, maxViewportW)

      let chosenSide: Side = preferredSide
      let chosenMaxW = compactMaxW
      let measured = measureAt(compactMaxW)

      const orderMap: Record<Side, Side[]> = {
        top: ['top', 'bottom', 'right', 'left'],
        bottom: ['bottom', 'top', 'right', 'left'],
        left: ['left', 'right', 'top', 'bottom'],
        right: ['right', 'left', 'top', 'bottom'],
      }

      const candidates = orderMap[preferredSide]
      let fitted = false

      for (const side of candidates) {
        if (side === 'top' || side === 'bottom') {
          const vSpace = side === 'top' ? availTop : availBottom
          const m = measureAt(compactMaxW)
          if (m.h <= vSpace && m.w <= maxViewportW) {
            chosenSide = side
            chosenMaxW = compactMaxW
            measured = m
            fitted = true
            break
          }
          if (expandedMaxW > compactMaxW) {
            const mw = measureAt(expandedMaxW)
            if (mw.h <= vSpace && mw.w <= maxViewportW) {
              chosenSide = side
              chosenMaxW = expandedMaxW
              measured = mw
              fitted = true
              break
            }
          }
        } else {
          const hSpace = side === 'left' ? availLeft : availRight
          if (hSpace >= 165) {
            const sideMaxW = Math.min(340, hSpace)
            const ms = measureAt(sideMaxW)
            if (ms.w <= hSpace && ms.h <= maxViewportH) {
              chosenSide = side
              chosenMaxW = sideMaxW
              measured = ms
              fitted = true
              break
            }
          }
        }
      }

      let needsScroll = false
      let clampedBodyMaxH = maxViewportH

      if (!fitted) {
        const widest = expandedMaxW
        const mTop = measureAt(widest)
        const areaScores: Array<{ side: Side; score: number; maxW: number; maxH: number }> = [
          { side: 'top', score: widest * availTop, maxW: widest, maxH: availTop },
          { side: 'bottom', score: widest * availBottom, maxW: widest, maxH: availBottom },
          { side: 'right', score: availRight * maxViewportH, maxW: Math.max(150, Math.min(340, availRight)), maxH: maxViewportH },
          { side: 'left', score: availLeft * maxViewportH, maxW: Math.max(150, Math.min(340, availLeft)), maxH: maxViewportH },
        ]
        areaScores.sort((a, b) => b.score - a.score)
        const best = areaScores[0]
        chosenSide = best.side
        chosenMaxW = best.maxW

        const mBest = chosenMaxW === widest ? mTop : measureAt(chosenMaxW)
        const nonBodyChrome = Math.max(0, mBest.h - body.scrollHeight)
        const availableBody = Math.max(48, best.maxH - nonBodyChrome - 4)
        if (mBest.h > best.maxH) {
          needsScroll = true
          clampedBodyMaxH = availableBody
          body.style.maxHeight = `${clampedBodyMaxH}px`
          body.style.overflowY = 'auto'
        }
        const finalRect = outer.getBoundingClientRect()
        measured = { w: finalRect.width, h: finalRect.height }
      }

      const finalW = Math.min(measured.w, maxViewportW)
      const finalH = Math.min(measured.h, maxViewportH)
      const anchorX = rect.left + rect.width / 2
      const anchorY = rect.top + rect.height / 2

      let left = 0
      let top = 0

      if (chosenSide === 'top' || chosenSide === 'bottom') {
        left = Math.max(margin, Math.min(vw - margin - finalW, anchorX - finalW / 2))
        const rawTop = chosenSide === 'bottom' ? rect.bottom + gap : rect.top - gap - finalH
        top = Math.max(margin, Math.min(vh - margin - finalH, rawTop))
      } else {
        const rawLeft = chosenSide === 'right' ? rect.right + gap : rect.left - gap - finalW
        left = Math.max(margin, Math.min(vw - margin - finalW, rawLeft))
        top = Math.max(margin, Math.min(vh - margin - finalH, anchorY - finalH / 2))
      }

      outer.style.left = `${Math.round(left)}px`
      outer.style.top = `${Math.round(top)}px`
      outer.style.maxWidth = `${chosenMaxW}px`
      outer.style.visibility = 'visible'

      if (needsScroll && interactive) {
        outer.style.pointerEvents = 'auto'
      } else {
        outer.style.pointerEvents = 'none'
      }

      arrow.style.top = ''
      arrow.style.bottom = ''
      arrow.style.left = ''
      arrow.style.right = ''
      arrow.style.borderTopWidth = '0px'
      arrow.style.borderRightWidth = '0px'
      arrow.style.borderBottomWidth = '0px'
      arrow.style.borderLeftWidth = '0px'

      const isAbove = top + finalH <= rect.top + 2
      const isBelow = top >= rect.bottom - 2
      const isRight = left >= rect.right - 2
      const isLeft = left + finalW <= rect.left + 2

      if (chosenSide === 'bottom' && isBelow) {
        const ax = Math.max(14, Math.min(finalW - 14, anchorX - left))
        arrow.style.display = 'block'
        arrow.style.left = `${Math.round(ax - 5)}px`
        arrow.style.top = '-5px'
        arrow.style.borderLeftWidth = '1px'
        arrow.style.borderTopWidth = '1px'
        card.style.transformOrigin = `${Math.round(ax)}px top`
      } else if (chosenSide === 'top' && isAbove) {
        const ax = Math.max(14, Math.min(finalW - 14, anchorX - left))
        arrow.style.display = 'block'
        arrow.style.left = `${Math.round(ax - 5)}px`
        arrow.style.bottom = '-5px'
        arrow.style.borderRightWidth = '1px'
        arrow.style.borderBottomWidth = '1px'
        card.style.transformOrigin = `${Math.round(ax)}px bottom`
      } else if (chosenSide === 'right' && isRight) {
        const ay = Math.max(14, Math.min(finalH - 14, anchorY - top))
        arrow.style.display = 'block'
        arrow.style.top = `${Math.round(ay - 5)}px`
        arrow.style.left = '-5px'
        arrow.style.borderLeftWidth = '1px'
        arrow.style.borderBottomWidth = '1px'
        card.style.transformOrigin = `left ${Math.round(ay)}px`
      } else if (chosenSide === 'left' && isLeft) {
        const ay = Math.max(14, Math.min(finalH - 14, anchorY - top))
        arrow.style.display = 'block'
        arrow.style.top = `${Math.round(ay - 5)}px`
        arrow.style.right = '-5px'
        arrow.style.borderRightWidth = '1px'
        arrow.style.borderTopWidth = '1px'
        card.style.transformOrigin = `right ${Math.round(ay)}px`
      } else {
        arrow.style.display = 'none'
        card.style.transformOrigin = 'center center'
      }
    }

    reposition()

    const ro = new ResizeObserver(() => reposition())
    ro.observe(outer)
    window.addEventListener('scroll', reposition, { capture: true, passive: true })
    window.addEventListener('resize', reposition, { passive: true })
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', reposition, { passive: true })
      vv.addEventListener('scroll', reposition, { passive: true })
    }

    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      if (vv) {
        vv.removeEventListener('resize', reposition)
        vv.removeEventListener('scroll', reposition)
      }
    }
  }, [triggerRef, initialRect, title, text, hint, preferredSide, interactive])

  return createPortal(
    <div
      ref={outerRef}
      role="tooltip"
      className="fixed z-[10050] pointer-events-none w-max"
      style={{ visibility: 'hidden', left: 0, top: 0 }}
    >
      <div
        ref={cardRef}
        className="relative rounded-xl px-3.5 py-2.5 shadow-2xl animate-pop-in"
        style={{
          backgroundColor: 'var(--nl-bg-glass)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          border: '1px solid var(--nl-accent-border)',
          boxShadow: 'var(--nl-shadow), 0 0 24px -6px var(--nl-accent-glow)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--nl-accent-light), var(--nl-secondary), transparent)',
          }}
        />
        <div ref={bodyRef} className="min-w-0 space-y-1">
          {title && (
            <p
              className="text-[11px] font-extrabold leading-tight tracking-tight break-words whitespace-normal"
              style={{ color: 'var(--nl-text-primary)' }}
            >
              {title}
            </p>
          )}
          <p
            className="text-[11px] leading-relaxed font-medium break-words whitespace-normal"
            style={{ color: 'var(--nl-text-secondary)' }}
          >
            {text}
          </p>
          {hint && (
            <p
              className="text-[10px] font-mono pt-0.5 break-words whitespace-normal"
              style={{ color: 'var(--nl-accent-light)' }}
            >
              {hint}
            </p>
          )}
        </div>
        <span
          ref={arrowRef}
          className="absolute w-2.5 h-2.5 rotate-45 pointer-events-none"
          style={{
            backgroundColor: 'var(--nl-bg-elevated)',
            borderColor: 'var(--nl-accent-border)',
            borderStyle: 'solid',
          }}
        />
      </div>
    </div>,
    document.body
  )
}

interface InfoTipProps {
  title?: string
  text: string
  hint?: string
  side?: Side
  size?: 'xs' | 'sm'
  className?: string
}

export function InfoTip({ title, text, hint, side = 'top', size = 'xs', className = '' }: InfoTipProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [pinned, setPinned] = useState(false)

  function updateRect() {
    if (triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect())
    }
  }

  useEffect(() => {
    if (!pinned) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      const insideTrigger = triggerRef.current?.contains(target)
      const insideTooltip = target instanceof Element && Boolean(target.closest('[role="tooltip"]'))
      if (!insideTrigger && !insideTooltip) {
        setPinned(false)
        setRect(null)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPinned(false)
        setRect(null)
      }
    }
    window.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  const dimCls = size === 'sm' ? 'w-4.5 h-4.5' : 'w-4 h-4'
  const iconCls = size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5'

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={title ? `Información: ${title}` : 'Información'}
      onMouseEnter={updateRect}
      onMouseLeave={() => { if (!pinned) setRect(null) }}
      onFocus={updateRect}
      onBlur={() => { if (!pinned) setRect(null) }}
      onClick={e => {
        e.stopPropagation()
        setPinned(prev => {
          const next = !prev
          if (next) updateRect()
          else setRect(null)
          return next
        })
      }}
      className={`inline-flex items-center justify-center rounded-full shrink-0 transition-all duration-150 focus:outline-none focus-visible:ring-2 ${dimCls} ${className}`}
      style={{
        backgroundColor: rect ? 'var(--nl-accent-soft)' : 'transparent',
        border: `1px solid ${rect ? 'var(--nl-accent-border)' : 'var(--nl-border-strong)'}`,
        color: rect ? 'var(--nl-accent-light)' : 'var(--nl-text-muted)',
      }}
    >
      <Info className={iconCls} />
      {rect && (
        <FloatingPopover
          triggerRef={triggerRef}
          initialRect={rect}
          title={title}
          text={text}
          hint={hint}
          preferredSide={side}
          interactive={pinned}
        />
      )}
    </button>
  )
}

interface SystemTooltipProps {
  label: string
  title?: string
  hint?: string
  side?: Side
  className?: string
  children: ReactNode
}

export function SystemTooltip({
  label,
  title,
  hint,
  side = 'top',
  className = 'inline-flex',
  children,
}: SystemTooltipProps) {
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  function openSoon() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (wrapRef.current) {
        setRect(wrapRef.current.getBoundingClientRect())
      }
    }, 90)
  }

  function closeNow() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setRect(null)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <span
      ref={wrapRef}
      className={className}
      onMouseEnter={openSoon}
      onMouseLeave={closeNow}
      onFocus={openSoon}
      onBlur={closeNow}
      onMouseDown={closeNow}
    >
      {children}
      {rect && (
        <FloatingPopover
          triggerRef={wrapRef}
          initialRect={rect}
          title={title}
          text={label}
          hint={hint}
          preferredSide={side}
        />
      )}
    </span>
  )
}
