import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { INFRA_BASIC_1_CLEARED_KEY } from './infraBasic1Data'
import { fetchMyProgress, postProgress, isProgressApiAvailable, buildAuthHeaders, BASE_URL } from '../progressApi'
import { getCurrentDisplayName } from '../auth'
import { getProgressKey } from './trainingWbsData'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

type GradeResult = { passed: boolean; message: string; gradedAt: string }
type GradeState = Record<string, GradeResult>

const SECTION_IDS = ['teraterm', 'sakura', 'winmerge', 'winscp'] as const

const EMPTY_SNAPSHOT: TraineeProgressSnapshot = {
  introConfirmed: false, introAt: null, wbsPercent: 0,
  chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
}

// ---- クリップボード ----
function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator?.clipboard?.writeText === 'function') {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text))
  }
  return Promise.resolve(fallbackCopy(text))
}
function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } finally { document.body.removeChild(ta) }
  return ok
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    void copyToClipboard(value).then((ok) => {
      if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    })
  }, [value])
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <code className="truncate text-sm text-slate-700">{value || '—'}</code>
        {value && (
          <button type="button" onClick={handleCopy}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-indigo-500 hover:bg-indigo-50"
          >
            {copied ? 'コピーしました' : 'コピー'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---- 画像→base64変換 ----
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ---- AI画像採点 ----
async function gradeWithImage(
  section: string,
  file: File,
  username: string,
): Promise<{ passed: boolean; message: string }> {
  if (!BASE_URL) return { passed: false, message: 'APIが設定されていません' }
  try {
    const base64 = await fileToBase64(file)
    const res = await fetch(`${BASE_URL}/ai/grade-image`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'omit',
      body: JSON.stringify({ section, username, image: base64, imageType: file.type }),
    })
    if (!res.ok) return { passed: false, message: '採点に失敗しました' }
    const data = await res.json() as { passed?: boolean; message?: string }
    return { passed: !!data.passed, message: data.message ?? '採点完了' }
  } catch {
    return { passed: false, message: '採点に失敗しました' }
  }
}

// ---- 秘密鍵再ダウンロード ----
function redownloadKey(keyPairName: string, loginUsername: string) {
  const filename = `${keyPairName}.pem`
  const content = `-----BEGIN RSA PRIVATE KEY-----\n(mock key for ${loginUsername})\n-----END RSA PRIVATE KEY-----`
  const blob = new Blob([content], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ---- セクションコンポーネント（全て画像採点） ----
function ToolSection({
  title, why, tips, steps,
  gradeResult, isGrading, onImageGrade,
}: {
  title: string
  why: string
  tips: string
  steps: (string | React.ReactNode)[]
  gradeResult?: GradeResult
  isGrading: boolean
  onImageGrade: (file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const isPassed = gradeResult?.passed === true

  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors ${isPassed ? 'border-emerald-300' : 'border-slate-200'}`}>
      {/* タイトル */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-800">■ {title}</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">なぜ学ぶか：{why}</p>
        </div>
        {isPassed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            ✓ 完了
          </span>
        )}
      </div>

      {/* 手順 */}
      <ol className="mt-4 space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm text-slate-700">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {/* 採点エリア */}
      <div className="mt-5">
        {/* スクリーンショット枠 */}
        <div
          className="mb-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-[#f8f9fa] px-4 py-6 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50"
          onClick={() => !isGrading && fileRef.current?.click()}
        >
          <svg className="mb-1 h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-slate-500">
            {isGrading ? 'AI採点中...' : 'スクリーンショットをドロップまたはクリックしてアップロード'}
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImageGrade(file)
            if (fileRef.current) fileRef.current.value = ''
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isGrading}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGrading ? 'AI採点中...' : 'スクリーンショットをアップロード'}
        </button>

        {/* 採点結果 */}
        {gradeResult && (
          <div className={`mt-3 rounded-xl border px-4 py-3 text-sm font-medium ${gradeResult.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {gradeResult.passed ? '✓ ' : '✗ '}{gradeResult.message}
          </div>
        )}
      </div>

      {/* Tips */}
      <p className="mt-4 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-500">Tips:</span> {tips}
      </p>
    </section>
  )
}

// ---- メインコンポーネント ----
export function InfraBasic1Page() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [gradeState, setGradeState] = useState<GradeState>({})
  const [gradingSection, setGradingSection] = useState<string | null>(null)
  const [ec2Params, setEc2Params] = useState<{
    ip: string; loginUsername: string; keyPairName: string; ec2CreatedAt: string; hasServer: boolean
  }>({ ip: '', loginUsername: '', keyPairName: '', ec2CreatedAt: '', hasServer: false })

  const username = getCurrentDisplayName().trim().toLowerCase()
  const clearedKey = getProgressKey(INFRA_BASIC_1_CLEARED_KEY)

  // DynamoDBから読み込み
  useEffect(() => {
    document.title = 'インフラ基礎演習1'
    const load = async () => {
      if (!username || username === 'admin') { setIsLoading(false); return }
      const snap = await fetchMyProgress(username)
      if (snap) {
        setServerSnapshot(snap)
        const ip = snap.ec2PublicIp || snap.ec2Host || ''
        setEc2Params({
          ip,
          loginUsername: username,
          keyPairName: snap.keyPairName || '',
          ec2CreatedAt: snap.ec2CreatedAt || '',
          hasServer: !!ip,
        })
        setGradeState(snap.infra1GradeState ?? {})
      }
      setIsLoading(false)
    }
    void load()
  }, [username, clearedKey])

  // 採点結果をDynamoDBに保存
  const saveGrade = useCallback(async (sectionId: string, result: GradeResult) => {
    const newGradeState: GradeState = { ...gradeState, [sectionId]: result }
    setGradeState(newGradeState)

    const allPassed = SECTION_IDS.every((id) => newGradeState[id]?.passed)
    if (typeof window !== 'undefined') {
      try {
        if (allPassed) window.localStorage.setItem(clearedKey, 'true')
        else window.localStorage.removeItem(clearedKey)
      } catch { /* ignore */ }
    }

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

  // 画像採点（全セクション共通）
  const handleImageGrade = useCallback(async (sectionId: string, file: File) => {
    setGradingSection(sectionId)
    const result = await gradeWithImage(sectionId, file, username)
    await saveGrade(sectionId, { ...result, gradedAt: new Date().toISOString() })
    setGradingSection(null)
  }, [saveGrade, username])

  const allPassed = SECTION_IDS.every((id) => gradeState[id]?.passed)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* ヘッダー */}
        <div>
          <p className="text-xs text-slate-500">課題1-1 · 使用ツール</p>
          <h1 className="text-xl font-bold text-slate-800">インフラ基礎演習1</h1>
        </div>

        {/* 演習サーバー情報 or 未作成警告 */}
        {ec2Params.hasServer ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">演習サーバー情報</p>
            <div className="mt-3 space-y-2">
              <CopyRow label="サーバーIP" value={ec2Params.ip} />
              <CopyRow label="接続ユーザー" value={ec2Params.loginUsername} />
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-xs text-slate-400 shrink-0">秘密鍵</span>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <code className="truncate text-sm text-slate-700">{ec2Params.keyPairName || '—'}.pem</code>
                  {ec2Params.keyPairName && (
                    <button
                      type="button"
                      onClick={() => redownloadKey(ec2Params.keyPairName, ec2Params.loginUsername)}
                      className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-indigo-500 hover:bg-indigo-50"
                    >
                      再ダウンロード
                    </button>
                  )}
                </div>
              </div>
              {ec2Params.ec2CreatedAt && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-400">作成日時</span>
                  <span className="text-sm text-slate-600">{ec2Params.ec2CreatedAt}</span>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-900">演習サーバーがまだ作成されていません</p>
            <p className="mt-1 text-sm text-amber-700">トップページでサーバーを作成してください。</p>
            <button
              type="button"
              onClick={() => { window.location.hash = '#/' }}
              className="mt-3 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
            >
              トップページへ
            </button>
          </section>
        )}

        {/* サーバー未作成時はここで終了 */}
        {!ec2Params.hasServer && (
          <p className="text-center text-xs text-slate-400">
            サーバーを作成後、この画面に戻ってきてください。
          </p>
        )}

        {/* サーバー作成済み：以降のセクションを表示 */}
        {ec2Params.hasServer && (
          <>
            {/* 前提 */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">前提</p>
              <p className="mt-2 text-sm text-slate-700">
                本演習を実施する前に、端末に以下のツールをインストールしてください。
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                {['TeraTerm', 'sakuraエディタ', 'WinMerge', 'WinSCP'].map((tool) => (
                  <li key={tool} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                    {tool}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-slate-400">各ツールは公式サイトから最新版をダウンロードしてください。</p>
            </section>

            {/* ■ TeraTerm */}
            <ToolSection
              title="TeraTerm"
              why="現場でLinuxサーバーに接続する際に必須のツールです"
              tips="秘密鍵紛失時はトップページで再ダウンロード。接続失敗時はWindowsファイアウォール設定を確認してください"
              gradeResult={gradeState.teraterm}
              isGrading={gradingSection === 'teraterm'}
              onImageGrade={(file) => { void handleImageGrade('teraterm', file) }}
              steps={[
                'デスクトップの「TeraTerm」をダブルクリック',
                <span key="host">ホスト名に <code className="rounded bg-slate-100 px-1 font-mono text-xs">{ec2Params.ip}</code> を入力（コピーボタンから貼り付け）</span>,
                'OKをクリック',
                <span key="user">ユーザー名に <code className="rounded bg-slate-100 px-1 font-mono text-xs">{ec2Params.loginUsername}</code> を入力</span>,
                '「RSA/DSA/ECDSA/ED25519鍵を使う」を選択',
                <span key="key">デスクトップの <code className="rounded bg-slate-100 px-1 font-mono text-xs">{ec2Params.keyPairName || '（秘密鍵ファイル）'}.pem</code> を選択</span>,
                'OKをクリック → 接続成功を確認',
                <span key="exit"><code className="rounded bg-slate-100 px-1 font-mono text-xs">exit</code> でログアウト</span>,
                <span key="ss">接続成功後のプロンプト画面をスクリーンショット撮影し、下のボタンからアップロード</span>,
              ]}
            />

            {/* ■ sakuraエディタ */}
            <ToolSection
              title="sakuraエディタ"
              why="設定ファイルやログファイルを編集する際に使います"
              tips="文字コード「UTF-8」、改行コード「LF」で保存。Linux環境との互換性を意識してください。"
              gradeResult={gradeState.sakura}
              isGrading={gradingSection === 'sakura'}
              onImageGrade={(file) => { void handleImageGrade('sakura', file) }}
              steps={[
                'デスクトップの「sakura」アイコンをダブルクリック',
                '新規ファイルに「自分の名前と趣味」を入力',
                '「ファイル」→「名前を付けて保存」をクリック',
                <span key="趣味">ファイル名を <code className="rounded bg-slate-100 px-1 font-mono text-xs">趣味.txt</code> にして保存</span>,
                <span key="動物">同様に <code className="rounded bg-slate-100 px-1 font-mono text-xs">好きな動物.txt</code> も作成</span>,
                'ファイル保存ダイアログ、またはエディタ画面にファイル名が表示された状態でスクリーンショット撮影し、下のボタンからアップロード',
              ]}
            />

            {/* ■ WinMerge */}
            <ToolSection
              title="WinMerge"
              why="リリース作業で変更内容を証明するために必須のツールです"
              tips="リリース作業で「何を変えたか」を証明するために必須のツール。差分確認を習慣にしましょう。"
              gradeResult={gradeState.winmerge}
              isGrading={gradingSection === 'winmerge'}
              onImageGrade={(file) => { void handleImageGrade('winmerge', file) }}
              steps={[
                'WinMergeを起動',
                '「ファイル」→「開く」で、先ほど作成した2つのファイルを選択',
                '差分が表示されることを確認',
                'WinMergeの差分表示画面をスクリーンショット撮影し、下のボタンからアップロード',
              ]}
            />

            {/* ■ WinSCP */}
            <ToolSection
              title="WinSCP"
              why="ローカルとサーバー間でファイルを転送する際に使います"
              tips="ファイルを置いたら「消す」まで作業。不要なファイルをサーバーに残さない習慣をつけましょう。"
              gradeResult={gradeState.winscp}
              isGrading={gradingSection === 'winscp'}
              onImageGrade={(file) => { void handleImageGrade('winscp', file) }}
              steps={[
                'WinSCPを起動',
                <span key="host">ホスト名に <code className="rounded bg-slate-100 px-1 font-mono text-xs">{ec2Params.ip}</code> を入力</span>,
                <span key="user">ユーザー名に <code className="rounded bg-slate-100 px-1 font-mono text-xs">{ec2Params.loginUsername}</code> を入力</span>,
                <span key="key">設定 → SSH → 認証 で秘密鍵（<code className="rounded bg-slate-100 px-1 font-mono text-xs">{ec2Params.keyPairName || '秘密鍵ファイル'}.pem</code>）を指定</span>,
                'ログインをクリック',
                <span key="transfer">ローカルの2ファイルをサーバーの <code className="rounded bg-slate-100 px-1 font-mono text-xs">/tmp</code> に転送</span>,
                '転送成功を確認後、サーバー側のファイルを右クリックで削除',
                'WinSCPの接続成功画面またはファイル転送画面をスクリーンショット撮影し、下のボタンからアップロード',
              ]}
            />

            {/* 全完了メッセージ */}
            {allPassed && (
              <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 shadow-sm">
                <p className="text-base font-bold text-emerald-800">すべてのツール演習が完了しました 🎉</p>
                <p className="mt-2 text-sm text-slate-700">
                  次は「<strong>課題1-2 · LINUXコマンド</strong>」に進んでください。
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/training/linux-level1')}
                  className="mt-4 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
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
