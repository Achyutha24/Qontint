import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, Target, BarChart2, Shield, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Info } from 'lucide-react'
import * as THREE from 'three'
import { useThreeScene } from '../hooks/useThreeScene'
import { useTheme } from '../hooks/useTheme'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { useMouseParallax } from '../hooks/useMouseParallax'
import CinematicLoader from '../components/ui/CinematicLoader'
import MagneticButton from '../components/ui/MagneticButton'

import { apiFetch } from '../api/apiClient'

type Vertical = 'accounting_finance' | 'banking_lending' | 'investment_wealth' | 'sap_supply_chain'

const VERTICALS: { key: Vertical; label: string }[] = [
  { key: 'accounting_finance', label: 'Accounting & Finance' },
  { key: 'banking_lending', label: 'Banking & Lending' },
  { key: 'investment_wealth', label: 'Investment & Wealth' },
  { key: 'sap_supply_chain', label: 'SAP & Supply Chain' },
]

function ScoreDial({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const offset = circ - value * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          style={{ stroke: color, strokeDasharray: circ, strokeDashoffset: offset, transition: 'stroke-dashoffset 1s ease-out' }}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" fill={color} fontSize="16" fontWeight="700" fontFamily="Space Mono">
          {Math.round(value * 100)}
        </text>
      </svg>
      <p className="text-xs text-[var(--text-muted)] font-mono text-center leading-tight">{label}</p>
    </div>
  )
}

function RecCard({ rec }: { rec: { type: string; description: string; suggested_entities?: string[]; priority: string } }) {
  const [open, setOpen] = useState(false)
  const tagCls = rec.priority === 'High' ? 'text-[var(--solar)] border-[var(--solar)]' : 
                 rec.priority === 'Medium' ? 'text-[var(--aurora)] border-[var(--aurora)]' : 
                 'text-[var(--stellar)] border-[var(--stellar)]'
  return (
    <div className="card p-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Info className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-primary)]">{rec.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`tag ${tagCls}`}>{rec.priority}</span>
          {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
        </div>
      </div>
      <AnimatePresence>
        {open && rec.suggested_entities && rec.suggested_entities.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-muted)] mb-2 font-mono uppercase tracking-wider">Suggested Entities</p>
              <div className="flex flex-wrap gap-2">
                {rec.suggested_entities.map((e, i) => (
                  <span key={i} className="tag">{e}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type AnalyzeResult = {
  novelty: {
    novelty_score: number
    similarity_score: number
    entity_novelty: number
    relationship_novelty: number
    semantic_diversity: number
    passed: boolean
    threshold: number
    verdict: string
    reasoning?: string[]
  }
  ranking: {
    predicted_rank: number
    confidence: number
    optimization_gaps?: string[]
    position_range?: [number, number]
    improvement_potential?: string
  }
  authority: {
    authority_score: number
    matched_entities: string[]
    missing_entities: string[]
    total_checked?: number
  }
  recommendations: Array<{ type: string; description: string; suggested_entities?: string[]; priority: string }>
  total_processing_time_ms: number
  loop_required: boolean
}

/** Map API response fields to what the UI expects (prevents render crashes). */
function normalizeAnalyzeResponse(raw: Record<string, unknown>): AnalyzeResult {
  const novelty = (raw.novelty ?? {}) as AnalyzeResult['novelty']
  const rankingRaw = (raw.ranking ?? {}) as Record<string, unknown>
  const authorityRaw = (raw.authority ?? {}) as Record<string, unknown>

  const predictedRank =
    (rankingRaw.predicted_rank as number | undefined) ??
    (rankingRaw.predicted_position as number | undefined) ??
    50

  const range = rankingRaw.position_range as [number, number] | undefined
  const positionRange: [number, number] = range ?? [
    Math.max(1, predictedRank - 5),
    Math.min(100, predictedRank + 5),
  ]

  const matched = (authorityRaw.matched_entities as string[] | undefined) ?? []
  const missing =
    (authorityRaw.missing_entities as string[] | undefined) ??
    (authorityRaw.missing_high_authority as string[] | undefined) ??
    []

  const authorityScore =
    (authorityRaw.authority_score as number | undefined) ??
    (authorityRaw.coverage_score as number | undefined) ??
    0

  const totalChecked =
    (authorityRaw.total_checked as number | undefined) ??
    Math.max(matched.length + missing.length, 1)

  const gaps = (rankingRaw.optimization_gaps as string[] | undefined) ?? []
  const improvement =
    (rankingRaw.improvement_potential as string | undefined) ??
    (gaps.length > 0 ? gaps[0] : 'Content meets baseline ranking signals.')

  return {
    novelty,
    ranking: {
      predicted_rank: predictedRank,
      confidence: (rankingRaw.confidence as number) ?? 0.5,
      optimization_gaps: gaps,
      position_range: positionRange,
      improvement_potential: improvement,
    },
    authority: {
      authority_score: authorityScore,
      matched_entities: matched,
      missing_entities: missing,
      total_checked: totalChecked,
    },
    recommendations: (raw.recommendations as AnalyzeResult['recommendations']) ?? [],
    total_processing_time_ms: (raw.total_processing_time_ms as number) ?? 0,
    loop_required: Boolean(raw.loop_required),
  }
}

function ResultsPanel({ data }: { data: AnalyzeResult }) {
  const { novelty, ranking, authority, recommendations, total_processing_time_ms, loop_required } = data
  const positionRange = ranking.position_range ?? [
    Math.max(1, ranking.predicted_rank - 5),
    Math.min(100, ranking.predicted_rank + 5),
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        {novelty.passed ? (
          <span className="tag text-[var(--aurora)] border-[var(--aurora)]">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> NOVELTY PASSED
          </span>
        ) : (
          <span className="tag text-[var(--solar)] border-[var(--solar)]">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> NOVELTY FAILED
          </span>
        )}
        {loop_required && <span className="tag text-[var(--solar)] border-[var(--solar)]">REVISION REQUIRED</span>}
        <span className="ml-auto font-mono text-xs text-[var(--text-muted)]">{total_processing_time_ms}ms pipeline</span>
      </div>

      <div className="card p-6 reveal">
        <h3 className="font-display font-semibold text-[var(--text-primary)] mb-5 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[var(--aurora)]" /> Novelty Breakdown
        </h3>
        <div className="flex flex-wrap justify-around gap-4">
          <ScoreDial value={novelty.novelty_score} color="var(--aurora)" label="Overall Novelty" />
          <ScoreDial value={novelty.entity_novelty} color="var(--plasma)" label="Entity Novelty" />
          <ScoreDial value={novelty.relationship_novelty} color="var(--stellar)" label="Relationship" />
          <ScoreDial value={novelty.semantic_diversity} color="var(--gold)" label="Semantic Diversity" />
        </div>
        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap gap-4 text-sm">
          <div>
            <p className="font-mono text-xs text-[var(--text-muted)] mb-0.5">Verdict</p>
            <p className="text-[var(--text-primary)] font-medium">{novelty.verdict}</p>
          </div>
          <div>
            <p className="font-mono text-xs text-[var(--text-muted)] mb-0.5">Similarity Score</p>
            <p className="text-[var(--text-primary)] font-medium">{(novelty.similarity_score * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-mono text-xs text-[var(--text-muted)] mb-0.5">Threshold</p>
            <p className="text-[var(--text-primary)] font-medium">{novelty.threshold}</p>
          </div>
        </div>
        {novelty.reasoning && novelty.reasoning.length > 0 && (
          <div className="mt-4 bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-lg p-3">
            <p className="font-mono text-xs text-[var(--text-muted)] mb-1 uppercase">Analysis Reasoning</p>
            <ul className="space-y-1">
              {novelty.reasoning.map((reason: string, i: number) => (
                <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                  <span className="text-[var(--aurora)] shrink-0">→</span> {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 reveal">
        <div className="lg:col-span-2 card p-6">
          <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--aurora)]" /> Ranking Prediction
          </h3>
          <div className="flex items-end gap-2 mb-3">
            <span className="font-mono text-5xl font-bold text-[var(--aurora)]">#{ranking.predicted_rank}</span>
            <span className="text-[var(--text-muted)] text-sm mb-1 font-mono">
              [{positionRange[0]}–{positionRange[1]}]
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-2">{ranking.improvement_potential}</p>
          <div className="flex items-center gap-2 mt-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-[var(--aurora)] to-[var(--plasma)]"
              style={{ width: `${ranking.confidence * 100}%`, maxWidth: '100%' }}
            />
            <span className="font-mono text-xs text-[var(--text-muted)]">{(ranking.confidence * 100).toFixed(0)}% conf</span>
          </div>
          {ranking.optimization_gaps && ranking.optimization_gaps.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <p className="font-mono text-xs text-[var(--text-muted)] mb-2 uppercase">Optimization Gaps</p>
              <ul className="space-y-1">
                {ranking.optimization_gaps.map((gap: string, i: number) => (
                  <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                    <span className="text-[var(--solar)] shrink-0">•</span> {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-display font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--aurora)]" /> Authority Coverage
          </h3>
          <div className="flex items-end gap-2 mb-3">
            <span className="font-mono text-5xl font-bold text-[var(--aurora)]">
              {(authority.authority_score * 100).toFixed(0)}%
            </span>
            <span className="text-[var(--text-muted)] text-sm mb-1">/{authority.total_checked} entities</span>
          </div>
          {authority.missing_entities.length > 0 && (
            <div>
              <p className="font-mono text-xs text-[var(--text-muted)] mb-1.5">Missing</p>
              <div className="flex flex-wrap gap-1">
                {authority.missing_entities.slice(0, 3).map((e: string, i: number) => (
                  <span key={i} className="tag text-[var(--solar)] border-[var(--solar)]">{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {recommendations?.length > 0 && (
        <div className="reveal">
          <h3 className="font-display font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--text-secondary)]" />
            Recommendations ({recommendations.length})
          </h3>
          <div className="space-y-3">
            {recommendations.map((rec: any, i: number) => <RecCard key={i} rec={rec} />)}
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default function AnalyzePage() {
  const [content, setContent] = useState('')
  const [keyword, setKeyword] = useState('')
  const [vertical, setVertical] = useState<Vertical>('accounting_finance')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Re-trigger scroll reveal when results are added to the DOM
  useScrollReveal([result])
  
  const mouse = useMouseParallax()
  const { theme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isAnalyzing = useRef(false)
  
  useThreeScene(canvasRef, (scene, camera) => {
    const isDark = theme === 'dark'
    
    // Background Texture
    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = isDark ? 'rgba(212,149,106,0.05)' : 'rgba(212,129,58,0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      ctx.lineTo(64 + 60 * Math.cos(i * Math.PI / 3), 64 + 60 * Math.sin(i * Math.PI / 3))
    }
    ctx.closePath()
    ctx.stroke()
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(20, 20)
    scene.background = null // Handle via CSS background for transparency

    // Icosahedron (Neural Core)
    const coreGeo = new THREE.IcosahedronGeometry(4, 0)
    const positions = coreGeo.attributes.position.array
    const group = new THREE.Group()

    const darkColors = ['#d4956a', '#f0d080', '#c8722a']
    const lightColors = ['#d4813a', '#8b6f47', '#5a8a6e']
    const colors = isDark ? darkColors : lightColors
    const nodes: THREE.Mesh[] = []

    for (let i = 0; i < positions.length; i += 3) {
      if (Math.random() > 0.3) continue
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06),
        new THREE.MeshStandardMaterial({ 
          color: colors[Math.floor(Math.random() * colors.length)],
          emissive: colors[Math.floor(Math.random() * colors.length)],
          emissiveIntensity: isDark ? 0.5 : 0.2
        })
      )
      mesh.position.set(positions[i], positions[i+1], positions[i+2])
      mesh.userData.targetPos = mesh.position.clone()
      mesh.position.set(0,0,0)
      mesh.userData.idx = i
      nodes.push(mesh)
      group.add(mesh)
    }

    const edges = new THREE.LineSegments(
      coreGeo,
      new THREE.LineBasicMaterial({ 
        color: isDark ? 0xd4956a : 0xd4813a, 
        transparent: true, 
        opacity: isDark ? 0.1 : 0.2 
      })
    )
    group.add(edges)
    scene.add(group)

    const light = new THREE.PointLight(isDark ? 0xd4956a : 0xffffff, isDark ? 2 : 1)
    light.position.set(10, 10, 10)
    scene.add(light)
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.2 : 0.5))
    
    camera.position.z = 15
    return { group, nodes, tex }
  }, (state, clock, mousePos) => {
    const { group, nodes } = state
    const t = clock.getElapsedTime()
    const isDark = theme === 'dark'

    group.rotation.y += 0.002
    const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(mousePos.y * 0.3, mousePos.x * 0.3, 0))
    group.quaternion.slerp(targetQuat, 0.05)

    nodes.forEach((node: THREE.Mesh) => {
      node.position.lerp(node.userData.targetPos, 0.05)
      const scale = 0.8 + 0.4 * Math.sin(t * 2 + node.userData.idx * 0.5)
      node.scale.setScalar(scale)
      
      if (isAnalyzing.current) {
        const wave = Math.sin(t * 5 + node.userData.idx * 0.1)
        ;(node.material as THREE.MeshStandardMaterial).emissiveIntensity = wave > 0.8 ? (isDark ? 2.5 : 1.5) : 0.2
      } else {
        ;(node.material as THREE.MeshStandardMaterial).emissiveIntensity = isDark ? 0.5 : 0.2
      }
    })
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const handleAnalyze = async () => {
    if (!content.trim() || !keyword.trim()) return
    setLoading(true)
    setError(null)
    isAnalyzing.current = true
    try {
      const data = await apiFetch<any>('/api/v1/analyze', {
        method: 'POST',
        body: JSON.stringify({
          content: content,
          keyword: keyword,
          vertical: vertical,
        }),
      })
      setResult(normalizeAnalyzeResponse(data as Record<string, unknown>))
    } catch (e: any) {
      setError(e.message || 'Analysis failed. Make sure the backend is running.')
    } finally {
      setLoading(false)
      isAnalyzing.current = false
    }
  }

  return (
    <div className="min-h-screen pt-8 pb-20 px-4 relative">
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-40" />

      <div 
        className="max-w-6xl mx-auto space-y-6 relative z-10"
        style={{ transform: `translate(${mouse.current.x * -10}px, ${mouse.current.y * -10}px)` }}
      >
        <div className="mb-10 reveal">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-8 h-8 text-[var(--aurora)]" />
            <h1 className="page-title gradient-text">Neural Dissection Chamber</h1>
          </div>
          <p className="text-[var(--text-secondary)] max-w-2xl text-lg">
            Paste your content and target keyword. Qontint extracts entities, scores semantic novelty against live SERP data, and predicts your ranking position with confidence intervals.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 reveal">
          <motion.div
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}
            className="lg:col-span-3 space-y-4"
          >
            <div>
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                Target Keyword
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 text-sm"
                placeholder="e.g. AP automation software"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>

            <div>
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                Vertical
              </label>
              <div className="flex flex-wrap gap-2">
                {VERTICALS.map(v => (
                  <button
                    key={v.key}
                    className={`px-4 py-2 rounded-xl border font-bold transition-all duration-200 text-xs ${
                      vertical === v.key 
                        ? 'bg-[var(--aurora)] text-[var(--bg-void)] border-[var(--aurora)] shadow-lg shadow-[var(--glow-aurora)]' 
                        : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--aurora)] hover:text-[var(--aurora)]'
                    }`}
                    onClick={() => setVertical(v.key)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Content
                </label>
                <span className={`font-mono text-xs ${wordCount < 50 ? 'text-[var(--solar)]' : 'text-[var(--text-muted)]'}`}>
                  {wordCount} words
                </span>
              </div>
              <textarea
                ref={textareaRef}
                className="w-full px-4 py-3 text-sm resize-none min-h-[200px] leading-relaxed"
                placeholder="Paste your content here..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={8}
              />
            </div>

            <MagneticButton
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm"
              onClick={handleAnalyze}
              disabled={loading || content.length < 50 || !keyword.trim()}
            >
              {loading ? 'Running Pipeline…' : <><Cpu className="w-4 h-4" /> Analyze Content</>}
            </MagneticButton>

            {error && (
              <div 
                className="card border-[var(--solar)] p-4 flex gap-3 text-[var(--solar)]"
                style={{ backgroundColor: 'color-mix(in srgb, var(--solar) 5%, transparent)' }}
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }}
            className="lg:col-span-2 space-y-4"
          >
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[var(--text-primary)] mb-3">Pipeline Modules</h3>
              <div className="space-y-3">
                {[
                  { label: 'M2', name: 'Entity Extraction', desc: 'spaCy en_core_web_lg' },
                  { label: 'M4', name: 'Novelty Scorer', desc: '3-component weighted' },
                  { label: 'M5', name: 'Authority Calc.', desc: 'SQLite Authority Baseline' },
                  { label: 'M6', name: 'Ranking Predictor', desc: 'GradientBoosting ML' },
                ].map((m, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div 
                      className="w-7 h-7 rounded text-[var(--aurora)] border border-[var(--aurora)] flex items-center justify-center font-mono text-xs"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--aurora) 10%, transparent)' }}
                    >
                      {m.label}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{m.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Cinematic loading — shows during analysis */}
        <CinematicLoader
          isLoading={loading}
          label="Neural Dissection Running"
          subLabel="Semantic Analysis Pipeline"
        />

        {result && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span className="font-mono text-xs text-[var(--text-primary)] uppercase tracking-wider px-3">Analysis Results</span>
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>
            <ResultsPanel data={result} />
          </div>
        )}
      </div>
    </div>
  )
}
