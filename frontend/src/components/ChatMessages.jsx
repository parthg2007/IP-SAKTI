import { useEffect, useRef, useState } from 'react'
import Icon from './LandingIcon.jsx'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { safeSourceUrl } from '../lib/api.js'
import ConfidenceBadge from './ConfidenceBadge.jsx'
import AgenticReasoningCard from './AgenticReasoningCard.jsx'
import EvidenceList from './EvidenceList.jsx'

const emptyMessages = []

const markdownComponents = {
  a: ({ href, children }) => {
    const url = safeSourceUrl(href)
    return url ? <a href={url} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>
  },
  img: ({ alt }) => <span>{alt}</span>,
}

export default function ChatMessages({ messages = emptyMessages, isGenerating = false, citationsLoading = false, emptyState, onRetry, onEscalate }) {
  const scrollRef = useRef(null)
  const followLatestRef = useRef(true)
  const firstRenderRef = useRef(true)
  const [speakingId, setSpeakingId] = useState(null)
  const utteranceRef = useRef(null)
  const isEmpty = messages.length === 0 && !isGenerating && !citationsLoading

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const toggleSpeech = (id, text, language) => {
    if (!('speechSynthesis' in window)) return
    if (speakingId === id) {
      window.speechSynthesis.cancel()
      utteranceRef.current = null
      setSpeakingId(null)
      return
    }
    window.speechSynthesis.cancel()
    const cleanText = text
      .replace(/###\s+/g, '')
      .replace(/\[S\d+\]/g, '')
      .replace(/[*_`#]/g, '')
      .trim()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = 1.0
    utterance.lang = language === 'hi-Latn' ? 'hi-IN' : language || 'en'
    utteranceRef.current = utterance
    utterance.onend = () => { if (utteranceRef.current === utterance) setSpeakingId(null) }
    utterance.onerror = () => { if (utteranceRef.current === utterance) setSpeakingId(null) }
    setSpeakingId(id)
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    const container = scrollRef.current
    if (isEmpty) {
      followLatestRef.current = true
      firstRenderRef.current = true
      return
    }
    if (followLatestRef.current) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      container.scrollTo({
        top: container.scrollHeight,
        behavior: firstRenderRef.current || reduceMotion ? 'instant' : 'smooth',
      })
    }
    firstRenderRef.current = false
  }, [messages, isGenerating, citationsLoading, isEmpty])

  return (
    <div
      ref={scrollRef}
      className="chat-messages-scroll"
      onScroll={() => {
        if (isEmpty) return
        const container = scrollRef.current
        followLatestRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 96
      }}
    >
      {isEmpty ? emptyState : (
      <div className="chat-message-list" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
        {messages.filter((message) => message.status !== 'loading').map((message) => (
          <article key={message.id} className={`chat-message-row motion-safe:animate-message-in ${message.role === 'user' ? 'chat-message-row-user' : ''}`}>
            <div className={`chat-message-card ${message.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="chat-message-author">
                  {message.role === 'user' ? 'You' : 'IP-SAKTI'}{message.jurisdiction && ` · ${message.jurisdiction === 'international' ? 'International' : 'India'}`}
                </p>
                {message.role !== 'user' && message.status !== 'error' && message.content && 'speechSynthesis' in window && (
                  <button
                    type="button"
                    onClick={() => toggleSpeech(message.id, message.content, message.language)}
                    aria-label={speakingId === message.id ? 'Stop reading aloud' : 'Read answer aloud'}
                    title={speakingId === message.id ? 'Stop reading aloud' : 'Read answer aloud'}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      speakingId === message.id
                        ? 'border border-[var(--lp-accent)] bg-[var(--lp-accent)]/20 text-[var(--lp-accent)]'
                        : 'border border-[var(--lp-line)] text-[var(--lp-muted)] hover:border-[var(--lp-accent)] hover:text-[var(--lp-ink)]'
                    }`}
                  >
                    {speakingId === message.id ? (
                      <>
                        <span className="size-1.5 rounded-full bg-[var(--lp-accent)] animate-ping" />
                        Stop audio
                      </>
                    ) : (
                      <>
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        </svg>
                        Listen
                      </>
                    )}
                  </button>
                )}
              </div>
              {message.role === 'user' || message.status === 'error' ? (
                <p role={message.status === 'error' ? 'alert' : undefined} className="chat-message-text whitespace-pre-wrap wrap-anywhere">{message.content}</p>
              ) : (
                <div dir="auto" className="chat-answer chat-message-text wrap-anywhere"><Markdown skipHtml remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.content}</Markdown></div>
              )}
              {message.status === 'error' && message.query && <button type="button" onClick={() => onRetry?.(message)} disabled={isGenerating} className="mt-3 cursor-pointer rounded-full border border-[var(--lp-strong-line)] px-4 py-2 text-sm text-[var(--lp-accent)] disabled:cursor-not-allowed disabled:opacity-40">Retry answer</button>}
              {message.citations?.length > 0 && <EvidenceList items={message.citations} />}
              {message.routeDecision && <details className="mt-4 text-xs leading-6 text-[var(--lp-muted)]">
                <summary className="cursor-pointer">Answer provenance ? {message.respondedRags?.length || 0} responding sources</summary>
                <p>{message.routeDecision.explanation}</p>
                <p>Intent: {message.routeDecision.intent}</p>
                <p>Responded: {message.respondedRags?.join(', ')}</p>
                {message.routeDecision.target_rags?.some((id) => !message.respondedRags?.includes(id)) && <p role="status">Some selected sources did not respond. This answer uses the available sources.</p>}
                {message.domainContext && <details><summary>Domain evidence context</summary><p className="whitespace-pre-wrap">{message.domainContext}</p></details>}
                {message.legalContext && <details><summary>Legal evidence context</summary><p className="whitespace-pre-wrap">{message.legalContext}</p></details>}
              </details>}

              {/* Confidence Indicator */}
              {message.confidence && <ConfidenceBadge confidence={message.confidence} />}

              {/* Agentic Reasoning & Knowledge Graph Subgraph */}
              {(message.agentic_reasoning || message.graph) && (
                <AgenticReasoningCard reasoning={message.agentic_reasoning} graph={message.graph} />
              )}

              {/* Always-accessible Human Facilitator Escalation Path */}
              {message.role !== 'user' && onEscalate && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--lp-line)] pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--lp-muted)]">
                    <Icon name="shield" className="size-3.5 text-[var(--lp-gold)]" />
                    <span>Need specialized statutory review?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEscalate(message)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      message.confidence?.escalation_recommended
                        ? 'border border-[var(--lp-gold)] bg-[var(--lp-gold)]/15 text-[var(--lp-gold)] hover:bg-[var(--lp-gold)]/25 shadow-xs'
                        : 'border border-[var(--lp-line)] bg-[var(--lp-surface)] text-[var(--lp-ink)] hover:border-[var(--lp-accent)] hover:text-[var(--lp-accent)]'
                    } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent)]`}
                  >
                    <span>{message.escalation ? `Review case ${message.escalation.case_id}` : 'Escalate to Human IP Facilitator'}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}

              {message.disclaimer && <p className="mt-3 border-t border-[var(--lp-line)] pt-2 text-xs leading-relaxed text-[var(--lp-muted)]">{message.disclaimer}</p>}
            </div>
          </article>
        ))}
        {isGenerating && (
          <div role="status" className="chat-message-card chat-message-assistant motion-safe:animate-message-in">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="size-2 rounded-full bg-[var(--lp-gold)] motion-safe:animate-[bounce_1.2s_infinite]" />
                <span className="size-2 rounded-full bg-[var(--lp-gold)] motion-safe:animate-[bounce_1.2s_150ms_infinite]" />
                <span className="size-2 rounded-full bg-[var(--lp-gold)] motion-safe:animate-[bounce_1.2s_300ms_infinite]" />
              </span>
              <span className="font-['Source_Sans_3',sans-serif] text-sm text-[var(--lp-muted)]">Preparing your answer…</span>
            </div>
          </div>
        )}
        {citationsLoading && (
          <div role="status" className="space-y-2 motion-safe:animate-message-in">
            <span className="font-['Source_Sans_3',sans-serif] text-sm text-[var(--lp-muted)]">Loading sources…</span>
            <div className="flex flex-wrap gap-2" aria-hidden="true">
              {[0, 1, 2].map((item) => (
                <div key={item} className="relative h-8 w-32 overflow-hidden rounded-lg border border-[var(--lp-gold)]/40 bg-[var(--lp-surface)]">
                  <span className="absolute inset-0 bg-linear-to-r from-transparent via-[var(--lp-accent)]/15 to-transparent motion-safe:animate-citation-shimmer motion-reduce:hidden" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
