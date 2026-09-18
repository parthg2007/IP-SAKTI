import { useEffect, useId, useRef } from 'react'
import { gsap } from 'gsap'

const layers = [
  { height: 490, amplitude: 78, wavelength: 1420, speed: .43, phase: .3, color: '#264333', opacity: .30 },
  { height: 560, amplitude: 102, wavelength: 1180, speed: .58, phase: 2.1, color: '#3e6548', opacity: .32 },
  { height: 650, amplitude: 118, wavelength: 1330, speed: .72, phase: 4.4, color: '#5e8159', opacity: .34 },
  { height: 735, amplitude: 94, wavelength: 1020, speed: .64, phase: 1.3, color: '#809666', opacity: .23 },
]

function wavePath(layer, time) {
  const points = []
  for (let x = -160; x <= 1600; x += 80) {
    // Different wavelengths keep the surface irregular while the main swell
    // carries each crest continuously across the screen.
    const y = layer.height
      + Math.sin(x * Math.PI * 2 / layer.wavelength - time * layer.speed + layer.phase) * layer.amplitude
      + Math.sin(x * Math.PI * 2 / 720 - time * .31 + layer.phase * 1.7) * layer.amplitude * .28
      + Math.sin(x * Math.PI * 2 / 430 + time * .18 + layer.phase) * layer.amplitude * .09
    points.push({ x, y })
  }

  let path = `M ${points[0].x} ${points[0].y.toFixed(1)}`
  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[Math.max(0, index - 1)]
    const start = points[index]
    const end = points[index + 1]
    const next = points[Math.min(points.length - 1, index + 2)]
    path += ` C ${(start.x + (end.x - previous.x) / 6).toFixed(1)} ${(start.y + (end.y - previous.y) / 6).toFixed(1)}, ${(end.x - (next.x - start.x) / 6).toFixed(1)} ${(end.y - (next.y - start.y) / 6).toFixed(1)}, ${end.x} ${end.y.toFixed(1)}`
  }
  return `${path} L 1600 1000 L -160 1000 Z`
}

export default function ChatAtmosphere() {
  const id = useId().replace(/:/g, '')
  const pathRefs = useRef([])
  const glowRef = useRef(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let elapsed = 0
    let frameTime = 0
    let previousTick = null

    const draw = () => {
      layers.forEach((layer, index) => {
        pathRefs.current[index]?.setAttribute('d', wavePath(layer, elapsed))
      })
      glowRef.current?.setAttribute('cx', String(720 + Math.sin(elapsed * .23) * 170))
      glowRef.current?.setAttribute('cy', String(765 + Math.sin(elapsed * .37) * 28))
    }

    const tick = (time) => {
      if (previousTick === null) { previousTick = time; return }
      const delta = Math.min(time - previousTick, .1)
      previousTick = time
      elapsed += delta
      frameTime += delta
      if (frameTime < 1 / 30) return
      frameTime %= 1 / 30
      draw()
    }

    const syncPlayback = () => {
      gsap.ticker.remove(tick)
      previousTick = null
      frameTime = 0
      if (!document.hidden && !reducedMotion.matches) gsap.ticker.add(tick)
    }

    draw()
    syncPlayback()
    document.addEventListener('visibilitychange', syncPlayback)
    reducedMotion.addEventListener('change', syncPlayback)
    return () => {
      gsap.ticker.remove(tick)
      document.removeEventListener('visibilitychange', syncPlayback)
      reducedMotion.removeEventListener('change', syncPlayback)
    }
  }, [])

  return (
    <div className="chat-atmosphere" aria-hidden="true">
      <svg className="chat-atmosphere-wave-field" viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">
        <defs>
          {layers.map((layer, index) => (
            <linearGradient key={index} id={`${id}-wave-${index}`} x1="0" y1="300" x2="0" y2="980" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={layer.color} stopOpacity=".06" />
              <stop offset=".4" stopColor={layer.color} stopOpacity={layer.opacity * .65} />
              <stop offset=".76" stopColor={layer.color} stopOpacity={layer.opacity} />
              <stop offset="1" stopColor={layer.color} stopOpacity="0" />
            </linearGradient>
          ))}
          <radialGradient id={`${id}-fog`}>
            <stop offset="0" stopColor="#93b279" stopOpacity=".12" />
            <stop offset=".45" stopColor="#75975d" stopOpacity=".07" />
            <stop offset="1" stopColor="#42653d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#050906" stopOpacity=".7" />
            <stop offset=".35" stopColor="#050906" stopOpacity="0" />
            <stop offset=".87" stopColor="#050906" stopOpacity="0" />
            <stop offset="1" stopColor="#050906" stopOpacity=".35" />
          </linearGradient>
          <filter id={`${id}-soften`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
        <g filter={`url(#${id}-soften)`}>
          {layers.map((layer, index) => (
            <path key={index} ref={(element) => { pathRefs.current[index] = element }} d={wavePath(layer, 0)} fill={`url(#${id}-wave-${index})`} />
          ))}
        </g>
        <ellipse ref={glowRef} cx="720" cy="765" rx="800" ry="235" fill={`url(#${id}-fog)`} />
        <rect width="1440" height="900" fill={`url(#${id}-shade)`} />
      </svg>
    </div>
  )
}
