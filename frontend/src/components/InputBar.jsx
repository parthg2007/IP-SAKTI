import { useFormContext, useWatch } from 'react-hook-form'
import { useLayoutEffect, useRef, useState } from 'react'
import Icon from './LandingIcon.jsx'
import VoiceInputButton from './VoiceInputButton.jsx'

export default function InputBar({ language = 'en', isGenerating = false, onSend, onStop, settings }) {
  const { register, control, handleSubmit, setValue, getValues } = useFormContext()
  const [voiceBusy, setVoiceBusy] = useState(false)
  const textareaRef = useRef(null)
  const { ref: registerRef, ...messageField } = register('message')
  const draft = useWatch({ control, name: 'message' }) || ''
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '24px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [draft])
  const hasMessage = Boolean(draft.trim()) && draft.length <= 4000
  const submit = handleSubmit(({ message }) => {
    if (!isGenerating && !voiceBusy && message.trim() && message.trim().length <= 4000) onSend(message)
  })

  const handleVoiceTranscript = (text) => {
    const current = getValues('message') || ''
    setValue('message', current ? `${current.trim()} ${text}` : text, { shouldDirty: true })
  }

  return (
    <form
      onSubmit={submit}
      className="chat-composer"
    >
      {settings}
      <div className="chat-composer-field">
        <textarea
          {...messageField}
          ref={(element) => { registerRef(element); textareaRef.current = element }}
          aria-label="Message"
          placeholder="Ask about Ayurveda and IP…"
          rows={1}
          maxLength={4000}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void submit()
            }
          }}
          className="chat-composer-input"
        />
        {draft.length > 4000 && <p role="alert" className="text-sm text-[var(--lp-gold)]">Please shorten your question to 4,000 characters.</p>}
      </div>
      <div className="chat-composer-actions">
        <VoiceInputButton onTranscript={handleVoiceTranscript} onBusyChange={setVoiceBusy} language={language} disabled={isGenerating} />
        <button
          type={isGenerating ? 'button' : 'submit'}
          onClick={isGenerating ? onStop : undefined}
          disabled={!isGenerating && (!hasMessage || voiceBusy)}
          aria-label={isGenerating ? 'Stop response' : 'Send message'}
          title={isGenerating ? 'Stop response' : 'Send message (Enter; Shift+Enter for a new line)'}
          className="chat-send-button"
        >
          {isGenerating
            ? <span aria-hidden="true" className="size-3.5 rounded-sm bg-current" />
            : <Icon name="up" />
          }
        </button>
      </div>
    </form>
  )
}
