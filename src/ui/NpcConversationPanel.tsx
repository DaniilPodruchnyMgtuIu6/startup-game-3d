import { useRef, useState } from 'react'
import { useNpcConversationStore, type NpcConversationMessage } from '../game/npcConversationStore'
import { gatherGameSnapshot, buildPublicNpcGameContext } from '../game/npcPublicContext'
import { sendNpcChat } from '../game/npcChatClient'
import { getNpcFallbackReply } from '../game/npcFallback'
import { NPC_META, NPC_CHAT_LIMITS, type NpcId } from '../game/npcChatTypes'
import { femalePm } from '../character/characters/femalePm'
import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import './ui.css'

const PORTRAIT: Partial<Record<NpcId, string>> = {
  'sonya-sokolova': femalePm.portrait,
  'ilya-vlasov': ilyaVlasov.portrait,
}

let idCounter = 0
function newId(): string {
  idCounter += 1
  return `c-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

type Phase = 'idle' | 'thinking' | 'streaming'

// Feature 14 free-chat panel. Reuses the dialogue visual style. Renders replies
// as plain text (never dangerouslySetInnerHTML). Streaming, Stop, Clear and Close
// never move the game day or change any game state.
export function NpcConversationPanel() {
  const npcId = useNpcConversationStore((s) => s.activeNpcChat)
  const messages = useNpcConversationStore((s) => (npcId ? s.conversations[npcId] : undefined))
  const appendMessage = useNpcConversationStore((s) => s.appendMessage)
  const clearConversation = useNpcConversationStore((s) => s.clearConversation)
  const closeChat = useNpcConversationStore((s) => s.closeChat)

  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [streaming, setStreaming] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  if (!npcId) return null
  const meta = NPC_META[npcId]
  const history = messages ?? []
  const busy = phase !== 'idle'

  const send = async () => {
    const text = input.trim().slice(0, NPC_CHAT_LIMITS.messageMax)
    if (!text || busy) return
    setInput('')

    const userMessage: NpcConversationMessage = { id: newId(), role: 'user', content: text, createdAt: Date.now() }
    // real (non-fallback) turns become the model's short memory
    const priorHistory = history.filter((m) => !m.local).map((m) => ({ role: m.role, content: m.content }))
    appendMessage(npcId, userMessage)

    const controller = new AbortController()
    abortRef.current = controller
    setPhase('thinking')
    setStreaming('')

    const context = buildPublicNpcGameContext(gatherGameSnapshot(), npcId)
    let acc = ''
    const result = await sendNpcChat(
      { npcId, message: text, history: priorHistory, context },
      {
        signal: controller.signal,
        onToken: (t) => {
          acc += t
          setStreaming(acc)
          setPhase('streaming')
        },
      },
    )
    abortRef.current = null
    setPhase('idle')
    setStreaming('')

    if (result.status === 'ok' && acc.trim()) {
      appendMessage(npcId, { id: newId(), role: 'assistant', content: acc.trim(), createdAt: Date.now() })
    } else if (result.status === 'error') {
      appendMessage(npcId, { id: newId(), role: 'assistant', content: getNpcFallbackReply(npcId), createdAt: Date.now(), local: true })
    }
    // 'aborted' → drop the partial assistant text (nothing saved)
  }

  const stop = () => abortRef.current?.abort()
  const close = () => {
    abortRef.current?.abort()
    closeChat()
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="overlay-backdrop npc-chat-backdrop" onClick={close}>
      <div className="npc-chat" onClick={(e) => e.stopPropagation()}>
        <div className="npc-chat-header">
          {PORTRAIT[npcId] ? <img className="npc-chat-portrait" src={PORTRAIT[npcId]} alt="" /> : null}
          <div>
            <div className="npc-chat-name">{meta.name}</div>
            <div className="npc-chat-sub">Свободный разговор</div>
          </div>
          <button className="npc-chat-close" onClick={close} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="npc-chat-log">
          {history.length === 0 && phase === 'idle' ? (
            <div className="npc-chat-hint">Напишите сообщение — {meta.name.split(' ')[0]} ответит в своём характере.</div>
          ) : null}
          {history.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'npc-chat-msg npc-chat-msg--user' : 'npc-chat-msg npc-chat-msg--npc'}>
              {m.content}
            </div>
          ))}
          {phase === 'thinking' ? <div className="npc-chat-msg npc-chat-msg--npc npc-chat-thinking">{meta.name.split(' ')[0]} думает…</div> : null}
          {phase === 'streaming' ? <div className="npc-chat-msg npc-chat-msg--npc">{streaming}</div> : null}
        </div>

        <div className="npc-chat-input">
          <textarea
            value={input}
            maxLength={NPC_CHAT_LIMITS.messageMax}
            placeholder="Сообщение…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
          />
          <div className="npc-chat-counter">
            {input.length}/{NPC_CHAT_LIMITS.messageMax}
          </div>
        </div>

        <div className="npc-chat-actions">
          {busy ? (
            <button className="primary" onClick={stop}>
              Остановить
            </button>
          ) : (
            <button className="primary" onClick={() => void send()} disabled={!input.trim()}>
              Отправить
            </button>
          )}
          <button className="npc-chat-secondary" onClick={() => clearConversation(npcId)} disabled={busy || history.length === 0}>
            Очистить разговор
          </button>
          <button className="npc-chat-secondary" onClick={close}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
