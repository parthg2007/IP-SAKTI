import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import InteractiveBackground from '../components/InteractiveBackground.jsx'
import BotanicalScrollScene from '../components/BotanicalScrollScene.jsx'
import Icon from '../components/LandingIcon.jsx'
import logo from '../assets/landing-logo.webp'

gsap.registerPlugin(ScrollTrigger)

const features = [
  { icon: 'book', title: 'Answers with a foundation.', text: 'Trace guidance back to its source. Understand the reasoning, then explore the reference.' },
  { icon: 'globe', title: 'Context before conclusions.', text: 'Indian and international perspectives, with jurisdiction at the heart of your question.' },
  { icon: 'shield', title: 'Tradition, treated with care.', text: 'An approach that respects traditional knowledge and the communities behind it.' },
]

const toolkits = [
  { id: 'classify', icon: 'grid', title: 'Find your IP direction', short: 'IP classification', text: 'A formulation, a brand, a process. Different ideas call for different questions. Start by understanding where yours fits.', question: 'What kind of IP should I explore for my Ayurvedic product?', items: ['Describe your innovation', 'Explore relevant IP categories', 'Understand what to investigate next'], label: 'Turn an idea into a clearer starting point.' },
  { id: 'abs', icon: 'balance', title: 'Understand benefit sharing', short: 'Access & benefit sharing', text: 'Working with biological resources or associated knowledge? Explore the questions around access, responsibilities, and benefit sharing.', question: 'What should I consider when sourcing a medicinal plant?', items: ['Identify the resource and intended use', 'Add location and access context', 'Explore source-backed considerations'], label: 'Keep the people behind the knowledge in view.' },
  { id: 'prior-art', icon: 'search', title: 'Look before you leap', short: 'Prior-art exploration', text: 'Put your research in context. Explore existing knowledge and references before deciding what to investigate further.', question: 'How can I begin a prior-art search for a herbal formulation?', items: ['Frame the research question', 'Explore existing knowledge', 'Follow references for deeper research'], label: 'Build on knowledge. Understand what came before.' },
]

const faqs = [
  ['Who is IP-SAKTI for?', 'AYUSH startups, researchers, practitioners, MSMEs, cultivators, and IP facilitators exploring intellectual property and regulatory questions in Ayurveda.'],
  ['What can I ask about?', 'Start with questions about IP categories, prior-art research, access and benefit sharing, or regulatory considerations. Add details about your idea and choose the relevant jurisdiction in the chat.'],
  ['How are answers grounded?', 'IP-SAKTI is being built around retrieval from a curated knowledge base. The intended experience connects answers to supporting citations and makes gaps or uncertainty clear.'],
  ['Does this replace professional legal advice?', 'No. IP-SAKTI supports research and understanding. Decisions about applications, compliance, or rights should be reviewed with a qualified professional using current, applicable sources.'],
]

export default function Landing() {
  const pageRef = useRef(null)
  const [activeTool, setActiveTool] = useState(0)
  const toolkit = toolkits[activeTool]

  useEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro.from('[data-hero-line]', { yPercent: 110, rotate: 2, duration: 1.15, stagger: 0.13 })
        .from('[data-hero-copy]', { opacity: 0, y: 20, duration: 0.7, stagger: 0.12 }, '-=0.65')
        .from('[data-hero-visual]', { opacity: 0, duration: 1.1 }, 0.25)
      // Use ScrollTrigger.batch — one IntersectionObserver for all reveals
      // instead of N independent ScrollTrigger instances.
      gsap.set('[data-reveal]', { opacity: 0, y: 32 })
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 91%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.85, ease: 'power2.out', stagger: 0.08 }),
      })
      return undefined
    }, pageRef)
    media.add('(prefers-reduced-motion: no-preference) and (pointer: fine)', () => {
      const hero = pageRef.current.querySelector('[data-hero-visual]')
      const visual = pageRef.current.querySelector('[data-parallax]')
      const moveX = gsap.quickTo(visual, 'x', { duration: 1.2, ease: 'power3.out' })
      const moveY = gsap.quickTo(visual, 'y', { duration: 1.2, ease: 'power3.out' })
      const onMove = (event) => {
        const bounds = hero.getBoundingClientRect()
        moveX((event.clientX - bounds.left - bounds.width / 2) * 0.015)
        moveY((event.clientY - bounds.top - bounds.height / 2) * 0.015)
      }
      const reset = () => { moveX(0); moveY(0) }
      hero.addEventListener('pointermove', onMove)
      hero.addEventListener('pointerleave', reset)
      return () => { hero.removeEventListener('pointermove', onMove); hero.removeEventListener('pointerleave', reset) }
    }, pageRef)
    return () => media.revert()
  }, [])

  // Keep ScrollTrigger's measured positions in sync with content that
  // finishes loading AFTER the effect above already ran a scrollTrigger
  // calculation: web fonts, the logo, and anything BotanicalScrollScene
  // loads. Locally these are already cached by the browser, so layout is
  // stable the instant GSAP measures it. On a fresh production visit they
  // load over the network and can take a second or more, so the page
  // reflows after ScrollTrigger has already recorded "top 91%" for each
  // [data-reveal] element — which makes reveals fire late or need extra
  // scrolling. Re-measuring once fonts/images actually finish fixes that.
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh()

    document.fonts?.ready?.then(refresh)

    if (document.readyState === 'complete') {
      refresh()
    } else {
      window.addEventListener('load', refresh)
    }

    const images = Array.from(pageRef.current?.querySelectorAll('img') ?? [])
    const pending = images.filter((img) => !img.complete)
    pending.forEach((img) => img.addEventListener('load', refresh))

    return () => {
      window.removeEventListener('load', refresh)
      pending.forEach((img) => img.removeEventListener('load', refresh))
    }
  }, [])

  useEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-tool-content]', { opacity: 0, y: 12, duration: 0.35, ease: 'power2.out' })
    }, pageRef)
    return () => media.revert()
  }, [activeTool])

  return (
    <div ref={pageRef} className="relative isolate overflow-x-clip bg-[var(--lp-bg)] font-['Inter',sans-serif] text-[var(--lp-ink)]">
      <InteractiveBackground />
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-[var(--lp-card)] p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>
      <header className="relative z-10 mx-auto flex h-24 max-w-[1400px] items-center justify-between gap-6 border-b border-[var(--lp-line)] px-6 pr-20 sm:px-10 sm:pr-24 lg:px-16 lg:pr-28">
        <a href="#" aria-label="IP-SAKTI home" className="flex items-center gap-2.5">
          <img src={logo} alt="" fetchPriority="high" className="size-10 rounded-full bg-[#F7F4ED] object-contain p-0.5" />
          <span className="font-['Merriweather',serif] text-xl font-bold tracking-[-0.04em]">IP-SAKTI<span className="text-[var(--lp-gold)]">.</span></span>
        </a>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm text-[var(--lp-muted)] md:flex">
          <a className="transition-colors hover:text-[var(--lp-ink)]" href="#approach">Our approach</a>
          <a className="transition-colors hover:text-[var(--lp-ink)]" href="#toolkit">The toolkit</a>
          <a className="transition-colors hover:text-[var(--lp-ink)]" href="#faqs">FAQs</a>
          <Link
            to="/chat"
            className="group inline-flex items-center gap-2 rounded-full border border-[var(--lp-accent)]/50 bg-[#24543C] px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-sm transition-all duration-200 hover:bg-[#32683B] hover:shadow-md dark:bg-[#C1D1AA] dark:text-[#17251A] dark:hover:bg-[#D1DDBC] motion-safe:hover:scale-105"
          >
            <span className="size-2 rounded-full bg-[var(--lp-gold)] animate-pulse" />
            Console
            <Icon name="diagonal" className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </nav>
        <span className="hidden items-center gap-2 text-xs tracking-[0.12em] text-[var(--lp-muted)] uppercase lg:flex"><span className="size-1.5 rounded-full bg-[var(--lp-accent)]" />Made for AYUSH</span>
      </header>

      <main id="main-content" className="relative z-0">
        <section data-hero className="relative mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-12 px-6 pt-12 pb-16 sm:gap-16 sm:px-10 sm:pt-16 lg:px-16 lg:pt-20 lg:pb-20">
          <div className="relative z-10 mx-auto w-full max-w-[800px] text-center">
            <p data-hero-copy className="mb-7 flex items-center justify-center gap-3 text-xs font-medium tracking-[0.18em] text-[var(--lp-gold)] uppercase sm:text-[13px]"><span className="h-px w-8 shrink-0 bg-current" />Ancient knowledge. New possibilities.</p>
            <h1 className="font-['Merriweather',serif] text-[clamp(3.25rem,6.6vw,6.1rem)] leading-[1.12] font-normal tracking-[-0.065em]">
              <span className="block overflow-hidden pb-1"><span data-hero-line className="block">Your ideas.</span></span>
              <span className="block overflow-hidden pb-1"><span data-hero-line className="block">Your roots.</span></span>
              <span className="block overflow-hidden pb-3"><span data-hero-line className="block italic text-[var(--lp-accent)]">Your rights.</span></span>
            </h1>
            <p data-hero-copy className="mx-auto mt-5 max-w-[560px] font-['Source_Sans_3',sans-serif] text-lg leading-relaxed text-[var(--lp-muted)] sm:text-xl">Your AI research companion for Ayurveda’s intellectual property and regulations. Ask with confidence. Explore with context.</p>
            <div data-hero-copy className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/chat" className="group inline-flex min-h-14 items-center gap-7 rounded-full bg-[#24543C] px-6 text-sm font-medium text-white transition-[background-color,transform] hover:bg-[#32683B] motion-safe:hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--lp-accent)] dark:bg-[#C1D1AA] dark:text-[#17251A] dark:hover:bg-[#D1DDBC]">Start a conversation<Icon name="diagonal" className="transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" /></Link>
              <a href="https://drive.google.com/file/d/1U2kTTLO3JBzJeYy2bjDIGslqulwMyJdd/view?usp=drivesdk" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center gap-2.5 rounded-full border border-[var(--lp-line)] px-5 text-sm text-[var(--lp-ink)] transition-colors hover:bg-[var(--lp-card)]"><Icon name="play" className="size-4" />Watch walkthrough</a>
            </div>
            <p data-hero-copy className="mt-6 flex items-center justify-center gap-2 font-['Source_Sans_3',sans-serif] text-sm text-[var(--lp-muted)]"><Icon name="shield" className="size-4 text-[var(--lp-accent)]" />Built for thoughtful, source-grounded exploration.</p>
          </div>

        </section>

        <BotanicalScrollScene />

        <div className="relative border-y border-[var(--lp-line)] bg-[var(--lp-surface)]/70">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-8 gap-y-5 px-6 py-7 text-sm sm:px-10 lg:px-16">
            <span className="text-xs tracking-[0.15em] text-[var(--lp-muted)] uppercase">For the people moving Ayurveda forward</span>
            {['Startups', 'Researchers', 'Practitioners', 'Cultivators', 'IP facilitators'].map((item) => <span key={item} className="font-['Merriweather',serif] text-[15px]">{item}</span>)}
          </div>
        </div>

        <section id="approach" className="mx-auto max-w-[1400px] scroll-mt-8 px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
          <div data-reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
            <div><p className="mb-5 text-xs tracking-[0.2em] text-[var(--lp-gold)] uppercase">01 — A little clarity goes a long way</p><h2 className="max-w-[600px] font-['Merriweather',serif] text-4xl leading-[1.2] font-normal tracking-[-0.045em] sm:text-5xl">Complex questions.<br /><span className="italic text-[var(--lp-accent)]">Grounded conversations.</span></h2></div>
            <p className="max-w-[410px] font-['Source_Sans_3',sans-serif] text-lg leading-relaxed text-[var(--lp-muted)] lg:ml-auto">Great ideas deserve more than a maze of documents. IP-SAKTI brings the right questions, useful context, and supporting knowledge into one conversation.</p>
          </div>
          <div className="mt-14 grid border-t border-[var(--lp-line)] md:grid-cols-3">
            {features.map((feature, index) => <article data-reveal key={feature.title} className="py-9 md:pr-8 md:not-first:border-l md:not-first:border-[var(--lp-line)] md:not-first:pl-8"><div className="mb-9 flex items-center justify-between"><Icon name={feature.icon} className="size-7 text-[var(--lp-accent)]" /><span className="text-xs text-[var(--lp-muted)]">0{index + 1}</span></div><h3 className="font-['Merriweather',serif] text-xl tracking-[-0.025em]">{feature.title}</h3><p className="mt-4 font-['Source_Sans_3',sans-serif] text-lg leading-relaxed text-[var(--lp-muted)]">{feature.text}</p></article>)}
          </div>
        </section>

        <section id="toolkit" className="relative scroll-mt-8 border-y border-[var(--lp-line)] bg-[var(--lp-surface)]/80">
          <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-16 lg:py-28">
            <div data-reveal className="mb-12 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-5 text-xs tracking-[0.2em] text-[var(--lp-gold)] uppercase">02 — Your research toolkit</p><h2 className="font-['Merriweather',serif] text-4xl font-normal tracking-[-0.045em] sm:text-5xl">One place. <span className="italic text-[var(--lp-accent)]">A clearer perspective.</span></h2></div><span className="flex items-center gap-2 text-xs text-[var(--lp-muted)]"><Icon name="spark" className="size-4" />Explore the tools below</span></div>
            <div data-reveal className="grid gap-8 lg:grid-cols-[0.9fr_1.2fr] lg:gap-16">
              <div>
                <div role="tablist" aria-orientation="vertical" aria-label="Explore IP-SAKTI tools" className="space-y-2">
                  {toolkits.map((tool, index) => <button key={tool.id} id={`tab-${tool.id}`} type="button" role="tab" aria-selected={activeTool === index} aria-controls="tool-preview" tabIndex={activeTool === index ? 0 : -1} onClick={() => setActiveTool(index)} onKeyDown={(event) => {
                    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
                    event.preventDefault()
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + toolkits.length) % toolkits.length
                    setActiveTool(next)
                    document.getElementById(`tab-${toolkits[next].id}`)?.focus()
                  }} className={`group flex w-full cursor-pointer items-center gap-4 rounded-xl border px-5 py-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent)] ${activeTool === index ? 'border-[var(--lp-line)] bg-[var(--lp-card)]' : 'border-transparent hover:bg-[var(--lp-card)]/60'}`}><Icon name={tool.icon} className="text-[var(--lp-accent)]" /><span className="flex-1 text-base">{tool.short}</span><Icon name="arrow" className={`transition-transform ${activeTool === index ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-30'}`} /></button>)}
                </div>
                <p className="mt-7 flex gap-2 px-5 text-sm leading-relaxed text-[var(--lp-muted)]"><Icon name="globe" className="size-4" />Choose India or International when you start a conversation.</p>
              </div>
              <div id="tool-preview" role="tabpanel" aria-labelledby={`tab-${toolkit.id}`} tabIndex={0} className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-card)] p-6 shadow-2xl shadow-black/5 sm:p-9">
                <div className="mb-7 flex items-center justify-between border-b border-[var(--lp-line)] pb-5"><span className="flex items-center gap-2 text-sm"><Icon name="spark" className="size-4 text-[var(--lp-accent)]" />Inside IP-SAKTI</span><span className="rounded-full border border-[var(--lp-line)] px-2.5 py-1 text-xs text-[var(--lp-muted)]">Tool preview</span></div>
                <div data-tool-content key={toolkit.id}>
                  <h3 className="font-['Merriweather',serif] text-2xl tracking-[-0.03em]">{toolkit.title}</h3>
                  <p className="mt-3 font-['Source_Sans_3',sans-serif] text-lg leading-relaxed text-[var(--lp-muted)]">{toolkit.text}</p>
                  <div className="mt-6 rounded-xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-4"><p className="mb-2 text-xs tracking-wider text-[var(--lp-muted)] uppercase">A question to start with</p><p className="font-['Source_Sans_3',sans-serif] text-lg">“{toolkit.question}”</p></div>
                  <ul className="mt-6 space-y-3">{toolkit.items.map((item) => <li key={item} className="flex items-start gap-3 text-sm text-[var(--lp-muted)]"><Icon name="check" className="size-4 text-[var(--lp-accent)]" />{item}</li>)}</ul>
                  <p className="mt-7 border-t border-[var(--lp-line)] pt-5 font-['Merriweather',serif] text-sm leading-relaxed italic text-[var(--lp-accent)]">{toolkit.label}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
          <div data-reveal className="text-center"><p className="mb-5 text-xs tracking-[0.2em] text-[var(--lp-gold)] uppercase">03 — From question to understanding</p><h2 className="font-['Merriweather',serif] text-4xl font-normal tracking-[-0.045em] sm:text-5xl">Start curious. <span className="italic text-[var(--lp-accent)]">Leave clearer.</span></h2></div>
          <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              ['Bring your question', 'Tell us what you’re working on. A formulation, a discovery, a brand, or simply an idea.'],
              ['Give it some context', 'Choose your jurisdiction and share the details that make your question specific.'],
              ['Explore with perspective', 'Read the guidance, follow its references, and identify questions for your next step.'],
            ].map(([title, description], index) => <div data-reveal key={title} className="relative"><div className="mb-7 flex items-center gap-5"><span className="font-['Merriweather',serif] text-5xl font-light italic text-[var(--lp-gold)]">0{index + 1}</span><div className="h-px flex-1 bg-[var(--lp-line)]" /><Icon name="arrow" className="text-[var(--lp-muted)]" /></div><h3 className="font-['Merriweather',serif] text-xl">{title}</h3><p className="mt-4 max-w-[340px] font-['Source_Sans_3',sans-serif] text-lg leading-relaxed text-[var(--lp-muted)]">{description}</p></div>)}
          </div>
        </section>

        <section data-reveal className="mx-auto max-w-[1272px] border-y border-[var(--lp-line)] px-6 py-16 text-center sm:px-10 lg:py-20">
          <Icon name="shield" className="mx-auto mb-6 size-8 text-[var(--lp-gold)]" />
          <p className="mx-auto max-w-[860px] font-['Merriweather',serif] text-3xl leading-[1.5] font-normal tracking-[-0.035em] sm:text-4xl">Knowledge passed down through generations.<br className="hidden sm:block" /> <span className="italic text-[var(--lp-accent)]">Possibilities carried forward by you.</span></p>
          <p className="mt-6 text-xs tracking-[0.2em] text-[var(--lp-muted)] uppercase">Rooted in Ayurveda. Built for what comes next.</p>
        </section>

        <section id="faqs" className="mx-auto grid max-w-[1400px] scroll-mt-8 gap-10 px-6 py-24 sm:px-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24 lg:px-16 lg:py-28">
          <div data-reveal><p className="mb-5 text-xs tracking-[0.2em] text-[var(--lp-gold)] uppercase">A few things, clarified</p><h2 className="font-['Merriweather',serif] text-4xl leading-tight font-normal tracking-[-0.04em] sm:text-5xl">Good questions.<br /><span className="italic text-[var(--lp-accent)]">Clear beginnings.</span></h2></div>
          <div data-reveal className="border-t border-[var(--lp-line)]">{faqs.map(([question, answer]) => <details key={question} className="group border-b border-[var(--lp-line)]"><summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-5 py-5 text-base font-medium [&::-webkit-details-marker]:hidden">{question}<Icon name="plus" className="transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none" /></summary><p className="max-w-[570px] pb-7 pr-8 font-['Source_Sans_3',sans-serif] text-lg leading-relaxed text-[var(--lp-muted)]">{answer}</p></details>)}</div>
        </section>
      </main>

      <footer className="relative border-t border-[var(--lp-line)] bg-[var(--lp-surface)]/80">
        <div className="mx-auto max-w-[1400px] px-6 pt-12 pb-7 sm:px-10 lg:px-16">
          <div className="flex flex-wrap items-start justify-between gap-8"><div><p className="font-['Merriweather',serif] text-2xl font-bold tracking-[-0.04em]">IP-SAKTI<span className="text-[var(--lp-gold)]">.</span></p><p className="mt-3 text-sm text-[var(--lp-muted)]">Ayurveda IP & Regulatory Sahayak</p></div><nav aria-label="Footer navigation" className="flex flex-wrap gap-6 text-sm text-[var(--lp-muted)]"><a href="#approach" className="hover:text-[var(--lp-ink)]">Our approach</a><a href="#toolkit" className="hover:text-[var(--lp-ink)]">The toolkit</a><a href="#faqs" className="hover:text-[var(--lp-ink)]">FAQs</a></nav></div>
          <div className="mt-10 flex flex-wrap justify-between gap-3 border-t border-[var(--lp-line)] pt-6 text-xs leading-relaxed text-[var(--lp-muted)]"><span>© {new Date().getFullYear()} IP-SAKTI. Made with respect for our roots.</span><span>For research and understanding. Not a substitute for professional advice.</span></div>
        </div>
      </footer>
    </div>
  )
}
