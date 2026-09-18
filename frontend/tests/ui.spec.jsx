import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Chat from '../src/pages/Chat.jsx'
import ResearchTools from '../src/components/ResearchTools.jsx'
import EscalationModal from '../src/components/EscalationModal.jsx'
import VoiceInputButton from '../src/components/VoiceInputButton.jsx'
import useChat from '../src/hooks/useChat.js'
import { escalateToHuman, queryKnowledge, researchApi, transcribeAudio } from '../src/lib/api.js'

vi.mock('../src/lib/api.js', async (original) => ({
  ...await original(),
  researchApi: Object.fromEntries(['languages', 'health', 'search', 'query', 'historical', 'route', 'document', 'info', 'rags', 'register'].map((name) => [name, vi.fn()])),
  queryKnowledge: vi.fn(), escalateToHuman: vi.fn(), transcribeAudio: vi.fn(),
}))
vi.mock('../src/components/InteractiveBackground.jsx', () => ({ default: () => null }))
vi.mock('../src/components/ChatWelcome.jsx', () => ({ default: () => <p>Welcome</p> }))

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  HTMLElement.prototype.scrollTo = vi.fn()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  researchApi.languages.mockResolvedValue({ languages: [{ code: 'en', name: 'English' }, { code: 'ta', name: 'Tamil' }], bhashini_enabled: true })
  researchApi.health.mockResolvedValue({ status: 'healthy', total_chunks: 12, domains_indexed: ['PATENT'], categories_indexed: ['patents_act'] })
  researchApi.info.mockResolvedValue({ service: 'IP-SAKTI', version: '1' })
  researchApi.rags.mockResolvedValue([])
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('the chat page loads backend languages, answers a query and preserves its review context after selectors change', async () => {
  const user = userEvent.setup()
  queryKnowledge.mockResolvedValue({ content: 'Integrated answer', citations: [], language: 'ta' })
  escalateToHuman.mockResolvedValue({ case_id: 'IPF-INTEGRATED', status: 'queued_for_human_review' })
  render(<MemoryRouter><Chat /></MemoryRouter>)
  await screen.findByRole('option', { name: 'Tamil' })
  await user.selectOptions(screen.getByRole('combobox', { name: 'Response language' }), 'ta')
  await user.click(screen.getByRole('button', { name: 'International', exact: true }))
  await user.type(screen.getByRole('textbox', { name: 'Message', exact: true }), 'What is TKDL?')
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  await screen.findByText('Integrated answer')
  expect(queryKnowledge.mock.calls[0][0]).toMatchObject({ query: 'What is TKDL?', language: 'ta', jurisdiction: 'international' })
  await user.selectOptions(screen.getByRole('combobox', { name: 'Response language' }), 'en')
  await user.click(screen.getByRole('button', { name: 'India', exact: true }))
  await user.click(screen.getByRole('button', { name: /Escalate to Human IP Facilitator/ }))
  await user.click(screen.getByRole('button', { name: 'Send to facilitator' }))
  await screen.findByText('IPF-INTEGRATED')
  expect(escalateToHuman.mock.calls[0][0]).toMatchObject({ query: 'What is TKDL?', jurisdiction: 'international', language: 'ta' })
  expect(localStorage.getItem('ip-sakti-chats-v1')).toContain('IPF-INTEGRATED')
})

test('routing preview shows backend intent and targets', async () => {
  const user = userEvent.setup()
  researchApi.route.mockResolvedValue({ intent: 'hybrid', target_rags: ['rag1', 'rag2'], primary_rag: 'rag1', confidence: 0.9, explanation: 'Both sources are relevant.' })
  render(<ResearchTools jurisdiction="india" language="en" onClose={vi.fn()} onRegistered={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Routing preview' }))
  await user.type(screen.getByLabelText('Question'), 'Ayurveda patent')
  await user.click(screen.getByRole('button', { name: 'Preview routing' }))
  await screen.findByText('Both sources are relevant.')
  expect(researchApi.route.mock.calls[0][0]).toBe('Ayurveda patent')
  expect(screen.getByText('Targets: rag1, rag2')).toBeTruthy()
})

test('service registration submits only on request and refreshes available chat sources', async () => {
  const user = userEvent.setup()
  const onRegistered = vi.fn()
  researchApi.register.mockResolvedValue({ message: 'Service connected' })
  render(<ResearchTools jurisdiction="india" language="en" onClose={vi.fn()} onRegistered={onRegistered} />)
  await user.click(screen.getByRole('button', { name: 'Services' }))
  await screen.findByText('Ayurveda & IP knowledge')
  expect(researchApi.register).not.toHaveBeenCalled()
  await user.click(screen.getByText('Connect an external RAG service'))
  await user.type(screen.getByLabelText('Service ID'), 'remote')
  await user.type(screen.getByLabelText('Display name'), 'Remote evidence')
  await user.type(screen.getByLabelText('Service URL'), 'https://example.com')
  await user.selectOptions(screen.getByLabelText('Role'), 'prior_art')
  await user.click(screen.getByRole('button', { name: 'Register service' }))
  await screen.findByText('Service connected')
  expect(researchApi.register.mock.calls[0][0]).toMatchObject({ rag_id: 'remote', name: 'Remote evidence', endpoint_url: 'https://example.com', role: 'prior_art' })
  expect(onRegistered).toHaveBeenCalledTimes(1)
})

test('research failures are visible and allow retry', async () => {
  const user = userEvent.setup()
  researchApi.search.mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValueOnce({ results: [] })
  render(<ResearchTools jurisdiction="india" language="en" onClose={vi.fn()} onRegistered={vi.fn()} />)
  await user.type(screen.getByLabelText('Search terms'), 'patents')
  await user.click(screen.getByRole('button', { name: 'Run search' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Service unavailable')
  await user.click(screen.getByRole('button', { name: 'Run search' }))
  await screen.findByText(/No matching evidence found/)
  expect(screen.queryByRole('alert')).toBe(null)
})

test('evidence search submits filters, renders results and loads legal document provenance', async () => {
  const user = userEvent.setup()
  researchApi.search.mockResolvedValue({ results: [{ title: 'Patent evidence', document_id: 'DOC', chunk_id: 'C1', text: 'A retrieved passage', source_url: 'https://example.com', score: 0.7 }], total_hits: 1 })
  researchApi.document.mockResolvedValue({ title: 'Original document', jurisdiction: 'INDIA', total_chunks: 7, sample_chunk: { text: 'Document sample' } })
  render(<ResearchTools jurisdiction="india" language="en" onClose={vi.fn()} onRegistered={vi.fn()} />)
  await user.type(screen.getByLabelText('Search terms'), 'traditional knowledge')
  await user.selectOptions(screen.getByLabelText('Search method'), 'bm25')
  await user.selectOptions(screen.getByLabelText('Domain'), 'PATENT')
  await user.click(screen.getByRole('button', { name: 'Run search' }))
  await screen.findByText('Patent evidence', { exact: false })
  expect(researchApi.search.mock.calls[0][0]).toBe('legal')
  expect(researchApi.search.mock.calls[0][1]).toMatchObject({ query: 'traditional knowledge', mode: 'bm25', domain: 'PATENT', jurisdiction: 'INDIA' })
  await user.click(screen.getByText('Patent evidence', { exact: false }))
  await user.click(screen.getByRole('button', { name: 'Document details' }))
  await screen.findByText('Original document')
  expect(researchApi.document.mock.calls[0][0]).toBe('DOC')
})

test('history requires a date and sends the historical contract', async () => {
  const user = userEvent.setup()
  researchApi.historical.mockResolvedValue({ requested_date: '2015-01-01', explanation: 'Historical result', evidence: [] })
  render(<ResearchTools jurisdiction="international" language="ta" onClose={vi.fn()} onRegistered={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Legal history' }))
  await user.type(screen.getByLabelText('Question'), 'patents')
  fireEvent.change(screen.getByLabelText('Historical date'), { target: { value: '2015-01-01' } })
  await user.click(screen.getByRole('button', { name: 'Look up legal history' }))
  await screen.findByText('Historical result')
  expect(researchApi.historical.mock.calls[0][0]).toMatchObject({ query: 'patents', requested_date: '2015-01-01', top_k: 5 })
})

test('source query carries language, jurisdiction, category and date', async () => {
  const user = userEvent.setup()
  researchApi.query.mockResolvedValue({ answer_context: 'Source context', evidence: [], conflict_detected: true, conflict_details: 'Qualification for review' })
  render(<ResearchTools jurisdiction="international" language="ta" onClose={vi.fn()} onRegistered={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Source query' }))
  await user.type(screen.getByLabelText('Question'), 'TRIPS')
  await user.selectOptions(screen.getByLabelText('Legal category'), 'patents_act')
  fireEvent.change(screen.getByLabelText('As of date (optional)'), { target: { value: '2020-01-01' } })
  await user.click(screen.getByRole('button', { name: 'Run search' }))
  await screen.findByText('Source context')
  expect(researchApi.query.mock.calls[0][1]).toMatchObject({ language: 'ta', jurisdiction: 'INTERNATIONAL', categories: ['patents_act'], as_of_date: '2020-01-01' })
  expect(screen.getByText(/Qualification for review/)).toBeTruthy()
})

test('research cancellation aborts the request and suppresses late results', async () => {
  const user = userEvent.setup()
  let resolve
  researchApi.search.mockReturnValue(new Promise((done) => { resolve = done }))
  render(<ResearchTools jurisdiction="india" language="en" onClose={vi.fn()} onRegistered={vi.fn()} />)
  await user.type(screen.getByLabelText('Search terms'), 'query')
  await user.click(screen.getByRole('button', { name: 'Run search' }))
  const signal = researchApi.search.mock.calls[0][2]
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(signal.aborted).toBe(true)
  await act(async () => resolve({ results: [{ title: 'Stale result' }] }))
  expect(screen.queryByText('Stale result')).toBe(null)
})

test('human review uses original message context and saves the case once', async () => {
  const user = userEvent.setup()
  const onCreated = vi.fn()
  const message = { query: 'Original question', content: 'Original answer', jurisdiction: 'international', language: 'ta', confidence: { score: 0.7 }, citations: [] }
  escalateToHuman.mockResolvedValue({ case_id: 'IPF-TEST', status: 'queued_for_human_review' })
  render(<EscalationModal message={message} jurisdiction="india" language="en" onCreated={onCreated} onClose={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Send to facilitator' }))
  await screen.findByText('IPF-TEST')
  expect(escalateToHuman.mock.calls[0][0]).toMatchObject({ jurisdiction: 'international', language: 'ta', query: 'Original question', answer: 'Original answer' })
  expect(onCreated).toHaveBeenCalledTimes(1)
})

test('chat retry preserves settings and cancellation cannot overwrite a newer chat', async () => {
  const { result } = renderHook(() => useChat())
  queryKnowledge.mockRejectedValueOnce(new Error('offline'))
  act(() => result.current.setQueryOptions({ targetRags: ['remote'], topK: 7 }))
  act(() => result.current.setLanguage('ta'))
  act(() => result.current.sendMessage('Question'))
  await waitFor(() => expect(result.current.messages[1].status).toBe('error'))
  act(() => result.current.setQueryOptions({ targetRags: [], topK: 4 }))
  let resolve
  queryKnowledge.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  act(() => result.current.retryMessage(result.current.messages[1]))
  expect(queryKnowledge.mock.calls[1][0]).toMatchObject({ targetRags: ['remote'], topK: 7, language: 'ta' })
  const signal = queryKnowledge.mock.calls[1][0].signal
  act(() => result.current.newChat())
  expect(signal.aborted).toBe(true)
  await act(async () => resolve({ content: 'Late answer' }))
  expect(result.current.messages).toEqual([])
  expect(result.current.chats[0].messages[1].content).not.toBe('Late answer')
})

test('deleting a chat requires confirmation, clears its draft and persists after reopening the page', async () => {
  const user = userEvent.setup()
  queryKnowledge.mockResolvedValue({ content: 'Saved answer', citations: [] })
  const view = render(<MemoryRouter><Chat /></MemoryRouter>)
  await user.type(screen.getByRole('textbox', { name: 'Message', exact: true }), 'Saved conversation')
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  await screen.findByText('Saved answer')
  await user.type(screen.getByRole('textbox', { name: 'Message', exact: true }), 'Unsent draft')
  const savedHistory = localStorage.getItem('ip-sakti-chats-v1')

  await user.click(screen.getByRole('button', { name: 'Open sidebar' }))
  await user.click(screen.getByRole('button', { name: 'Delete chat: Saved conversation' }))
  const confirmation = await screen.findByRole('dialog', { name: 'Delete chat', exact: true })
  await user.click(within(confirmation).getByRole('button', { name: 'Cancel', exact: true }))
  expect(screen.queryByRole('dialog', { name: 'Delete chat', exact: true })).toBe(null)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete chat: Saved conversation' }))
  expect(localStorage.getItem('ip-sakti-chats-v1')).toBe(savedHistory)
  expect(screen.getByRole('textbox', { name: 'Message', exact: true }).value).toBe('Unsent draft')
  expect(screen.getByText('Saved answer')).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Delete chat: Saved conversation' }))
  fireEvent(await screen.findByRole('dialog', { name: 'Delete chat', exact: true }), new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog', { name: 'Delete chat', exact: true })).toBe(null)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete chat: Saved conversation' }))
  expect(localStorage.getItem('ip-sakti-chats-v1')).toBe(savedHistory)
  expect(screen.getByRole('textbox', { name: 'Message', exact: true }).value).toBe('Unsent draft')

  await user.click(screen.getByRole('button', { name: 'Delete chat: Saved conversation' }))
  await user.click(within(await screen.findByRole('dialog', { name: 'Delete chat', exact: true })).getByRole('button', { name: 'Delete chat', exact: true }))
  await screen.findByText('Welcome')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New Query', exact: true }))
  expect(screen.getByRole('textbox', { name: 'Message', exact: true }).value).toBe('')
  expect(screen.queryByText('Saved answer')).toBe(null)
  expect(JSON.parse(localStorage.getItem('ip-sakti-chats-v1'))).toEqual({ activeChatId: null, chats: [] })

  view.unmount()
  render(<MemoryRouter><Chat /></MemoryRouter>)
  await screen.findByText('Welcome')
  await user.click(screen.getByRole('button', { name: 'Open sidebar' }))
  expect(screen.getByText('No chats yet.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Saved conversation', exact: true })).toBe(null)
})

test('deleting an active pending chat aborts it and a late answer cannot restore it or disrupt a new chat', async () => {
  let resolveDeleted
  let resolveNext
  queryKnowledge
    .mockReturnValueOnce(new Promise((resolve) => { resolveDeleted = resolve }))
    .mockReturnValueOnce(new Promise((resolve) => { resolveNext = resolve }))
  const { result } = renderHook(() => useChat())
  act(() => { result.current.sendMessage('Delete this pending question') })
  const deletedId = result.current.activeChatId
  const deletedSignal = queryKnowledge.mock.calls[0][0].signal

  act(() => result.current.deleteChat(deletedId))
  expect(deletedSignal.aborted).toBe(true)
  expect(result.current.activeChatId).toBe(null)
  expect(result.current.messages).toEqual([])
  expect(result.current.chats).toEqual([])
  expect(result.current.isGenerating).toBe(false)
  expect(JSON.parse(localStorage.getItem('ip-sakti-chats-v1'))).toEqual({ activeChatId: null, chats: [] })

  act(() => { expect(result.current.sendMessage('New question')).toBe(true) })
  const nextId = result.current.activeChatId
  const nextSignal = queryKnowledge.mock.calls[1][0].signal
  await act(async () => resolveDeleted({ content: 'Deleted late answer' }))
  expect(result.current.activeChatId).toBe(nextId)
  expect(result.current.chats.map((chat) => chat.id)).toEqual([nextId])
  expect(nextId).not.toBe(deletedId)
  expect(nextSignal.aborted).toBe(false)
  expect(result.current.isGenerating).toBe(true)
  expect(result.current.messages[1].status).toBe('loading')

  await act(async () => resolveNext({ content: 'New answer' }))
  expect(result.current.messages[1]).toMatchObject({ content: 'New answer', status: 'complete' })
  expect(localStorage.getItem('ip-sakti-chats-v1')).not.toContain('Deleted late answer')
  expect(result.current.isGenerating).toBe(false)
})

test('deleting an inactive chat preserves the active pending request and its messages', async () => {
  queryKnowledge.mockResolvedValueOnce({ content: 'Older answer' })
  const { result } = renderHook(() => useChat())
  act(() => { result.current.sendMessage('Older question') })
  await waitFor(() => expect(result.current.isGenerating).toBe(false))
  const olderId = result.current.activeChatId
  act(() => result.current.newChat())

  let resolveActive
  queryKnowledge.mockReturnValueOnce(new Promise((resolve) => { resolveActive = resolve }))
  act(() => { result.current.sendMessage('Active question') })
  const activeId = result.current.activeChatId
  const activeMessages = result.current.messages
  const activeSignal = queryKnowledge.mock.calls[1][0].signal

  act(() => result.current.deleteChat(olderId))
  expect(activeSignal.aborted).toBe(false)
  expect(result.current.activeChatId).toBe(activeId)
  expect(result.current.messages).toEqual(activeMessages)
  expect(result.current.isGenerating).toBe(true)
  expect(result.current.chats.map((chat) => chat.id)).toEqual([activeId])
  expect(JSON.parse(localStorage.getItem('ip-sakti-chats-v1')).chats.map((chat) => chat.id)).toEqual([activeId])

  await act(async () => resolveActive({ content: 'Active answer' }))
  expect(result.current.messages[1]).toMatchObject({ content: 'Active answer', status: 'complete' })
  expect(result.current.activeChatId).toBe(activeId)
  expect(result.current.isGenerating).toBe(false)
})

test('voice releases late microphone access on unmount without transcribing', async () => {
  const user = userEvent.setup()
  let resolve
  const stop = vi.fn()
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(() => new Promise((done) => { resolve = done })) } })
  vi.stubGlobal('MediaRecorder', class {})
  const view = render(<VoiceInputButton onTranscript={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Dictate with voice' }))
  view.unmount()
  await act(async () => resolve({ getTracks: () => [{ stop }] }))
  expect(stop).toHaveBeenCalledTimes(1)
  expect(transcribeAudio).not.toHaveBeenCalled()
})
