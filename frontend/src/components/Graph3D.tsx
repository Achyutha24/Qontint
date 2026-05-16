import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Float, Sparkles, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useTheme } from '../hooks/useTheme'

export interface GraphNode {
  id: string
  label: string
  type: string
  vertical: string
  authority: number
  size?: number
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
  relation: string
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeHover: (node: GraphNode | null, x: number, y: number) => void
  onNodeClick: (node: GraphNode | null) => void
  selectedId: string | null
}

function GraphScene({ nodes, edges, onNodeHover, onNodeClick, selectedId }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // ── Palette ──
  const TYPE_COLORS: Record<string, string> = useMemo(() => {
    if (isDark) {
      return {
        PRODUCT:     '#d4956a', // aurora amber
        TECHNOLOGY:  '#f0d080', // gold
        ORG:         '#c8722a', // solar orange
        PERSON:      '#d06848', // coral
        CONCEPT:     '#e8c080', // stellar gold
        PROCESS:     '#a0785a', // plasma
        STANDARD:    '#d4956a',
        DEFAULT:     '#d4956a',
      }
    } else {
      return {
        PRODUCT:     '#d4813a', // amber
        TECHNOLOGY:  '#8b6f47', // plasma/brown
        ORG:         '#e8a020', // solar yellow
        PERSON:      '#c45e3e', // coral
        CONCEPT:     '#5a8a6e', // stellar/sage
        PROCESS:     '#d4813a',
        STANDARD:    '#8b6f47',
        DEFAULT:     '#d4813a',
      }
    }
  }, [isDark])

  // Precompute initial positions using a more stable layout (Spiral)
  const positions = useMemo(() => {
    const posMap = new Map<string, THREE.Vector3>()
    nodes.forEach((node, idx) => {
      const phi = Math.acos(-1 + (2 * idx) / nodes.length)
      const theta = Math.sqrt(nodes.length * Math.PI) * phi
      const r = 30 + node.authority * 10
      const x = r * Math.cos(theta) * Math.sin(phi)
      const y = r * Math.sin(theta) * Math.sin(phi)
      const z = r * Math.cos(phi)
      posMap.set(node.id, new THREE.Vector3(x, y, z))
    })
    return posMap
  }, [nodes])

  const velocities = useMemo(() => {
    const velMap = new Map<string, THREE.Vector3>()
    nodes.forEach(node => {
      velMap.set(node.id, new THREE.Vector3(
        (Math.random() - 0.5) * 0.005,
        (Math.random() - 0.5) * 0.005,
        (Math.random() - 0.5) * 0.005
      ))
    })
    return velMap
  }, [nodes])

  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<THREE.LineSegments>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    
    // Smooth breathing rotation
    groupRef.current.rotation.y = Math.sin(t * 0.05) * 0.2
    groupRef.current.rotation.x = Math.cos(t * 0.03) * 0.1

    // Update node positions smoothly (Brownian-ish motion)
    nodes.forEach(node => {
      const pos = positions.get(node.id)!
      const vel = velocities.get(node.id)!
      
      // Floating motion
      pos.x += Math.sin(t * 0.2 + pos.z) * 0.01 + vel.x
      pos.y += Math.cos(t * 0.2 + pos.x) * 0.01 + vel.y
      pos.z += Math.sin(t * 0.2 + pos.y) * 0.01 + vel.z
      
      // Constraint box
      const B = 50
      if (Math.abs(pos.x) > B) vel.x *= -1
      if (Math.abs(pos.y) > B) vel.y *= -1
      if (Math.abs(pos.z) > B) vel.z *= -1

      const child = groupRef.current!.children.find(c => c.userData.id === node.id)
      if (child) {
        child.position.lerp(pos, 0.1) // Smoother transition
      }
    })

    // Sync edges
    if (linesRef.current) {
      const lp = linesRef.current.geometry.attributes.position.array as Float32Array
      let lineIdx = 0
      edges.forEach(e => {
        const src = positions.get(e.source)
        const tgt = positions.get(e.target)
        if (src && tgt) {
          lp[lineIdx*6] = src.x; lp[lineIdx*6+1] = src.y; lp[lineIdx*6+2] = src.z
          lp[lineIdx*6+3] = tgt.x; lp[lineIdx*6+4] = tgt.y; lp[lineIdx*6+5] = tgt.z
          lineIdx++
        }
      })
      linesRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  // Edge setup
  const edgePositions = useMemo(() => new Float32Array(edges.length * 6), [edges])
  const edgeColors = useMemo(() => {
    const col: number[] = []
    // Use a deeper, less intense color for edges to prevent white blowout
    const c = new THREE.Color(isDark ? '#8a5a3a' : '#b4713a')
    edges.forEach(() => {
      col.push(c.r, c.g, c.b, c.r, c.g, c.b)
    })
    return new Float32Array(col)
  }, [edges, isDark])

  return (
    <>
      <ambientLight intensity={isDark ? 0.8 : 1.2} />
      <pointLight position={[50, 50, 50]} intensity={isDark ? 5 : 3} color={isDark ? '#f0d080' : '#ffffff'} />
      <pointLight position={[-50, -50, -50]} intensity={isDark ? 3 : 2} color={isDark ? '#d4956a' : '#ffffff'} />

      <Sparkles count={isDark ? 100 : 50} scale={60} size={isDark ? 3 : 1} speed={0.3} color={isDark ? '#f0d080' : '#d4813a'} />

      <group ref={groupRef}>
        {nodes.map(node => {
          const isSelected = selectedId === node.id
          const baseR = 1.0 + node.authority * 2.0
          const r = isSelected ? baseR * 1.5 : baseR
          const color = TYPE_COLORS[node.type] || TYPE_COLORS.DEFAULT

          return (
            <group key={node.id} userData={{ id: node.id }}>
              <mesh 
                onPointerOver={(e) => {
                  e.stopPropagation()
                  onNodeHover(node, e.clientX, e.clientY)
                }}
                onPointerOut={(e) => {
                  e.stopPropagation()
                  onNodeHover(null, 0, 0)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onNodeClick(node)
                }}
              >
                <sphereGeometry args={[r, 32, 32]} />
                <meshStandardMaterial 
                  color={color} 
                  emissive={color}
                  emissiveIntensity={isSelected ? 1.5 : (isDark ? 0.4 : 0.2)}
                  roughness={0.2}
                  metalness={0.8}
                  transparent
                  opacity={1.0}
                />
              </mesh>
              
              {/* Subtle Label for Authority Nodes */}
              {(isSelected || node.authority > 0.8) && (
                <Text
                  position={[0, r + 1, 0]}
                  fontSize={1.2}
                  color={isDark ? "#ffffff" : "#1a1208"}
                  font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZg.woff"
                  anchorX="center"
                  anchorY="bottom"
                >
                  {node.label}
                </Text>
              )}

              {/* Glowing Pulse Aura */}
              {(isSelected || node.authority > 0.6) && (
                <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
                  <mesh>
                    <sphereGeometry args={[r * 1.3, 32, 32]} />
                    <meshBasicMaterial 
                      color={color} 
                      transparent 
                      opacity={isSelected ? 0.3 : 0.1} 
                      blending={THREE.AdditiveBlending} 
                      depthWrite={false}
                    />
                  </mesh>
                </Float>
              )}
            </group>
          )
        })}

        <lineSegments ref={linesRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[edgePositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[edgeColors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial 
            vertexColors 
            transparent 
            opacity={isDark ? 0.03 : 0.08} 
            blending={isDark ? THREE.AdditiveBlending : THREE.NormalBlending} 
            depthWrite={false} 
          />
        </lineSegments>
      </group>

      <OrbitControls enableDamping dampingFactor={0.05} minDistance={20} maxDistance={150} />
    </>
  )
}

export default function Graph3D(props: Props) {
  return (
    <div className="w-full h-full cursor-grab active:cursor-grabbing bg-transparent rounded-xl overflow-hidden relative">
      <Canvas camera={{ position: [0, 40, 80], fov: 45 }}>
        <GraphScene {...props} />
      </Canvas>
    </div>
  )
}
