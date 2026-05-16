/**
 * Centralized animation variants for the Qontint UI system.
 * All durations are GPU-friendly (150–300ms). No excessive bounce.
 */
import type { Variants } from 'framer-motion'

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
}

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}

export const slideRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}

export const glowPulse: Variants = {
  idle: { boxShadow: '0 0 0px rgba(212,149,106,0)' },
  pulse: {
    boxShadow: [
      '0 0 0px rgba(212,149,106,0)',
      '0 0 20px rgba(212,149,106,0.3)',
      '0 0 0px rgba(212,149,106,0)',
    ],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
}

export const cardHover = {
  rest: { y: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' },
  hover: {
    y: -3,
    boxShadow: '0 8px 32px rgba(212,149,106,0.12)',
    transition: { duration: 0.2, ease: 'easeOut' },
  },
}
