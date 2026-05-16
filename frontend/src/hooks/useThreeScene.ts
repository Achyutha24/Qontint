import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useTheme } from './useTheme'

export function useThreeScene(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  setupFn: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => any,
  animateFn: (state: any, clock: THREE.Clock, mouse: { x: number, y: number }, scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => void,
  mouseMoveFn?: (e: MouseEvent, mouse: { x: number, y: number }) => void
) {
  const { theme } = useTheme()
  const mouse = useRef({ x: 0, y: 0 })
  const animFrameId = useRef<number>(0)
  const fpsData = useRef({ lastTime: 0, frames: 0, avgFps: 60 })

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight

    // Performance Rule: setPixelRatio capped at 2
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000)
    const clock = new THREE.Clock()

    const state = setupFn(scene, camera, renderer)

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate)
      
      // FPS Guard
      const now = performance.now()
      fpsData.current.frames++
      if (now - fpsData.current.lastTime > 1000) {
        fpsData.current.avgFps = (fpsData.current.frames * 1000) / (now - fpsData.current.lastTime)
        fpsData.current.frames = 0
        fpsData.current.lastTime = now
        
        // Performance Rule: If avg < 30 for 3s, you could trigger a callback here
        // For now we just log or keep track
      }

      animateFn(state, clock, mouse.current, scene, camera, renderer)
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      const width = canvas.clientWidth || window.innerWidth
      const height = canvas.clientHeight || window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(canvas)

    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) - 0.5
      mouse.current.y = (e.clientY / window.innerHeight) - 0.5
      if (mouseMoveFn) mouseMoveFn(e, mouse.current)
    }
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      cancelAnimationFrame(animFrameId.current)
      window.removeEventListener('mousemove', handleMouseMove)
      resizeObserver.disconnect()
      
      // Full Three.js disposal
      renderer.dispose()
      scene.clear()
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: any) => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
        if (obj.texture) obj.texture.dispose()
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]) // Re-run on theme change

  return { mouse, avgFps: fpsData.current.avgFps }
}
