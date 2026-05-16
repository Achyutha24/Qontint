/**
 * AmbientBackground — Cinematic layered ambient canvas.
 * Renders: slow gradient glows, faint neural grid, semantic flow particles.
 * GPU-optimized via RAF + transform3d. Opacity low for readability.
 * 
 * Respects prefers-reduced-motion (disables particles on low-motion preference).
 * Safe to render behind any page — pointer-events none, z-index 0.
 */
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

interface AmbientBackgroundProps {
  variant?: 'default' | 'scanner' | 'graph' | 'signal' | 'dashboard'
  opacity?: number
  particleCount?: number
}

const VARIANT_CONFIGS = {
  default:   { gridColor: 'rgba(212,149,106,0.025)', particleColor: '#d4956a', glowColor1: '#d4956a', glowColor2: '#f0d080' },
  scanner:   { gridColor: 'rgba(212,149,106,0.035)', particleColor: '#d06848', glowColor1: '#d06848', glowColor2: '#d4956a' },
  graph:     { gridColor: 'rgba(240,208,128,0.02)',  particleColor: '#f0d080', glowColor1: '#f0d080', glowColor2: '#d4956a' },
  signal:    { gridColor: 'rgba(208,104,72,0.025)',  particleColor: '#d06848', glowColor1: '#d06848', glowColor2: '#a0785a' },
  dashboard: { gridColor: 'rgba(160,120,90,0.025)',  particleColor: '#a0785a', glowColor1: '#a0785a', glowColor2: '#d4956a' },
}

export default function AmbientBackground({
  variant = 'default',
  opacity = 1,
  particleCount,
}: AmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const cfg = VARIANT_CONFIGS[variant]
    const isMobile = window.innerWidth < 768
    // Reduce particle count on mobile & reduced motion
    const count = particleCount ?? (prefersReduced ? 0 : (isMobile ? 25 : 55))

    let W = 0, H = 0
    const resize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    resize()

    // ── Grid lines ─────────────────────────────────────────────────────────────
    const CELL = 60
    function drawGrid(t: number) {
      ctx.clearRect(0, 0, W, H)
      ctx.strokeStyle = cfg.gridColor
      ctx.lineWidth = 0.5
      const offset = (t * 8) % CELL
      for (let x = -CELL; x < W + CELL; x += CELL) {
        ctx.beginPath()
        ctx.moveTo(x + offset * 0.15, 0)
        ctx.lineTo(x + offset * 0.15, H)
        ctx.stroke()
      }
      for (let y = -CELL; y < H + CELL; y += CELL) {
        ctx.beginPath()
        ctx.moveTo(0, y + offset * 0.1)
        ctx.lineTo(W, y + offset * 0.1)
        ctx.stroke()
      }
    }

    // ── Ambient glow orbs ──────────────────────────────────────────────────────
    const orbs = [
      { x: 0.25, y: 0.3, r: 0.35, phase: 0 },
      { x: 0.75, y: 0.65, r: 0.30, phase: Math.PI },
      { x: 0.5, y: 0.5, r: 0.20, phase: Math.PI / 2 },
    ]

    function drawOrbs(t: number) {
      orbs.forEach((orb, i) => {
        const x = orb.x * W + Math.sin(t * 0.2 + orb.phase) * W * 0.05
        const y = orb.y * H + Math.cos(t * 0.15 + orb.phase) * H * 0.04
        const r = (i === 0 ? 0.5 : 0.35) * Math.min(W, H)
        const pulse = 0.8 + 0.2 * Math.sin(t * 0.4 + orb.phase)
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * pulse)
        const col1 = i % 2 === 0 ? cfg.glowColor1 : cfg.glowColor2
        grad.addColorStop(0, hexToRgba(col1, 0.04))
        grad.addColorStop(0.5, hexToRgba(col1, 0.015))
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, r * pulse, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // ── Semantic particles ─────────────────────────────────────────────────────
    type Particle = { x: number; y: number; vx: number; vy: number; size: number; opacity: number; life: number; maxLife: number }
    
    const particles: Particle[] = Array.from({ length: count }, () => makeParticle(W, H))

    function makeParticle(w: number, h: number): Particle {
      const maxLife = 180 + Math.random() * 240
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.5 - 0.1,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        life: Math.random() * maxLife,
        maxLife,
      }
    }

    function drawParticles() {
      ctx.fillStyle = cfg.particleColor
      particles.forEach(p => {
        p.life++
        p.x += p.vx
        p.y += p.vy
        const lifeFrac = p.life / p.maxLife
        const fade = lifeFrac < 0.1 ? lifeFrac / 0.1 : lifeFrac > 0.8 ? 1 - (lifeFrac - 0.8) / 0.2 : 1
        ctx.globalAlpha = p.opacity * fade * 0.6
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        if (p.life >= p.maxLife) Object.assign(p, makeParticle(W, H))
      })
      ctx.globalAlpha = 1
    }

    // ── Flow lines ─────────────────────────────────────────────────────────────
    const flowLines = Array.from({ length: prefersReduced ? 0 : 6 }, (_, i) => ({
      progress: i / 6,
      y: (0.1 + i * 0.15) * 1,
      width: W * (0.3 + Math.random() * 0.4),
      startX: Math.random() * W * 0.3,
      speed: 0.0008 + Math.random() * 0.0006,
    }))

    function drawFlowLines(t: number) {
      flowLines.forEach(line => {
        line.progress = (line.progress + line.speed) % 1
        const yy = line.y * H + Math.sin(t * 0.3 + line.startX) * 30
        const x1 = line.startX
        const x2 = line.startX + line.width * line.progress
        const grad = ctx.createLinearGradient(x1, yy, x2, yy)
        grad.addColorStop(0, 'transparent')
        grad.addColorStop(0.7, hexToRgba(cfg.particleColor, 0.06))
        grad.addColorStop(1, hexToRgba(cfg.particleColor, 0.15))
        ctx.strokeStyle = grad
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(x1, yy)
        ctx.lineTo(x2, yy)
        ctx.stroke()
      })
    }

    let rafId = 0
    let startTime = performance.now()

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick)
      const t = (now - startTime) / 1000
      drawGrid(t)
      drawOrbs(t)
      if (!prefersReduced) {
        drawFlowLines(t)
        drawParticles()
      }
    }
    rafId = requestAnimationFrame(tick)

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [variant, particleCount, prefersReduced])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none select-none"
      style={{ zIndex: 0, opacity }}
      aria-hidden="true"
    />
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
