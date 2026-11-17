import { useEffect, useState } from 'react'

export function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target <= 0) return
    const steps = 22
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setValue(target)
        clearInterval(timer)
      } else {
        setValue(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [target, duration])

  return target <= 0 ? 0 : value
}

