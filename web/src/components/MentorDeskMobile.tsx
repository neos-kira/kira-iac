import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BASE_URL, buildAuthHeaders, forceLogout } from '../progressApi'
import { Z } from '../zIndex'

type Msg = { role: 'user' | 'assistant'; content: string; image?: string }

const CONTEXT_MAP: Record<string, string> = {
  '/training/intro': 'はじめに',
  '/training/infra-basic-top': 'インフラ基礎課題1',
  '/training/infra-basic-1': 'インフラ基礎課題1-1',
  '/training/infra-basic-2-top': 'インフラ基礎課題2',
  '/training/infra-basic-2-1': 'インフラ基礎課題2-1',
  '/training/infra-basic-3-top': 'インフラ基礎課題3',
  '/training/infra-basic-3-1': 'インフラ基礎課題3-1',
  '/training/infra-basic-3-2': 'インフラ基礎課題3-2',
  '/training/infra-basic-4': 'インフラ基礎課題4',
  '/training/infra-wbs': 'インフラWBS',
  '/training/linux-level1': 'Linuxコマンド課題',
  '/training/linux-level2': 'TCP/IP課題',
}

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function renderMd(raw: string) {
  let s = esc(raw)
  s = s.replace(/^### (.+)$/gm, '<h4 style="font-weight:700;font-size:13px;margin:4px 0">$1</h4>')
  s = s.replace(/^## (.+)$/gm, '<h3 style="font-weight:700;font-size:14px;margin:4px 0">$1</h3>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:11px">$1</code>')
  s = s.replace(/\n/g, '<br/>')
  return s
}

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition
  : undefined

export function MentorDeskMobileButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: '研修内容についてわからないことがあれば聞いてください。' }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ base64: string; type: string; dataUrl: string } | null>(null)
  const [isListening, setIsListening] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const voiceBaseRef = useRef('')
  const location = useLocation()
  const path = location.pathname
  const context = CONTEXT_MAP[path] ?? ''

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isOpen])

  if (path === '/login') return null

  function handleImageFile(file: File) {
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) return
    if (file.size > 5 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPendingImage({ base64: dataUrl.split(',')[1], type: file.type, dataUrl })
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

  function toggleVoice() {
    if (!SpeechRecognitionAPI) return
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop(); recognitionRef.current = null; setIsListening(false); return
    }
    voiceBaseRef.current = input
    const recognition = new SpeechRecognitionAPI() as {
      start: () => void; stop: () => void; lang: string; continuous: boolean; interimResults: boolean
      onresult: ((e: { results: { length: number; [i: number]: { isFinal?: boolean; length: number; [j: number]: { transcript?: string } } } }) => void) | null
      onend: (() => void) | null; onerror: ((e?: unknown) => void) | null
    }
    recognition.lang = 'ja-JP'; recognition.continuous = true; recognition.interimResults = true
    recognition.onresult = (e) => {
      let finalText = '', interimText = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]; const t = r[0]?.transcript ?? ''
        if (r.isFinal) finalText += t; else interimText += t
      }
      voiceBaseRef.current = voiceBaseRef.current.replace(/\n$/, '') + finalText
      setInput(voiceBaseRef.current + interimText)
    }
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null }
    recognition.onerror = () => { setIsListening(false); recognitionRef.current = null }
    recognition.start(); recognitionRef.current = recognition; setIsListening(true)
  }

  async function send() {
    const text = input.trim()
    if (!text && !pendingImage) return
    if (sending) return
    const userMsg: Msg = { role: 'user', content: text || '(画像を送信)', image: pendingImage?.dataUrl }
    const next = [...messages, userMsg].slice(-40)
    setMessages(next)
    const imagePayload = pendingImage ? { base64: pendingImage.base64, type: pendingImage.type } : undefined
    setInput(''); setPendingImage(null); setSending(true)
    try {
      const history = next.slice(1).slice(-20)
      const res = await fetch(`${BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        body: JSON.stringify({ message: text || '画像を確認してください', history, context, image: imagePayload }),
      })
      if (!res.ok) {
        if (res.status === 401) { forceLogout(); return }
        setMessages((p) => [...p, { role: 'assistant' as const, content: 'AIとの通信に失敗しました。もう一度送信してください。' }])
        return
      }
      const data = (await res.json()) as { reply?: string }
      const reply = (data.reply ?? '').trim() || '（応答が取得できませんでした）'
      setMessages((p) => [...p, { role: 'assistant' as const, content: reply }].slice(-40))
    } catch {
      setMessages((p) => [...p, { role: 'assistant' as const, content: 'AIとの通信に失敗しました。もう一度送信してください。' }])
    } finally { setSending(false) }
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: Z.floatingPanel }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-2xl text-white shadow-lg hover:bg-sky-600"
        aria-label="AI講師に聞く"
      >
        🎓
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: Z.floatingPanel }} className="flex flex-col justify-end bg-black/20" onClick={() => setIsOpen(false)}>
          <div className="flex flex-col rounded-t-2xl bg-white" style={{ height: '60vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-sky-100 bg-sky-50 px-3 py-2 rounded-t-2xl shrink-0">
              <span className="text-sm font-semibold text-sky-800">🎓 AI講師</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(false) }} className="p-2 text-slate-500 hover:text-slate-800 text-lg">✕</button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-800'}`}>
                    {m.image && <img src={m.image} alt="添付画像" className="max-h-16 rounded-lg mb-1" />}
                    {m.role === 'assistant' ? <span dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} /> : m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">入力中...</div>
                </div>
              )}
            </div>

            {pendingImage && (
              <div className="flex items-start gap-2 border-t border-slate-200 px-3 pt-2 shrink-0">
                <div className="relative">
                  <img src={pendingImage.dataUrl} alt="プレビュー" className="max-h-12 rounded-lg border border-slate-200" />
                  <button type="button" onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-[8px] text-white">✕</button>
                </div>
              </div>
            )}

            <div className="flex items-end gap-1 border-t border-slate-200 p-2 shrink-0" onPaste={handlePaste}>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg px-1.5 py-1.5 text-slate-400 hover:bg-slate-100" aria-label="画像を添付">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }}
                onPaste={handlePaste}
                rows={1}
                placeholder="メッセージを入力"
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                style={{ maxHeight: 60 }}
              />
              {SpeechRecognitionAPI && (
                <button type="button" onClick={toggleVoice} className={`rounded-lg px-1.5 py-1.5 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:bg-slate-100'}`} aria-label={isListening ? '音声入力を停止' : '音声入力'}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" /></svg>
                </button>
              )}
              <button type="button" onClick={() => void send()} disabled={sending || (!input.trim() && !pendingImage)} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed">
                送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
