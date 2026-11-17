import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { SystemSelect } from './SystemSelect'

interface PaginationBarProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  pageSizeOptions?: readonly number[]
  onPageSizeChange?: (size: number) => void
  itemLabel?: string
}

function buildPageTokens(current: number, total: number): Array<number | 'ellipsis-left' | 'ellipsis-right'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const tokens: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) tokens.push('ellipsis-left')
  for (let p = start; p <= end; p++) tokens.push(p)
  if (end < total - 1) tokens.push('ellipsis-right')
  tokens.push(total)
  return tokens
}

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions = [5, 10, 25, 50],
  onPageSizeChange,
  itemLabel = 'registros',
}: PaginationBarProps) {
  if (totalItems <= 0) return null

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIdx = (safePage - 1) * pageSize + 1
  const endIdx = Math.min(safePage * pageSize, totalItems)
  const pageTokens = buildPageTokens(safePage, totalPages)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-800/80 bg-slate-950/45 text-xs">
      <div className="flex flex-wrap items-center gap-3 text-slate-400">
        <span>
          Mostrando <span className="text-white font-mono font-semibold">{startIdx}–{endIdx}</span> de{' '}
          <span className="text-white font-mono font-semibold">{totalItems}</span> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Por página:</span>
            <SystemSelect
              value={String(pageSize)}
              onChange={val => onPageSizeChange(Number(val))}
              size="xs"
              className="w-20"
              menuMinWidth={96}
              ariaLabel="Registros por página"
              options={pageSizeOptions.map(n => ({
                value: String(n),
                label: String(n),
                mono: true,
              }))}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          aria-label="Primera página"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Página anterior"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1 px-1">
          {pageTokens.map(token =>
            typeof token === 'number' ? (
              <button
                key={token}
                type="button"
                onClick={() => onPageChange(token)}
                aria-current={token === safePage ? 'page' : undefined}
                className={`min-w-7 h-7 px-2 rounded-lg font-mono text-[11px] font-bold transition-all ${
                  token === safePage
                    ? 'nl-accent-bg nl-accent-glow text-white'
                    : 'bg-slate-900/70 hover:bg-slate-800 border border-slate-800 text-slate-300'
                }`}
              >
                {token}
              </button>
            ) : (
              <span key={token} className="px-1 text-slate-500 font-mono select-none">
                …
              </span>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Página siguiente"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          aria-label="Última página"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

