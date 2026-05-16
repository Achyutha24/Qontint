import { useEffect } from 'react'

/**
 * Hook to reveal elements with the 'reveal' class when they enter the viewport.
 * @param dependencies Optional dependencies to trigger re-observation (e.g. after fetching data)
 */
export function useScrollReveal(dependencies: any[] = []) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
    )

    const elements = document.querySelectorAll('.reveal')
    elements.forEach(el => observer.observe(el))

    return () => {
      elements.forEach(el => observer.unobserve(el))
      observer.disconnect()
    }
  }, dependencies)
}
