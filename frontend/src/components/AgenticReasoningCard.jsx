import { useState } from 'react'
import Icon from './LandingIcon.jsx'
import RuleAudit from './RuleAudit.jsx'

export default function AgenticReasoningCard({ reasoning, graph }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!reasoning && !graph) return null

  const steps = reasoning?.reasoning_steps || []
  const statutoryChecks = reasoning?.statutory_checks || []
  const actionPlan = reasoning?.action_plan || []
  const nodes = graph?.nodes || []
  const edges = graph?.edges || []
  const reasoningPaths = graph?.reasoning_paths || []

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)]/80 text-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition hover:bg-[var(--lp-surface)] focus-visible:outline-2 focus-visible:outline-[var(--lp-accent)]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-medium text-[var(--lp-ink)]">
            <span className="size-2 rounded-full bg-[var(--lp-accent)] animate-pulse" />
            Agentic Reasoning & Knowledge Graph
          </span>
          {reasoning?.intent && (
            <span className="rounded-full border border-[var(--lp-gold)]/50 bg-[var(--lp-card)] px-2.5 py-0.5 text-[11px] text-[var(--lp-gold)] font-medium">
              {reasoning.intent}
            </span>
          )}
          {nodes.length > 0 && (
            <span className="text-[11px] text-[var(--lp-muted)]">
              · {nodes.length} legal entities mapped
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-[var(--lp-muted)]">
          <span>{isOpen ? 'Collapse' : 'Inspect trace'}</span>
          <Icon name="arrow" className={`size-3.5 transition-transform duration-200 ${isOpen ? '-rotate-90' : 'rotate-90'}`} />
        </div>
      </button>
      {reasoning?.audit && <p className="px-4 pb-3 text-xs text-[var(--lp-gold)]">Decision support · Human verification required · Evidence currency unverified</p>}

      {isOpen && (
        <div className="border-t border-[var(--lp-line)] px-4 py-4 space-y-5 bg-[var(--lp-card)]/60">
          {/* Section 1: Step-by-Step Agentic Reasoning Trace */}
          {steps.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--lp-gold)]">
                Reasoning & Synthesis Trace
              </h4>
              <ol className="mt-3 space-y-2.5 border-l-2 border-[var(--lp-line)] pl-3">
                {steps.map((st) => (
                  <li key={st.step} className="relative">
                    <span className="absolute -left-[19px] top-1 size-2 rounded-full bg-[var(--lp-accent)]" />
                    <p className="text-xs font-semibold text-[var(--lp-ink)]">
                      {st.step}. {st.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--lp-muted)] leading-relaxed">
                      {st.summary}
                    </p>
                    {st.details && <p className="mt-1 text-xs text-[var(--lp-muted)]">{st.details}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Section 2: Statutory Barrier Checks */}
          {statutoryChecks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--lp-gold)]">
                Statutory Compliance & Legal Rule Checks
              </h4>
              <div className="mt-2.5 grid gap-2">
                {statutoryChecks.map((sc, idx) => (
                  <div key={idx} className="rounded-xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-xs text-[var(--lp-ink)]">{sc.rule}</span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        sc.status === 'MANDATORY_PREREQUISITE'
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : sc.status === 'APPLICABLE_BARRIER'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          : 'bg-[var(--lp-accent)]/20 text-[var(--lp-accent)]'
                      }`}>
                        {reasoning?.audit ? 'Needs human verification' : (sc.status || 'REVIEW').replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--lp-muted)] leading-relaxed">{sc.finding}</p>
                    {sc.mitigation && (
                      <p className="mt-1 text-[11px] text-[var(--lp-gold)] font-medium">
                        💡 Compliance step: {sc.mitigation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Relational Knowledge Graph Entities & Paths */}
          {nodes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--lp-gold)]">
                Relational Knowledge Graph Nodes
              </h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {nodes.map((node) => (
                  <span
                    key={node.id}
                    title={node.audit ? `Unverified legacy statement. ${node.audit.human_verification_items.join(' ')}` : node.description}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--lp-line)] bg-[var(--lp-surface)] px-2.5 py-1 text-xs text-[var(--lp-ink)] hover:border-[var(--lp-accent)]"
                  >
                    <span className={`size-1.5 rounded-full ${
                      node.category === 'Biological Resource' ? 'bg-emerald-500' :
                      node.category === 'Statutory Bar' ? 'bg-rose-500' :
                      node.category === 'Regulatory Authority' ? 'bg-amber-500' :
                      node.category === 'Compliance Filing' ? 'bg-cyan-500' : 'bg-[var(--lp-accent)]'
                    }`} />
                    {node.label}{node.audit && ' · Review required'}
                  </span>
                ))}
              </div>

              {reasoningPaths.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] text-[var(--lp-muted)] font-medium">Active Relational Paths:</p>
                  {reasoningPaths.map((path, pidx) => (
                    <div key={pidx} className="rounded-lg bg-[var(--lp-surface)] px-3 py-1.5 text-xs font-mono text-[var(--lp-ink)] border border-[var(--lp-line)]">
                      {path}
                    </div>
                  ))}
                </div>
              )}
              {edges.length > 0 && <ul className="mt-3 space-y-2 text-xs text-[var(--lp-muted)]" aria-label="Knowledge graph relationships">
                {edges.map((edge, index) => <li key={index}>{nodes.find((node) => node.id === edge.source)?.label || edge.source} → {nodes.find((node) => node.id === edge.target)?.label || edge.target}<span className="block">{edge.audit ? edge.audit.human_verification_items.join(' ') : edge.label || edge.relation}</span></li>)}
              </ul>}
            </div>
          )}

          {/* Section 4: Action Checklist */}
          {actionPlan.length > 0 && (
            <div className="rounded-xl border border-[var(--lp-line)] bg-[var(--lp-surface)]/60 p-3">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lp-muted)]">
                Recommended Procedural Next Steps
              </h5>
              <ul className="mt-2 space-y-1">
                {actionPlan.map((action, aidx) => (
                  <li key={aidx} className="flex items-start gap-2 text-xs text-[var(--lp-ink)]">
                    <span className="text-[var(--lp-accent)] font-bold">✓</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <RuleAudit audit={reasoning?.audit} />
        </div>
      )}
    </div>
  )
}
