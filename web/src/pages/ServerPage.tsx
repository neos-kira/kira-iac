import { useState, useEffect, useCallback, useRef } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getCurrentUsername } from '../auth'
import { fetchMyProgress, buildAuthHeaders, BASE_URL } from '../progressApi'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

type Ec2State = 'running' | 'stopped' | 'pending' | 'stopping' | null

export function ServerPage() {
  const navigate = useSafeNavigate()
  const [snap, setSnap] = useState<TraineeProgressSnapshot | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [copiedField, setCopiedField] = useState<'ip' | 'user' | null>(null)
  const [pemLostOpen, setPemLostOpen] = useState(false)
  const [osTab, setOsTab] = useState<'mac' | 'windows'>('mac')
  const [winTab, setWinTab] = useState<'powershell' | 'teraterm'>('powershell')
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 初回: DynamoDB からスナップショット取得
  useEffect(() => {
    const username = getCurrentUsername()
    if (!username) return
    fetchMyProgress(username).then((s) => {
      if (s) setSnap(s)
      setIsLoaded(true)
    }).catch(() => setIsLoaded(true))
  }, [])

  // EC2 実態ステータス取得
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/server/status`, {
        method: 'GET',
        headers: buildAuthHeaders(),
        credentials: 'omit',
      })
      if (!res.ok) return
      const data = (await res.json()) as { ok: boolean; status?: string; publicIp?: string | null; instanceId?: string | null }
      if (!data.status) return
      setSnap((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          ec2State: data.status as NonNullable<Ec2State>,
          ec2PublicIp: data.publicIp ?? prev.ec2PublicIp,
          ec2Host: data.publicIp ?? prev.ec2Host,
          ...(data.instanceId ? { ec2InstanceId: data.instanceId } : {}),
        }
      })
    } catch { /* ignore */ }
  }, [])

  // 初回ロード後にステータス取得
  useEffect(() => {
    if (!isLoaded || (!snap?.ec2InstanceId && !snap?.ec2PublicIp)) return
    void fetchStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded])

  // pending / stopping 中はポーリング
  useEffect(() => {
    const state = snap?.ec2State
    if (state === 'pending' || state === 'stopping') {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => { void fetchStatus() }, 3000)
      }
    } else {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    }
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    }
  }, [snap?.ec2State, fetchStatus])

  const handleStart = async () => {
    if (isActionLoading || !snap) return
    setIsActionLoading(true)
    const prev = snap
    setSnap({ ...snap, ec2State: 'pending', updatedAt: new Date().toISOString() })
    try {
      const res = await fetch(`${BASE_URL}/server/start`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        body: JSON.stringify({}),
      })
      if (!res.ok) setSnap(prev)
    } catch {
      setSnap(prev)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleStop = async () => {
    if (isActionLoading || !snap) return
    setShowStopConfirm(false)
    setIsActionLoading(true)
    const prev = snap
    setSnap({ ...snap, ec2State: 'stopping', updatedAt: new Date().toISOString() })
    try {
      const res = await fetch(`${BASE_URL}/server/stop`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        body: JSON.stringify({}),
      })
      if (!res.ok) setSnap(prev)
    } catch {
      setSnap(prev)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleCreate = async () => {
    if (isCreating) return
    setIsCreating(true)
    setCreateError(null)
    try {
      const res = await fetch(`${BASE_URL}/server/create`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        body: JSON.stringify({}),
      })
      if (res.status === 409) {
        setCreateError('すでにサーバーが存在します')
        setTimeout(() => window.location.reload(), 1500)
        return
      }
      if (!res.ok) {
        setCreateError('サーバーの作成に失敗しました。時間をおいて再試行してください。')
        return
      }
      const data = await res.json() as { ok: boolean; privateKey?: string; keyPairName?: string }
      if (data.privateKey && data.keyPairName) {
        const blob = new Blob([data.privateKey], { type: 'application/x-pem-file' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${data.keyPairName}.pem`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      window.location.reload()
    } catch {
      setCreateError('サーバーの作成に失敗しました。時間をおいて再試行してください。')
    } finally {
      setIsCreating(false)
    }
  }

  const copy = (text: string, field: 'ip' | 'user') => {
    void navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  const ec2State = snap?.ec2State ?? null
  const isTransitioning = ec2State === 'pending' || ec2State === 'stopping'

  return (
    <>
      {/* 停止確認ダイアログ */}
      {showStopConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[18px] font-bold text-slate-800 mb-2">サーバーを停止しますか？</h2>
            <p className="text-[14px] text-slate-600 mb-5">停止中はSSH接続できません。作業中のデータは保持されます。</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowStopConfirm(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50">キャンセル</button>
              <button type="button" onClick={() => { void handleStop() }} className="flex-1 rounded-xl bg-red-600 py-2.5 text-[14px] font-semibold text-white hover:bg-red-700">停止する</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 py-8">
        {/* ページヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            ホームに戻る
          </button>
        </div>
        <h1 className="text-[22px] font-bold text-slate-800 mb-6">演習サーバー</h1>

        {!isLoaded ? (
          // スケルトン
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 animate-pulse">
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="h-6 w-48 bg-slate-100 rounded" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
          </div>
        ) : !snap?.ec2PublicIp ? (
          // サーバーなし: 自己作成UI
          <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-5">
            <div className="flex flex-col items-center text-center space-y-3">
              <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" /></svg>
              <div>
                <p className="text-[16px] font-semibold text-slate-700 mb-1">演習サーバーを準備しましょう</p>
                <p className="text-[13px] text-slate-500">Linuxの実機演習に使用するサーバーです。作成には1〜2分かかります。</p>
              </div>
            </div>
            {createError && (
              <p className="text-[13px] text-red-600 text-center">{createError}</p>
            )}
            <button
              type="button"
              onClick={() => { void handleCreate() }}
              disabled={isCreating}
              className="w-full rounded-xl bg-sky-500 py-3 text-[14px] font-semibold text-white hover:bg-sky-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                  作成中...
                </>
              ) : 'サーバーを作成する'}
            </button>
            <p className="text-[11px] text-slate-400 text-center">※ 5時間操作がない場合、サーバーは自動的に停止します。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* サーバー情報カード */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              {/* ステータス */}
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-slate-700">サーバー情報</h2>
                <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${
                  ec2State === 'running' ? 'bg-emerald-100 text-emerald-700' :
                  ec2State === 'stopped' ? 'bg-slate-100 text-slate-600' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {ec2State === 'running' ? '● 起動中' :
                   ec2State === 'stopped' ? '○ 停止中' :
                   ec2State === 'pending' ? '⟳ 起動中...' :
                   ec2State === 'stopping' ? '⟳ 停止中...' : '— 不明'}
                </span>
              </div>

              {/* IPアドレス */}
              <div>
                <p className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wider">IPアドレス</p>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-mono font-semibold text-slate-800">{snap.ec2PublicIp}</span>
                  <button
                    type="button"
                    onClick={() => copy(snap.ec2PublicIp ?? '', 'ip')}
                    className="rounded-md px-2 py-0.5 text-[11px] border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    {copiedField === 'ip' ? '✓ コピー済' : 'コピー'}
                  </button>
                </div>
                <p className="text-[12px] mt-1" style={{ color: '#64748B' }}>※ IPアドレスはサーバーを起動するたびに変わります。接続前に必ず最新のIPを確認してください。</p>
              </div>

              {/* ユーザー名 */}
              {snap.ec2Username && (
                <div>
                  <p className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wider">ユーザー名</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-mono font-semibold text-slate-800">{snap.ec2Username}</span>
                    <button
                      type="button"
                      onClick={() => copy(snap.ec2Username ?? '', 'user')}
                      className="rounded-md px-2 py-0.5 text-[11px] border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      {copiedField === 'user' ? '✓ コピー済' : 'コピー'}
                    </button>
                  </div>
                </div>
              )}

              {/* 秘密鍵 */}
              {snap.keyPairName && (
                <div>
                  <p className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wider">秘密鍵ファイル</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-mono text-slate-700">{snap.keyPairName}.pem</span>
                    <button
                      type="button"
                      onClick={() => setPemLostOpen((v) => !v)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                    >
                      {pemLostOpen ? '閉じる' : '紛失した場合'}
                    </button>
                  </div>
                  {pemLostOpen && (
                    <p className="mt-2 text-[12px] text-slate-600 leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                      秘密鍵を紛失した場合は管理者（講師）に連絡し、サーバー再作成を依頼してください。研修の進捗は保持されます。
                    </p>
                  )}
                </div>
              )}

              {/* 起動・停止ボタン */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                {isTransitioning ? (
                  <button type="button" disabled className="flex-1 rounded-xl bg-slate-100 py-2.5 text-[13px] font-medium text-slate-400 cursor-not-allowed">
                    {ec2State === 'pending' ? '起動中...' : '停止中...'}
                  </button>
                ) : ec2State === 'running' ? (
                  <button
                    type="button"
                    onClick={() => setShowStopConfirm(true)}
                    disabled={isActionLoading}
                    className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    サーバーを停止する
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { void handleStart() }}
                    disabled={isActionLoading}
                    className="flex-1 rounded-xl bg-sky-600 py-2.5 text-[13px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
                  >
                    サーバーを起動する
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { void fetchStatus() }}
                  className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                  title="ステータスを更新"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            {/* 注意事項 */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
              <p className="text-[12px] font-semibold text-amber-700">⚠ ご注意</p>
              <p className="text-[12px] text-amber-700">使用後は必ずサーバーを停止してください。</p>
              <p className="text-[12px] text-amber-700">5時間操作がない場合、サーバーは自動的に停止します。</p>
            </div>

            {/* SSH接続コマンド */}
            {ec2State === 'running' && snap.ec2PublicIp && snap.ec2Username && snap.keyPairName && (() => {
              const pemName = `${snap.keyPairName}.pem`
              const sshCmd = `ssh -i ${pemName} ${snap.ec2Username}@${snap.ec2PublicIp}`
              const cdMac = `cd ~/Downloads`
              const permCmdMac = `chmod 400 ${pemName}`
              const cdWin = String.raw`cd $env:USERPROFILE\Downloads`
              const permCmdWin = `icacls "${pemName}" /inheritance:r /grant:r "$($env:USERNAME):(R)"`
              const copyCmd = (text: string, key: string) => {
                void navigator.clipboard.writeText(text)
                setCopiedCmd(key)
                setTimeout(() => setCopiedCmd(null), 1500)
              }
              const CodeBlock = ({ text, cmdKey }: { text: string; cmdKey: string }) => (
                <div className="relative">
                  <pre className="rounded-lg bg-slate-900 px-4 py-3 font-mono text-sm text-green-400 overflow-x-auto whitespace-nowrap block pr-20">{text}</pre>
                  <button
                    type="button"
                    onClick={() => copyCmd(text, cmdKey)}
                    className="absolute top-2 right-2 rounded px-2 py-0.5 text-[11px] font-medium border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                  >
                    {copiedCmd === cmdKey ? '✓ コピー' : 'コピー'}
                  </button>
                </div>
              )
              return (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  {/* OSタブ */}
                  <div className="flex border-b border-slate-200">
                    {(['mac', 'windows'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setOsTab(tab)}
                        className={`px-4 py-2 text-[12px] font-medium transition-colors ${osTab === tab ? 'text-sky-600 border-b-2 border-sky-500 bg-white -mb-px' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {tab === 'mac' ? 'Mac / Linux' : 'Windows'}
                      </button>
                    ))}
                  </div>

                  {osTab === 'mac' ? (
                    <div className="px-4 py-4 space-y-3">
                      <ol className="space-y-1.5 list-decimal list-inside">
                        <li className="text-[12px] text-slate-600">Finderからアプリケーション→ユーティリティ→ターミナルを開くか、Spotlight（Command+Space）で「ターミナル」と検索してください。</li>
                        <li className="text-[12px] text-slate-600">秘密鍵ファイルのあるフォルダに移動してください</li>
                        <li className="text-[12px] text-slate-600">パーミッション設定を実行してください</li>
                        <li className="text-[12px] text-slate-600">SSH接続コマンドを実行してください</li>
                      </ol>
                      <CodeBlock text={cdMac} cmdKey="mac-cd" />
                      <CodeBlock text={permCmdMac} cmdKey="mac-perm" />
                      <CodeBlock text={sshCmd} cmdKey="mac-ssh" />
                    </div>
                  ) : (
                    <div>
                      {/* Windowsサブタブ */}
                      <div className="flex border-b border-slate-100 bg-slate-50 px-4">
                        {(['powershell', 'teraterm'] as const).map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setWinTab(sub)}
                            className={`px-3 py-2 text-[11px] font-medium transition-colors ${winTab === sub ? 'text-sky-600 border-b-2 border-sky-500 -mb-px bg-white' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {sub === 'powershell' ? 'PowerShell' : 'TeraTerm'}
                          </button>
                        ))}
                      </div>

                      {winTab === 'powershell' ? (
                        <div className="px-4 py-4 space-y-4">
                          {/* Step 1 */}
                          <div className="space-y-2">
                            <p className="text-[12px] font-semibold text-slate-700">① PowerShellを管理者権限で開く</p>
                            <p className="text-[12px] text-slate-600">Windowsキーを押して「PowerShell」と検索し、「管理者として実行」を選択してください。</p>
                            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                              <p className="text-[11px] text-amber-600">⚠️ 通常のPowerShellではなく「管理者として実行」を選択してください</p>
                            </div>
                          </div>
                          {/* Step 2 */}
                          <div className="space-y-2">
                            <p className="text-[12px] font-semibold text-slate-700">② 秘密鍵ファイルのあるフォルダに移動</p>
                            <p className="text-[12px] text-slate-600">ダウンロードフォルダに移動します。以下のコマンドをそのまま実行してください。</p>
                            <CodeBlock text={cdWin} cmdKey="win-cd" />
                          </div>
                          {/* Step 3 */}
                          <div className="space-y-2">
                            <p className="text-[12px] font-semibold text-slate-700">③ 秘密鍵ファイルのパーミッション設定</p>
                            <p className="text-[12px] text-slate-600">秘密鍵ファイルに適切なアクセス権限を設定します。セキュリティ上必要な手順です。</p>
                            <CodeBlock text={permCmdWin} cmdKey="win-perm" />
                            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                              <p className="text-[11px] text-green-700">「1個のファイルが正常に処理されました」と表示されれば成功です。</p>
                            </div>
                          </div>
                          {/* Step 4 */}
                          <div className="space-y-2">
                            <p className="text-[12px] font-semibold text-slate-700">④ SSH接続</p>
                            <p className="text-[12px] text-slate-600">以下のコマンドを実行してサーバーに接続します。初回接続時は「yes」と入力してEnterを押してください。</p>
                            <CodeBlock text={sshCmd} cmdKey="win-ssh" />
                            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                              <p className="text-[11px] text-green-700">「$ 」が表示されれば接続成功です。</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-4 space-y-3">
                          <ol className="space-y-1.5 list-decimal list-inside">
                            <li className="text-[12px] text-slate-600">
                              TeraTermをインストールしてください（未インストールの場合）
                              <br />
                              <a
                                href="https://teratermproject.github.io/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-4 text-sky-500 underline"
                              >
                                https://teratermproject.github.io/
                              </a>
                            </li>
                            <li className="text-[12px] text-slate-600">TeraTermを起動し、以下の接続情報を入力してください</li>
                            <li className="text-[12px] text-slate-600">認証画面で秘密鍵ファイルを選択してください</li>
                          </ol>
                          {/* 接続情報カード */}
                          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                            {(
                              [
                                { label: 'ホスト', value: snap.ec2PublicIp ?? '', copyKey: 'tt-ip' as string | null },
                                { label: 'TCPポート', value: '22', copyKey: null },
                                { label: 'サービス', value: 'SSH', copyKey: null },
                                { label: 'ユーザー名', value: snap.ec2Username ?? '', copyKey: 'tt-user' as string | null },
                                { label: '認証方式', value: 'RSA/DSA/ECDSA/ED25519鍵を使う', copyKey: null },
                                { label: '秘密鍵ファイル', value: pemName, copyKey: null },
                              ] as { label: string; value: string; copyKey: string | null }[]
                            ).map(({ label, value, copyKey }) => (
                              <div key={label} className="flex items-center justify-between text-[12px]">
                                <span className="text-slate-500 shrink-0 w-28">{label}</span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-slate-800 truncate">{value}</span>
                                  {copyKey && (
                                    <button
                                      type="button"
                                      onClick={() => copyCmd(value, copyKey)}
                                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                                    >
                                      {copiedCmd === copyKey ? '✓' : 'コピー'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-500">※ 秘密鍵ファイルは .pem のままで使用できます。変換不要です。</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </>
  )
}
