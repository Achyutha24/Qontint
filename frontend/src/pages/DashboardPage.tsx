import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Activity, Database, Layers, Cpu, TrendingUp, AlertTriangle, CheckCircle, Terminal } from 'lucide-react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import * as THREE from 'three'
import { useThreeScene } from '../hooks/useThreeScene'
import { useTheme } from '../hooks/useTheme'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { useMouseParallax } from '../hooks/useMouseParallax'
import { AnimatedCounter, PulseIndicator } from '../components/ui/AnimatedMetrics'

import { API_BASE, apiFetch } from '../api/apiClient'

interface DashboardStats {
  noveltyHistory: { time: string; score: number }[];
  radarData: { metric: string; value: number }[];
  verticalInfo: { key: string; label: string; kw: number }[];
}

interface ServiceHealth { name: string; status: string; latency_ms: number | null; details: string | null }
interface HealthData {
  status: string; version: string; environment: string;
  services: ServiceHealth[]; uptime_seconds: number
}

function statusColor(s: string) {
  if (s === 'healthy') return 'text-[var(--aurora)]'
  if (s === 'degraded') return 'text-[var(--solar)]'
  return 'text-[var(--coral)]'
}
function statusIcon(s: string) {
  if (s === 'healthy') return <CheckCircle className="w-4 h-4 text-[var(--aurora)]" />
  if (s === 'degraded') return <AlertTriangle className="w-4 h-4 text-[var(--solar)]" />
  return <AlertTriangle className="w-4 h-4 text-[var(--coral)]" />
}

function formatUptime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m`
}

const verticalInfo = [
  { key: 'accounting_finance', label: 'Accounting & Finance', kw: 30 },
  { key: 'banking_lending', label: 'Banking & Lending', kw: 27 },
  { key: 'investment_wealth', label: 'Investment & Wealth', kw: 28 },
  { key: 'sap_supply_chain', label: 'SAP & Supply Chain', kw: 31 },
]

export default function DashboardPage() {
  useScrollReveal()
  const mouse = useMouseParallax()
  const { theme } = useTheme()

  const [health, setHealth] = useState<HealthData | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useThreeScene(canvasRef, (scene, camera) => {
    const isDark = theme === 'dark'
    const group = new THREE.Group()

    // Grid Floor
    const grid = new THREE.GridHelper(20, 20, isDark ? 0xd4956a : 0xd4813a, isDark ? 0x1a1410 : 0xede8dc)
    grid.position.y = -5
    const gridMat = grid.material as THREE.Material
    gridMat.transparent = true
    gridMat.opacity = isDark ? 0.2 : 0.4
    group.add(grid)

    // Hologram Rings
    const rings: THREE.Mesh[] = []
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.TorusGeometry(3 + i * 2, 0.02, 16, 100)
      const mat = new THREE.MeshBasicMaterial({ 
        color: isDark ? 0xf0d080 : 0xe8a020, 
        transparent: true, 
        opacity: isDark ? 0.3 : 0.4 
      })
      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = Math.PI / 2
      ring.position.y = -4.9
      group.add(ring)
      rings.push(ring)
    }

    // 3D Bar Chart (Floating Cylinders)
    const bars: THREE.Mesh[] = []
    const barCount = 8
    for (let i = 0; i < barCount; i++) {
      const geo = new THREE.CylinderGeometry(0.3, 0.3, 1, 32)
      const mat = new THREE.MeshStandardMaterial({
        color: isDark ? 0xd4956a : 0xd4813a,
        emissive: isDark ? 0xd4956a : 0xd4813a,
        emissiveIntensity: isDark ? 0.5 : 0.1,
        transparent: true,
        opacity: isDark ? 0.8 : 0.6
      })
      const bar = new THREE.Mesh(geo, mat)
      const angle = (i / barCount) * Math.PI * 2
      bar.position.set(Math.cos(angle) * 5, -4.5, Math.sin(angle) * 5)
      bar.userData.targetHeight = 2 + Math.random() * 4
      bar.userData.phase = Math.random() * Math.PI * 2
      group.add(bar)
      bars.push(bar)
    }

    // Particle Streams
    const partCount = isDark ? 200 : 120
    const partGeo = new THREE.BufferGeometry()
    const partPos = new Float32Array(partCount * 3)
    for (let i = 0; i < partCount; i++) {
      partPos[i*3] = (Math.random()-0.5) * 20
      partPos[i*3+1] = (Math.random()-0.5) * 10
      partPos[i*3+2] = (Math.random()-0.5) * 20
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3))
    const partMat = new THREE.PointsMaterial({ 
      color: isDark ? 0xf0d080 : 0xd4813a, 
      size: 0.05, 
      transparent: true, 
      opacity: isDark ? 0.4 : 0.3 
    })
    const particles = new THREE.Points(partGeo, partMat)
    group.add(particles)

    scene.add(group)
    camera.position.set(0, 5, 15)
    camera.lookAt(0, 0, 0)

    const light = new THREE.PointLight(isDark ? 0xd4956a : 0xffffff, isDark ? 2 : 1)
    light.position.set(10, 20, 10)
    scene.add(light)
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.1 : 0.6))

    return { group, rings, bars, particles }
  }, (state, clock, mousePos) => {
    const { group, rings, bars, particles } = state
    const t = clock.getElapsedTime()

    // Rotate rings
    rings.forEach((ring: THREE.Mesh, i: number) => {
      ring.rotation.z = t * 0.2 * (i % 2 === 0 ? 1 : -1)
    })

    // Animate bars
    bars.forEach((bar: THREE.Mesh) => {
      const h = bar.userData.targetHeight * (0.8 + Math.sin(t * 2 + bar.userData.phase) * 0.2)
      bar.scale.y = h
      bar.position.y = -5 + h / 2
    })

    // Float particles
    const pos = particles.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length; i += 3) {
      pos[i+1] += 0.01
      if (pos[i+1] > 5) pos[i+1] = -5
    }
    particles.geometry.attributes.position.needsUpdate = true

    // Parallax
    group.rotation.y = mousePos.x * 0.2
    group.rotation.x = mousePos.y * 0.1
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [healthData, statsData] = await Promise.all([
          apiFetch<HealthData>('/health'),
          apiFetch<DashboardStats>('/api/v1/dashboard/stats')
        ])
        setHealth(healthData)
        setStats(statsData)
        setError(false)
      } catch (err) {
        console.error('Data fetch failed:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen pt-8 pb-20 px-4 relative">
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-40" />

      <div 
        className="max-w-7xl mx-auto space-y-6 relative z-10"
        style={{ transform: `translate(${mouse.current.x * -5}px, ${mouse.current.y * -5}px)` }}
      >
        {/* Header */}
        <div className="mb-10 reveal">
          <div className="flex items-center gap-3 mb-2">
            <Terminal className="w-8 h-8 text-[var(--aurora)]" />
            <h1 className="page-title gradient-text">Command Center</h1>
          </div>
          <p className="text-[var(--text-secondary)] text-base max-w-xl">
            Real-time health, entity authority metrics, and novelty score monitoring across all verticals.
          </p>
        </div>

        {/* System Health Strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="card p-5 mb-6 flex flex-wrap gap-4 items-center justify-between reveal"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[var(--aurora)]" />
            <span className="font-display font-semibold text-[var(--text-primary)]">System Health</span>
            {loading ? (
              <span className="text-[var(--text-muted)] animate-pulse text-sm font-mono">Checking…</span>
            ) : error ? (
              <span className="tag text-[var(--coral)] border-[var(--coral)]">Offline</span>
            ) : (
              <>
                <span className={`tag ${health?.status === 'healthy' ? 'text-[var(--aurora)] border-[var(--aurora)]' : 'text-[var(--solar)] border-[var(--solar)]'}`}>
                  {health?.status?.toUpperCase()}
                </span>
                {health?.status === 'healthy' && <PulseIndicator label="LIVE" />}
              </>
            )}
          </div>
          {health && (
            <div className="flex flex-wrap gap-6 text-sm text-[var(--text-muted)] font-mono">
              <span>v{health.version}</span>
              <span>env: {health.environment}</span>
              <span>uptime: {formatUptime(health.uptime_seconds)}</span>
            </div>
          )}
          {error && (
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Backend offline — run <code className="text-[var(--aurora)]">docker compose up -d</code>
            </p>
          )}
        </motion.div>

        {/* Service Cards */}
        {health?.services && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 reveal">
            {health.services.map((svc, i) => (
              <motion.div
                key={svc.name}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="card p-4 hover:border-[var(--aurora)] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">{svc.name}</span>
                  {statusIcon(svc.status)}
                </div>
                <p className={`font-display font-semibold capitalize ${statusColor(svc.status)}`}>{svc.status}</p>
                {svc.latency_ms !== null && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">{svc.latency_ms.toFixed(1)}ms</p>
                )}
                {svc.details && <p className="text-xs text-[var(--text-muted)] mt-1 truncate">{svc.details}</p>}
              </motion.div>
            ))}
          </div>
        )}

        {/* Placeholder cards if API offline */}
        {(error || loading) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 reveal">
            {['PostgreSQL', 'Neo4j', 'Redis', 'Ollama'].map((name, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12 + i * 0.04 }}
                className="card p-4"
              >
                <p className="font-mono text-xs text-[var(--text-muted)] uppercase mb-2">{name}</p>
                <div 
                  className="h-2 w-16 rounded animate-pulse" 
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 reveal">
          {/* Novelty Score History */}
          <motion.div
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[var(--aurora)]" />
              <h2 className="font-display font-semibold text-[var(--text-primary)]">Novelty Score History</h2>
              <span className="tag text-[var(--aurora)] border-[var(--aurora)] ml-auto">Today</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats?.noveltyHistory || []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="noveltyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--aurora)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--aurora)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 1]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(1)} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--text-muted)', fontSize: 11 }}
                  itemStyle={{ color: 'var(--aurora)', fontSize: 12 }}
                  formatter={(v: any) => [Number(v).toFixed(2), 'Novelty']}
                />
                <Area type="monotone" dataKey="score" stroke="var(--aurora)" strokeWidth={2} fill="url(#noveltyGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-[var(--text-muted)] mt-2 font-mono text-center">* Live novelty score timeline</p>
          </motion.div>

          {/* Radar Chart */}
          <motion.div
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
            className="card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-[var(--solar)]" />
              <h2 className="font-display font-semibold text-[var(--text-primary)]">Authority Radar</h2>
              <span className="tag text-[var(--solar)] border-[var(--solar)] ml-auto">All Verticals</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={stats?.radarData || []}>
                <PolarGrid stroke="var(--border-subtle)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Radar name="Score" dataKey="value" stroke="var(--solar)" fill="var(--solar)" fillOpacity={0.15} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-xs text-[var(--text-muted)] mt-2 font-mono text-center">* Live authority radar</p>
          </motion.div>
        </div>

        {/* Verticals Grid */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="reveal">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-[var(--plasma)]" />
            <h2 className="font-display font-semibold text-[var(--text-primary)]">Verticals</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(stats?.verticalInfo || []).map((v, i) => (
              <motion.div
                key={v.key}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.32 + i * 0.05 }}
                className="card p-5"
              >
                <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">{v.key}</p>
                <p className="font-display font-bold text-[var(--text-primary)] text-sm leading-snug mb-3">{v.label}</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-mono text-2xl font-bold text-[var(--plasma)]">
                      <AnimatedCounter value={v.kw} suffix="" />
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">keywords</p>
                  </div>
                  <Cpu className="w-8 h-8 text-[var(--border-subtle)]" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick start hint */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="mt-8 card p-6 border-l-4 border-[var(--solar)] reveal"
          >
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--solar)] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-semibold text-[var(--text-primary)] mb-1">Backend not running</h3>
                <p className="text-sm text-[var(--text-muted)] mb-3">Start all services with Docker:</p>
                <code className="block text-xs font-mono text-[var(--aurora)] bg-black/30 rounded px-4 py-2">
                  docker compose up -d
                </code>
                <p className="text-xs text-[var(--text-muted)] mt-2">Then visit <span className="text-[var(--aurora)]">http://localhost:8000/docs</span></p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
