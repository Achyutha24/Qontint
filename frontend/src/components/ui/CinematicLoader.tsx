/**
 * CinematicLoader — Premium AI processing feedback overlay.
 * Shows animated rings, semantic log streaming, and neural pulse.
 * Completely isolated from business logic — reads only `isLoading` and `logs` props.
 */
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface CinematicLoaderProps {
  isLoading: boolean
  logs?: string[]
  label?: string
  subLabel?: string
}

const AI_LOGS = [
  '→ Extracting semantic entities',
  '→ Building relationship graph',
  '→ Comparing SERP embeddings',
  '→ Evaluating topical authority',
  '→ Generating optimization vectors',
  '→ Calibrating ranking predictor',
  '→ Synthesizing intelligence report',
]

export default function CinematicLoader({
  isLoading,
  logs = [],
  label = 'Processing',
  subLabel = 'AI Intelligence Pipeline',
}: CinematicLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prefersReduced = useReducedMotion()
  const [displayLogs, setDisplayLogs] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  // Merge incoming logs with internal AI log stream
  useEffect(() => {
    if (!isLoading) { setDisplayLogs([]); return }
    // Start with external logs, then stream AI logs
    const merged = [...logs]
    setDisplayLogs(merged.length ? merged : [AI_LOGS[0]])

    let idx = 1
    const interval = setInterval(() => {
      if (idx < AI_LOGS.length) {
        setDisplayLogs(prev => {
          const next = [...prev]
          if (!next.includes(AI_LOGS[idx])) next.push(AI_LOGS[idx])
          return next
        })
        idx++
      }
    }, 1400)
    return () => clearInterval(interval)
  }, [isLoading])

  // Sync external logs
  useEffect(() => {
    if (logs.length) {
      setDisplayLogs(prev => {
        const next = [...new Set([...prev, ...logs])]
        return next
      })
    }
  }, [logs])

  // Auto-scroll log container
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [displayLogs])

  // Neural ring canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isLoading || prefersReduced) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 200; canvas.height = 200
    let raf = 0
    const start = performance.now()

    const rings = [
      { r: 70, speed: 0.8, width: 1.5, dashLen: 30, color: 'rgba(212,149,106,' },
      { r: 55, speed: -1.2, width: 1, dashLen: 20, color: 'rgba(240,208,128,' },
      { r: 40, speed: 1.8, width: 0.8, dashLen: 15, color: 'rgba(208,104,72,' },
    ]

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, 200, 200)

      rings.forEach(ring => {
        const angle = t * ring.speed
        ctx.save()
        ctx.translate(100, 100)
        ctx.rotate(angle)
        ctx.setLineDash([ring.dashLen, 200 - ring.dashLen])
        ctx.strokeStyle = ring.color + '0.7)'
        ctx.lineWidth = ring.width
        ctx.shadowBlur = 8
        ctx.shadowColor = ring.color + '0.4)'
        ctx.beginPath()
        ctx.arc(0, 0, ring.r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      })

      // Core pulse
      const pulse = 0.5 + 0.5 * Math.sin(t * 3)
      const grad = ctx.createRadialGradient(100, 100, 0, 100, 100, 25)
      grad.addColorStop(0, `rgba(212,149,106,${0.6 * pulse})`)
      grad.addColorStop(0.6, `rgba(212,149,106,${0.2 * pulse})`)
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(100, 100, 25, 0, Math.PI * 2)
      ctx.fill()

      // Scanning line
      ctx.save()
      ctx.translate(100, 100)
      ctx.rotate(t * 1.5)
      const scanGrad = ctx.createLinearGradient(0, 0, 70, 0)
      scanGrad.addColorStop(0, 'rgba(212,149,106,0.8)')
      scanGrad.addColorStop(1, 'transparent')
      ctx.strokeStyle = scanGrad
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(70, 0)
      ctx.stroke()
      ctx.restore()
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isLoading, prefersReduced])

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <div className="card p-6 space-y-5 border border-[var(--border-subtle)]"
            style={{ background: 'linear-gradient(135deg, rgba(18,14,10,0.95), rgba(26,20,15,0.95))' }}>
            
            <div className="flex items-center gap-6">
              {/* Animated rings canvas */}
              <div className="flex-shrink-0 relative">
                {prefersReduced ? (
                  <div className="w-12 h-12 rounded-full border-2 border-[var(--aurora)] border-t-transparent animate-spin" />
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="w-[80px] h-[80px]"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <motion.span
                    className="w-2 h-2 rounded-full bg-[var(--aurora)]"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <span className="font-mono text-xs text-[var(--aurora)] uppercase tracking-widest">{subLabel}</span>
                </div>
                <h3 className="text-[var(--text-primary)] font-bold text-lg">{label}</h3>
                <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                  Running semantic intelligence pipeline…
                </p>
              </div>
            </div>

            {/* Log stream */}
            <div
              ref={logRef}
              className="bg-[var(--bg-void)] rounded-xl border border-[var(--border-subtle)] p-4 max-h-40 overflow-y-auto space-y-1.5"
            >
              <AnimatePresence initial={false}>
                {displayLogs.map((log, i) => (
                  <motion.div
                    key={log}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i === displayLogs.length - 1 ? 0 : 0 }}
                    className="flex items-start gap-2"
                  >
                    <span className={`font-mono text-xs flex-shrink-0 ${i === displayLogs.length - 1 ? 'text-[var(--aurora)]' : 'text-[var(--text-muted)]'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`font-mono text-xs leading-relaxed ${i === displayLogs.length - 1 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                      {log}
                    </span>
                    {i === displayLogs.length - 1 && (
                      <motion.span
                        className="font-mono text-xs text-[var(--aurora)] ml-1"
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.7, repeat: Infinity }}
                      >
                        _
                      </motion.span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Progress bar */}
            <div className="h-px bg-[var(--border-subtle)] overflow-hidden rounded-full">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, var(--aurora), var(--stellar))' }}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
