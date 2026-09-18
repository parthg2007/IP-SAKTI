import { useEffect, useRef, useState } from 'react'
import { queryKnowledge } from '../lib/api.js'
import { readChatHistory, writeChatHistory } from '../lib/chatStorage.js'

function loadHistory() {
  try { return readChatHistory(window.localStorage) } catch { return { chats: [], activeChatId: null } }
}

export default function useChat() {
  const [history, setHistory] = useState(loadHistory)
  const [draftJurisdiction, setDraftJurisdiction] = useState('india')
  const [draftLanguage, setDraftLanguage] = useState('en')
  const [queryOptions, setQueryOptions] = useState({ targetRags: [], topK: 4 })
  const requestRef = useRef(null)
  const activeChat = history.chats.find((chat) => chat.id === history.activeChatId)
  const messages = activeChat?.messages || []
  const jurisdiction = activeChat?.jurisdiction || draftJurisdiction
  const language = activeChat?.language || draftLanguage
  const isGenerating = messages.some((message) => message.status === 'loading')

  useEffect(() => {
    try { writeChatHistory(window.localStorage, history) } catch { /* storage is optional */ }
  }, [history])
  useEffect(() => () => requestRef.current?.controller.abort(), [])

  function updateMessage(chatId, messageId, update) {
    setHistory((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === chatId
      ? { ...chat, messages: chat.messages.map((message) => message.id === messageId ? { ...message, ...update } : message) } : chat) }))
  }

  function cancelRequest() {
    const pending = requestRef.current
    if (!pending) return
    requestRef.current = null
    pending.controller.abort()
    updateMessage(pending.chatId, pending.messageId, { status: 'error', content: 'This answer was stopped. You can retry it.' })
  }

  async function requestAnswer(chatId, messageId, query, context, lang, options = {}) {
    const pending = { chatId, messageId, controller: new AbortController() }
    requestRef.current = pending
    try {
      const answer = await queryKnowledge({ query, jurisdiction: context, language: lang, ...options, signal: pending.controller.signal })
      if (requestRef.current === pending) updateMessage(chatId, messageId, { ...answer, status: 'complete' })
    } catch (error) {
      if (requestRef.current === pending && !pending.controller.signal.aborted) updateMessage(chatId, messageId, { status: 'error', content: error.message || 'Something went wrong. Please try again.' })
    } finally {
      if (requestRef.current === pending) requestRef.current = null
    }
  }

  function sendMessage(value) {
    const query = value.trim()
    if (!query || query.length > 4000 || requestRef.current) return false
    const chatId = activeChat?.id || crypto.randomUUID()
    const messageId = crypto.randomUUID()
    const additions = [
      { id: crypto.randomUUID(), role: 'user', content: query, jurisdiction, language },
      { id: messageId, role: 'assistant', content: '', status: 'loading', query, jurisdiction, language, queryOptions },
    ]
    setHistory((current) => ({
      activeChatId: chatId,
      chats: activeChat
        ? current.chats.map((chat) => chat.id === chatId ? { ...chat, messages: [...chat.messages, ...additions], language } : chat)
        : [{ id: chatId, title: query.slice(0, 64), jurisdiction, language, messages: additions }, ...current.chats],
    }))
    void requestAnswer(chatId, messageId, query, jurisdiction, language, queryOptions)
    return true
  }

  function retryMessage(message) {
    if (requestRef.current || !activeChat || !message.query) return
    updateMessage(activeChat.id, message.id, { status: 'loading', content: '' })
    void requestAnswer(activeChat.id, message.id, message.query, message.jurisdiction, message.language || language, message.queryOptions)
  }

  function newChat() { cancelRequest(); setHistory((current) => ({ ...current, activeChatId: null })) }
  function selectChat(chat) { if (chat.id === history.activeChatId) return; cancelRequest(); setHistory((current) => ({ ...current, activeChatId: chat.id })) }
  function deleteChat(chatId) {
    const pending = requestRef.current
    if (pending?.chatId === chatId) {
      requestRef.current = null
      pending.controller.abort()
    }
    setHistory((current) => ({
      ...current,
      activeChatId: current.activeChatId === chatId ? null : current.activeChatId,
      chats: current.chats.filter((chat) => chat.id !== chatId),
    }))
  }
  function setJurisdiction(value) { setDraftJurisdiction(value); if (activeChat) setHistory((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === activeChat.id ? { ...chat, jurisdiction: value } : chat) })) }
  function setLanguage(value) { setDraftLanguage(value); if (activeChat) setHistory((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === activeChat.id ? { ...chat, language: value } : chat) })) }

  function saveEscalation(messageId, escalation) {
    if (activeChat) updateMessage(activeChat.id, messageId, { escalation })
  }

  return { ...history, messages, jurisdiction, language, setJurisdiction, setLanguage, queryOptions, setQueryOptions, saveEscalation, isGenerating, sendMessage, retryMessage, newChat, selectChat, deleteChat, cancelRequest }
}
