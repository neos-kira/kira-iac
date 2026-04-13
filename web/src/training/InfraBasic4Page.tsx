import { useEffect, useState } from 'react'
import { getCurrentUsername } from '../auth'
import { VI_STEPS, SHELL_QUESTIONS, type InfraBasic4Rag } from './InfraBasic4Data'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { fetchMyProgress, postProgress, isProgressApiAvailable } from '../progressApi'

const EMPTY_SNAPSHOT: TraineeProgressSnapshot = {
  introConfirmed: false, introAt: null, wbsPercent: 0,
  chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
}

type VirtualFs = {
  viNeOS: string
  scripts: Record<string, string>
}

function InlineTerminal({
  value,
  onChange,
  output,
}: {
  value: string
  onChange: (v: string) => void
  output: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-50 shadow-inner">
      <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-300">
        <span className="flex h-2 w-2 rounded-full bg-rose-500" />
        <span className="flex h-2 w-2 rounded-full bg-amber-500" />
        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        <span className="ml-2 font-mono text-[10px]">mock-terminal</span>
      </div>
      <div className="grid gap-2 p-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[80px] w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[12px] text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="$ vi viNeOS\n$ ls\n$ cat viNeOS"
          spellCheck={false}
        />
        <pre className="min-h-[40px] whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-200">
          {output || '$ '}
        </pre>
      </div>
    </div>
  )
}

export function InfraBasic4Page() {
  const username = getCurrentUsername()
  const isKiraTest = username === 'kira-test'

  const [snapshot, setSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [viDone, setViDone] = useState<Record<number, boolean>>({})
  const [shellDone, setShellDone] = useState<Record<number, boolean>>({})
  const [rag, setRag] = useState<InfraBasic4Rag | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fs, setFs] = useState<VirtualFs>({ viNeOS: '', scripts: {} })
  const [terminalInput, setTerminalInput] = useState<Record<string, string>>({})
  const [terminalOutput] = useState<Record<string, string>>({})

  const viDoneCount = VI_STEPS.filter((s) => viDone[s.step]).length
  const shellDoneCount = SHELL_QUESTIONS.filter((s) => shellDone[s.q]).length
  const viAll = viDoneCount === VI_STEPS.length
  const shellUnlocked = isKiraTest || viAll

  useEffect(() => {
    document.title = 'インフラ基礎課題4 - vi & シェルスクリプト'
  }, [])

  useEffect(() => {
    if (!isProgressApiAvailable() || typeof window === 'undefined') return
    const name = username.trim().toLowerCase()
    if (!name || name === 'admin') return
    let cancelled = false
    const load = async () => {
      const snap = await fetchMyProgress(name)
      if (cancelled) return
      // DynamoDB未取得時は EMPTY_SNAPSHOT を使う（localStorageは参照しない）
      const resolved = snap ?? EMPTY_SNAPSHOT
      setSnapshot(resolved)
      const viSteps = Array.isArray(resolved.infra4ViDoneSteps) ? resolved.infra4ViDoneSteps : []
      const shellQs = Array.isArray(resolved.infra4ShellDoneQuestions) ? resolved.infra4ShellDoneQuestions : []
      const viState: Record<number, boolean> = {}
      VI_STEPS.forEach((s) => {
        viState[s.step] = viSteps.includes(s.step)
      })
      const shellState: Record<number, boolean> = {}
      SHELL_QUESTIONS.forEach((q) => {
        shellState[q.q] = shellQs.includes(q.q)
      })
      setViDone(viState)
      setShellDone(shellState)
      setRag(resolved.infra4Rag ?? null)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [username])

  const applyUpdate = async (updater: (prev: TraineeProgressSnapshot) => TraineeProgressSnapshot) => {
    if (!isProgressApiAvailable() || typeof window === 'undefined') return
    const name = username.trim().toLowerCase()
    if (!name || name === 'admin') return
    // DynamoDBデータ未取得時はlocalStorageを参照せずスキップ
    if (!snapshot) return
    const next = updater({ ...snapshot })
    setSnapshot(next)
    void postProgress(name, next)
  }

  const handleToggleVi = (step: number, checked: boolean) => {
    setViDone((prev) => ({ ...prev, [step]: checked }))
    void applyUpdate((snap) => {
      const current = Array.isArray(snap.infra4ViDoneSteps) ? snap.infra4ViDoneSteps : []
      const set = new Set(current)
      if (checked) set.add(step)
      else set.delete(step)
      return { ...snap, infra4ViDoneSteps: Array.from(set).sort((a, b) => a - b) }
    })
  }

  const handleToggleShell = (q: number, checked: boolean) => {
    setShellDone((prev) => ({ ...prev, [q]: checked }))
    void applyUpdate((snap) => {
      const current = Array.isArray(snap.infra4ShellDoneQuestions) ? snap.infra4ShellDoneQuestions : []
      const set = new Set(current)
      if (checked) set.add(q)
      else set.delete(q)
      return { ...snap, infra4ShellDoneQuestions: Array.from(set).sort((a, b) => a - b) }
    })
  }

  const handleSetRag = (next: InfraBasic4Rag) => {
    setRag(next)
    void applyUpdate((snap) => ({ ...snap, infra4Rag: next }))
  }

  const handleSuspend = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)
    const name = username.trim().toLowerCase()
    if (name && name !== 'admin' && isProgressApiAvailable()) {
      const base = snapshot ?? EMPTY_SNAPSHOT
      const viSteps = VI_STEPS.filter((s) => viDone[s.step]).map((s) => s.step)
      const shellQs = SHELL_QUESTIONS.filter((q) => shellDone[q.q]).map((q) => q.q)
      const ok = await postProgress(name, {
        ...base,
        infra4ViDoneSteps: viSteps,
        infra4ShellDoneQuestions: shellQs,
        infra4Rag: rag,
        updatedAt: new Date().toISOString(),
      })
      if (!ok) {
        setSaveError('保存に失敗しました')
        setIsSaving(false)
        return
      }
    }
    setIsSaving(false)
    window.location.hash = '#/'
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs text-slate-500">課題4 · 実践演習</p>
          <h1 className="text-xl font-bold text-slate-800">vi & シェルスクリプト演習</h1>
        </div>
        <header className="flex items-center justify-between">

          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => { void handleSuspend() }}
              disabled={isSaving}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '中断して保存'}
            </button>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">ステータス</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span>
              4-1: {viDoneCount}/{VI_STEPS.length} 問 / 4-2: {shellDoneCount}/{SHELL_QUESTIONS.length} 問
            </span>
            <div className="ml-auto flex items-center gap-1 text-[11px]">
              <span className="text-slate-500">RAG:</span>
              {(['green', 'yellow', 'red'] as InfraBasic4Rag[]).map((v) => {
                const active = rag === v
                const base =
                  v === 'green'
                    ? 'bg-emerald-500 text-white'
                    : v === 'yellow'
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-500 text-white'
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleSetRag(v)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${base} ${
                      active ? 'opacity-100' : 'opacity-40 hover:opacity-80'
                    }`}
                  >
                    {v.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {isKiraTest ? 'kira-test は 4-2 も最初から操作できます。'
              : '通常ユーザーは 4-1 を全問クリアすると 4-2 がアンロックされます。'}
          </p>
        </section>

        {/* 4-1: vi */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">4-1</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-800">vi操作マスター（10問）</h2>
              <p className="mt-1 text-[11px] text-slate-600">
                下のターミナル風入力欄はブラウザ内の仮想環境です。viNeOS という仮想ファイルに対して操作を実行します。
              </p>
            </div>
          </div>
          <InlineTerminal
            value={terminalInput.vi ?? ''}
            onChange={(v) =>
              setTerminalInput((prev) => ({
                ...prev,
                vi: v,
              }))
            }
            output={terminalOutput.vi ?? ''}
          />
          <ul className="mt-4 space-y-2 text-sm">
            {VI_STEPS.map((s) => (
              <li key={s.step} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-semibold text-slate-800">
                      Step {s.step}. {s.label}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      ヒント: viNeOS の内容は下部の「仮想ファイル内容」から直接編集できます。実務では必ず保存前に内容を確認します。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleVi(s.step, !viDone[s.step])}
                    className={`ml-2 rounded-lg px-2 py-1 text-[11px] font-medium ${
                      viDone[s.step]
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {viDone[s.step] ? '済' : '未完了'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold text-slate-700">仮想ファイル: viNeOS</p>
            <textarea
              value={fs.viNeOS}
              onChange={(e) =>
                setFs((prev) => ({
                  ...prev,
                  viNeOS: e.target.value,
                }))
              }
              className="mt-2 min-h-[80px] w-full resize-y rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="ここに viNeOS の内容が表示されます。"
            />
          </div>
        </section>

        {/* 4-2: shell */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">4-2</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-800">シェルスクリプト演習（10問）</h2>
              <p className="mt-1 text-[11px] text-slate-600">
                仮想スクリプトファイル（script1.sh など）の内容を編集し、Verify で要件を満たしているか確認します。
              </p>
            </div>
            {!shellUnlocked && !isKiraTest && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 border border-amber-200">
                4-1 を全問クリアするとアンロック
              </span>
            )}
          </div>
          <InlineTerminal
            value={terminalInput.shell ?? ''}
            onChange={(v) =>
              setTerminalInput((prev) => ({
                ...prev,
                shell: v,
              }))
            }
            output={terminalOutput.shell ?? ''}
          />
          <div className={shellUnlocked ? 'mt-4 space-y-2' : 'mt-4 space-y-2 pointer-events-none select-none opacity-60'}>
            {SHELL_QUESTIONS.map((q) => (
              <div key={q.q} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-semibold text-slate-800">
                      Q{q.q}. {q.title}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">{q.detail}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      クイックリファレンス: if, for, while, 関数定義、"$var"、exit 0/1 など基本構文を確認しましょう。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleShell(q.q, !shellDone[q.q])}
                    className={`ml-2 rounded-lg px-2 py-1 text-[11px] font-medium ${
                      shellDone[q.q]
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {shellDone[q.q] ? '済' : '未完了'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
