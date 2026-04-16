import { useEffect, useState, useCallback, useRef } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { INFRA_BASIC_1_CLEARED_KEY } from './infraBasic1Data'
import { fetchMyProgress, postProgress, isProgressApiAvailable, buildAuthHeaders, BASE_URL } from '../progressApi'
import { getCurrentDisplayName } from '../auth'
import { getProgressKey } from './trainingWbsData'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

type GradeResult = { passed: boolean; message: string; gradedAt: string }
type GradeState = Record<string, GradeResult>

const SECTION_IDS = ['ssh'] as const

const API_ERROR_MSG = 'もう一度お試しください'

const EMPTY_SNAPSHOT: TraineeProgressSnapshot = {
  introConfirmed: false, introAt: null, wbsPercent: 0,
  chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function gradeWithImage(
  section: string,
  file: File,
  username: string,
): Promise<{ passed: boolean; message: string }> {
  if (!BASE_URL) return { passed: false, message: API_ERROR_MSG }
  try {
    const base64 = await fileToBase64(file)
    const res = await fetch(`${BASE_URL}/ai/grade-image`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'omit',
      body: JSON.stringify({ section, username, image: base64, imageType: file.type }),
    })
    if (!res.ok) return { passed: false, message: API_ERROR_MSG }
    const data = await res.json() as { passed?: boolean; message?: string }
    const fallback = 'SSH接続成功後のターミナル画面をアップロードしてください'
    return { passed: !!data.passed, message: data.message ?? fallback }
  } catch {
    return { passed: false, message: API_ERROR_MSG }
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
    >
      {copied ? 'コピー済み' : 'コピー'}
    </button>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3">
      <code className="flex-1 text-sm font-mono text-emerald-400 break-all">{code}</code>
      <CopyButton text={code} />
    </div>
  )
}

export function InfraBasic1Page() {
  const navigate = useSafeNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [gradeState, setGradeState] = useState<GradeState>({})
  const [gradingSection, setGradingSection] = useState<string | null>(null)
  const [hasServer, setHasServer] = useState(false)
  const [osTab, setOsTab] = useState<'mac' | 'windows'>('mac')
  const fileRef = useRef<HTMLInputElement>(null)

  const username = getCurrentDisplayName().trim().toLowerCase()
  const clearedKey = getProgressKey(INFRA_BASIC_1_CLEARED_KEY)

  useEffect(() => {
    document.title = 'インフラ基礎演習1'
    const load = async () => {
      if (!username || username === 'admin') { setIsLoading(false); return }
      const snap = await fetchMyProgress(username)
      if (snap) {
        setServerSnapshot(snap)
        const ip = snap.ec2PublicIp || snap.ec2Host || ''
        setHasServer(!!ip)
        setGradeState(snap.infra1GradeState ?? {})
      }
      setIsLoading(false)
    }
    void load()
  }, [username, clearedKey])

  const saveGrade = useCallback(async (sectionId: string, result: GradeResult) => {
    const newGradeState: GradeState = { ...gradeState, [sectionId]: result }
    setGradeState(newGradeState)

    const allPassed = SECTION_IDS.every((id) => newGradeState[id]?.passed)
    try {
      if (allPassed) window.localStorage.setItem(clearedKey, 'true')
      else window.localStorage.removeItem(clearedKey)
    } catch { /* ignore */ }

    if (username && username !== 'admin' && isProgressApiAvailable()) {
      const base: TraineeProgressSnapshot = serverSnapshot ?? EMPTY_SNAPSHOT
      await postProgress(username, {
        ...base,
        infra1GradeState: newGradeState,
        infra1Cleared: allPassed,
        updatedAt: new Date().toISOString(),
      })
    }
  }, [gradeState, serverSnapshot, username, clearedKey])

  const handleImageGrade = useCallback(async (sectionId: string, file: File) => {
    setGradingSection(sectionId)
    const result = await gradeWithImage(sectionId, file, username)
    await saveGrade(sectionId, { ...result, gradedAt: new Date().toISOString() })
    setGradingSection(null)
  }, [saveGrade, username])

  const allPassed = SECTION_IDS.every((id) => gradeState[id]?.passed)
  const sshPassed = gradeState.ssh?.passed === true
  const isGrading = gradingSection === 'ssh'

  const ip = serverSnapshot?.ec2PublicIp || serverSnapshot?.ec2Host || '自分のサーバーIP'
  const user = (serverSnapshot?.ec2Username && serverSnapshot.ec2Username !== 'ubuntu')
    ? serverSnapshot.ec2Username
    : username || '自分のユーザー名'
  const pemFile = serverSnapshot?.keyPairName ? `${serverSnapshot.keyPairName}.pem` : '秘密鍵ファイル.pem'

  const sshCommand = `ssh -i ${pemFile} ${user}@${ip}`
  const pemPermCmd = `chmod 600 ${pemFile}`

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">

        {/* ヘッダー */}
        <div>
          <p className="text-xs text-slate-500">課題1-1 · SSH接続</p>
          <h1 className="text-xl font-bold text-slate-800">インフラ基礎演習1</h1>
          <p className="mt-1 text-sm text-slate-600">ターミナルから演習サーバーにSSH接続し、接続成功画面を提出します。</p>
        </div>

        {/* EC2未作成警告 */}
        {!hasServer && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">演習サーバーが未作成です</p>
              <p className="text-xs text-amber-700 mt-0.5">トップページでサーバーを作成してください。</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50"
            >
              トップページへ
            </button>
          </section>
        )}

        {hasServer && (
          <>
            {/* サーバー情報確認 */}
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 mb-2">接続先サーバー情報</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <span className="text-slate-400">IPアドレス</span>
                  <p className="font-mono font-semibold text-slate-800">{ip}</p>
                </div>
                <div>
                  <span className="text-slate-400">ユーザー名</span>
                  <p className="font-mono font-semibold text-slate-800">{user}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">秘密鍵ファイル</span>
                  <p className="font-mono text-slate-700">{pemFile}</p>
                </div>
              </div>
            </section>

            {/* SSH接続手順 */}
            <section className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-colors ${sshPassed ? 'border-emerald-300' : 'border-slate-200'}`}>
              {/* セクションヘッダー */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">SSH接続</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">なぜ学ぶか：現場でLinuxサーバーを操作するための基本スキルです</p>
                </div>
                {sshPassed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    ✓ 完了
                  </span>
                )}
              </div>

              <div className="px-4 pb-4 space-y-4">
                {/* OS タブ */}
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium w-fit">
                  <button type="button" onClick={() => setOsTab('mac')} className={`px-4 py-1.5 transition-colors ${osTab === 'mac' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>macOS</button>
                  <button type="button" onClick={() => setOsTab('windows')} className={`px-4 py-1.5 transition-colors ${osTab === 'windows' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Windows</button>
                </div>

                {/* macOS 手順 */}
                {osTab === 'mac' && (
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">1</span>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-slate-700 mb-1.5">ダウンロードフォルダに秘密鍵があることを確認し、ターミナルを開く</p>
                        <p className="text-xs text-slate-500">Finder → アプリケーション → ユーティリティ → ターミナル.app<br/>または Spotlight（⌘+Space）で「ターミナル」と検索</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">2</span>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-slate-700 mb-1.5">秘密鍵のパーミッションを設定する（初回のみ）</p>
                        <CodeBlock code={pemPermCmd} />
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">3</span>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-slate-700 mb-1.5">以下のコマンドを入力してSSH接続する</p>
                        <CodeBlock code={sshCommand} />
                        <p className="mt-1.5 text-xs text-slate-500">「Are you sure you want to continue connecting?」と表示されたら <code className="bg-slate-100 px-1 rounded">yes</code> と入力してEnter</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">4</span>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-slate-700">プロンプト（<code className="bg-slate-100 px-1 rounded text-xs">{user}@ip-xxx-xxx-xxx-xxx:~$</code>）が表示されれば接続成功</p>
                      </div>
                    </li>
                  </ol>
                )}

                {/* Windows 手順 */}
                {osTab === 'windows' && (
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">1</span>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-slate-700 mb-1.5">ダウンロードフォルダに秘密鍵があることを確認し、PowerShellを開く</p>
                        <p className="text-xs text-slate-500">スタートメニューで「PowerShell」と検索して起動<br/>または Windowsキー + R → <code className="bg-slate-100 px-1 rounded">powershell</code> → Enter</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">2</span>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-slate-700 mb-1.5">ダウンロードフォルダに移動する</p>
                        <CodeBlock code="cd $HOME\Downloads" />
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">3</span>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-slate-700 mb-1.5">以下のコマンドを入力してSSH接続する</p>
                        <CodeBlock code={sshCommand} />
                        <p className="mt-1.5 text-xs text-slate-500">「Are you sure you want to continue connecting?」と表示されたら <code className="bg-slate-100 px-1 rounded">yes</code> と入力してEnter</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">4</span>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-slate-700">プロンプト（<code className="bg-slate-100 px-1 rounded text-xs">{user}@ip-xxx-xxx-xxx-xxx:~$</code>）が表示されれば接続成功</p>
                      </div>
                    </li>
                  </ol>
                )}

                {/* 採点エリア */}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-600 mb-2">接続成功画面を提出する</p>
                  <p className="text-xs text-slate-500 mb-3">プロンプトが表示されたターミナル画面のスクリーンショットを撮影してアップロードしてください。</p>

                  <div
                    className="mb-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                    onClick={() => !isGrading && fileRef.current?.click()}
                  >
                    <svg className="mb-1.5 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-slate-500">
                      {isGrading ? 'AI採点中...' : 'クリックしてスクリーンショットをアップロード'}
                    </p>
                  </div>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleImageGrade('ssh', file)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isGrading}
                    className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGrading ? 'AI採点中...' : 'スクリーンショットをアップロード'}
                  </button>

                  {gradeState.ssh && (
                    <div className={`mt-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${gradeState.ssh.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                      {gradeState.ssh.passed ? '✓ ' : '✗ '}{gradeState.ssh.message}
                    </div>
                  )}
                </div>

                {/* Tips */}
                <p className="text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-500">Tips:</span> 秘密鍵紛失時はトップページの「再DL」ボタンで再ダウンロードできます。接続に失敗する場合はサーバーが起動中であることをトップページで確認してください。
                </p>
              </div>
            </section>

            {/* 全完了メッセージ */}
            {allPassed && (
              <section className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-5 py-4 shadow-sm">
                <p className="text-base font-bold text-emerald-800">SSH接続演習が完了しました 🎉</p>
                <p className="mt-1 text-sm text-slate-700">
                  次は「<strong>課題1-2 · LINUXコマンド</strong>」に進んでください。
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/training/linux-level1')}
                  className="mt-3 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  課題1-2 · LINUXコマンドを開く
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
