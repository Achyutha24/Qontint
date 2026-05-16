/**
 * AnimatedCounter — Counts up to a target number with spring animation.
 * Handles integers and floats. Respects reduced-motion (shows static value).
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function AnimatedCounter({
  value,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedCounterProps) {
  const prefersReduced = useReducedMotion()
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const startValRef = useRef<number>(0)

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value)
      return
    }
    cancelAnimationFrame(rafRef.current)
    startRef.current = 0
    startValRef.current = display

    const animate = (now: number) => {
      if (!startRef.current) startRef.current = now
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(startValRef.current + (value - startValRef.current) * eased)
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString()

  return (
    <span className={className}>
      {prefix}{formatted}{suffix}
    </span>
  )
}

/**
 * PulseIndicator — Small pulsing dot indicating live state.
 */
interface PulseIndicatorProps {
  color?: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export function PulseIndicator({ color = 'var(--aurora)', size = 'sm', label }: PulseIndicatorProps) {
  const sizeMap = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' }
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`${sizeMap[size]} rounded-full relative`}
        style={{ backgroundColor: color }}
      >
        <span
          className={`absolute inset-0 rounded-full animate-ping`}
          style={{ backgroundColor: color, opacity: 0.4 }}
        />
      </span>
      {label && <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>{label}</span>}
    </span>
  )
}

/**
 * MetricBadge — Displays a labelled metric with optional trend indicator.
 */
interface MetricBadgeProps {
  label: string
  value: string | number
  delta?: number
  mono?: boolean
  className?: string
}

export function MetricBadge({ label, value, delta, mono = true, className = '' }: MetricBadgeProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">{label}</span>
      <span className={`text-[var(--text-primary)] font-bold text-sm ${mono ? 'font-mono' : ''}`}>
        {value}
        {delta !== undefined && (
          <span className={`ml-1 text-xs ${delta >= 0 ? 'text-[var(--aurora)]' : 'text-[var(--coral)]'}`}>
            {delta >= 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  )
}
