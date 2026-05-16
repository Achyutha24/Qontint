import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Zap, Shield, Star, ArrowRight, Globe } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { useThreeScene } from '../hooks/useThreeScene'
import { useTheme } from '../hooks/useTheme'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { useMouseParallax } from '../hooks/useMouseParallax'

const plans = [
  {
    name: 'Community',
    price: { monthly: 0, annual: 0 },
    badge: null,
    color: 'var(--stellar)',
    icon: Globe,
    desc: 'Self-hosted, open-source. Deploy with Docker in minutes.',
    cta: 'Deploy Free',
    ctaAction: 'deploy',
    features: [
      '4 B2B Fintech Verticals',
      '116 keyword taxonomy',
      'Core pipeline (M2–M6)',
      'Entity extraction (spaCy)',
      'Neo4j authority graph',
      'Local LLM via Ollama',
      'Unlimited analyses',
      'REST API + Swagger docs',
      'Community support (GitHub)',
    ],
    missing: [
      'Managed cloud hosting',
      'Team collaboration',
      'Priority support',
      'Custom verticals',
      'SLA guarantee',
    ],
  },
  {
    name: 'Starter',
    price: { monthly: 49, annual: 39 },
    badge: 'Most Popular',
    color: 'var(--aurora)',
    icon: Zap,
    desc: 'Cloud-hosted. No Docker required. Ideal for solo content teams.',
    cta: 'Start Free Trial',
    ctaAction: 'starter',
    features: [
      'Everything in Community',
      'Managed cloud (no Docker)',
      '5 seats',
      'Managed Neo4j + Redis',
      'Cloud Ollama inference',
      'YouTube Rank Predictor',
      '99.5% uptime SLA',
      'Email support (48h)',
      '5 custom keywords/vertical',
      'CSV export',
    ],
    missing: [
      'Custom verticals',
      'Dedicated infrastructure',
      'SSO / SAML',
    ],
  },
  {
    name: 'Pro',
    price: { monthly: 149, annual: 119 },
    badge: null,
    color: 'var(--plasma)',
    icon: Shield,
    desc: 'For growing content teams that need custom verticals and integrations.',
    cta: 'Start Free Trial',
    ctaAction: 'pro',
    features: [
      'Everything in Starter',
      '20 seats',
      '2 custom verticals',
      'Custom keyword taxonomy',
      'Priority email + Slack',
      'Webhook integrations',
      'Advanced analytics dashboard',
      'API rate limit: 1000 req/day',
      'White-label reports',
      '99.9% uptime SLA',
      'Monthly strategy review call',
    ],
    missing: [
      'Dedicated infrastructure',
      'SSO / SAML',
    ],
  },
  {
    name: 'Enterprise',
    price: { monthly: null, annual: null },
    badge: 'Custom',
    color: 'var(--solar)',
    icon: Star,
    desc: 'Dedicated infrastructure, SSO, SLA, and custom integrations for large teams.',
    cta: 'Contact Sales',
    ctaAction: 'enterprise',
    features: [
      'Everything in Pro',
      'Unlimited seats',
      'Unlimited custom verticals',
      'Dedicated cloud infrastructure',
      'SSO / SAML / SCIM',
      'Custom SLA (up to 99.99%)',
      'On-prem deployment option',
      'Dedicated Slack channel',
      'Custom LLM fine-tuning',
      'Priority Jira integration',
      'Quarterly roadmap influence',
      'Custom contracts & invoicing',
    ],
    missing: [],
  },
]

const faqs = [
  {
    q: 'Is the Community plan really free forever?',
    a: 'Yes. The full Qontint Intelligence Engine is 100% open-source (MIT license). You can self-host it with Docker at zero cost, forever. The paid plans add cloud hosting and team features on top.',
  },
  {
    q: 'What LLM does Qontint use?',
    a: 'Community users run Ollama locally (llama3.1:8b by default, but any Ollama model works). Starter/Pro plans use cloud-hosted Ollama inference so you don\'t need a GPU. Enterprise can bring their own fine-tuned model.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes — upgrade or downgrade at any time. Annual plans are billed upfront at the discounted rate. Unused months are credited to your account on downgrade.',
  },
  {
    q: 'What\'s a "custom vertical"?',
    a: 'A custom vertical is a domain-specific keyword taxonomy + entity corpus that you define. We build the spaCy patterns, Neo4j schema, and training data for your niche (e.g. LegalTech, InsurTech, ClimateTech).',
  },
  {
    q: 'Do you offer nonprofit / academic discounts?',
    a: 'Yes — contact sales@qontint.io with your organization\'s details. We offer up to 70% discount for qualifying nonprofits and academic institutions.',
  },
]

function FaqItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay }} viewport={{ once: true }}
      className="card overflow-hidden"
    >
      <button
        className="w-full text-left p-5 flex items-start justify-between gap-4"
        onClick={() => setOpen(o => !o)}
      >
        <p className="font-display font-semibold text-[var(--text-primary)]">{q}</p>
        <span className="text-[var(--aurora)] text-xl flex-shrink-0 mt-0.5">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          className="px-5 pb-5 text-[var(--text-secondary)] text-sm leading-relaxed"
        >
          {a}
        </motion.div>
      )}
    </motion.div>
  )
}

export default function PricingPage() {
  useScrollReveal()
  const mouse = useMouseParallax()
  const { theme } = useTheme()
  const [annual, setAnnual] = useState(false)
  const navigate = useNavigate()

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useThreeScene(canvasRef, (scene, camera) => {
    const isDark = theme === 'dark'
    const group = new THREE.Group()

    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: isDark ? 0xffffff : 0xf5f0e8,
      metalness: isDark ? 0.1 : 0.05,
      roughness: 0.05,
      transmission: 1.0,
      ior: 1.5,
      thickness: 2.0,
      specularIntensity: 1,
      specularColor: new THREE.Color(0xffffff),
      transparent: true,
      opacity: isDark ? 0.8 : 0.6
    })

    const goldMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0xf0d080 : 0xe8a020, // Gold / Solar
      metalness: 1.0,
      roughness: 0.1,
      emissive: isDark ? 0xf0d080 : 0xe8a020,
      emissiveIntensity: isDark ? 0.3 : 0.1
    })

    const shapes = [
      { geo: new THREE.OctahedronGeometry(2), pos: [-8, 2, -5], name: 'Free' },
      { geo: new THREE.DodecahedronGeometry(2.2), pos: [0, 4, -8], name: 'Pro' },
      { geo: new THREE.IcosahedronGeometry(2.5), pos: [8, 1, -6], name: 'Enterprise' }
    ]

    const crystals: THREE.Group[] = []

    shapes.forEach(s => {
      const crystalGroup = new THREE.Group()
      const shell = new THREE.Mesh(s.geo, crystalMat)
      crystalGroup.add(shell)
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), goldMat)
      crystalGroup.add(core)
      crystalGroup.position.set(...s.pos as [number, number, number])
      crystalGroup.userData = { 
        basePos: crystalGroup.position.clone(),
        rotSpeed: 0.01 + Math.random() * 0.01,
        phase: Math.random() * Math.PI * 2
      }
      group.add(crystalGroup)
      crystals.push(crystalGroup)
    })

    // Orbit particles
    const partCount = isDark ? 150 : 100
    const partGeo = new THREE.BufferGeometry()
    const partPos = new Float32Array(partCount * 3)
    for (let i = 0; i < partCount; i++) {
      partPos[i*3] = (Math.random()-0.5) * 30
      partPos[i*3+1] = (Math.random()-0.5) * 20
      partPos[i*3+2] = (Math.random()-0.5) * 20
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3))
    const partMat = new THREE.PointsMaterial({ 
      color: isDark ? 0xf0d080 : 0xd4813a, 
      size: 0.08, 
      transparent: true, 
      opacity: isDark ? 0.6 : 0.4 
    })
    const particles = new THREE.Points(partGeo, partMat)
    group.add(particles)

    scene.add(group)
    
    const p1 = new THREE.PointLight(isDark ? 0xd4956a : 0xffffff, isDark ? 5 : 2, 50)
    p1.position.set(-10, 10, 10)
    scene.add(p1)
    
    const p2 = new THREE.PointLight(isDark ? 0xf0d080 : 0xd4813a, isDark ? 5 : 2, 50)
    p2.position.set(10, -10, 10)
    scene.add(p2)
    
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.2 : 0.7))

    camera.position.z = 20
    return { group, crystals, particles }
  }, (state, clock, mousePos) => {
    const { group, crystals, particles } = state
    const t = clock.getElapsedTime()

    crystals.forEach((crystal: THREE.Group) => {
      crystal.rotation.y += crystal.userData.rotSpeed
      crystal.rotation.x += crystal.userData.rotSpeed * 0.5
      crystal.position.y = crystal.userData.basePos.y + Math.sin(t + crystal.userData.phase) * 1.0
      const core = crystal.children[1] as THREE.Mesh
      core.scale.setScalar(1 + Math.sin(t * 3) * 0.1)
    })

    const pos = particles.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] += Math.sin(t + i) * 0.01
      pos[i+1] += Math.cos(t + i) * 0.01
    }
    particles.geometry.attributes.position.needsUpdate = true

    group.rotation.y = mousePos.x * 0.1
    group.rotation.x = mousePos.y * 0.1
  })

  const handleCta = (action: string) => {
    if (action === 'deploy') {
      window.open('https://github.com', '_blank')
    } else {
      navigate('/analyze')
    }
  }

  return (
    <div className="min-h-screen pt-16 pb-20 px-4 relative overflow-hidden">
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-40" />

      <div 
        className="max-w-7xl mx-auto relative z-10"
        style={{ transform: `translate(${mouse.current.x * -5}px, ${mouse.current.y * -5}px)` }}
      >
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-14 reveal">
          <p className="section-tag mb-3">Pricing</p>
          <h1 className="font-display font-black text-5xl sm:text-6xl text-[var(--text-primary)] mb-4">
            Start free,<br />
            <span className="gradient-text">scale when ready</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-xl max-w-2xl mx-auto mb-8">
            The full intelligence engine is open-source and free to self-host. Cloud plans add managed infrastructure and team features.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-4 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-full px-5 py-3">
            <span className={`font-mono text-sm ${!annual ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>Monthly</span>
            <button
              onClick={() => setAnnual(a => !a)}
              className="relative w-12 h-6 rounded-full transition-colors duration-300"
              style={{ background: annual ? 'var(--aurora)' : 'var(--border-subtle)' }}
            >
              <motion.div
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[var(--text-primary)] shadow"
                animate={{ x: annual ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            </button>
            <span className={`font-mono text-sm ${annual ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
              Annual
              <span className="ml-1.5 tag text-[var(--aurora)] border-[var(--aurora)]" style={{ fontSize: '0.6rem' }}>Save 20%</span>
            </span>
          </div>
        </motion.div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-16 reveal">
          {plans.map((plan, i) => {
            const Icon = plan.icon
            const price = annual ? plan.price.annual : plan.price.monthly
            const isPopular = plan.badge === 'Most Popular'
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`card p-6 flex flex-col ${isPopular ? 'border-[var(--aurora)] shadow-[0_0_20px_rgba(0,245,212,0.1)]' : ''}`}
                style={isPopular ? { background: 'var(--surface-hover)' } : {}}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="mb-3">
                    <span className="tag" style={{
                      color: plan.color,
                      border: `1px solid ${plan.color}`,
                    }}>
                      {plan.badge === 'Most Popular' ? '⭐ ' : ''}{plan.badge}
                    </span>
                  </div>
                )}

                {/* Icon + name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{ borderColor: plan.color, background: `color-mix(in srgb, ${plan.color} 10%, transparent)` }}>
                    <Icon className="w-5 h-5" style={{ color: plan.color }} />
                  </div>
                  <h2 className="font-display font-black text-xl text-[var(--text-primary)]">{plan.name}</h2>
                </div>

                {/* Price */}
                <div className="mb-4">
                  {price === null ? (
                    <p className="font-display font-black text-3xl text-[var(--text-primary)]">Custom</p>
                  ) : price === 0 ? (
                    <div className="flex items-end gap-1">
                      <p className="font-display font-black text-4xl" style={{ color: plan.color }}>Free</p>
                      <p className="text-[var(--text-muted)] text-sm mb-1">forever</p>
                    </div>
                  ) : (
                    <div className="flex items-end gap-1">
                      <p className="font-display font-black text-4xl" style={{ color: plan.color }}>${price}</p>
                      <p className="text-[var(--text-muted)] text-sm mb-1">/mo</p>
                    </div>
                  )}
                  {annual && price !== null && price !== 0 && (
                    <p className="font-mono text-xs text-[var(--text-muted)]">billed ${(price! * 12).toLocaleString()}/year</p>
                  )}
                </div>

                <p className="text-[var(--text-secondary)] text-sm mb-5 leading-relaxed">{plan.desc}</p>

                {/* CTA */}
                <button
                  className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 mb-6 transition-all duration-200`}
                  style={isPopular
                    ? { background: plan.color, color: 'var(--bg-void)' }
                    : { background: `color-mix(in srgb, ${plan.color} 10%, transparent)`, color: plan.color, border: `1px solid ${plan.color}` }
                  }
                  onClick={() => handleCta(plan.ctaAction)}
                >
                  {plan.cta} <ArrowRight className="w-4 h-4" />
                </button>

                {/* Features */}
                <div className="flex-1 space-y-2">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                      <p className="text-xs text-[var(--text-secondary)]">{f}</p>
                    </div>
                  ))}
                  {plan.missing.map(f => (
                    <div key={f} className="flex items-start gap-2 opacity-40">
                      <div className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 flex items-center justify-center">
                        <div className="w-2.5 h-px bg-[var(--text-muted)] rounded" />
                      </div>
                      <p className="text-xs text-[var(--text-muted)] line-through">{f}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Comparison note */}
        <motion.div
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="card p-6 mb-16 text-center reveal"
        >
          <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">vs. Competitors</p>
          <h3 className="font-display font-bold text-2xl text-[var(--text-primary)] mb-3">
            Ahrefs costs $129/mo. Semrush costs $139/mo.<br />
            <span className="gradient-text">Qontint costs $0 to self-host.</span>
          </h3>
          <p className="text-[var(--text-secondary)] text-sm max-w-xl mx-auto">
            We use only open-source technology: DuckDuckGo for SERP data, spaCy for NLP, Neo4j Community for the graph, and local Ollama for LLM inference. No vendor lock-in. Ever.
          </p>
        </motion.div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto reveal">
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="text-center mb-8"
          >
            <p className="section-tag mb-2">FAQ</p>
            <h2 className="font-display font-bold text-3xl text-[var(--text-primary)]">Common Questions</h2>
          </motion.div>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <FaqItem key={i} {...f} delay={i * 0.05} />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} className="text-center mt-20 reveal"
        >
          <h2 className="font-display font-black text-4xl text-[var(--text-primary)] mb-4">
            Ready to stop guessing?
          </h2>
          <p className="text-[var(--text-secondary)] mb-8">Deploy in 3 minutes with Docker. No credit card required.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              className="btn-primary px-10 py-4 text-base flex items-center gap-2"
              onClick={() => navigate('/analyze')}
            >
              Try Analyze <ArrowRight className="w-5 h-5" />
            </button>
            <button
              className="btn-secondary px-10 py-4 text-base flex items-center gap-2"
              onClick={() => navigate('/graph')}
            >
              Explore Graph
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
