/**
 * MagneticButton — Button with subtle magnetic hover feel.
 * The button slightly shifts toward the cursor on hover.
 * GPU-optimized using transform3d. Respects reduced-motion.
 */
import { useRef, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  className?: string
  strength?: number
  glowColor?: string
}

export default function MagneticButton({
  children,
  className = '',
  strength = 0.25,
  glowColor = 'var(--glow-aurora)',
  ...rest
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const prefersReduced = useReducedMotion()

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (prefersReduced || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) * strength
    const dy = (e.clientY - cy) * strength
    ref.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
  }, [prefersReduced, strength])

  const handleMouseLeave = useCallback(() => {
    if (!ref.current) return
    ref.current.style.transform = 'translate3d(0,0,0)'
    ref.current.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)'
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (!ref.current) return
    ref.current.style.transition = 'transform 0.15s ease-out'
  }, [])

  return (
    <motion.button
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      whileHover={prefersReduced ? {} : { scale: 1.02 }}
      whileTap={prefersReduced ? {} : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
      style={{ willChange: 'transform', touchAction: 'manipulation' }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
