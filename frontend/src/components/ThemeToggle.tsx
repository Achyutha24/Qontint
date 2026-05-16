import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg nav-link-base transition-colors group relative z-[60]"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {theme === 'light' ? (
            <motion.div
              key="sun"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Sun className="w-5 h-5 text-[var(--aurora)]" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Moon className="w-5 h-5 text-[var(--aurora)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] group-hover:text-[var(--aurora)]">
        {theme === 'light' ? 'Light' : 'Dark'}
      </span>
    </button>
  )
}
