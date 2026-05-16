/**
 * GlassCard — Enhanced glassmorphism card with subtle inner glow,
 * soft animated border, and elevation on hover.
 * Drop-in replacement / wrapper around the existing `.card` class.
 */
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
  glowOnHover?: boolean
  glowColor?: string
  noPadding?: boolean
  as?: 'div' | 'article' | 'section'
}

export default function GlassCard({
  children,
  className = '',
  style,
  onClick,
  glowOnHover = true,
  glowColor = 'var(--glow-aurora)',
  noPadding = false,
  as: Tag = 'div',
}: GlassCardProps) {
  const prefersReduced = useReducedMotion()

  const baseStyle: CSSProperties = {
    background: 'linear-gradient(135deg, rgba(26,20,15,0.85) 0%, rgba(18,14,10,0.9) 100%)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(212,149,106,0.1)',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  }

  if (prefersReduced || !glowOnHover) {
    return (
      <Tag
        className={`${noPadding ? '' : 'p-5'} ${className}`}
        style={baseStyle}
        onClick={onClick}
      >
        {children}
      </Tag>
    )
  }

  return (
    <motion.div
      className={`${noPadding ? '' : 'p-5'} ${className}`}
      style={baseStyle}
      onClick={onClick}
      initial="rest"
      whileHover="hover"
      animate="rest"
      variants={{
        rest: {
          y: 0,
          borderColor: 'rgba(212,149,106,0.1)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
        },
        hover: {
          y: -2,
          borderColor: 'rgba(212,149,106,0.25)',
          boxShadow: `0 8px 32px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
          transition: { duration: 0.2, ease: 'easeOut' },
        },
      }}
    >
      {/* Inner top shimmer */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(212,149,106,0.2), transparent)' }}
      />
      {children}
    </motion.div>
  )
}
