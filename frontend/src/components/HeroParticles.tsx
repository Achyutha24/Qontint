import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COLORS = [
  new THREE.Color('#FF5E3A'), // Sunset Coral
  new THREE.Color('#4f8ef7'), // Blue
  new THREE.Color('#FFB347'), // Amber
]

interface Props {
  height?: number
}

function ParticleNetwork() {
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const groupRef = useRef<THREE.Group>(null)
  const { mouse, viewport } = useThree()

  // Responsive particle count
  const isMobile = window.innerWidth < 768
  const NODE_COUNT = isMobile ? 60 : 150
  const CONNECTION_DISTANCE = isMobile ? 1.5 : 2.0

  const { positions, colors, velocities } = useMemo(() => {
    const pos = new Float32Array(NODE_COUNT * 3)
    const col = new Float32Array(NODE_COUNT * 3)
    const vel = []

    for (let i = 0; i < NODE_COUNT; i++) {
      // 3 Depth layers based on z
      const zLayer = Math.random() > 0.6 ? (Math.random() * 2 + 1) : (Math.random() * -3)
      pos[i * 3] = (Math.random() - 0.5) * 12
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8
      pos[i * 3 + 2] = zLayer

      const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]
      col[i * 3] = color.r
      col[i * 3 + 1] = color.g
      col[i * 3 + 2] = color.b

      vel.push({
        x: (Math.random() - 0.5) * 0.005,
        y: (Math.random() - 0.5) * 0.005,
        z: (Math.random() - 0.5) * 0.005,
      })
    }
    return { positions: pos, colors: col, velocities: vel }
  }, [NODE_COUNT])

  useFrame(() => {
    if (!pointsRef.current || !linesRef.current || !groupRef.current) return

    // Ambient slow rotation
    groupRef.current.rotation.y += 0.0003

    // Parallax
    const targetX = (mouse.x * viewport.width) / 10
    const targetY = (mouse.y * viewport.height) / 10
    groupRef.current.position.x += (targetX - groupRef.current.position.x) * 0.02
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.02

    const positionsArray = pointsRef.current.geometry.attributes.position.array as Float32Array
    
    // Update positions
    for (let i = 0; i < NODE_COUNT; i++) {
      positionsArray[i * 3] += velocities[i].x
      positionsArray[i * 3 + 1] += velocities[i].y
      positionsArray[i * 3 + 2] += velocities[i].z

      // Bounds check
      if (Math.abs(positionsArray[i * 3]) > 6) velocities[i].x *= -1
      if (Math.abs(positionsArray[i * 3 + 1]) > 4) velocities[i].y *= -1
      if (Math.abs(positionsArray[i * 3 + 2]) > 3) velocities[i].z *= -1
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true

    // Update lines
    const linePositions = []
    const lineColors = []
    let connections = 0

    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = positionsArray[i * 3] - positionsArray[j * 3]
        const dy = positionsArray[i * 3 + 1] - positionsArray[j * 3 + 1]
        const dz = positionsArray[i * 3 + 2] - positionsArray[j * 3 + 2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < CONNECTION_DISTANCE) {
          linePositions.push(
            positionsArray[i * 3], positionsArray[i * 3 + 1], positionsArray[i * 3 + 2],
            positionsArray[j * 3], positionsArray[j * 3 + 1], positionsArray[j * 3 + 2]
          )
          
          const alpha = 1.0 - (dist / CONNECTION_DISTANCE)
          const ci = i * 3
          const cj = j * 3
          // Mix colors of the two connected nodes
          lineColors.push(
            colors[ci], colors[ci + 1], colors[ci + 2], alpha,
            colors[cj], colors[cj + 1], colors[cj + 2], alpha
          )
          connections++
        }
      }
    }

    linesRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    linesRef.current.geometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 4))
  })

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.08} vertexColors transparent opacity={0.8} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>

      <lineSegments ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial vertexColors transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} linewidth={2} />
      </lineSegments>
    </group>
  )
}

export default function HeroParticles({ height = window.innerHeight }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ height: `${height}px` }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <ParticleNetwork />
      </Canvas>
    </div>
  )
}
