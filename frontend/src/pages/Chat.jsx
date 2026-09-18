import { useEffect, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import InputBar from '../components/InputBar.jsx'
import ChatMessages from '../components/ChatMessages.jsx'
import ChatWelcome from '../components/ChatWelcome.jsx'
import ChatAtmosphere from '../components/ChatAtmosphere.jsx'
import Icon from '../components/LandingIcon.jsx'
import logo from '../assets/landing-logo.webp'
import useChat from '../hooks/useChat.js'
import EscalationModal from '../components/EscalationModal.jsx'
import ResearchTools from '../components/ResearchTools.jsx'
import { researchApi } from '../lib/api.js'
import '../components/research.css'
import './chat.css'

const toolPrompts = {
  Classify: 'What kind of IP could be relevant to my Ayurvedic product?',
  ABS: 'What should I consider when sourcing a medicinal plant?',
  'Prior Art': 'How do I begin a prior-art search for a herbal formulation?',
}

const Chat = () => {
  const { messages, isGenerating, chats, activeChatId, jurisdiction, language, setJurisdiction, setLanguage,
    sendMessage, retryMessage, newChat, selectChat, deleteChat, cancelRequest, queryOptions, setQueryOptions, saveEscalation } = useChat()
  const sidebarRef = useRef(null)
  const settingsRef = useRef(null)
  const form = useForm({ defaultValues: { message: '' } })
  const [escalationMessage, setEscalationMessage] = useState(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [inputRevision, setInputRevision] = useState(0)
  const [capabilities, setCapabilities] = useState(null)
  const [rags, setRags] = useState([])
  const [serviceError, setServiceError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    researchApi.languages(controller.signal).then(setCapabilities, () => {})
    researchApi.rags(controller.signal).then((data) => { setRags(data); setServiceError('') }, (error) => { if (!controller.signal.aborted) setServiceError(error.message) })
    return () => controller.abort()
  }, [revision])

  const languages = [
    ['en', 'English'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['gu', 'ગુજરાતી'],
    ['kn', 'ಕನ್ನಡ'], ['ml', 'മലയാളം'], ['mr', 'मराठी'], ['or', 'ଓଡ଼ିଆ'],
    ['pa', 'ਪੰਜਾਬੀ'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['ur', 'اردو'],
  ]

  useEffect(() => {
    const closeSettings = (event) => {
      const settings = settingsRef.current
      if (!settings?.open) return
      if (event.type === 'keydown' && event.key === 'Escape') {
        settings.open = false
        settings.querySelector('summary')?.focus()
      } else if (event.type === 'pointerdown' && !settings.contains(event.target)) {
        settings.open = false
      }
    }
    document.addEventListener('pointerdown', closeSettings)
    document.addEventListener('keydown', closeSettings)
    return () => {
      document.removeEventListener('pointerdown', closeSettings)
      document.removeEventListener('keydown', closeSettings)
    }
  }, [])

  const preparePrompt = (prompt) => {
    sidebarRef.current?.close()
    form.setValue('message', prompt, { shouldDirty: true })
    form.setFocus('message')
  }

  const sidebarProps = {
    chats,
    activeChatId,
    onDeleteChat: (chatId) => {
      deleteChat(chatId)
      if (chatId === activeChatId) {
        form.reset({ message: '' })
        setInputRevision((value) => value + 1)
        setEscalationMessage(null)
      }
    },
    onChatSelect: (chat) => {
      sidebarRef.current?.close()
      selectChat(chat)
      form.reset({ message: '' })
    },
    onNewQuery: () => {
      setInputRevision((value) => value + 1)
      sidebarRef.current?.close()
      form.reset({ message: '' })
      form.setFocus('message')
      newChat()
    },
    onToolSelect: (tool) => {
      if (tool === 'Research tools') { sidebarRef.current?.close(); setToolsOpen(true); return }
      preparePrompt(toolPrompts[tool])
    },
  }

  return (
    <FormProvider {...form}>
      <div className="chat-shell dark scheme-dark">
        <ChatAtmosphere />
        <header className="chat-topbar">
          <Link to="/" aria-label="IP-SAKTI home" className="chat-brand">
            <img src={logo} alt="" />
            <span>IP-SAKTI<span className="chat-brand-dot">.</span></span>
          </Link>
          <div className="chat-topbar-controls">
            <div className="chat-jurisdiction" role="group" aria-label="Jurisdiction">
              {['india', 'international'].map((option) => (
                <button key={option} type="button" aria-pressed={jurisdiction === option} onClick={() => setJurisdiction(option)}>
                  {option === 'india' ? 'India' : 'International'}
                </button>
              ))}
            </div>
            <label className="chat-language">
              <Icon name="globe" />
              <span className="sr-only">Response language</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                {(capabilities?.languages?.map(({ code, name }) => [code, name]) || languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
          </div>
        </header>

        <button type="button" className="chat-drawer-tab" aria-label="Open sidebar" aria-haspopup="dialog" aria-controls="chat-sidebar" onClick={() => sidebarRef.current?.showModal()}>
          <Icon name="panel" /><span>Chats</span>
        </button>
        <dialog
          ref={sidebarRef}
          id="chat-sidebar"
          aria-label="Navigation menu"
          className="chat-sidebar-drawer"
          onClick={(event) => {
            if (event.target === event.currentTarget) sidebarRef.current?.close()
          }}
        >
          <Sidebar {...sidebarProps} mobile onClose={() => sidebarRef.current?.close()} />
        </dialog>

        <main className="chat-workspace" aria-label="Chat">
          <ChatMessages key={activeChatId || 'new'} messages={messages} isGenerating={isGenerating} onRetry={retryMessage} onEscalate={setEscalationMessage} emptyState={<ChatWelcome onPromptSelect={preparePrompt} />} />

          <div className="chat-composer-dock">
              <InputBar key={`${activeChatId || 'new'}:${inputRevision}`} language={language} isGenerating={isGenerating} onStop={cancelRequest} settings={
                <details ref={settingsRef} className="chat-answer-settings">
                  <summary title="Answer settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg><span className="sr-only">Answer settings</span></summary>
                  <div className="chat-settings-panel">
                    <p>Answer settings</p>
                    <fieldset disabled={isGenerating}>
                      <legend className="sr-only">Answer settings</legend>
                      <label>Evidence per source<select aria-label="Evidence per source" value={queryOptions.topK} onChange={(event) => setQueryOptions((current) => ({ ...current, topK: Number(event.target.value) }))}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>
                      <label><input type="checkbox" checked={!queryOptions.targetRags.length} onChange={() => setQueryOptions((current) => ({ ...current, targetRags: [] }))} />Automatic routing</label>
                      {rags.map((rag) => <label key={rag.rag_id}><input type="checkbox" checked={queryOptions.targetRags.includes(rag.rag_id)} onChange={(event) => setQueryOptions((current) => ({ ...current, targetRags: event.target.checked ? [...current.targetRags, rag.rag_id] : current.targetRags.filter((id) => id !== rag.rag_id) }))} />{rag.name}{!rag.is_healthy && ' (unavailable)'}</label>)}
                    </fieldset>
                    {serviceError && <p role="status">{serviceError} <button type="button" onClick={() => setRevision((value) => value + 1)}>Retry status</button></p>}
                  </div>
                </details>
              } onSend={(message) => {
                if (sendMessage(message)) form.reset({ message: '' })
              }} />
              <p className="chat-composer-note">Research guidance, not legal advice.</p>
          </div>
        </main>
      {escalationMessage && <EscalationModal message={escalationMessage} jurisdiction={jurisdiction} language={language} onCreated={(data) => saveEscalation(escalationMessage.id, data)} onClose={() => setEscalationMessage(null)} />}
      {toolsOpen && <ResearchTools jurisdiction={jurisdiction} language={language} onClose={() => setToolsOpen(false)} onRegistered={() => setRevision((value) => value + 1)} />}
      </div>
    </FormProvider>
  )
}

export default Chat
