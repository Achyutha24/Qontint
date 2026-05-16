import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Target, Zap, BarChart2, AlertTriangle } from 'lucide-react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js'
import { useThreeScene } from '../hooks/useThreeScene'
import { useTheme } from '../hooks/useTheme'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { useMouseParallax } from '../hooks/useMouseParallax'
import { apiFetch } from '../api/apiClient'

function ScoreDial({ value, color, label, size = 90 }: { value: number; color: string; label: string; size?: number }) {
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const offset = circ - value * circ
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          style={{ stroke: color, strokeDasharray: circ, strokeDashoffset: offset, transition: 'stroke-dashoffset 1s ease-out' }}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
        <text x={size/2} y={size/2 + 5} textAnchor="middle" fill={color} fontSize={size * 0.17} fontWeight="700" fontFamily="Space Mono">
          {Math.round(value * 100)}
        </text>
      </svg>
      <p className="font-mono text-xs text-[var(--text-muted)] text-center leading-tight">{label}</p>
    </div>
  )
}

function GaugeBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="font-mono text-xs text-[var(--text-muted)]">{label}</span>
        <span className="font-mono text-xs font-bold" style={{ color }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-depth)] overflow-hidden border border-[var(--border-subtle)]">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ background: `linear-gradient(90deg, ${color}60, ${color})` }}
        />
      </div>
    </div>
  )
}

interface YouTubePrediction {
  seoScore: number
  viralityScore: number
  engagementScore: number
  thumbnailScore: number
  noveltyScore: number
  rankEstimate: number
  views24h: number
  views7d: number
  views30d: number
  recs: string[]
  verdict: string
}

function formatNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function YouTubePage() {
  useScrollReveal()
  const mouse = useMouseParallax()
  const { theme } = useTheme()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [result, setResult] = useState<YouTubePrediction | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── 3D Scene ──
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isAnalyzing = useRef(false)
  
  useThreeScene(canvasRef, (scene, camera, renderer) => {
    const isDark = theme === 'dark'
    const group = new THREE.Group()
    
    // Broadcast Tower (12 segments) — LARGER
    const towerGroup = new THREE.Group()
    const segmentCount = 12
    for (let i = 0; i < segmentCount; i++) {
      const radius = 3.2 * (1 - i / segmentCount)
      const height = 1.4
      const geo = new THREE.CylinderGeometry(radius * 0.85, radius, height, 4, 1, true)
      const mat = new THREE.MeshStandardMaterial({
        color: isDark ? 0xd4956a : 0xd4813a,
        wireframe: true,
        emissive: isDark ? 0xd4956a : 0xd4813a,
        emissiveIntensity: isDark ? 0.7 : 0.3
      })
      const segment = new THREE.Mesh(geo, mat)
      segment.position.y = i * 1.4 - 9
      segment.rotation.y = (i * Math.PI) / 4
      towerGroup.add(segment)
    }
    group.add(towerGroup)

    // Signal Waves (Rings) — WIDER
    const rings: THREE.Mesh[] = []
    const ringCount = 6
    for (let i = 0; i < ringCount; i++) {
      const geo = new THREE.TorusGeometry(1.2, 0.06, 16, 100)
      const mat = new THREE.MeshBasicMaterial({
        color: isDark ? 0xf0d080 : 0xe8a020,
        transparent: true,
        opacity: 0.6,
        blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending
      })
      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = Math.PI / 2
      ring.position.y = 10
      ring.scale.setScalar(0.1)
      ring.userData.offset = i / ringCount
      rings.push(ring)
      group.add(ring)
    }

    // Orbiting Data Cards — wider orbit
    const cards: THREE.Mesh[] = []
    const cardCount = 6
    const cardGeo = new THREE.PlaneGeometry(2, 2.6)
    for (let i = 0; i < cardCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: isDark ? 0xe8c080 : 0x5a8a6e,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        emissive: isDark ? 0xe8c080 : 0x5a8a6e,
        emissiveIntensity: isDark ? 0.3 : 0.15
      })
      const card = new THREE.Mesh(cardGeo, mat)
      card.userData.angle = (i / cardCount) * Math.PI * 2
      card.userData.radius = 6
      card.userData.speed = 0.008 + Math.random() * 0.008
      cards.push(card)
      group.add(card)
    }

    group.position.x = 0
    group.scale.setScalar(0.85)
    scene.add(group)
    
    const light = new THREE.PointLight(isDark ? 0xd4956a : 0xffffff, isDark ? 3 : 1.5, 80)
    light.position.set(0, 15, 8)
    scene.add(light)
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.15 : 0.5))

    let composer: EffectComposer | null = null
    let glitchPass: GlitchPass | null = null

    if (window.innerWidth >= 768 && isDark) {
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.85)
      composer.addPass(bloom)
      glitchPass = new GlitchPass()
      glitchPass.enabled = false
      composer.addPass(glitchPass)
    }

    camera.position.set(0, 3, 18)
    camera.lookAt(0, 0, 0)

    return { group, towerGroup, rings, cards, composer, glitchPass }
  }, (state, clock, mousePos, scene, camera, renderer) => {
    const { group, towerGroup, rings, cards, composer, glitchPass } = state
    const t = clock.getElapsedTime()

    // Rotate tower
    towerGroup.children.forEach((seg: any, i: number) => {
      seg.rotation.y = t * 0.5 + (i * Math.PI) / 8
    })

    // Pulse rings — WIDER expansion
    rings.forEach((ring: THREE.Mesh) => {
      const progress = (t * 0.5 + ring.userData.offset) % 1
      ring.scale.setScalar(progress * 10)
      const mat = ring.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - progress) * 0.9
    })

    // Orbit cards
    cards.forEach((card: THREE.Mesh) => {
      card.userData.angle += card.userData.speed
      const x = Math.cos(card.userData.angle) * card.userData.radius
      const z = Math.sin(card.userData.angle) * card.userData.radius
      const y = Math.sin(t + card.userData.angle) * 2
      card.position.set(x, y, z)
      card.lookAt(0, 0, 0)
    })

    // Parallax
    group.rotation.x = mousePos.y * 0.1
    group.rotation.y = mousePos.x * 0.2

    if (glitchPass) {
      glitchPass.enabled = isAnalyzing.current
      glitchPass.goWild = isAnalyzing.current
    }

    if (composer) composer.render()
    else renderer.render(scene, camera)
  })

  useEffect(() => {
    isAnalyzing.current = loading
  }, [loading])

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t) && tags.length < 20) {
      setTags(prev => [...prev, t])
      setTagInput('')
    }
  }

  const handleFetchFromUrl = async () => {
    if (!videoUrl.trim()) return
    setIsFetching(true)
    setError(null)
    try {
      // Use Gemini to extract YouTube metadata from the URL
      const data = await apiFetch<{ title: string; description: string; tags: string[] }>(
        '/api/v1/youtube/extract',
        {
          method: 'POST',
          body: JSON.stringify({ url: videoUrl }),
        }
      )
      setTitle(data.title || '')
      setDescription(data.description || '')
      setTags(data.tags || [])
    } catch {
      // Fallback: parse video ID from URL and set a helpful placeholder
      const videoId = videoUrl.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
      if (videoId) {
        setTitle(`YouTube Video: ${videoId}`)
        setDescription('Paste your video description here for more accurate analysis.')
        setTags([])
      } else {
        setError('Could not parse YouTube URL. Please enter the title manually.')
      }
    } finally {
      setIsFetching(false)
    }
  }

  const handlePredict = async () => {
    if (!title.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const data = await apiFetch<YouTubePrediction>('/api/v1/youtube/predict', {
        method: 'POST',
        body: JSON.stringify({ title, description, tags }),
      })
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Prediction failed. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }
  const verdictColor = result
    ? result.seoScore > 0.75 ? 'var(--aurora)' : result.seoScore > 0.55 ? 'var(--solar)' : 'var(--coral)'
    : 'var(--text-muted)'

  return (
    <div className="min-h-screen pt-8 pb-20 px-4 relative">
      <canvas ref={canvasRef} className="fixed top-0 right-0 w-full md:w-1/2 h-full pointer-events-none z-0 opacity-40" />

      <div 
        className="max-w-6xl mx-auto space-y-6 relative z-10"
        style={{ transform: `translate(${mouse.current.x * -10}px, ${mouse.current.y * -10}px)` }}
      >
        <div className="mb-10 reveal">
          <div className="flex items-center gap-3 mb-2">
            <Video className="w-8 h-8 text-[var(--plasma)]" />
            <h1 className="page-title gradient-text">Signal Extractor</h1>
          </div>
          <p className="text-[var(--text-secondary)] text-base max-w-xl">
            Paste your YouTube title, description, and tags — or fetch directly from a URL. Qontint predicts rank, virality, and estimated views using semantic and entity analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 reveal">
          {/* Input column */}
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <div className="p-4 bg-[var(--bg-void)] border border-[var(--aurora)]/30 rounded-lg mb-4">
                <label className="font-mono text-xs text-[var(--aurora)] uppercase tracking-wider mb-2 block">
                  Analyze via Video URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 text-sm bg-black/20 border-none focus:ring-1 focus:ring-[var(--aurora)]"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                  />
                  <button 
                    className="btn-secondary px-6 py-2 text-xs" 
                    onClick={handleFetchFromUrl}
                    disabled={isFetching || !videoUrl}
                  >
                    {isFetching ? 'Extracting...' : 'Fetch'}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                  Video Title *
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 text-sm font-medium"
                  placeholder="e.g. How to automate AP with AI in 2024"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={100}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs font-mono ${title.length > 70 ? 'text-[var(--coral)]' : 'text-[var(--text-muted)]'}`}>
                    {title.length}/100
                  </span>
                </div>
              </div>

              <div>
                <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                  Description
                </label>
                <textarea
                  className="w-full px-4 py-3 text-sm resize-none h-32"
                  placeholder="Video description, links, and chapters..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                  Tags ({tags.length}/20)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 text-sm"
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                  />
                  <button className="btn-secondary px-4 text-xs" onClick={addTag}>Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  <AnimatePresence>
                    {tags.map(t => (
                      <motion.span
                        key={t}
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        className="tag text-xs py-0.5 cursor-pointer hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] hover:border-[var(--coral)] transition-colors"
                        onClick={() => setTags(tags.filter(tag => tag !== t))}
                        title="Click to remove"
                      >
                        {t} &times;
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <button
              className="btn-primary w-full py-4 text-sm flex justify-center items-center gap-2"
              onClick={handlePredict}
              disabled={loading || !title.trim()}
            >
              {loading ? 'Analyzing Signals...' : <><Zap className="w-4 h-4" /> Run Prediction Model</>}
            </button>
          </div>

          {/* Results column */}
          <div>
            {!result && !loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8 text-center text-[var(--text-muted)]">
                <div>
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-mono text-xs uppercase tracking-widest">Awaiting Analysis Data</p>
                </div>
              </motion.div>
            )}

            {loading && (
              <div className="h-full flex flex-col items-center justify-center p-8 space-y-4">
                <div className="w-12 h-12 rounded-full border-4 border-[var(--plasma)] border-t-transparent animate-spin" />
                <p className="font-mono text-sm text-[var(--plasma)] animate-pulse">Running Neural Dissection...</p>
              </div>
            )}

            {result && !loading && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                {/* Top metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="card p-4 text-center border-t-2" style={{ borderTopColor: verdictColor }}>
                    <p className="font-mono text-xs text-[var(--text-muted)] mb-1">Rank Est.</p>
                    <p className="text-3xl font-display font-bold text-[var(--text-primary)]">#{result.rankEstimate}</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="font-mono text-xs text-[var(--text-muted)] mb-1">24h Views</p>
                    <p className="text-2xl font-display font-bold text-[var(--aurora)]">{formatNum(result.views24h)}</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="font-mono text-xs text-[var(--text-muted)] mb-1">30d Views</p>
                    <p className="text-2xl font-display font-bold text-[var(--text-primary)]">{formatNum(result.views30d)}</p>
                  </div>
                </div>

                <div className="card p-5 flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <ScoreDial value={result.seoScore} color={verdictColor} label="SEO Score" size={100} />
                  </div>
                  <div className="flex-1">
                    <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Verdict</p>
                    <p className="text-lg font-bold" style={{ color: verdictColor }}>{result.verdict}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Based on keyword density, title length, and semantic matching with current SERP trends.
                    </p>
                  </div>
                </div>

                <div className="card p-5 space-y-4">
                  <h3 className="font-display font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-[var(--plasma)]" /> Performance Sub-scores
                  </h3>
                  <GaugeBar label="Virality Potential" value={result.viralityScore} color="var(--plasma)" />
                  <GaugeBar label="Engagement Predictor" value={result.engagementScore} color="var(--aurora)" />
                  <GaugeBar label="Thumbnail CTR Est." value={result.thumbnailScore} color="var(--solar)" />
                  <GaugeBar label="Topic Novelty" value={result.noveltyScore} color="var(--stellar)" />
                </div>

                {result.recs.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-display font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[var(--solar)]" /> Recommendations ({result.recs.length})
                    </h3>
                    <ul className="space-y-2">
                      {result.recs.map((r, i) => (
                        <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                          <span className="text-[var(--solar)] mt-0.5">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
