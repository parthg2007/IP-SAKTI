import axios from 'axios'

export function safeSourceUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

export function mapCitations(items = []) {
  return items.map((item, index) => item && typeof item.title === 'string' ? ({
    ...item,
    id: `${item.rag_source || ''}:${item.chunk_id || index}`,
    ref: `S${index + 1}`,
    title: item.title,
    sourceName: item.source_name,
    url: safeSourceUrl(item.source_url),
    excerpt: item.text,
    score: typeof item.score === 'number' ? item.score : null,
  }) : null).filter(Boolean)
}

export function createChatApi(baseURL = '') {
  const client = axios.create({ baseURL: baseURL.replace(/\/+$/, ''), timeout: 120_000 })

  return async function queryKnowledge({ query, jurisdiction = 'india', language = 'en', targetRags, topK = 4, signal }) {
    try {
      const { data } = await client.post('/api/v1/orchestrator/query', {
        query: query.trim(),
        jurisdiction: jurisdiction.toUpperCase(),
        language,
        top_k_per_rag: topK,
        ...(targetRags?.length ? { target_rags: targetRags } : {}),
      }, { signal })

      if (!data || typeof data.synthesized_answer !== 'string' || !data.synthesized_answer.trim()
        || !Array.isArray(data.citations) || !Array.isArray(data.connected_rags_responded)) {
        throw new Error('The server returned an unreadable answer. Please try again.')
      }
      if (!data.connected_rags_responded.length) {
        throw new Error('The knowledge service is unavailable. Please try again shortly.')
      }

        return {
        content: data.synthesized_answer,
        citations: mapCitations(data.citations),
        confidence: data.confidence || null,
        disclaimer: typeof data.legal_disclaimer === 'string' ? data.legal_disclaimer : '',
        language: data.language || language,
        graph: data.graph || null,
        agentic_reasoning: data.agentic_reasoning || null,
        routeDecision: data.route_decision || null,
        respondedRags: data.connected_rags_responded,
        domainContext: data.domain_context || null,
        legalContext: data.legal_evidence_context || null,
      }
    } catch (error) {
      if (axios.isCancel(error) || signal?.aborted) throw error
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new Error('The answer took too long. Please try again with a shorter question.', { cause: error })
      }
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 422) {
          throw new Error('Please enter a question of 1–4,000 characters and select a jurisdiction.', { cause: error })
        }
        if (error.response?.status === 429) {
          throw new Error('The service is busy. Please wait a moment, then try again.', { cause: error })
        }
        throw new Error(error.response
          ? 'The server could not answer your question. Please try again shortly.'
          : 'Unable to reach the backend. Check that it is running and try again.', { cause: error })
      }
      throw error
    }
  }
}

export async function escalateToHuman({ baseURL = import.meta.env?.VITE_API_BASE_URL || '', query, jurisdiction, language, answer, confidence, citations, userNote }) {
  const client = axios.create({ baseURL: baseURL.replace(/\/+$/, ''), timeout: 30_000 })
  const { data } = await client.post('/api/v1/human/escalate', {
    query,
    jurisdiction: jurisdiction.toUpperCase(),
    language,
    answer,
    confidence,
    user_note: userNote || undefined,
    citations: citations.map((item) => ({
      document_id: item.document_id || item.documentId || '',
      chunk_id: item.chunk_id || item.id?.split(':').slice(1).join(':') || item.id || '',
      title: item.title,
      source_name: item.source_name || item.sourceName || '',
      source_url: safeSourceUrl(item.source_url || item.url),
      text: item.excerpt || null,
      domain: item.domain || null,
      score: item.score,
      authority_tier: item.authority_tier || null,
      rag_source: item.rag_source || 'RAG',
      ...Object.fromEntries(['record_id', 'version', 'effective_from', 'effective_to', 'evidence_category', 'evidence_freshness', 'verification_status', 'verification_items', 'source_refs']
        .filter((key) => item[key] !== undefined).map((key) => [key, item[key]])),
    })),
  })
  return data
}

export const queryKnowledge = createChatApi(import.meta.env?.VITE_API_BASE_URL || '')

export async function transcribeAudio({ audioBlob, language = '', signal, baseURL = import.meta.env?.VITE_API_BASE_URL || '' }) {
  const client = axios.create({ baseURL: baseURL.replace(/\/+$/, ''), timeout: 75_000 })
  const formData = new FormData()
  const extension = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : audioBlob.type.includes('wav') ? 'wav' : 'webm'
  formData.append('file', audioBlob, `recording.${extension}`)
  if (language && language !== 'auto') {
    formData.append('language', language)
  }
  const { data } = await client.post('/api/v1/voice/transcribe', formData, {
    signal,
  })
  return data
}

export function apiError(error) {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'The request timed out. Please try again.'
  const detail = error.response?.data?.detail
  if (Array.isArray(detail)) return detail.map((item) => `${item.loc?.slice(1).join('.') || 'Request'}: ${item.msg}`).join('; ')
  if (error.response?.status === 409 && typeof detail === 'string') return detail
  if (error.response?.status === 422 && typeof detail === 'string') return detail
  if (error.response?.status === 404) return 'The requested document or service was not found.'
  if (error.response?.status === 503) return 'This service is currently unavailable. Please try again shortly.'
  if (error.response) return 'The server could not complete the request. Please try again.'
  return error.message === 'Network Error' ? 'Unable to reach the backend. Check your connection and try again.' : error.message || 'Unable to complete the request.'
}

export function createResearchApi(baseURL = '') {
  const client = axios.create({ baseURL: baseURL.replace(/\/+$/, ''), timeout: 120_000 })
  async function request(method, url, data, signal, params) {
    try {
      const response = await client.request({ method, url, data, signal, params })
      if (!response.data || typeof response.data !== 'object') throw new Error('The server returned an unreadable response. Please try again.')
      return response.data
    } catch (error) {
      if (axios.isCancel(error) || signal?.aborted) throw error
      throw new Error(apiError(error), { cause: error })
    }
  }
  return {
    info: (signal) => request('get', '/api/info', undefined, signal),
    languages: (signal) => request('get', '/api/v1/languages', undefined, signal),
    rags: (signal) => request('get', '/api/v1/orchestrator/rags', undefined, signal),
    health: (corpus, signal) => request('get', `/api/v1/rag/${corpus}/health`, undefined, signal),
    search: (corpus, payload, signal) => request('post', `/api/v1/rag/${corpus}/search`, payload, signal),
    query: (corpus, payload, signal) => request('post', `/api/v1/rag/${corpus}/query`, payload, signal),
    historical: (payload, signal) => request('post', '/api/v1/rag/legal/historical', payload, signal),
    document: (id, signal) => request('get', `/api/v1/rag/legal/documents/${encodeURIComponent(id)}`, undefined, signal),
    route: (query, signal) => request('post', '/api/v1/orchestrator/route', undefined, signal, { query: query.trim() }),
    register: (payload) => request('post', '/api/v1/orchestrator/rags/register', payload),
  }
}

export const researchApi = createResearchApi(import.meta.env?.VITE_API_BASE_URL || '')
