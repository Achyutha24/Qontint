/**
 * MotionWrapper — Wraps children with GPU-optimized reveal animations.
 * Respects prefers-reduced-motion. Isolated from page logic.
 * Variants are inlined to avoid import resolution issues.
 */
import { useRef, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { Variants } from 'framer-motion'

// Inlined to avoid cross-directory import issues
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
}

interface MotionWrapperProps {
  children: ReactNode
  variants?: Variants
  delay?: number
  className?: string
  once?: boolean
  threshold?: number
}

export function MotionWrapper({
  children,
  variants = fadeUp,
  delay = 0,
  className = '',
  once = true,
  threshold = 0.15,
}: MotionWrapperProps) {
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [once, threshold])

  if (prefersReduced) {
    return <div ref={ref} className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

/** Staggered grid of MotionWrapper children */
interface StaggerGridProps {
  children: ReactNode[]
  className?: string
  itemClassName?: string
  stagger?: number
}

export function StaggerGrid({ children, className = '', itemClassName = '', stagger = 0.08 }: StaggerGridProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <MotionWrapper key={i} delay={i * stagger} className={itemClassName}>
          {child}
        </MotionWrapper>
      ))}
    </div>
  )
}
