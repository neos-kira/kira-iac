import { useEffect, useRef, useState } from 'react'
import { BASE_URL, buildAuthHeaders, forceLogout } from '../progressApi'
import { Z } from '../zIndex'
import { useQuizContext } from '../quizContext'

type ChatMessage = { role: 'user' | 'assistant'; content: string; image?: string }

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'こんにちは。わからないことがあれば何でも聞いてください。',
}

const MAX_TURNS = 20

function renderMarkdown(raw: string): string {
  let s = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  s = s.replace(/^### (.+)$/gm, '<h4 style="font-weight:700;font-size:13px;margin:4px 0">$1</h4>')
  s = s.replace(/^## (.+)$/gm, '<h3 style="font-weight:700;font-size:14px;margin:4px 0">$1</h3>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/^---$/gm, '<hr style="border:0;border-top:1px solid #e2e8f0;margin:6px 0"/>')
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid #7dd3fc;padding-left:8px;margin:4px 0;color:#475569">$1</blockquote>')
  s = s.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:11px">$1</code>')
  s = s.replace(/\n/g, '<br/>')
  return s
}

export type { ChatMessage }
export { INITIAL_MESSAGE }

export function MentorDesk({ context, open: externalOpen, onClose: externalOnClose, sidebar = false, mobile = false, embedded = false, messages: externalMessages, setMessages: externalSetMessages }: { context?: string; open?: boolean; onClose?: () => void; sidebar?: boolean; mobile?: boolean; embedded?: boolean; messages?: ChatMessage[]; setMessages?: React.Dispatch<React.SetStateAction<ChatMessage[]>> }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = sidebar ? true : (externalOpen ?? internalOpen)
  const onClose = externalOnClose ?? (() => setInternalOpen(false))
  const [internalMessages, internalSetMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const messages = externalMessages ?? internalMessages
  const setMessages = externalSetMessages ?? internalSetMessages
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [bakumatsuCount, setBakumatsuCount] = useState<number>(0)
  const BAKUMATSU_KEYWORDS = ['幕末','新選組','土方','近藤','沖田','西郷','松陰','高杉','捨助','池田屋','桜田門外','大政奉還','明治維新','黒船','薩長','会津','斎藤','永倉','山南','芹沢','原田','藤堂','五稜郭','戊辰']
  const [pendingImage, setPendingImage] = useState<{ base64: string; type: string; dataUrl: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { quizState } = useQuizContext()

  const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

  function handleImageFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) return
    if (file.size > 5 * 1024 * 1024) return // 5MB limit
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const type = file.type
      setPendingImage({ base64, type, dataUrl })
    }
    reader.readAsDataURL(file)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) { handleImageFile(file); e.preventDefault(); break }
      }
    }
  }

  // 音声入力
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const voiceBaseRef = useRef('')
  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition
    : undefined

  function toggleVoice() {
    if (!SpeechRecognitionAPI) return
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setIsListening(false)
      return
    }
    voiceBaseRef.current = input
    const recognition = new SpeechRecognitionAPI() as {
      start: () => void; stop: () => void; lang: string; continuous: boolean; interimResults: boolean
      onresult: ((e: { results: { length: number; [i: number]: { isFinal?: boolean; length: number; [j: number]: { transcript?: string } } } }) => void) | null
      onend: (() => void) | null; onerror: ((e?: unknown) => void) | null
    }
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        const transcript = r[0]?.transcript ?? ''
        if (r.isFinal) {
          finalText += transcript
        } else {
          interimText += transcript
        }
      }
      voiceBaseRef.current = voiceBaseRef.current.replace(/\n$/, '') + finalText
      setInput(voiceBaseRef.current + interimText)
    }
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null }
    recognition.onerror = () => { setIsListening(false); recognitionRef.current = null }
    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }



  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open, isSending])

  async function handleSend() {
    const text = input.trim()
    if (!text && !pendingImage) return
    if (isSending) return
    const userMsg: ChatMessage = { role: 'user', content: text || '(画像を送信)', image: pendingImage?.dataUrl }
    const next = [...messages, userMsg].slice(-MAX_TURNS * 2)
    setMessages(next)
    const imagePayload = pendingImage ? { base64: pendingImage.base64, type: pendingImage.type } : undefined
    setInput('')
    setPendingImage(null)
    setIsSending(true)
    const isBakumatsu = BAKUMATSU_KEYWORDS.some((k) => text.includes(k))

    if (isBakumatsu && bakumatsuCount >= 3) {
      setMessages((prev) => [...prev, { role: 'assistant' as const, content: '幕末トークは本日ここまでです。研修に戻りましょう！続きはログアウト後にどうぞ。' }].slice(-MAX_TURNS * 2))
      setIsSending(false)
      return
    }

    if (isBakumatsu) {
      setBakumatsuCount((prev) => prev + 1)
    }

    try {
      const history = next.filter((m) => m !== INITIAL_MESSAGE).slice(-MAX_TURNS * 2)
      console.log('[MentorDesk] BASE_URL:', BASE_URL)
      const url = `${BASE_URL}/ai/chat`
      console.log('[MentorDesk] POST', url)
      const res = await fetch(url, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        body: JSON.stringify({ message: text || '画像を確認してください', history, context: context ?? '', image: imagePayload, currentQuestion: quizState.currentQuestion, studentAnswer: quizState.studentAnswer, isCorrect: quizState.isCorrect }),
      })
      console.log('[MentorDesk] response:', res.status, res.ok)
      if (!res.ok) {
        if (res.status === 401) {
          forceLogout()
          return
        }
        if (res.status === 429) {
          const data = await res.json() as { error?: string }
          setMessages((prev) => [...prev, { role: 'assistant' as const, content: data.error || '本日の利用上限に達しました。明日また利用できます。' }].slice(-MAX_TURNS * 2))
          return
        }
        const errMsg = res.status === 503
          ? 'AIが混雑しています。少し待ってから再試行してください。'
          : 'AIとの通信に失敗しました。もう一度送信してください。'
        setMessages((prev) => [...prev, { role: 'assistant' as const, content: errMsg }].slice(-MAX_TURNS * 2))
        return
      }
      const data = (await res.json()) as { reply?: string; error?: boolean }
      const reply = (data.reply ?? '').trim() || '（応答が取得できませんでした）'
      setMessages((prev) => [...prev, { role: 'assistant' as const, content: reply }].slice(-MAX_TURNS * 2))
    } catch (err) {
      console.error('[MentorDesk] fetch failed:', err)
      setMessages((prev) => [...prev, { role: 'assistant' as const, content: 'AIとの通信に失敗しました。もう一度送信してください。' }].slice(-MAX_TURNS * 2))
    } finally {
      setIsSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleSend()
    }
  }

  // ── サイドバーモードで共通チャットUIを返すヘルパー ──
  const chatHeader = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>AI</span>
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', letterSpacing: '-0.025em', lineHeight: 1.2 }}>AI講師</p>
          <p style={{ fontSize: 10, color: '#64748b', fontWeight: 500, lineHeight: 1.3 }}>わからないことは何でも</p>
        </div>
      </div>
      <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: '0 0 0 8px' }} title="閉じる">✕</button>
    </div>
  )

  // ── サイドバーモード（PCのみ） ──
  if (sidebar) {
    return (
      <aside style={embedded ? { flex: 1, display: 'flex', flexDirection: 'column' as const, minHeight: 0 } : { position: 'fixed' as const, top: 64, right: 0, bottom: 0, width: 380, zIndex: Z.sticky }} className={`flex flex-col ${embedded ? '' : 'border-l border-slate-200'} bg-white`}>
        {chatHeader}

        <div ref={scrollRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start gap-2'}`}>
              {m.role === 'assistant' && (
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <span style={{ color: 'white', fontSize: 8, fontWeight: 700 }}>AI</span>
                </div>
              )}
              <div className={`max-w-[85%] whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-sky-500 text-white rounded-2xl' : 'bg-slate-100 text-slate-800'}`} style={m.role === 'assistant' ? { borderRadius: '12px 12px 12px 2px', lineHeight: 1.7 } : {}}>
                {m.image && <img src={m.image} alt="添付画像" className="max-h-20 rounded-lg mb-1" />}
                {m.role === 'assistant' ? <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} /> : m.content}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px', background: '#f3f4f6', borderRadius: '12px 12px 12px 4px', width: 'fit-content' }}>
                {[0, 1, 2].map((i) => (<div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7dd3fc', animation: 'typing-dot 1.2s infinite', animationDelay: `${i * 0.2}s` }} />))}
                <style>{`@keyframes typing-dot { 0%,60%,100%{opacity:.3;transform:scale(.8)} 30%{opacity:1;transform:scale(1.2)} }`}</style>
              </div>
            </div>
          )}
        </div>

        {pendingImage && (
          <div className="flex items-start gap-2 border-t border-slate-200 px-3 pt-2">
            <div className="relative">
              <img src={pendingImage.dataUrl} alt="添付プレビュー" className="max-h-16 rounded-lg border border-slate-200" />
              <button type="button" onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-[8px] text-white hover:bg-slate-800">✕</button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-slate-200 px-3 py-2" style={{ flexShrink: 0, paddingBottom: 'max(8px, env(safe-area-inset-bottom))', background: 'white' }} onPaste={handlePaste}>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />
          {/* 添付ボタン: 44px タップターゲット */}
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors" style={{ minWidth: 44, minHeight: 44 }} aria-label="画像を添付" title="画像を添付">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </button>
          {/* テキスト入力: flex-1 で伸縮 */}
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} onFocus={(e) => { setTimeout(() => { (e.target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, 300) }} rows={1} placeholder="メッセージを入力" className="flex-1 resize-none rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40" style={{ maxHeight: 72, minHeight: 44 }} />
          {/* マイクボタン: 44px タップターゲット */}
          {SpeechRecognitionAPI && (
            <button type="button" onClick={toggleVoice} className={`flex-shrink-0 flex items-center justify-center rounded-xl transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} style={{ minWidth: 44, minHeight: 44 }} aria-label={isListening ? '音声入力を停止' : '音声入力'} title={isListening ? '音声入力を停止' : '音声入力'}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" /></svg>
            </button>
          )}
          {/* 送信ボタン: 44px タップターゲット + 送信中スピナー */}
          <button type="button" onClick={() => void handleSend()} disabled={isSending || (!input.trim() && !pendingImage)} className="flex-shrink-0 flex items-center justify-center gap-1.5 rounded-full bg-sky-600 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" style={{ minWidth: 44, minHeight: 44, paddingLeft: 12, paddingRight: 12 }}>
            {isSending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : '送信'}
          </button>
        </div>
      </aside>
    )
  }

  // ── モバイルモード（md未満のみ表示） ──
  if (mobile) {
    return (
      <>
        {/* フローティングボタン（md未満のみ表示） */}
        {!open && (
          <button
            type="button"
            onClick={() => setInternalOpen(true)}
            className={`md:hidden fixed bottom-6 right-6 flex items-center justify-center w-14 h-14 rounded-full bg-sky-500 text-white shadow-2xl hover:bg-sky-600 transition-all`} style={{ zIndex: Z.floatingPanel }}
            aria-label="AI講師に聞く"
          >
            <span className="text-2xl">🎓</span>
          </button>
        )}

        {/* オーバーレイ */}
        {open && <div className="md:hidden fixed inset-0 bg-black/30" style={{ zIndex: Z.floatingPanelBehind }} onClick={onClose} />}

        {/* チャットパネル（画面75%高さ） */}
        {open && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 flex flex-col bg-white rounded-t-2xl shadow-xl" style={{ height: '75vh', zIndex: Z.floatingPanel }}>
            <header className="flex items-center justify-between bg-sky-50 border-b border-sky-100 px-4 py-3 rounded-t-2xl">
              <p className="text-sm font-semibold text-slate-800">🎓 AI講師</p>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </header>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-800'}`}>
                    {m.image && <img src={m.image} alt="添付画像" className="max-h-20 rounded-lg mb-1" />}
                    {m.role === 'assistant' ? <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} /> : m.content}
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">入力中...</div>
                </div>
              )}
            </div>
            {pendingImage && (
              <div className="flex items-start gap-2 border-t border-slate-200 px-3 pt-2">
                <div className="relative">
                  <img src={pendingImage.dataUrl} alt="添付プレビュー" className="max-h-16 rounded-lg border border-slate-200" />
                  <button type="button" onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-[8px] text-white hover:bg-slate-800">✕</button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-2 border-t border-slate-200 px-3 py-2" style={{ flexShrink: 0, paddingBottom: 'max(8px, env(safe-area-inset-bottom))', background: 'white' }} onPaste={handlePaste}>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200" style={{ minWidth: 44, minHeight: 44 }} aria-label="画像を添付">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} onFocus={(e) => { setTimeout(() => { (e.target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, 300) }} rows={1} placeholder="メッセージを入力" className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40" style={{ maxHeight: 72, minHeight: 44 }} />
              {SpeechRecognitionAPI && (
                <button type="button" onClick={toggleVoice} className={`flex-shrink-0 flex items-center justify-center rounded-xl transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} style={{ minWidth: 44, minHeight: 44 }} aria-label={isListening ? '音声入力を停止' : '音声入力'}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" /></svg>
                </button>
              )}
              <button type="button" onClick={() => void handleSend()} disabled={isSending || (!input.trim() && !pendingImage)} className="flex-shrink-0 flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" style={{ minWidth: 44, minHeight: 44, paddingLeft: 12, paddingRight: 12 }}>
                {isSending ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : '送信'}
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // フォールバック（sidebar/mobile以外は何も描画しない）
  return null
}
