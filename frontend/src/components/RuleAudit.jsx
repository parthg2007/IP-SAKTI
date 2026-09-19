import { safeSourceUrl } from '../lib/api.js'

export function RuleSources({ sources = [] }) {
  return <ul className="mt-2 space-y-2 text-xs" aria-label="Rule sources">
    {sources.map((source) => {
      const url = safeSourceUrl(source.source_url)
      return <li key={source.source_id}>
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline">{source.title}</a> : <span>{source.title}</span>}
        <span className="block text-[var(--lp-muted)]">{source.source_id} · Version {source.version || 'unknown'} · Effective date {source.effective_from || 'unknown'}</span>
        <span className="block text-[var(--lp-muted)]">{source.note}</span>
      </li>
    })}
  </ul>
}

export default function RuleAudit({ audit }) {
  if (!audit) return null
  const matches = audit.evaluation?.matches || []
  const questions = [...new Set([
    ...(audit.presentation?.human_verification_items || []),
    ...matches.flatMap((match) => match.human_verification_items || []),
    ...(audit.verification_items || []).map((item) => item.note),
  ])]
  return <section className="space-y-3 rounded-xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-3" aria-label="Rule evidence and verification">
    <p className="font-medium">Human verification required</p>
    <p className="text-xs text-[var(--lp-muted)]">{audit.scope_note}</p>
    <p className="text-xs text-[var(--lp-muted)]">Evidence freshness: {audit.evaluation?.evidence_freshness?.status?.replaceAll('_', ' ') || 'unknown'}. {audit.evaluation?.evidence_freshness?.note}</p>
    <p className="text-xs text-[var(--lp-muted)]">{audit.evaluation?.mode === 'legacy_compatibility' ? 'Legacy keyword matches; effective dates and legal applicability are unresolved.' : `Rules selected for ${audit.evaluation?.as_of}. Check verification status before relying on a result.`}</p>
    <ul className="space-y-1 text-xs" aria-label="Matched rules">
      {matches.map((match) => <li key={`${match.rule_id}:${match.version}`}>{match.rule_id} · {match.version} · {match.temporal_status?.replaceAll('_', ' ')} · {match.determination_ready ? 'Reviewed rule match' : 'Review required'}</li>)}
    </ul>
    <div className="space-y-2 text-xs" aria-label="Separate evidence categories">
      <p>Traditional-knowledge evidence: {audit.evidence_groups?.traditional_knowledge?.length || 0} retrieved items. This does not establish patent prior art.</p>
      <p>Patent prior-art evidence: {audit.evidence_groups?.patent_prior_art?.length || 0} retrieved items. Absence of evidence does not establish novelty.</p>
      <p>Legal/regulatory evidence: {audit.evidence_groups?.legal_regulatory?.length || 0} retrieved items. Rule source references below are separate from retrieved evidence.</p>
      {!!audit.evidence_groups?.unclassified?.length && <p>Other domain evidence awaiting classification: {audit.evidence_groups.unclassified.length} items.</p>}
    </div>
    <RuleSources sources={Object.values(audit.sources || {})} />
    <div>
      <p className="text-xs font-medium">Items requiring human verification</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">{questions.map((question) => <li key={question}>{question}</li>)}</ul>
    </div>
    <p className="text-xs text-[var(--lp-muted)]">{audit.disclaimer}</p>
  </section>
}
