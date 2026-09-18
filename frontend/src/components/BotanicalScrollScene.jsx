import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createScrollSequence } from './scrollSequence.js'
import manifest from '../assets/botanical/manifest.json'

gsap.registerPlugin(ScrollTrigger)

const assetPath = `${import.meta.env.BASE_URL}animations/botanical/`
const stages = [
  { title: 'Knowledge', description: 'Rooted in generations of living knowledge.' },
  { title: 'Innovation', description: 'A new perspective on what nature makes possible.' },
  { title: 'Guidance', description: 'Distil your questions into a clearer direction.' },
  { title: 'Protection', description: 'Carry your ideas forward with care.' },
]

export default function BotanicalScrollScene() {
  const sceneRef = useRef(null)
  const canvasRef = useRef(null)
  const backgroundRef = useRef(null)

  useEffect(() => {
    const media = gsap.matchMedia()
    media.add({ motion: '(prefers-reduced-motion: no-preference)', tall: '(min-height: 500px)' }, ({ conditions }) => {
      if (!conditions.motion) return
      const scene = sceneRef.current
      const sequence = createScrollSequence(canvasRef.current, manifest, assetPath, backgroundRef.current)
      if (!sequence) return

      const playhead = { frame: 0 }
      const progress = scene.querySelector('[data-scroll-progress]')
      const labels = [...scene.querySelectorAll('[data-stage-label]')]
      const descriptions = [...scene.querySelectorAll('[data-stage-description]')]
      let previousStage = -1

      const render = () => {
        sequence.render(playhead.frame)
        const fraction = playhead.frame / (manifest.frames - 1)
        gsap.set(progress, { scaleX: fraction })
        // Match the reference: capsule, tilted capsule, drop, mortar and pestle.
        const stage = fraction < 0.17 ? 0 : fraction < 0.36 ? 1 : fraction < 0.6 ? 2 : 3
        if (stage === previousStage) return
        previousStage = stage
        labels.forEach((label, index) => {
          label.dataset.active = String(index === stage)
        })
        descriptions.forEach((description, index) => {
          description.hidden = index !== stage
        })
      }

      const animation = gsap.to(playhead, {
        frame: manifest.frames - 1,
        ease: 'none',
        onUpdate: render,
        scrollTrigger: {
          trigger: scene,
          start: () => conditions.tall ? 'top top' : 'top bottom',
          end: () => conditions.tall ? `+=${Math.max(window.innerHeight * 2.6, 1800)}` : 'bottom top',
          pin: conditions.tall,
          pinSpacing: true,
          scrub: 0.35,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          refreshPriority: 1,
        },
      })
      render()
      // The pin adds space before the landing page's section reveal triggers.
      const refresh = requestAnimationFrame(() => ScrollTrigger.refresh())

      return () => {
        cancelAnimationFrame(refresh)
        animation.scrollTrigger?.kill()
        animation.kill()
        sequence.dispose()
        labels.forEach((label, index) => { label.dataset.active = String(index === 0) })
        descriptions.forEach((description, index) => { description.hidden = index !== 0 })
      }
    }, sceneRef)
    return () => media.revert()
  }, [])

  return (
    <div ref={sceneRef} className="relative w-full">
      <figure data-hero-visual className="relative h-svh min-h-[480px] w-full overflow-hidden bg-[#0D2117]">
        <div aria-hidden="true" className="pointer-events-none absolute -inset-16 opacity-60 blur-3xl">
          <img src={`${assetPath}poster.webp`} alt="" className="absolute inset-0 size-full object-cover" />
          <canvas ref={backgroundRef} className="absolute inset-0 size-full object-cover opacity-0 data-[ready=true]:opacity-100" />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#08170E]/35" />

        <div data-parallax className="absolute inset-x-0 top-8 bottom-[220px] flex items-center justify-center sm:top-10 sm:bottom-[200px]">
          <div className="relative aspect-8/7 w-full max-w-[calc((max(480px,100svh)-260px)*8/7)] [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent),linear-gradient(to_bottom,transparent,black_8%,black_88%,transparent)] [mask-composite:intersect]">
            <img src={`${assetPath}poster.webp`} alt="A botanical glass capsule transforms into a golden drop, then a mortar and pestle as you scroll." width={manifest.width} height={manifest.height} fetchPriority="high" className="absolute inset-0 size-full object-contain" />
            <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full object-contain opacity-0 data-[ready=true]:opacity-100" style={{ willChange: 'transform' }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-[#0D2117] to-transparent" />
          </div>
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-[var(--lp-bg)] to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-linear-to-t from-[#0A1B11] via-[#0A1B11]/80 to-transparent" />

        <figcaption className="absolute inset-x-0 bottom-0 mx-auto max-w-[1400px] px-6 pt-6 pb-8 text-[#EFF1E5] sm:px-10 lg:px-16">
          <div className="mb-4 flex items-center justify-between gap-4 text-xs tracking-[0.17em] text-[#B6C3A7] uppercase">
            <span>A living legacy</span>
            <span className="flex items-center gap-2 motion-reduce:hidden">Scroll to explore <span aria-hidden="true">↓</span></span>
          </div>
          <div className="relative mb-4 h-px bg-[#A8BC89]/20 motion-reduce:hidden">
            <div data-scroll-progress className="absolute inset-0 origin-left scale-x-0 bg-[#D7B977]" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs sm:text-base">
            {stages.map((stage, index) => (
              <span key={stage.title} data-stage-label data-active={index === 0} className="text-[#93A58B] transition-colors duration-300 data-[active=true]:text-[#E1C589] motion-reduce:transition-none">
                <span className="mb-1 block text-[10px] opacity-65">0{index + 1}</span>
                {stage.title}
              </span>
            ))}
          </div>
          <div className="mt-4 min-h-10 font-['Source_Sans_3',sans-serif] text-base leading-5 text-[#C3CCB8]">
            {stages.map((stage, index) => <p key={stage.title} data-stage-description hidden={index !== 0}>{stage.description}</p>)}
          </div>
        </figcaption>
      </figure>
    </div>
  )
}
