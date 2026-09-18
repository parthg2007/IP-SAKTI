import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import Icon from './LandingIcon.jsx'
import logo from '../assets/landing-logo.webp'

const starters = [
  { icon: 'grid', label: 'Classify an idea', text: 'What kind of IP could be relevant to my Ayurvedic product?' },
  { icon: 'balance', label: 'Check ABS', text: 'What should I consider when sourcing a medicinal plant?' },
  { icon: 'search', label: 'Search prior art', text: 'How do I begin a prior-art search for a herbal formulation?' },
]

export default function ChatWelcome({ onPromptSelect }) {
  const welcomeRef = useRef(null)

  useEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-welcome-part]', { y: 22, opacity: 0, duration: 0.75, stagger: 0.1, ease: 'power3.out' })
    }, welcomeRef)
    return () => media.revert()
  }, [])

  return (
    <section ref={welcomeRef} aria-label="Suggested questions" className="chat-welcome">
      <div data-welcome-part className="mb-8 text-center">
        <div className="mb-5 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[var(--lp-accent)]/10 blur-xl scale-150" aria-hidden="true" />
            <img src={logo} alt="" className="relative size-12 rounded-full bg-[#F7F4ED] object-contain p-1 shadow-lg ring-1 ring-[var(--lp-line)]" />
          </div>
        </div>
        <h1 className="chat-welcome-heading">What would you like to research?</h1>
      </div>

      <div data-welcome-part className="chat-starters">
        {starters.map((starter) => (
          <button
            key={starter.label}
            type="button"
            onClick={() => onPromptSelect(starter.text)}
            className="chat-starter"
          >
            <span className="text-[var(--lp-accent)]">
              <Icon name={starter.icon} className="size-[18px]" />
            </span>
            <span>{starter.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
