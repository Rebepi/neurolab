import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Download,
  Eye,
  Flag,
  ListFilter,
  Loader2,
  Radio,
  RefreshCw,
  ScrollText,
  Search,
  Table2,
} from 'lucide-react'
import type { AuditEvent, Project, User } from '../../../types'
import {
  AUDIT_CATEGORY_TABS,
  AUDIT_SEVERITY_META,
  type AuditCategory,
  type AuditMark,
  type AuditMarksStore,
  buildAuditMarkdown,
  exportAuditCsv,
  exportAuditJson,
  formatRelativeTime,
  getActionMeta,
  loadAuditMarks,
  saveAuditMarks,
  summarizeAuditMetadata,
} from '../constants'
import { AuditEventDrawer } from './AuditEventDrawer'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'
import { useToast } from '../../../components/toast/ToastContext'

interface GlobalAuditTabProps {
  auditEvents: AuditEvent[]
  projects: Project[]
  users: User[]
  loading?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  onSilentRefresh?: () => void
}

type ViewMode = 'table' | 'timeline'
type PeriodFilter = 'all' | 'today' | '7d' | '30d'
type QuickFilter = 'all' | 'alerts' | 'marked'

const AUDIT_TABLE_HEADERS = [
  'Fecha',
  'Actor',
  'Área / Proyecto',
  'Acción',
  'Detalles',
  'Marca',
  'Inspección',
] as const

function AuditTableColGroup() {
  return (
    <colgroup>
      <col className="w-[128px]" />
      <col className="w-[16%]" />
      <col className="w-[17%]" />
      <col className="w-[17%]" />
      <col />
      <col className="w-[114px]" />
      <col className="w-[114px]" />
    </colgroup>
  )
}

export function GlobalAuditTab({
  auditEvents,
  projects,
  users,
  loading = false,
  refreshing = false,
  onRefresh,
  onSilentRefresh,
}: GlobalAuditTabProps) {
  const toast = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [categoryFilter, setCategoryFilter] = useState<'all' | AuditCategory>('all')
  const [projectFilter, setProjectFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [liveMode, setLiveMode] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [copiedMd, setCopiedMd] = useState(false)
  const [marks, setMarks] = useState<AuditMarksStore>(() => loadAuditMarks())
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [headerScrollbarPad, setHeaderScrollbarPad] = useState(0)

  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!exportMenuOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [exportMenuOpen])

  useEffect(() => {
    if (!liveMode || !onSilentRefresh) return
    const timer = window.setInterval(() => {
      onSilentRefresh()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [liveMode, onSilentRefresh])

  const projectMap = useMemo(
    () => new Map(projects.map(p => [p.id, p.name])),
    [projects]
  )

  const userRoleMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of users) {
      map.set(u.id, u.role)
      map.set(u.display_name, u.role)
    }
    return map
  }, [users])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: auditEvents.length }
    for (const ev of auditEvents) {
      const cat = getActionMeta(ev.action).category
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [auditEvents])

  const projectOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      { value: '', label: `Todas las áreas (${projects.length})` },
    ]
    const hasSystem = auditEvents.some(e => !e.project_id)
    if (hasSystem) {
      opts.push({ value: '__SYSTEM__', label: 'Nivel Sistema (sin área)' })
    }
    const seen = new Set<string>()
    for (const p of projects) {
      seen.add(p.id)
      opts.push({ value: p.id, label: p.name })
    }
    for (const ev of auditEvents) {
      if (ev.project_id && !seen.has(ev.project_id)) {
        seen.add(ev.project_id)
        opts.push({ value: ev.project_id, label: ev.project_id })
      }
    }
    return opts
  }, [auditEvents, projects])

  const actorOptions = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ev of auditEvents) {
      counts[ev.actor_name] = (counts[ev.actor_name] || 0) + 1
    }
    const list = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        value: name,
        label: `${name} (${count})`,
      }))
    return [{ value: '', label: `Todos los actores (${list.length})` }, ...list]
  }, [auditEvents])

  const markedCount = useMemo(
    () => auditEvents.filter(ev => Boolean(marks[ev.id])).length,
    [auditEvents, marks]
  )

  const filteredAudit = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const now = Date.now()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const items = auditEvents.filter(ev => {
      const meta = getActionMeta(ev.action)
      if (categoryFilter !== 'all' && meta.category !== categoryFilter) return false
      if (projectFilter === '__SYSTEM__' && ev.project_id) return false
      if (projectFilter && projectFilter !== '__SYSTEM__' && ev.project_id !== projectFilter) {
        return false
      }
      if (actorFilter && ev.actor_name !== actorFilter) return false

      if (periodFilter !== 'all') {
        const ts = new Date(ev.created_at).getTime()
        if (periodFilter === 'today' && ts < startOfToday.getTime()) return false
        if (periodFilter === '7d' && ts < now - 7 * 86400000) return false
        if (periodFilter === '30d' && ts < now - 30 * 86400000) return false
      }

      if (quickFilter === 'alerts') {
        if (meta.severity !== 'warning' && meta.severity !== 'critical') return false
      } else if (quickFilter === 'marked') {
        if (!marks[ev.id]) return false
      }

      if (!q) return true
      const pName = ev.project_id ? projectMap.get(ev.project_id) || '' : 'nivel sistema'
      return (
        ev.id.toLowerCase().includes(q) ||
        ev.actor_name.toLowerCase().includes(q) ||
        ev.action.toLowerCase().includes(q) ||
        meta.label.toLowerCase().includes(q) ||
        (ev.project_id || '').toLowerCase().includes(q) ||
        pName.toLowerCase().includes(q) ||
        JSON.stringify(ev.metadata ?? {}).toLowerCase().includes(q)
      )
    })

    return [...items].sort((a, b) =>
      sortOrder === 'desc'
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at)
    )
  }, [
    actorFilter,
    auditEvents,
    categoryFilter,
    marks,
    periodFilter,
    projectFilter,
    projectMap,
    quickFilter,
    searchQuery,
    sortOrder,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredAudit.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedAudit = filteredAudit.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [safePage, pageSize, viewMode])

  useLayoutEffect(() => {
    const el = scrollContainerRef.current
    if (!el || viewMode !== 'table') return

    const syncScrollbarPad = () => {
      const width = Math.max(0, el.offsetWidth - el.clientWidth)
      setHeaderScrollbarPad(prev => (prev === width ? prev : width))
    }

    const raf = window.requestAnimationFrame(syncScrollbarPad)
    const observer = new ResizeObserver(syncScrollbarPad)
    observer.observe(el)

    return () => {
      window.cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [viewMode, paginatedAudit.length, loading])

  const timelineGroups = useMemo(() => {
    const groups: Array<{ dateLabel: string; events: AuditEvent[] }> = []
    for (const ev of paginatedAudit) {
      const dateLabel = new Date(ev.created_at).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
      const last = groups[groups.length - 1]
      if (!last || last.dateLabel !== dateLabel) {
        groups.push({ dateLabel, events: [ev] })
      } else {
        last.events.push(ev)
      }
    }
    return groups
  }, [paginatedAudit])

  const hasActiveFilters = Boolean(
    searchQuery ||
      categoryFilter !== 'all' ||
      projectFilter ||
      actorFilter ||
      periodFilter !== 'all' ||
      quickFilter !== 'all'
  )

  function clearFilters() {
    setSearchQuery('')
    setCategoryFilter('all')
    setProjectFilter('')
    setActorFilter('')
    setPeriodFilter('all')
    setQuickFilter('all')
    setCurrentPage(1)
  }

  function handleSaveMark(eventId: string, nextMark: AuditMark | null) {
    setMarks(prev => {
      const next = { ...prev }
      if (nextMark) {
        next[eventId] = nextMark
      } else {
        delete next[eventId]
      }
      saveAuditMarks(next)
      return next
    })
  }

  function handleQuickFlag(ev: AuditEvent) {
    const existing = marks[ev.id]
    if (existing?.status === 'flagged') {
      handleSaveMark(ev.id, null)
      toast.info('Marca retirada', getActionMeta(ev.action).label)
    } else {
      handleSaveMark(ev.id, {
        status: 'flagged',
        note: existing?.note || '',
        updatedAt: new Date().toISOString(),
      })
      toast.success('Evento marcado para seguimiento', ev.actor_name)
    }
  }

  async function handleCopyMarkdown() {
    const md = buildAuditMarkdown(filteredAudit, projectMap, marks)
    await navigator.clipboard.writeText(md).catch(() => {})
    setCopiedMd(true)
    setTimeout(() => setCopiedMd(false), 1600)
    setExportMenuOpen(false)
    toast.success('Resumen Markdown copiado', `${filteredAudit.length} eventos incluidos`)
  }

  const selectedIndex = selectedEventId
    ? filteredAudit.findIndex(e => e.id === selectedEventId)
    : -1
  const selectedEvent = selectedIndex >= 0 ? filteredAudit[selectedIndex] : null

  const relatedEvents = useMemo(() => {
    if (!selectedEvent) return []
    return auditEvents
      .filter(
        ev =>
          ev.id !== selectedEvent.id &&
          ((selectedEvent.project_id && ev.project_id === selectedEvent.project_id) ||
            ev.actor_name === selectedEvent.actor_name)
      )
      .slice(0, 4)
  }, [auditEvents, selectedEvent])

  return (
    <div className="flex-1 flex flex-col gap-4 md:min-h-0">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 relative z-20">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-cyan-500/20 text-white border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Table2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tabla</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                viewMode === 'timeline'
                  ? 'bg-cyan-500/20 text-white border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Línea de Tiempo</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {AUDIT_CATEGORY_TABS.map(cat => {
              const active = categoryFilter === cat.id
              const count = categoryCounts[cat.id] || 0
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat.id)
                    setCurrentPage(1)
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-white'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-900/90 text-[10px] font-mono text-slate-300">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLiveMode(v => !v)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
              liveMode
                ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-300'
                : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
            title="Actualiza automáticamente cada 15 segundos"
          >
            <Radio className={`w-3.5 h-3.5 ${liveMode ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span>En vivo</span>
          </button>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing || loading}
              className="px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-cyan-400 ${refreshing || loading ? 'animate-spin' : ''}`}
              />
              <span>Actualizar</span>
            </button>
          )}

          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen(o => !o)}
              disabled={filteredAudit.length === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Exportar</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-[#091329] border border-cyan-500/30 rounded-xl shadow-2xl p-1.5 z-40 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    exportAuditJson(filteredAudit, projectMap)
                    setExportMenuOpen(false)
                    toast.success(
                      'Auditoría exportada en JSON',
                      `${filteredAudit.length} eventos exportados`
                    )
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800/80 text-left"
                >
                  <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>JSON Forense (.json)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportAuditCsv(filteredAudit, projectMap, marks)
                    setExportMenuOpen(false)
                    toast.success(
                      'Auditoría exportada en CSV',
                      `${filteredAudit.length} eventos exportados`
                    )
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800/80 text-left"
                >
                  <Table2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CSV Excel (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800/80 text-left"
                >
                  {copiedMd ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>Copiar Resumen Markdown</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[210px] max-w-xs">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar actor, área, acción, ID o detalle..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <SystemSelect
            value={projectFilter}
            onChange={val => {
              setProjectFilter(val)
              setCurrentPage(1)
            }}
            size="sm"
            searchable
            className="w-full sm:w-52"
            ariaLabel="Filtrar por área o proyecto"
            options={projectOptions}
          />

          <SystemSelect
            value={actorFilter}
            onChange={val => {
              setActorFilter(val)
              setCurrentPage(1)
            }}
            size="sm"
            searchable
            className="w-full sm:w-44"
            ariaLabel="Filtrar por actor"
            options={actorOptions}
          />

          <SystemSelect
            value={periodFilter}
            onChange={val => {
              setPeriodFilter(val as PeriodFilter)
              setCurrentPage(1)
            }}
            size="sm"
            className="w-36"
            ariaLabel="Filtrar por período"
            options={[
              { value: 'all', label: 'Todo el historial' },
              { value: 'today', label: 'Solo hoy' },
              { value: '7d', label: 'Últimos 7 días' },
              { value: '30d', label: 'Últimos 30 días' },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'alerts', label: 'Alertas' },
                { id: 'marked', label: `Marcados (${markedCount})` },
              ] as Array<{ id: QuickFilter; label: string }>
            ).map(q => {
              const active = quickFilter === q.id
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setQuickFilter(q.id)
                    setCurrentPage(1)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    active
                      ? 'bg-cyan-500/20 text-white border border-cyan-400/40'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {q.label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setSortOrder(o => (o === 'desc' ? 'asc' : 'desc'))}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            title="Cambiar orden cronológico"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
            <span>{sortOrder === 'desc' ? 'Recientes' : 'Antiguos'}</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      <div className="nl-cyber-panel animate-card-reveal nl-stagger-1 rounded-2xl overflow-hidden flex-1 min-h-[260px] md:min-h-0 flex flex-col">
        {loading && auditEvents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-12 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" />
          </div>
        ) : filteredAudit.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-2">
            <ScrollText className="w-8 h-8 text-slate-500 mx-auto opacity-60" />
            <p className="text-sm text-slate-300 font-semibold">
              No se encontraron eventos de auditoría con los filtros aplicados
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="flex-1 min-h-0 overflow-x-auto flex flex-col">
            <div className="min-w-[1020px] flex-1 min-h-0 flex flex-col">
              <div
                className="shrink-0 border-b border-slate-800 bg-slate-950/90"
                style={headerScrollbarPad > 0 ? { paddingRight: headerScrollbarPad } : undefined}
              >
                <table className="w-full text-xs table-fixed">
                  <AuditTableColGroup />
                  <thead>
                    <tr>
                      {AUDIT_TABLE_HEADERS.map(h => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-slate-400 text-[11px] uppercase tracking-wider font-bold whitespace-nowrap ${
                            h === 'Inspección' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                </table>
              </div>

              <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
                <table className="w-full text-xs table-fixed">
                  <AuditTableColGroup />
                  <tbody className="divide-y divide-slate-800/60">
                {paginatedAudit.map(ev => {
                  const meta = getActionMeta(ev.action)
                  const sev = AUDIT_SEVERITY_META[meta.severity]
                  const areaName = ev.project_id
                    ? projectMap.get(ev.project_id) || ev.project_id
                    : 'Nivel Sistema'
                  const roleLabel = userRoleMap.get(ev.actor_name) || userRoleMap.get(ev.actor_id)
                  const chips = summarizeAuditMetadata(ev, projectMap).slice(0, 2)
                  const mark = marks[ev.id]
                  const initials =
                    ev.actor_name
                      .split(' ')
                      .filter(Boolean)
                      .map(w => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'NL'

                  return (
                    <tr
                      key={ev.id}
                      onClick={() => setSelectedEventId(ev.id)}
                      className="hover:bg-slate-800/35 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">
                        <p>
                          {new Date(ev.created_at).toLocaleString('es', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {formatRelativeTime(ev.created_at)}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-cyan-300 shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-semibold truncate">
                              {ev.actor_name}
                            </p>
                            {roleLabel && (
                              <p className="text-[10px] text-slate-400 truncate">
                                {roleLabel}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          title={ev.project_id || 'Nivel Sistema'}
                          className="text-slate-200 font-medium block truncate"
                        >
                          {areaName}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          title={ev.action}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold max-w-full ${meta.badgeCls}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sev.dotCls}`} />
                          <span className="truncate">{meta.label}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {chips.length === 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {chips.map(c => (
                              <span
                                key={`${c.label}-${c.value}`}
                                className="px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-800 text-[10.5px] text-slate-300 truncate max-w-[220px]"
                                title={`${c.label}: ${c.value}`}
                              >
                                <span className="text-slate-500">{c.label}:</span>{' '}
                                <span className="text-slate-200 font-mono">{c.value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleQuickFlag(ev)}
                          title={
                            mark?.status === 'flagged'
                              ? 'Quitar seguimiento'
                              : mark?.status === 'reviewed'
                                ? 'Marcado como revisado'
                                : 'Marcar para seguimiento'
                          }
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10.5px] font-bold transition-colors ${
                            mark?.status === 'flagged'
                              ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                              : mark?.status === 'reviewed'
                                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                                : 'bg-slate-950/70 border-slate-800 text-slate-500 hover:text-amber-300'
                          }`}
                        >
                          {mark?.status === 'reviewed' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Flag className="w-3 h-3" />
                          )}
                          <span>
                            {mark?.status === 'flagged'
                              ? 'Seguim.'
                              : mark?.status === 'reviewed'
                                ? 'OK'
                                : 'Marcar'}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedEventId(ev.id)
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3 text-cyan-400" />
                          <span>Detalle</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
            {timelineGroups.map(group => (
              <div key={group.dateLabel} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-bold text-cyan-300 capitalize">
                    {group.dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-slate-800/80" />
                </div>

                <div className="pl-4 border-l border-slate-800/90 space-y-2.5">
                  {group.events.map(ev => {
                    const meta = getActionMeta(ev.action)
                    const sev = AUDIT_SEVERITY_META[meta.severity]
                    const areaName = ev.project_id
                      ? projectMap.get(ev.project_id) || ev.project_id
                      : 'Nivel Sistema'
                    const chips = summarizeAuditMetadata(ev, projectMap).slice(0, 3)
                    const mark = marks[ev.id]

                    return (
                      <div
                        key={ev.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedEventId(ev.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedEventId(ev.id)
                          }
                        }}
                        className="relative p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer"
                      >
                        <span
                          className={`absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full ring-4 ring-[#061024] ${sev.dotCls}`}
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${meta.badgeCls}`}>
                              {meta.label}
                            </span>
                            <span className="text-xs font-bold text-white">{ev.actor_name}</span>
                            <span className="text-[11px] text-cyan-300/90">en {areaName}</span>
                            {mark && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  mark.status === 'flagged'
                                    ? 'bg-amber-500/15 border border-amber-400/40 text-amber-300'
                                    : 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300'
                                }`}
                              >
                                {mark.status === 'flagged' ? 'Seguimiento' : 'Revisado'}
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(ev.created_at).toLocaleTimeString('es', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {formatRelativeTime(ev.created_at)}
                          </span>
                        </div>

                        {chips.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {chips.map(c => (
                              <span
                                key={`${c.label}-${c.value}`}
                                className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10.5px] text-slate-300"
                              >
                                <span className="text-slate-500">{c.label}:</span>{' '}
                                <span className="font-mono text-slate-200">{c.value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && filteredAudit.length > 0 && (
        <PaginationBar
          variant="card"
          currentPage={safePage}
          totalItems={filteredAudit.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          itemLabel="eventos"
        />
      )}

      {selectedEvent && (
        <AuditEventDrawer
          event={selectedEvent}
          eventIndex={selectedIndex}
          totalCount={filteredAudit.length}
          projectName={
            selectedEvent.project_id
              ? projectMap.get(selectedEvent.project_id) || selectedEvent.project_id
              : 'Nivel Sistema'
          }
          actorRole={
            userRoleMap.get(selectedEvent.actor_name) || userRoleMap.get(selectedEvent.actor_id)
          }
          mark={marks[selectedEvent.id]}
          relatedEvents={relatedEvents}
          projectMap={projectMap}
          onClose={() => setSelectedEventId(null)}
          onSelectEvent={ev => setSelectedEventId(ev.id)}
          onPrev={() => {
            if (selectedIndex > 0) {
              setSelectedEventId(filteredAudit[selectedIndex - 1].id)
            }
          }}
          onNext={() => {
            if (selectedIndex < filteredAudit.length - 1) {
              setSelectedEventId(filteredAudit[selectedIndex + 1].id)
            }
          }}
          onSaveMark={handleSaveMark}
        />
      )}
    </div>
  )
}
