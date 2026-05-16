import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, RefreshCw, AlertTriangle, Zap, Send } from 'lucide-react'
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

interface GenerateResult {
  content: string
  novelty_score: number
  predicted_position: number | null
  iterations_used: number
  success: boolean
  entity_coverage: number
  job_id: string
  processing_time_ms: number
  error?: string
}

function NoveltyBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 35 ? 'var(--aurora)' : pct >= 20 ? 'var(--solar)' : 'var(--coral)'
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="font-mono text-xs text-[var(--text-muted)]">Novelty Score</span>
        <span className="font-mono text-sm font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-depth)] overflow-hidden border border-[var(--border-subtle)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
      <div className="relative mt-0.5">
        <div className="absolute h-3 border-l border-dashed border-[var(--text-muted)] opacity-40" style={{ left: '35%' }} />
        <p className="text-xs text-[var(--text-muted)] text-right" style={{ marginRight: '1%' }}>threshold: 35%</p>
      </div>
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[var(--aurora)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function ResultCard({ result }: { result: GenerateResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-5 reveal"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Status', value: result.success ? 'SUCCESS' : 'PARTIAL', tag: result.success ? 'text-[var(--aurora)] border-[var(--aurora)]' : 'text-[var(--solar)] border-[var(--solar)]' },
          { label: 'Iterations', value: `${result.iterations_used}`, mono: true },
          { label: 'SERP Rank', value: result.predicted_position ? `#${result.predicted_position}` : 'N/A', mono: true },
          { label: 'Time', value: `${(result.processing_time_ms / 1000).toFixed(1)}s`, mono: true },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className="font-mono text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
            {s.tag ? (
              <span className={`tag ${s.tag}`}>{s.value}</span>
            ) : (
              <p className={`font-bold text-[var(--text-primary)] text-lg ${s.mono ? 'font-mono' : 'font-display'}`}>
                {s.value}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="card p-4">
        <NoveltyBar value={result.novelty_score} />
        <div className="mt-3 flex items-center gap-2">
          <span className="tag text-[var(--aurora)] border-[var(--aurora)]">Coverage: {(result.entity_coverage * 100).toFixed(0)}%</span>
          <span className="font-mono text-xs text-[var(--text-muted)]">job: {result.job_id.slice(0, 8)}...</span>
        </div>
      </div>

      {/* Generated Content */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-[var(--text-primary)]">Generated Content</h3>
          {result.content && <CopyBtn text={result.content} />}
        </div>
        {result.content ? (
          <div className="prose-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap text-sm max-h-[480px] overflow-y-auto pr-2 custom-scroll">
            {result.content}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <AlertTriangle className="w-8 h-8 text-[var(--coral)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Content generation failed</p>
            <p className="text-xs text-[var(--text-muted)] text-center max-w-sm font-mono">
              {result.error
                ? result.error
                : 'No content was returned. Check the backend logs for details.'}
            </p>
            {result.error?.includes('API key') && (
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-xs px-3 py-1.5 mt-1"
              >
                Get a free Gemini API key →
              </a>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function GeneratePage() {
  useScrollReveal()
  const mouse = useMouseParallax()
  const { theme } = useTheme()

  const [keyword, setKeyword] = useState('')
  const [vertical, setVertical] = useState<Vertical>('accounting_finance')
  const [iterations, setIterations] = useState(3)
  const [threshold, setThreshold] = useState(0.35)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  // ── 3D Scene ──
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isGenerating = useRef(false)
  
  useThreeScene(canvasRef, (scene, camera) => {
    const isDark = theme === 'dark'
    
    // Stars
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(1500 * 3)
    for(let i=0; i<1500; i++) {
      starPos[i*3] = (Math.random()-0.5)*100
      starPos[i*3+1] = (Math.random()-0.5)*100
      starPos[i*3+2] = (Math.random()-0.5)*100 - 20
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const starMat = new THREE.PointsMaterial({ 
      color: isDark ? 0xffffff : 0xd4813a, 
      size: 0.1, 
      transparent: true, 
      opacity: isDark ? 0.5 : 0.3 
    })
    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    const group = new THREE.Group()

    // Core
    const coreGeo = new THREE.SphereGeometry(2, 64, 64)
    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(isDark ? '#d4956a' : '#d4813a') },
        uColor2: { value: new THREE.Color(isDark ? '#f0d080' : '#8b6f47') }
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normal;
          vec3 pos = position;
          pos += normal * sin(pos.x * 5.0 + uTime) * 0.1;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          float mixVal = sin(vUv.x * 10.0 + uTime) * 0.5 + 0.5;
          vec3 color = mix(uColor1, uColor2, mixVal);
          float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(color + vec3(intensity), 0.9);
        }
      `,
      transparent: true,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    core.scale.setScalar(3) // Start scale for entry anim
    group.add(core)

    // Rings & Electrons
    const rings: THREE.Mesh[] = []
    
    for (let i = 0; i < 4; i++) {
      const radius = 4 + i * 1.5
      const ringGeo = new THREE.TorusGeometry(radius, 0.02, 16, 100)
      const ringMat = new THREE.MeshBasicMaterial({ 
        color: isDark ? 0xd4956a : 0xd4813a, 
        transparent: true, 
        opacity: isDark ? 0.3 : 0.4 
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = Math.PI / 2
      ring.rotation.y = (Math.PI / 4) * i
      ring.userData.radius = radius
      ring.scale.setScalar(0)
      
      // Electrons
      for (let j = 0; j < 20; j++) {
        const elGeo = new THREE.SphereGeometry(0.08, 8, 8)
        const elMat = new THREE.MeshBasicMaterial({ color: isDark ? 0xffffff : 0x5a8a6e })
        const el = new THREE.Mesh(elGeo, elMat)
        const angle = (j / 20) * Math.PI * 2
        el.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
        ring.add(el)
      }
      
      rings.push(ring)
      group.add(ring)
    }

    // Lightning lines
    const lightningGeo = new THREE.BufferGeometry()
    const lightningPos = new Float32Array(8 * 2 * 3) 
    lightningGeo.setAttribute('position', new THREE.BufferAttribute(lightningPos, 3))
    const lightningMat = new THREE.LineBasicMaterial({ 
      color: isDark ? 0xf0d080 : 0xe8a020, 
      transparent: true, 
      opacity: 0 
    })
    const lightning = new THREE.LineSegments(lightningGeo, lightningMat)
    group.add(lightning)

    scene.add(group)
    camera.position.z = 15

    return { group, core, rings, lightning, stars }
  }, (state, clock, mousePos) => {
    const { group, core, rings, lightning, stars } = state
    const t = clock.getElapsedTime()

    // Core logic
    core.material.uniforms.uTime.value = t
    const targetScale = isGenerating.current ? 1.3 : 1.0
    core.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05)
    
    // Mouse tracking
    const targetPos = new THREE.Vector3(mousePos.x * 5, mousePos.y * 5, 0)
    group.position.lerp(targetPos, 0.05)

    stars.rotation.y = t * 0.05

    // Rings
    const ringSpeed = isGenerating.current ? 4 : 1
    rings.forEach((ring: THREE.Mesh, i: number) => {
      ring.rotation.z += 0.01 * ringSpeed * (i % 2 === 0 ? 1 : -1)
      ring.scale.lerp(new THREE.Vector3(1, 1, 1), 0.02 + i * 0.01) // Entry stagger
    })

    // Lightning
    if (isGenerating.current) {
      lightning.material.opacity = 0.8
      const posArray = lightning.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < 8; i++) {
        const angle1 = Math.random() * Math.PI * 2
        const angle2 = Math.random() * Math.PI * 2
        posArray[i*6] = Math.cos(angle1) * Math.sin(angle2) * 2
        posArray[i*6+1] = Math.sin(angle1) * Math.sin(angle2) * 2
        posArray[i*6+2] = Math.cos(angle2) * 2
        
        const ring = rings[Math.floor(Math.random() * rings.length)]
        const rAngle = Math.random() * Math.PI * 2
        const rRad = ring.userData.radius
        const temp = new THREE.Vector3(Math.cos(rAngle)*rRad, Math.sin(rAngle)*rRad, 0)
        temp.applyMatrix4(ring.matrix)
        posArray[i*6+3] = temp.x
        posArray[i*6+4] = temp.y
        posArray[i*6+5] = temp.z
      }
      lightning.geometry.attributes.position.needsUpdate = true
    } else {
      lightning.material.opacity = Math.max(0, lightning.material.opacity - 0.05)
    }
  })

  useEffect(() => {
    isGenerating.current = loading
  }, [loading])

  const handleGenerate = async () => {
    if (!keyword.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setLogs(['[1/5] Connecting to Gemini AI pipeline...'])

    const addLog = (msg: string) => setLogs(prev => [...prev, msg])

    // Show progressive logs while request is in flight
    const logTimers: ReturnType<typeof setTimeout>[] = []
    const scheduleLog = (msg: string, delayMs: number) => {
      logTimers.push(setTimeout(() => addLog(msg), delayMs))
    }

    scheduleLog('[2/5] Fetching SERP competitor baseline...', 1500)
    scheduleLog('[3/5] Building entity authority map...', 4000)
    scheduleLog('[4/5] Generating content with Gemini AI...', 6000)
    scheduleLog('[5/5] Scoring novelty & authority (this may take 5–10s)...', 9000)

    try {
      const data = await apiFetch<GenerateResult>('/api/v1/generate', {
        method: 'POST',
        body: JSON.stringify({
          keyword,
          vertical,
          max_iterations: iterations,
          novelty_threshold: threshold,
        }),
      })

      // Clear scheduled logs since we got a response
      logTimers.forEach(clearTimeout)

      if (data.error) {
        addLog(`Pipeline error: ${data.error}`)
        setError(data.error)
        setResult(data)
        return
      }

      addLog(`Done — ${data.iterations_used} iteration(s) | novelty: ${(data.novelty_score * 100).toFixed(0)}% | time: ${(data.processing_time_ms / 1000).toFixed(1)}s`)
      setResult(data)
    } catch (e: unknown) {
      logTimers.forEach(clearTimeout)
      const msg = e instanceof Error ? e.message : 'Failed to reach API'
      const hint = msg.includes('fetch') || msg.includes('Failed to reach')
        ? ' Is the backend running at http://127.0.0.1:8000?'
        : ''
      setError(msg + hint)
      setLogs(prev => [...prev, `Error: ${msg}`])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-8 pb-20 px-4 relative">
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-40" />

      <div 
        className="max-w-5xl mx-auto space-y-6 relative z-10"
        style={{ transform: `translate(${mouse.current.x * -10}px, ${mouse.current.y * -10}px)` }}
      >
        <div className="mb-10 reveal">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-[var(--aurora)]" />
            <h1 className="page-title gradient-text">Quantum Forge</h1>
          </div>
          <p className="text-[var(--text-secondary)] text-base max-w-xl">
            Generate high-novelty, semantically authoritative content using the Gemini AI API with an iterative novelty feedback loop.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="card p-6 mb-6 reveal"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                Target Keyword *
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 text-sm"
                placeholder="e.g. AP automation software for mid-market finance"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                Vertical
              </label>
              <div className="flex flex-wrap gap-2">
                {VERTICALS.map(v => (
                  <button
                    key={v.key}
                    className={`btn-secondary text-xs px-3 py-1.5 ${vertical === v.key ? '!bg-[var(--aurora)] !text-[var(--bg-void)] !border-[var(--aurora)]' : ''}`}
                    onClick={() => setVertical(v.key)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                Max Iterations: <span className="text-[var(--aurora)]">{iterations}</span>
              </label>
              <input
                type="range" min={1} max={10} step={1}
                value={iterations}
                onChange={e => setIterations(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--aurora)',
                  appearance: 'auto',
                  margin: 0,
                  padding: 0,
                  display: 'block',
                }}
              />
              <div className="flex justify-between text-xs text-[var(--text-muted)] font-mono mt-1">
                <span>1 (fast)</span><span>10 (quality)</span>
              </div>
            </div>

            <div>
              <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                Novelty Threshold: <span className="text-[var(--solar)]">{threshold.toFixed(2)}</span>
              </label>
              <input
                type="range" min={0.10} max={1.00} step={0.05}
                value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--solar)',
                  appearance: 'auto',
                  margin: 0,
                  padding: 0,
                  display: 'block',
                }}
              />
              <div className="flex justify-between text-xs text-[var(--text-muted)] font-mono mt-1">
                <span>0.10 (lenient)</span><span>1.00 (strict)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <MagneticButton
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 text-sm"
              onClick={handleGenerate}
              disabled={loading || !keyword.trim()}
            >
              {loading ? (
                'Generating…'
              ) : (
                <><Zap className="w-4 h-4" /> Generate Content <Send className="w-4 h-4" /></>
              )}
            </MagneticButton>
            {(result || error) && (
              <button
                className="btn-secondary py-3 px-4 flex items-center gap-1.5 text-sm"
                onClick={() => { setResult(null); setError(null); setLogs([]) }}
              >
                <RefreshCw className="w-4 h-4" /> Reset
              </button>
            )}
          </div>
        </motion.div>

        {/* Cinematic loading overlay — replaces static log list when loading */}
        <CinematicLoader
          isLoading={loading}
          logs={logs}
          label="Quantum Forge Processing"
          subLabel="Gemini AI Pipeline"
        />

        <AnimatePresence>
          {logs.length > 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="card p-4 mb-6 overflow-hidden reveal"
            >
              <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Pipeline Log</p>
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15 }}
                    className={`font-mono text-xs ${i === logs.length - 1 ? 'text-[var(--aurora)]' : 'text-[var(--text-muted)]'}`}
                  >
                    <span className="text-white/30 mr-2">{String(i + 1).padStart(2, '0')}</span>
                    {log}
                  </motion.p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="card p-4 border-l-4 border-[var(--coral)] mb-6 reveal"
          >
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--coral)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Generation failed</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {result && <ResultCard result={result} />}

        {!result && !loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 reveal"
          >
            {[
              { icon: '🧠', title: 'Gemini AI', body: 'Powered by gemini-1.5-flash-8b — Google\'s highest-quota free model with 1,500 requests/day.' },
              { icon: '🔄', title: 'Novelty Loop', body: 'Iteratively regenerates content until it scores above your novelty threshold against live SERP competition.' },
              { icon: '🏆', title: 'Authority Aware', body: 'Entity extraction guides Gemini to cover high-authority B2B concepts your competitors miss.' },
            ].map(c => (
              <div key={c.title} className="card p-4">
                <p className="text-2xl mb-2">{c.icon}</p>
                <h3 className="font-display font-semibold text-[var(--text-primary)] text-sm mb-1">{c.title}</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{c.body}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
