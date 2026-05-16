import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, X, Target } from 'lucide-react'
import * as THREE from 'three'
import { useThreeScene } from '../hooks/useThreeScene'
import { useTheme } from '../hooks/useTheme'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { useMouseParallax } from '../hooks/useMouseParallax'

import { apiFetch } from '../api/apiClient'

type Vertical = 'accounting_finance' | 'banking_lending' | 'investment_wealth' | 'sap_supply_chain' | ''
type FunnelStage = 'TOFU' | 'MOFU' | ''
type IntentScore = 'High' | 'Medium' | 'Low' | ''

const VERTICALS = [
  { key: 'accounting_finance' as const, label: 'Accounting & Finance' },
  { key: 'banking_lending' as const, label: 'Banking & Lending' },
  { key: 'investment_wealth' as const, label: 'Investment & Wealth' },
  { key: 'sap_supply_chain' as const, label: 'SAP & Supply Chain' },
]

interface Keyword {
  id: string
  query: string
  vertical: string
  funnel_stage: string | null
  buyer_intent_score: string | null
  novelty_opportunity: string | null
  priority_matrix: string | null
  buyer_segment: string | null
  recommended_next_action: string | null
  query_cluster: string | null
  intent_type: string | null
}

interface KeywordList {
  keywords: Keyword[]
  total: number
  filtered: number
}

function intentColor(score: string | null) {
  if (score === 'High') return 'text-[var(--solar)] border-[var(--solar)]'
  if (score === 'Medium') return 'text-[var(--aurora)] border-[var(--aurora)]'
  if (score === 'Low') return 'text-[var(--stellar)] border-[var(--stellar)]'
  return 'text-[var(--stellar)] border-[var(--stellar)]'
}

function noveltyColor(score: string | null) {
  if (score === 'High') return 'text-[var(--aurora)] border-[var(--aurora)]'
  if (score === 'Medium') return 'text-[var(--plasma)] border-[var(--plasma)]'
  if (score === 'Low') return 'text-[var(--coral)] border-[var(--coral)]'
  return 'text-[var(--stellar)] border-[var(--stellar)]'
}

function funnelColor(stage: string | null) {
  if (stage === 'TOFU') return 'text-[var(--aurora)] border-[var(--aurora)]'
  if (stage === 'MOFU') return 'text-[var(--solar)] border-[var(--solar)]'
  return 'text-[var(--stellar)] border-[var(--stellar)]'
}

function funnelStyle(stage: string | null) {
  if (stage === 'TOFU') return { backgroundColor: 'color-mix(in srgb, var(--aurora) 10%, transparent)' }
  if (stage === 'MOFU') return { backgroundColor: 'color-mix(in srgb, var(--solar) 10%, transparent)' }
  return {}
}

function priorityLabel(pm: string | null) {
  if (!pm) return null
  const map: Record<string, string> = {
    'Sweet Spot': 'text-[var(--aurora)] border-[var(--aurora)]',
    'High Priority': 'text-[var(--solar)] border-[var(--solar)]',
    'Hard to Win': 'text-[var(--coral)] border-[var(--coral)]',
    'Authority Builder': 'text-[var(--plasma)] border-[var(--plasma)]',
    'Deprioritize': 'text-[var(--text-muted)] border-[var(--border-subtle)]',
    'Skip/Defer': 'text-[var(--coral)] border-[var(--coral)]',
  }
  return map[pm] || 'text-[var(--stellar)] border-[var(--stellar)]'
}

function KeywordRow({ kw }: { kw: Keyword }) {
  const [open, setOpen] = useState(false)
  const pm = priorityLabel(kw.priority_matrix)

  return (
    <>
      <tr
        className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-3 px-4">
          <p className="text-sm text-[var(--text-primary)] font-medium">{kw.query}</p>
          {kw.query_cluster && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{kw.query_cluster}</p>
          )}
        </td>
        <td className="py-3 px-3 hidden md:table-cell">
          <span className="tag text-[var(--plasma)] border-[var(--plasma)] text-xs">{kw.vertical.replace(/_/g, ' ')}</span>
        </td>
        <td className="py-3 px-3 hidden sm:table-cell">
          {kw.funnel_stage && <span className={`tag ${funnelColor(kw.funnel_stage)}`} style={funnelStyle(kw.funnel_stage)}>{kw.funnel_stage}</span>}
        </td>
        <td className="py-3 px-3">
          {kw.buyer_intent_score && (
            <span className={`tag ${intentColor(kw.buyer_intent_score)}`}>{kw.buyer_intent_score}</span>
          )}
        </td>
        <td className="py-3 px-3 hidden lg:table-cell">
          {kw.novelty_opportunity && (
            <span className={`tag ${noveltyColor(kw.novelty_opportunity)}`}>{kw.novelty_opportunity}</span>
          )}
        </td>
        <td className="py-3 px-3 hidden xl:table-cell">
          {pm && kw.priority_matrix && (
            <span className={`tag ${pm}`}>{kw.priority_matrix}</span>
          )}
        </td>
        <td className="py-3 px-3 text-right">
          {open ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)] inline" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)] inline" />
          )}
        </td>
      </tr>
      <AnimatePresence>
        {open && (
          <tr>
            <td colSpan={7} className="px-4 pb-4 pt-1 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)]">
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 pb-1">
                  {kw.buyer_segment && (
                    <div>
                      <p className="font-mono text-xs text-[var(--text-muted)] uppercase mb-1">Buyer Segment</p>
                      <p className="text-sm text-[var(--text-primary)]">{kw.buyer_segment}</p>
                    </div>
                  )}
                  {kw.intent_type && (
                    <div>
                      <p className="font-mono text-xs text-[var(--text-muted)] uppercase mb-1">Intent Type</p>
                      <p className="text-sm text-[var(--text-primary)]">{kw.intent_type}</p>
                    </div>
                  )}
                  {kw.recommended_next_action && (
                    <div className="sm:col-span-2">
                      <p className="font-mono text-xs text-[var(--text-muted)] uppercase mb-1">Recommended Action</p>
                      <p className="text-sm text-[var(--text-primary)]">{kw.recommended_next_action}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}

export default function KeywordsPage() {
  useScrollReveal()
  const mouse = useMouseParallax()
  const { theme } = useTheme()

  const [data, setData] = useState<KeywordList | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [vertical, setVertical] = useState<Vertical>('')
  const [funnel, setFunnel] = useState<FunnelStage>('')
  const [intent, setIntent] = useState<IntentScore>('')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useThreeScene(canvasRef, (scene, camera) => {
    const isDark = theme === 'dark'
    const group = new THREE.Group()
    
    // Star Map
    const starCount = 60
    const stars: THREE.Mesh[] = []
    
    const darkCols = {
      High:   new THREE.Color('#c8722a'), // Solar
      Medium: new THREE.Color('#d4956a'), // Aurora
      Low:    new THREE.Color('#e8c080')  // Stellar
    }
    const lightCols = {
      High:   new THREE.Color('#e8a020'), // Solar
      Medium: new THREE.Color('#d4813a'), // Aurora
      Low:    new THREE.Color('#5a8a6e')  // Stellar/Sage
    }
    const colors = isDark ? darkCols : lightCols

    for (let i = 0; i < starCount; i++) {
      const difficulty = i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low'
      const geo = new THREE.SphereGeometry(0.12 + Math.random() * 0.2, 16, 16)
      const mat = new THREE.MeshStandardMaterial({
        color: colors[difficulty as keyof typeof colors],
        emissive: colors[difficulty as keyof typeof colors],
        emissiveIntensity: isDark ? 0.8 : 0.2,
        transparent: true,
        opacity: isDark ? 0.8 : 0.6
      })
      const star = new THREE.Mesh(geo, mat)
      
      const r = 10 + Math.random() * 15
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      star.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )
      
      star.userData = {
        basePos: star.position.clone(),
        phase: Math.random() * Math.PI * 2
      }
      
      group.add(star)
      stars.push(star)
    }

    // Constellation Lines
    const lineMat = new THREE.LineBasicMaterial({ 
      color: isDark ? 0xd4956a : 0xd4813a, 
      transparent: true, 
      opacity: isDark ? 0.15 : 0.2 
    })
    for (let i = 0; i < starCount; i++) {
      if (Math.random() > 0.8) {
        const targetIdx = Math.floor(Math.random() * starCount)
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          stars[i].position,
          stars[targetIdx].position
        ])
        const line = new THREE.Line(lineGeo, lineMat)
        group.add(line)
      }
    }

    scene.add(group)
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.2 : 0.6))
    
    const light = new THREE.PointLight(0xffffff, isDark ? 1.5 : 1, 100)
    light.position.set(10, 10, 10)
    scene.add(light)

    camera.position.z = 30
    return { group, stars }
  }, (state, clock, mousePos) => {
    const { group, stars } = state
    const t = clock.getElapsedTime()
    const isDark = theme === 'dark'

    stars.forEach((star: THREE.Mesh) => {
      const mat = star.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = (isDark ? 0.5 : 0.1) + Math.sin(t * 2 + star.userData.phase) * (isDark ? 0.5 : 0.1)
      star.position.y = star.userData.basePos.y + Math.sin(t + star.userData.phase) * 0.2
    })

    group.rotation.y = t * 0.05 + mousePos.x * 0.2
    group.rotation.x = mousePos.y * 0.1
  })

  const fetchKeywords = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('query', search)
      if (vertical) params.set('vertical', vertical)
      if (funnel) params.set('funnel_stage', funnel)
      if (intent) params.set('buyer_intent_score', intent)
      params.set('limit', String(pageSize))
      params.set('offset', String(page * pageSize))

      const data = await apiFetch<KeywordList>(`/api/v1/keywords?${params.toString()}`)
      setData(data)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch keywords')
    } finally {
      setLoading(false)
    }
  }, [search, vertical, funnel, intent, page])

  useEffect(() => { fetchKeywords() }, [fetchKeywords])
  useEffect(() => { setPage(0) }, [search, vertical, funnel, intent])

  const hasFilters = !!(search || vertical || funnel || intent)
  const clearFilters = () => {
    setSearch(''); setVertical(''); setFunnel(''); setIntent(''); setPage(0)
  }

  const totalPages = data ? Math.ceil(data.filtered / pageSize) : 0

  return (
    <div className="min-h-screen pt-8 pb-20 px-4 relative">
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-30" />

      <div 
        className="max-w-7xl mx-auto space-y-6 relative z-10"
        style={{ transform: `translate(${mouse.current.x * -10}px, ${mouse.current.y * -10}px)` }}
      >
        <div className="mb-10 reveal">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-8 h-8 text-[var(--aurora)]" />
            <h1 className="page-title gradient-text">Entity Radar</h1>
          </div>
          <p className="text-[var(--text-secondary)] text-base max-w-xl">
            Browse and filter the full 116-keyword taxonomy across 4 verticals with intent, novelty, and priority matrix scores.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="card p-4 mb-6 reveal"
        >
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  className="w-full pl-9 pr-4 py-2 text-sm"
                  placeholder="Search keywords..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="min-w-40">
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Vertical</label>
              <select
                className="w-full px-3 py-2 text-sm appearance-none bg-[var(--surface-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded"
                value={vertical}
                onChange={e => setVertical(e.target.value as Vertical)}
              >
                <option value="">All Verticals</option>
                {VERTICALS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </div>

            <div className="min-w-32">
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Funnel</label>
              <select
                className="w-full px-3 py-2 text-sm appearance-none bg-[var(--surface-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded"
                value={funnel}
                onChange={e => setFunnel(e.target.value as FunnelStage)}
              >
                <option value="">All Stages</option>
                <option value="TOFU">TOFU</option>
                <option value="MOFU">MOFU</option>
              </select>
            </div>

            <div className="min-w-32">
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">Intent</label>
              <select
                className="w-full px-3 py-2 text-sm appearance-none bg-[var(--surface-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded"
                value={intent}
                onChange={e => setIntent(e.target.value as IntentScore)}
              >
                <option value="">All Intent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={fetchKeywords}
                className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              {hasFilters && (
                <button onClick={clearFilters} className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm">
                  <X className="w-4 h-4" /> Clear
                </button>
              )}
            </div>
          </div>

          {data && (
            <div className="flex gap-4 mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)]">
              <span>Total: <span className="text-[var(--aurora)]">{data.total}</span></span>
              <span>Filtered: <span className="text-[var(--solar)]">{data.filtered}</span></span>
              <span>Showing: <span className="text-[var(--plasma)]">{data.keywords.length}</span></span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="card overflow-hidden reveal"
        >
          {error && (
            <div className="p-6 flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-[var(--coral)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Failed to load keywords</p>
                <p className="text-xs text-[var(--text-muted)] font-mono">{error}</p>
              </div>
            </div>
          )}

          {loading && !data && (
            <div className="p-8 flex justify-center text-[var(--aurora)]">
              Loading...
            </div>
          )}

          {data && data.keywords.length === 0 && !loading && (
            <div className="p-8 text-center">
              <p className="text-[var(--text-muted)] text-sm">No keywords found matching your filters.</p>
            </div>
          )}

          {data && data.keywords.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                    <th className="py-3 px-4 font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Keyword</th>
                    <th className="py-3 px-3 font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider hidden md:table-cell">Vertical</th>
                    <th className="py-3 px-3 font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider hidden sm:table-cell">Funnel</th>
                    <th className="py-3 px-3 font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Intent</th>
                    <th className="py-3 px-3 font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider hidden lg:table-cell">Novelty Opp.</th>
                    <th className="py-3 px-3 font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider hidden xl:table-cell">Priority</th>
                    <th className="py-3 px-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {data.keywords.map((kw) => <KeywordRow key={kw.id} kw={kw} />)}
                </tbody>
              </table>
            </div>
          )}

          {data && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
              >
                ← Prev
              </button>
              <span className="font-mono text-xs text-[var(--text-muted)]">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
