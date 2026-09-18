// Keep just the current strip and its two neighbours decoded (about 35 MB).
// Each strip contains ten vertically stacked frames from the reference clip.
// Optimised: rAF-batched draws, throttled load() during rapid scrub, LRU eviction.
export function createScrollSequence(canvas, manifest, baseUrl, backgroundCanvas) {
  const context = canvas.getContext('2d')
  if (!context || typeof createImageBitmap !== 'function') return null
  const backgroundContext = backgroundCanvas?.getContext('2d')

  const cache = new Map()
  const pending = new Map()
  const failed = new Set()
  let disposed = false
  let frame = 0
  let direction = 1
  let lastDrawn = -1
  let rafId = 0
  let loadTimer = 0

  canvas.width = manifest.width
  canvas.height = manifest.height
  if (backgroundContext) {
    backgroundCanvas.width = manifest.width
    backgroundCanvas.height = manifest.height
  }

  const stripFor = (index) => Math.floor(index / manifest.framesPerStrip)
  const wantedStrips = () => {
    const current = stripFor(frame)
    return [current, current + direction, current - direction]
      .filter((index) => index >= 0 && index < manifest.stripCount)
  }

  const draw = () => {
    const bitmap = cache.get(stripFor(frame))
    if (!bitmap || frame === lastDrawn || disposed) return
    context.drawImage(
      bitmap, 0, (frame % manifest.framesPerStrip) * manifest.height,
      manifest.width, manifest.height, 0, 0, canvas.width, canvas.height,
    )
    canvas.dataset.ready = 'true'
    if (backgroundContext) {
      backgroundContext.drawImage(canvas, 0, 0)
      backgroundCanvas.dataset.ready = 'true'
    }
    lastDrawn = frame
  }

  // Batch draws via rAF to avoid multiple canvas paints in the same frame.
  const scheduleDraw = () => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      draw()
    })
  }

  const load = () => {
    if (disposed) return
    const wanted = wantedStrips()
    for (const [index, bitmap] of cache) {
      if (!wanted.includes(index)) {
        bitmap.close()
        cache.delete(index)
      }
    }
    for (const [index, controller] of pending) {
      if (!wanted.includes(index)) controller.abort()
    }

    for (const index of wanted) {
      if (pending.size >= 2) break
      if (cache.has(index) || pending.has(index) || failed.has(index)) continue
      const controller = new AbortController()
      pending.set(index, controller)
      fetch(`${baseUrl}strip-${String(index).padStart(2, '0')}.webp`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error('Unable to load animation frame')
          return response.blob()
        })
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          if (disposed || controller.signal.aborted || !wantedStrips().includes(index)) {
            bitmap.close()
            return
          }
          cache.set(index, bitmap)
          scheduleDraw()
        })
        .catch((error) => {
          if (error.name !== 'AbortError') failed.add(index)
        })
        .finally(() => {
          pending.delete(index)
          load()
        })
    }
  }

  // Throttle load() calls during rapid scrolling to prevent excessive
  // fetch churn — at most one evaluation per 60ms.
  const throttledLoad = () => {
    if (loadTimer) return
    loadTimer = setTimeout(() => {
      loadTimer = 0
      load()
    }, 60)
  }

  return {
    render(nextFrame) {
      const next = Math.max(0, Math.min(manifest.frames - 1, Math.round(nextFrame)))
      if (next !== frame) direction = next > frame ? 1 : -1
      frame = next
      scheduleDraw()
      throttledLoad()
    },
    dispose() {
      disposed = true
      if (rafId) cancelAnimationFrame(rafId)
      clearTimeout(loadTimer)
      pending.forEach((controller) => controller.abort())
      cache.forEach((bitmap) => bitmap.close())
      cache.clear()
      delete canvas.dataset.ready
      context.clearRect(0, 0, canvas.width, canvas.height)
      if (backgroundContext) {
        delete backgroundCanvas.dataset.ready
        backgroundContext.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height)
      }
    },
  }
}
