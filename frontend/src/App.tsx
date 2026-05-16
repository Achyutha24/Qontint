import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Cpu, Zap, BarChart3, Network, Video, CreditCard, Menu, X, Brain
} from 'lucide-react'

import HomePage      from './pages/HomePage'
import AnalyzePage   from './pages/AnalyzePage'
import GeneratePage  from './pages/GeneratePage'
import KeywordsPage  from './pages/KeywordsPage'
import GraphPage     from './pages/GraphPage'
import YouTubePage   from './pages/YouTubePage'
import PricingPage   from './pages/PricingPage'
import DashboardPage from './pages/DashboardPage'
import QueryIntelPage from './pages/QueryIntelPage'
import CustomCursor from './components/CustomCursor'
import PageTransition from './components/PageTransition'
import AmbientBackground from './components/ambient/AmbientBackground'
import { useTheme } from './hooks/useTheme'
import './App.css'

// ── Scanline ──────────────────────────────────────────────────────────────────
function ScanLine() {
  const { theme } = useTheme()
  if (theme === 'light') return null
  return <div className="scan-line pointer-events-none" />
}

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/',         label: 'Home',     icon: Home,       exact: true },
  { to: '/analyze',  label: 'Analyze',  icon: Cpu },
  { to: '/generate', label: 'Generate', icon: Zap },
  { to: '/query-intel', label: 'Intelligence', icon: Brain },
  { to: '/graph',    label: 'Graph',    icon: Network },
  { to: '/youtube',  label: 'YouTube',  icon: Video },
  { to: '/keywords', label: 'Keywords', icon: BarChart3 },
  { to: '/dashboard',label: 'Dashboard',icon: BarChart3 },
  { to: '/pricing',  label: 'Pricing',  icon: CreditCard },
]

function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme } = useTheme()

  return (
    <nav className="glass-nav fixed top-0 left-0 right-0 z-[60] px-5 py-3 border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 no-underline flex-shrink-0 group" onClick={() => setMobileOpen(false)}>
          <div className="relative w-9 h-9 flex items-center justify-center border border-[var(--aurora)] rounded-full transition-all duration-300 group-hover:shadow-[0_0_15px_var(--glow-aurora)]">
            <style>{`.group:hover div { background-color: color-mix(in srgb, var(--aurora) 5%, transparent); }`}</style>
            <Network className="w-5 h-5 text-[var(--aurora)]" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-black text-xl text-[var(--text-primary)] tracking-tighter leading-none">Qontint</span>
            <span className="font-mono text-[9px] text-[var(--aurora)] opacity-80 uppercase tracking-[0.2em] mt-0.5">Engine v1.0</span>
          </div>
        </NavLink>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 no-underline border ${
                  isActive ? 'nav-link-active' : 'nav-link-base'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Theme toggle removed */}
          
          <div className="live-badge hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-depth)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--aurora)] uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--aurora)] animate-pulse" />
            <span>LIVE</span>
          </div>
          
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 text-[var(--text-primary)] nav-link-base rounded-lg transition-colors"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden border-t border-[var(--border-subtle)] mt-3 pt-3"
          >
            <div className="grid grid-cols-2 gap-2 pb-2">
              {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={exact}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-bold no-underline transition-all border ${
                      isActive ? 'nav-link-active' : 'nav-link-base'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}


// ── Wrapper for non-home pages (adds pt-24 for nav) ──────────────────────────
function StandardLayout({ children }: { children: React.ReactNode }) {
  return <div className="pt-24">{children}</div>
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <ScanLine />
      {/* Cinematic ambient background — behind everything */}
      <AmbientBackground variant="default" opacity={0.7} />
      <div className="min-h-screen transition-colors duration-300 relative z-10">
        <Nav />
        <main className="relative h-full min-h-screen">
          <PageTransition>
            <Routes>
              <Route path="/"          element={<HomePage />} />
              <Route path="/analyze"   element={<StandardLayout><AnalyzePage /></StandardLayout>} />
              <Route path="/generate"  element={<StandardLayout><GeneratePage /></StandardLayout>} />
              <Route path="/graph"     element={<StandardLayout><GraphPage /></StandardLayout>} />
              <Route path="/youtube"   element={<StandardLayout><YouTubePage /></StandardLayout>} />
              <Route path="/keywords"  element={<StandardLayout><KeywordsPage /></StandardLayout>} />
              <Route path="/dashboard" element={<StandardLayout><DashboardPage /></StandardLayout>} />
              <Route path="/query-intel" element={<StandardLayout><QueryIntelPage /></StandardLayout>} />
              <Route path="/pricing"   element={<StandardLayout><PricingPage /></StandardLayout>} />
            </Routes>
          </PageTransition>
        </main>
      </div>
    </BrowserRouter>
  )
}
