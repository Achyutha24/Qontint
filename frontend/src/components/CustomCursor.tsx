import { useEffect, useRef, useState } from 'react'

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 0, y: 0 })
  const ringPos = useRef({ x: 0, y: 0 })
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      setIsTouch(true)
      return
    }

    let animFrameId: number

    const handleMouseMove = (e: MouseEvent) => {
      pos.current.x = e.clientX
      pos.current.y = e.clientY
    }
    
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName.toLowerCase() === 'button' || target.tagName.toLowerCase() === 'a' || target.closest('button') || target.closest('a')) {
        ringRef.current?.classList.add('hovering')
      } else {
        ringRef.current?.classList.remove('hovering')
      }
    }

    const handleMouseDown = () => {
      if (ringRef.current) {
        ringRef.current.style.setProperty('--x', `${ringPos.current.x}px`)
        ringRef.current.style.setProperty('--y', `${ringPos.current.y}px`)
        ringRef.current.classList.add('clicking')
        setTimeout(() => ringRef.current?.classList.remove('clicking'), 300)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseover', handleMouseOver)
    window.addEventListener('mousedown', handleMouseDown)

    const update = () => {
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`
      }
      if (ringRef.current) {
        ringPos.current.x += (pos.current.x - ringPos.current.x) * 0.1
        ringPos.current.y += (pos.current.y - ringPos.current.y) * 0.1
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0) translate(-50%, -50%)`
      }
      animFrameId = requestAnimationFrame(update)
    }
    update()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseover', handleMouseOver)
      window.removeEventListener('mousedown', handleMouseDown)
      cancelAnimationFrame(animFrameId)
    }
  }, [])

  if (isTouch) return null

  return (
    <>
      <div 
        ref={ringRef} 
        className="fixed top-0 left-0 w-8 h-8 rounded-full border border-[var(--aurora)] pointer-events-none z-[9999] transition-[width,height,background-color] duration-200"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <style>{`
          .hovering { width: 48px !important; height: 48px !important; background-color: var(--glow-aurora); border-color: var(--aurora); }
          .clicking { animation: clickAnim 0.3s ease; }
          @keyframes clickAnim { 0% { transform: translate3d(var(--x), var(--y), 0) translate(-50%, -50%) scale(1); } 50% { transform: translate3d(var(--x), var(--y), 0) translate(-50%, -50%) scale(1.5); } 100% { transform: translate3d(var(--x), var(--y), 0) translate(-50%, -50%) scale(1); } }
        `}</style>
      </div>
      <div 
        ref={dotRef} 
        className="fixed top-0 left-0 w-[6px] h-[6px] rounded-full bg-[var(--aurora)] pointer-events-none z-[10000]"
        style={{ transform: 'translate(-50%, -50%)' }}
      />
    </>
  )
}
