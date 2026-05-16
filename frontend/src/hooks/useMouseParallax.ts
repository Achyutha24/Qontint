import { useEffect, useRef } from 'react'

export function useMouseParallax() {
  const mouse = useRef({ x: 0, y: 0 })
  const target = useRef({ x: 0, y: 0 })
  const animFrameId = useRef<number>(0)

  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    if (isTouch) {
      mouse.current = { x: 0, y: 0 }
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      target.current.x = (e.clientX / window.innerWidth) - 0.5
      target.current.y = (e.clientY / window.innerHeight) - 0.5
    }
    window.addEventListener('mousemove', handleMouseMove)

    const update = () => {
    mouse.current.x += (target.current.x - mouse.current.x) * 0.25
    mouse.current.y += (target.current.y - mouse.current.y) * 0.25
      animFrameId.current = requestAnimationFrame(update)
    }
    animFrameId.current = requestAnimationFrame(update)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animFrameId.current)
    }
  }, [])

  return mouse
}
