import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// A field of connected points, with a soft spotlight and cursor repulsion.
// Optimised: spatial-grid neighbour lookup, batched canvas paths, reduced GC.
const CONNECTION_DIST = 165
const TWO_PI = Math.PI * 2

export default function InteractiveBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return

    const media = gsap.matchMedia()
    media.add({ moving: '(prefers-reduced-motion: no-preference)', still: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      let width = 0
      let height = 0
      let points = []
      let color = '76, 107, 72'
      let gold = '156, 116, 45'
      let animationTime = 0
      const pointer = { x: 0, y: 0, active: false }
      const glow = { x: 0, y: 0, trailX: 0, trailY: 0, opacity: 0 }
      const finePointer = window.matchMedia('(pointer: fine)')
      const interactionRadius = 240

      // ── Spatial grid for O(n) neighbour lookups instead of O(n²) ───
      let gridCols = 1
      let gridRows = 1
      let grid = []
      const buildGrid = (pos) => {
        gridCols = Math.max(1, Math.ceil(width / CONNECTION_DIST))
        gridRows = Math.max(1, Math.ceil(height / CONNECTION_DIST))
        const total = gridCols * gridRows
        if (grid.length !== total) grid = new Array(total)
        for (let i = 0; i < total; i++) grid[i] = []
        for (let i = 0; i < pos.length; i++) {
          const p = pos[i]
          const col = Math.min(gridCols - 1, Math.max(0, (p.x / CONNECTION_DIST) | 0))
          const row = Math.min(gridRows - 1, Math.max(0, (p.y / CONNECTION_DIST) | 0))
          grid[row * gridCols + col].push(i)
        }
      }

      const drawGlow = (x, y, radius, rgb, opacity) => {
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `rgba(${rgb}, ${opacity})`)
        gradient.addColorStop(0.4, `rgba(${rgb}, ${opacity * 0.45})`)
        gradient.addColorStop(1, `rgba(${rgb}, 0)`)
        context.fillStyle = gradient
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      }

      // Pre-allocated position array to avoid per-frame allocation.
      let positions = []

      const draw = (time = animationTime, step = 0) => {
        context.clearRect(0, 0, width, height)
        const following = 1 - Math.pow(0.82, step)
        const trailing = 1 - Math.pow(0.94, step)
        const interacting = pointer.active && conditions.moving
        glow.x += (pointer.x - glow.x) * following
        glow.y += (pointer.y - glow.y) * following
        glow.trailX += (glow.x - glow.trailX) * trailing
        glow.trailY += (glow.y - glow.trailY) * trailing
        glow.opacity += ((interacting ? 1 : 0) - glow.opacity) * following

        if (glow.opacity > 0.005) {
          drawGlow(glow.x, glow.y, 280, color, 0.18 * glow.opacity)
          drawGlow(glow.trailX, glow.trailY, 150, gold, 0.12 * glow.opacity)
        }

        // Compute animated positions (reuse array to reduce GC pressure).
        for (let i = 0; i < points.length; i++) {
          const point = points[i]
          const x = point.x + Math.sin(time * 0.16 + point.phase) * 13
          const y = point.y + Math.cos(time * 0.12 + point.phase) * 13
          const dx = x - pointer.x
          const dy = y - pointer.y
          const distance = Math.hypot(dx, dy)
          const influence = interacting ? Math.max(0, 1 - distance / interactionRadius) : 0
          const push = influence * influence * 105
          const targetX = distance > 0 ? dx / distance * push : 0
          const targetY = distance > 0 ? dy / distance * push : 0
          // Ease back into place instead of snapping when the cursor moves away.
          point.offsetX += (targetX - point.offsetX) * following
          point.offsetY += (targetY - point.offsetY) * following
          if (!positions[i]) positions[i] = { x: 0, y: 0, influence: 0 }
          positions[i].x = x + point.offsetX
          positions[i].y = y + point.offsetY
          positions[i].influence = influence
        }

        // ── Draw dots — batch normal and highlighted into two paths ───
        context.beginPath()
        for (let i = 0; i < points.length; i++) {
          const p = positions[i]
          if (p.influence > 0.45) continue
          const r = 1.5 + p.influence * 2
          context.moveTo(p.x + r, p.y)
          context.arc(p.x, p.y, r, 0, TWO_PI)
        }
        context.fillStyle = `rgba(${color}, 0.42)`
        context.fill()

        // Highlighted dots (near cursor).
        context.beginPath()
        for (let i = 0; i < points.length; i++) {
          const p = positions[i]
          if (p.influence <= 0.45) continue
          const r = 1.5 + p.influence * 2
          context.moveTo(p.x + r, p.y)
          context.arc(p.x, p.y, r, 0, TWO_PI)
        }
        context.fillStyle = `rgba(${gold}, 0.92)`
        context.fill()

        // ── Draw connection lines — spatial grid lookup ───
        // Group lines into 4 opacity buckets to minimise strokeStyle changes.
        buildGrid(positions)
        const buckets = [[], [], [], []]
        const bucketAlphas = [0.04, 0.08, 0.13, 0.2]

        for (let i = 0; i < points.length; i++) {
          const p = positions[i]
          const col = Math.min(gridCols - 1, Math.max(0, (p.x / CONNECTION_DIST) | 0))
          const row = Math.min(gridRows - 1, Math.max(0, (p.y / CONNECTION_DIST) | 0))

          // Check current cell and forward-adjacent cells to avoid double-drawing.
          for (let dr = 0; dr <= 1; dr++) {
            const nr = row + dr
            if (nr >= gridRows) continue
            const startDc = dr === 0 ? 0 : -1
            for (let dc = startDc; dc <= 1; dc++) {
              const nc = col + dc
              if (nc < 0 || nc >= gridCols) continue
              const cell = grid[nr * gridCols + nc]
              for (let ci = 0; ci < cell.length; ci++) {
                const j = cell[ci]
                if (j <= i) continue
                const other = positions[j]
                const ddx = p.x - other.x
                const ddy = p.y - other.y
                const dist = Math.sqrt(ddx * ddx + ddy * ddy)
                if (dist < CONNECTION_DIST) {
                  const alpha = (1 - dist / CONNECTION_DIST) * (0.2 + p.influence * 0.3)
                  const bucket = alpha < 0.06 ? 0 : alpha < 0.1 ? 1 : alpha < 0.15 ? 2 : 3
                  buckets[bucket].push(p.x, p.y, other.x, other.y)
                }
              }
            }
          }
        }

        for (let b = 0; b < 4; b++) {
          const lines = buckets[b]
          if (lines.length === 0) continue
          context.beginPath()
          for (let k = 0; k < lines.length; k += 4) {
            context.moveTo(lines[k], lines[k + 1])
            context.lineTo(lines[k + 2], lines[k + 3])
          }
          context.strokeStyle = `rgba(${color}, ${bucketAlphas[b]})`
          context.stroke()
        }

        // Limit cursor connections so the background stays clear around text.
        if (interacting) {
          let closest = []
          for (let i = 0; i < points.length; i++) {
            const p = positions[i]
            const dist = Math.hypot(p.x - glow.x, p.y - glow.y)
            if (dist < interactionRadius) {
              closest.push({ x: p.x, y: p.y, distance: dist })
            }
          }
          closest.sort((a, b) => a.distance - b.distance)
          if (closest.length > 7) closest.length = 7

          context.beginPath()
          for (let i = 0; i < closest.length; i++) {
            context.moveTo(closest[i].x, closest[i].y)
            context.lineTo(glow.x, glow.y)
          }
          context.strokeStyle = `rgba(${color}, ${0.35 * glow.opacity})`
          context.stroke()
        }
      }

      const resize = () => {
        width = canvas.clientWidth
        height = canvas.clientHeight
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
        canvas.width = width * ratio
        canvas.height = height * ratio
        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        const count = width < 600 ? 24 : Math.min(112, Math.max(72, Math.round(width * height / 14000)))
        points = Array.from({ length: count }, (_, index) => ({
          x: ((index * 0.6180339) % 1) * width,
          y: ((index * 0.4142136) % 1) * height,
          phase: index * 1.7,
          offsetX: 0,
          offsetY: 0,
        }))
        positions = new Array(count)
        draw()
      }
      const themeRoot = canvas.closest('.scheme-dark, .scheme-light')
      const updateColor = () => {
        color = themeRoot?.classList.contains('dark') ? '167, 192, 145' : '76, 107, 72'
        gold = themeRoot?.classList.contains('dark') ? '215, 185, 119' : '156, 116, 45'
        draw()
      }
      const onPointerMove = (event) => {
        if (!finePointer.matches || event.pointerType === 'touch') return
        if (!pointer.active) {
          glow.x = glow.trailX = event.clientX
          glow.y = glow.trailY = event.clientY
        }
        pointer.x = event.clientX
        pointer.y = event.clientY
        pointer.active = true
      }
      const resetPointer = () => { pointer.active = false }
      const tick = (time, deltaTime) => {
        animationTime = time
        draw(time, Math.min(deltaTime, 40) / (1000 / 60))
      }
      const onVisibility = () => {
        gsap.ticker.remove(tick)
        if (document.hidden) { resetPointer(); glow.opacity = 0 }
        if (conditions.moving && !document.hidden) gsap.ticker.add(tick)
      }

      const resizeObserver = new ResizeObserver(resize)
      const themeObserver = new MutationObserver(updateColor)
      resizeObserver.observe(canvas)
      if (themeRoot) themeObserver.observe(themeRoot, { attributes: true, attributeFilter: ['class'] })
      updateColor()
      resize()
      onVisibility()
      if (conditions.moving) window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.addEventListener('pointerleave', resetPointer)
      window.addEventListener('blur', resetPointer)
      document.addEventListener('visibilitychange', onVisibility)
      return () => {
        gsap.ticker.remove(tick)
        resizeObserver.disconnect()
        themeObserver.disconnect()
        window.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerleave', resetPointer)
        window.removeEventListener('blur', resetPointer)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    })
    return () => media.revert()
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 h-dvh w-full opacity-95" />
}
