import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Network, Filter, Info, RotateCcw, X } from 'lucide-react'
import * as THREE from 'three'
import { useThreeScene } from '../hooks/useThreeScene'
import { useTheme } from '../hooks/useTheme'
import Graph3D, { type GraphNode, type GraphEdge } from '../components/Graph3D'
import { apiFetch } from '../api/apiClient'

// ── Decorative Background Component ──
function DecorativeGalaxy() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()
  
  useThreeScene(canvasRef, (scene, camera) => {
    const isDark = theme === 'dark'
    const numParticles = isDark ? 3000 : 2000
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(numParticles * 3)
    const col = new Float32Array(numParticles * 3)
    
    const darkAur = new THREE.Color('#d4956a')
    const darkPla = new THREE.Color('#a0785a')
    const lightAur = new THREE.Color('#d4813a')
    const lightSte = new THREE.Color('#5a8a6e')
    
    for (let i = 0; i < numParticles; i++) {
      const angle = i * 2.39996
      const radius = Math.sqrt(i / numParticles) * 8
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = (Math.random() - 0.5) * 0.6
      
      pos[i*3] = x
      pos[i*3+1] = y
      pos[i*3+2] = z
      
      const color = isDark 
        ? (radius < 3 ? darkAur : darkPla)
        : (radius < 3 ? lightAur : lightSte)
        
      col[i*3] = color.r
      col[i*3+1] = color.g
      col[i*3+2] = color.b
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    
    const mat = new THREE.PointsMaterial({
      size: isDark ? 0.05 : 0.04,
      vertexColors: true,
      transparent: true,
      opacity: isDark ? 0.35 : 0.25,
      blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    })
    
    const points = new THREE.Points(geo, mat)
    scene.add(points)
    
    // Nebula sprites
    for (let i = 0; i < (isDark ? 5 : 3); i++) {
      const spriteGeo = new THREE.PlaneGeometry(10, 10)
      const spriteMat = new THREE.MeshBasicMaterial({
        color: isDark 
          ? (i % 2 === 0 ? 0xd4956a : 0xa0785a)
          : (i % 2 === 0 ? 0xd4813a : 0xede8dc),
        transparent: true,
        opacity: isDark ? 0.05 : 0.03,
        blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
      const sprite = new THREE.Mesh(spriteGeo, spriteMat)
      sprite.position.set((Math.random()-0.5)*20, (Math.random()-0.5)*5, (Math.random()-0.5)*20)
      sprite.rotation.x = Math.random() * Math.PI
      scene.add(sprite)
    }
    
    camera.position.set(0, 5, 15)
    camera.lookAt(0, 0, 0)
    
    return { points }
  }, (state, clock, _mousePos, _scene, camera) => {
    const { points } = state
    const t = clock.getElapsedTime()
    
    // Orbit camera
    const angle = t * 0.0004
    camera.position.x = Math.sin(angle) * 15
    camera.position.z = Math.cos(angle) * 15
    camera.lookAt(0, 0, 0)
    
    points.rotation.y = t * 0.05
  })
  
  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none opacity-40" 
      style={{ width: '100%', height: '100%' }}
    />
  )
}

// (Mock data removed, replaced by backend calls)

const VERTICAL_LABELS: Record<string, string> = {
  accounting_finance: 'Accounting & Finance',
  banking_lending:    'Banking & Lending',
  investment_wealth:  'Investment & Wealth',
  sap_supply_chain:   'SAP & Supply Chain',
}

const TYPE_COLORS: Record<string, string> = {
  PRODUCT:    'var(--aurora)',
  TECHNOLOGY: 'var(--aurora)',
  ORG:        'var(--solar)',
  PERSON:     'var(--plasma)',
  CONCEPT:    'var(--aurora)',
  PROCESS:    'var(--solar)',
  STANDARD:   'var(--plasma)',
  DEFAULT:    'var(--aurora)',
}

export default function GraphPage() {
  const [verticalFilter, setVerticalFilter] = useState<string>('accounting_finance')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [showLegend, setShowLegend] = useState(true)

  const fetchGraphData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{nodes: GraphNode[], edges: GraphEdge[]}>(`/api/v1/graph/snapshot/${verticalFilter}`)
      setNodes(data.nodes)
      setEdges(data.edges)
    } catch (err) {
      console.error('Failed to fetch graph data:', err)
    } finally {
      setLoading(false)
    }
  }, [verticalFilter])

  useEffect(() => {
    fetchGraphData()
  }, [fetchGraphData])

  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      const tOk = typeFilter === 'all' || n.type === typeFilter
      return tOk
    })
  }, [nodes, typeFilter])

  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map(n => n.id))
    return edges.filter(e => ids.has(e.source) && ids.has(e.target))
  }, [filteredNodes, edges])

  const handleHover = useCallback((node: GraphNode | null, x: number, y: number) => {
    setHoveredNode(node)
    if (node) setHoverPos({ x, y })
  }, [])

  const handleClick = useCallback((node: GraphNode | null) => {
    setSelectedNode(node)
  }, [])

  const uniqueTypes = useMemo(() => [...new Set(nodes.map(n => n.type))].sort(), [nodes])

  return (
    <div className="h-screen flex flex-col pt-14 overflow-hidden relative">
      <DecorativeGalaxy />

      {/* ── Header strip ── */}
      <div className="glass px-5 py-3 flex flex-wrap items-center gap-3 z-20 flex-shrink-0 border-b border-[var(--border-subtle)] relative">
        <div className="flex items-center gap-2 mr-auto">
          <Network className="w-5 h-5 text-[var(--aurora)]" />
          <h1 className="font-display font-bold text-[var(--text-primary)] text-lg">Entity Authority Graph</h1>
          <span className="tag ml-2 text-[var(--aurora)] border-[var(--aurora)]">{filteredNodes.length} nodes</span>
          <span className="tag text-[var(--stellar)] border-[var(--stellar)]">{filteredEdges.length} edges</span>
        </div>

        {/* Vertical filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <select
            className="w-auto px-3 py-1.5 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)]"
            value={verticalFilter}
            onChange={e => setVerticalFilter(e.target.value)}
          >
            <option value="accounting_finance">Accounting & Finance</option>
            {Object.entries(VERTICAL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Type filter */}
        <select
          className="w-auto px-3 py-1.5 text-xs bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)]"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <button
          className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
          onClick={() => { setVerticalFilter('accounting_finance'); setTypeFilter('all'); setSelectedNode(null) }}
          title="Reset filters"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>

        <button
          className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
          onClick={() => setShowLegend(l => !l)}
        >
          <Info className="w-3.5 h-3.5" /> Legend
        </button>
      </div>

      {/* ── Main canvas area ── */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* 3D Graph */}
        <div className="flex-1 relative">
          <Graph3D
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodeHover={handleHover}
            onNodeClick={handleClick}
            selectedId={selectedNode?.id ?? null}
          />

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-void)]/60 backdrop-blur-sm z-30 rounded-xl">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-[var(--aurora)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-[var(--text-muted)] font-mono">Loading graph…</p>
              </div>
            </div>
          )}

          {/* Empty state — shown when load is done but no nodes */}
          {!loading && filteredNodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="card p-8 text-center max-w-sm pointer-events-auto">
                <Network className="w-10 h-10 text-[var(--aurora)] mx-auto mb-3 opacity-60" />
                <h3 className="font-display font-bold text-[var(--text-primary)] mb-2">No graph data yet</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Run the <span className="text-[var(--aurora)]">Analyze</span> or{' '}
                  <span className="text-[var(--aurora)]">Keywords</span> pipeline first to collect SERP data —
                  entities will appear here automatically.
                </p>
              </div>
            </div>
          )}

          {/* Controls hint */}
          <div className="absolute bottom-4 left-4 pointer-events-none">
            <div className="card px-4 py-2 text-xs font-mono text-[var(--text-muted)] flex gap-4">
              <span>🖱️ Drag to rotate</span>
              <span>⚙️ Scroll to zoom</span>
              <span>🖱️ Click node for details</span>
            </div>
          </div>

          {/* Node count badge */}
          <div className="absolute top-4 left-4 pointer-events-none">
            <div className="font-mono text-xs text-[var(--text-muted)]">
              <span className="text-[var(--aurora)] font-bold">{filteredNodes.length}</span> entities ·{' '}
              <span className="text-[var(--text-primary)] font-bold">{filteredEdges.length}</span> relationships
            </div>
          </div>
        </div>

        {/* ── Right panel: selected node detail ── */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ x: 360, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }} transition={{ type: 'spring', damping: 24, stiffness: 200 }}
              className="w-80 flex-shrink-0 bg-[var(--surface-raised)] border-l border-[var(--border-subtle)] m-3 p-5 overflow-y-auto rounded-xl shadow-lg relative z-20"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-display font-bold text-[var(--text-primary)] text-lg leading-tight pr-2">
                  {selectedNode.label}
                </h3>
                <button onClick={() => setSelectedNode(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Authority gauge */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-mono text-xs text-[var(--text-muted)] uppercase">Authority Score</p>
                  <p className="font-mono text-sm font-bold" style={{ color: TYPE_COLORS[selectedNode.type] ?? '#9BADC8' }}>
                    {(selectedNode.authority * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-base)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedNode.authority * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${TYPE_COLORS[selectedNode.type] ?? '#9BADC8'}80, ${TYPE_COLORS[selectedNode.type] ?? '#9BADC8'})` }}
                  />
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs text-[var(--text-muted)] w-20 flex-shrink-0">Entity Type</p>
                  <span className="tag" style={{
                    background: (TYPE_COLORS[selectedNode.type] ?? '#9BADC8') + '18',
                    color: TYPE_COLORS[selectedNode.type] ?? '#9BADC8',
                    border: `1px solid ${TYPE_COLORS[selectedNode.type] ?? '#9BADC8'}30`,
                  }}>
                    {selectedNode.type}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs text-[var(--text-muted)] w-20 flex-shrink-0">Vertical</p>
                  <span className="tag">{VERTICAL_LABELS[selectedNode.vertical] ?? selectedNode.vertical}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs text-[var(--text-muted)] w-20 flex-shrink-0">Node ID</p>
                  <span className="font-mono text-xs text-[var(--text-muted)]">{selectedNode.id}</span>
                </div>
              </div>

              {/* Connected edges */}
              <div>
                <p className="font-mono text-xs text-[var(--text-muted)] uppercase mb-2">Relationships</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {filteredEdges
                    .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((e, i) => {
                      const otherId = e.source === selectedNode.id ? e.target : e.source
                      const other = nodes.find(n => n.id === otherId)
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                          style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)' }}
                          onClick={() => other && setSelectedNode(other)}
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[other?.type ?? 'DEFAULT'] }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[var(--text-primary)] truncate">{other?.label ?? otherId}</p>
                            <p className="text-xs text-[var(--text-muted)]">{e.relation}</p>
                          </div>
                          <span className="font-mono text-xs text-[var(--text-muted)] flex-shrink-0">{(e.weight * 100).toFixed(0)}%</span>
                        </div>
                      )
                    })}
                  {filteredEdges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length === 0 && (
                    <p className="text-xs text-[var(--text-muted)]">No visible relationships (try removing filters)</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Hover tooltip ── */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.1 }}
            className="absolute bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-3 rounded-lg shadow-xl z-50 pointer-events-none"
            style={{ left: hoverPos.x + 14, top: hoverPos.y - 10 }}
          >
            <p className="font-display font-bold text-[var(--text-primary)] text-sm mb-1">{hoveredNode.label}</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="tag" style={{
                background: (TYPE_COLORS[hoveredNode.type] ?? '#9BADC8') + '18',
                color: TYPE_COLORS[hoveredNode.type] ?? '#9BADC8',
                border: `1px solid ${TYPE_COLORS[hoveredNode.type] ?? '#9BADC8'}30`,
                fontSize: '0.6rem',
              }}>
                {hoveredNode.type}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)] font-mono">authority</span>
              <span className="font-mono font-bold" style={{ color: TYPE_COLORS[hoveredNode.type] ?? '#9BADC8' }}>
                {(hoveredNode.authority * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">Click for details</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Legend ── */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-14 right-4 z-20"
          >
            <div className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-5 rounded-xl shadow-lg" style={{ minWidth: 170 }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Node Types</p>
                <button onClick={() => setShowLegend(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1.5">
                {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'DEFAULT').map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span className="font-mono text-xs text-[var(--text-secondary)]">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
