import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/landing-logo.webp'
import Icon from './LandingIcon.jsx'

const tools = [
  { label: 'Research tools', icon: 'book' },
  { label: 'Classify', icon: 'grid' },
  { label: 'ABS', icon: 'balance' },
  { label: 'Prior Art', icon: 'search' },
]

export default function Sidebar({ onNewQuery, onToolSelect, chats = [], activeChatId, onChatSelect, mobile = false, onClose }) {
  const [desktopCollapsed, setCollapsed] = useState(false)
  const collapsed = !mobile && desktopCollapsed
  const labelClass = collapsed ? 'hidden' : ''
  const navigationId = mobile ? 'mobile-sidebar-navigation' : 'sidebar-navigation'
  const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent)]'
  const rowClass = `group flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl py-3 text-left text-sm transition-[color,background-color,translate] duration-200 motion-safe:hover:translate-x-0.5 motion-reduce:transition-none ${focusClass} ${collapsed ? 'justify-center px-0' : 'px-3'}`

  return (
    <aside className={`relative z-10 flex h-dvh shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-[var(--lp-strong-line)] bg-[var(--lp-sidebar)] pt-6 pb-5 font-['Inter',sans-serif] text-[var(--lp-ink)] transition-[width,padding] duration-300 motion-reduce:transition-none ${collapsed ? 'w-[84px] px-4' : 'w-[280px] max-w-[calc(100vw-40px)] px-5'}`} aria-label="Chat sidebar">
      <div className={`flex shrink-0 items-center ${collapsed ? 'flex-col gap-4' : 'justify-between gap-2'}`}>
        <Link to="/" aria-label="IP-SAKTI home" className={`flex items-center gap-2.5 rounded-lg whitespace-nowrap ${focusClass}`}>
          <img src={logo} alt="" className="size-9 shrink-0 rounded-full bg-[#F7F4ED] object-contain p-0.5" />
          <span className={`${labelClass} font-['Merriweather',serif] text-lg font-bold tracking-[-0.04em]`}>IP-SAKTI<span className="text-[var(--lp-gold)]">.</span></span>
        </Link>
        <button
          className={`grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[var(--lp-strong-line)] text-[var(--lp-muted)] transition-colors hover:bg-[var(--lp-card)]/40 hover:text-[var(--lp-ink)] ${focusClass}`}
          type="button"
          onClick={mobile ? onClose : () => setCollapsed((current) => !current)}
          aria-expanded={mobile ? undefined : !collapsed}
          aria-controls={mobile ? undefined : navigationId}
          aria-label={mobile ? 'Close sidebar' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={mobile ? 'Close sidebar' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={mobile ? 'close' : 'panel'} className={`size-[18px] transition-transform duration-300 motion-reduce:transition-none ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <nav id={navigationId} className="mt-6 shrink-0" aria-label="Chat tools">
        <button type="button" onClick={onNewQuery} aria-label="New Query" title={collapsed ? 'New Query' : undefined} className={`${rowClass} justify-center rounded-full border border-[var(--lp-action)] bg-[var(--lp-action)] font-medium text-[var(--lp-on-action)] hover:brightness-105`}>
          <Icon name="plus" className="size-[18px]" /><span className={labelClass}>New Query</span>
        </button>

        <h2 className={`mt-7 mb-3 px-3 text-sm font-semibold tracking-[0.1em] text-[var(--lp-muted)] uppercase ${collapsed ? 'sr-only' : ''}`}>Tools</h2>
        <div className={`space-y-1 ${collapsed ? 'mt-6' : ''}`}>
          {tools.map(({ label, icon }) => (
            <button key={label} type="button" onClick={() => onToolSelect?.(label)} aria-label={label} title={collapsed ? label : undefined} className={`${rowClass} border-0 hover:bg-[var(--lp-card)]/40`}>
              <Icon name={icon} className="text-[var(--lp-accent)]" />
              <span className={`min-w-0 font-medium ${labelClass}`}>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="mt-6 flex min-h-32 flex-1 flex-col border-t border-[var(--lp-strong-line)] pt-5" role="region" aria-label="Chat history">
        <div className={`mb-4 flex items-center justify-between px-3 ${collapsed ? 'sr-only' : ''}`}>
          <h2 className="text-sm font-semibold tracking-[0.1em] text-[var(--lp-muted)] uppercase">Chats</h2>
          <span className="text-xs tabular-nums text-[var(--lp-muted)]">{chats.length.toString().padStart(2, '0')}</span>
        </div>
        {chats.length > 0 ? (
          <ul className="min-h-0 space-y-1 overflow-y-auto p-1">
            {chats.map((chat) => (
              <li key={chat.id}>
                <button type="button" onClick={() => onChatSelect?.(chat)} aria-label={chat.title || 'Untitled chat'} aria-current={activeChatId === chat.id ? 'page' : undefined} title={chat.title || 'Untitled chat'} className={`${rowClass} border-0 ${activeChatId === chat.id ? 'bg-[var(--lp-card)]/60 text-[var(--lp-accent)]' : 'hover:bg-[var(--lp-card)]/40'}`}>
                  <Icon name="message" className="size-[18px]" /><span className={`min-w-0 truncate ${labelClass}`}>{chat.title || 'Untitled chat'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : collapsed ? (
          <span title="No chats yet" aria-label="No chats yet" className="mx-auto text-[var(--lp-muted)]"><Icon name="message" /></span>
        ) : (
          <div className="mx-2 flex items-center gap-2 rounded-xl border border-dashed border-[var(--lp-strong-line)] p-4 text-[var(--lp-muted)]">
            <Icon name="message" className="size-[18px]" />
            <p className="text-sm">No chats yet.</p>
          </div>
        )}
      </div>

      <footer className="mt-4 shrink-0 border-t border-[var(--lp-strong-line)] pt-4">
        <Link to="/" aria-label="Back to home" title={collapsed ? 'Back to home' : undefined} className={`${rowClass} text-[var(--lp-muted)] hover:text-[var(--lp-ink)]`}><Icon name="back" className="size-4" /><span className={labelClass}>Back to home</span></Link>
      </footer>
    </aside>
  )
}
