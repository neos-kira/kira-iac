import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProgressKey } from './trainingWbsData'
import {
  INFRA_BASIC_1_PARAMS,
  saveInfraBasic1State,
  INFRA_BASIC_1_CLEARED_KEY,
  INFRA_BASIC_1_STORAGE_KEY,
  type InfraBasic1StoredState,
} from './infraBasic1Data'
import { fetchMyProgress, postProgress, isProgressApiAvailable } from '../progressApi'
import { getCurrentDisplayName } from '../auth'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

const EMPTY_SNAPSHOT: TraineeProgressSnapshot = {
  introConfirmed: false, introAt: null, wbsPercent: 0,
  chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
}

function copyToClipboard(text: string): Promise<boolean> {
  const doFallback = (): boolean => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    let ok = false
    try {
      ok = document.execCommand('copy')
    } finally {
      document.body.removeChild(ta)
    }
    return ok
  }
  if (typeof navigator?.clipboard?.writeText === 'function') {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => doFallback())
  }
  return Promise.resolve(doFallback())
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      copyToClipboard(value).then((ok) => {
        if (ok) {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        }
      })
    },
    [value],
  )
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <code className="truncate text-sm text-slate-700">{value}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[32px] min-w-[72px] shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-indigo-500 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          {copied ? 'コピーしました' : 'コピー'}
        </button>
      </div>
    </div>
  )
}

const INFRA_BASIC_1_SECTION_IDS = ['teraterm', 'sakura', 'winmerge', 'winscp'] as const

export function InfraBasic1Page() {
  const navigate = useNavigate()
  const storageKey = getProgressKey(INFRA_BASIC_1_STORAGE_KEY)
  const clearedKey = getProgressKey(INFRA_BASIC_1_CLEARED_KEY)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [state, setState] = useState<InfraBasic1StoredState>({ checkboxes: [], sectionDone: {} })
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [ec2Params, setEc2Params] = useState<{ host: string; userRoot: string; userKensyu: string; password: string }>({
    host: INFRA_BASIC_1_PARAMS.host,
    userRoot: INFRA_BASIC_1_PARAMS.userRoot,
    userKensyu: INFRA_BASIC_1_PARAMS.userKensyu,
    password: INFRA_BASIC_1_PARAMS.password,
  })

  useEffect(() => {
    const load = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || username === 'admin') {
        setIsLoading(false)
        return
      }
      const snap = await fetchMyProgress(username)
      if (snap) {
        setServerSnapshot(snap)
        setEc2Params({
          host: snap.ec2Host || INFRA_BASIC_1_PARAMS.host,
          userRoot: INFRA_BASIC_1_PARAMS.userRoot,
          userKensyu: snap.ec2Username || INFRA_BASIC_1_PARAMS.userKensyu,
          password: snap.ec2Password || INFRA_BASIC_1_PARAMS.password,
        })
        // serverSnapshotから状態を復元（localStorageは参照しない）
        setState({
          checkboxes: snap.infra1Checkboxes ?? [],
          sectionDone: snap.infra1SectionDone ?? {},
        })
      }
      setIsLoading(false)
    }
    void load()
  }, [])

  useEffect(() => {
    document.title = 'インフラ基礎演習1'
  }, [])

  const toggleCheck = useCallback(
    (index: number) => {
      setState((prev) => {
        const checkboxes = [...(prev.checkboxes ?? [])]
        while (checkboxes.length <= index) checkboxes.push(false)
        checkboxes[index] = !checkboxes[index]
        const next = { ...prev, checkboxes }
        saveInfraBasic1State(next, storageKey)
        return next
      })
    },
    [],
  )

  const toggleSectionDone = async (sectionId: string) => {
    // 最新 state から次の状態を計算
    const sectionDone = { ...state.sectionDone, [sectionId]: !state.sectionDone[sectionId] }
    const checkboxes = state.checkboxes ?? []
    const next: InfraBasic1StoredState = { ...state, sectionDone }

    // ① localStorage に保存（補助キャッシュ）
    saveInfraBasic1State(next, storageKey)
    const allDone = INFRA_BASIC_1_SECTION_IDS.every((id) => sectionDone[id])
    if (typeof window !== 'undefined') {
      try {
        if (allDone) window.localStorage.setItem(clearedKey, 'true')
        else window.localStorage.removeItem(clearedKey)
      } catch { /* ignore */ }
    }

    // ② React state を更新
    setState(next)

    // ③ DynamoDB即時同期：serverSnapshotをベースに変化した値だけ上書き
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (username && username !== 'admin' && isProgressApiAvailable()) {
      const base: TraineeProgressSnapshot = serverSnapshot ?? {
        introConfirmed: false, introAt: null, wbsPercent: 0, chapterProgress: [],
        currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
      }
      await postProgress(username, {
        ...base,
        infra1Checkboxes: checkboxes,
        infra1SectionDone: sectionDone,
        infra1Cleared: allDone,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const handleSuspend = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (username && username !== 'admin' && isProgressApiAvailable()) {
      const base = serverSnapshot ?? EMPTY_SNAPSHOT
      const ok = await postProgress(username, {
        ...base,
        infra1Checkboxes: state.checkboxes ?? [],
        infra1SectionDone: state.sectionDone,
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

  const isChecked = (index: number) => (state.checkboxes ?? [])[index] === true
  const isSectionDone = (id: string) => state.sectionDone[id] === true

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TRAINING · INFRA BASIC
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">インフラ基礎演習1</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => { void handleSuspend() }}
              disabled={isSaving}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '中断して保存 →'}
            </button>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          </div>
        </div>

        {/* 前提 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            前提
          </p>
          <p className="mt-2 text-sm text-slate-700">
            本演習を実施する前に、<strong className="text-slate-800">端末に以下のツールをインストール</strong>してください。
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
            <li>TeraTerm</li>
            <li>sakuraエディタ</li>
            <li>WinMerge</li>
            <li>WinSCP</li>
          </ul>
        </section>

        {/* 演習用パラメータ */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            演習用パラメータ
          </p>
          <div className="mt-3 space-y-2">
            <CopyRow label="接続先IP" value={ec2Params.host} />
            <CopyRow label="ユーザ名 (root)" value={ec2Params.userRoot} />
            <CopyRow label="ユーザ名 (neos-training)" value={ec2Params.userKensyu} />
            <CopyRow label="共通パスワード" value={ec2Params.password} />
          </div>
        </section>

        {/* 進め方・操作の説明 */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-soft-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            進め方
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
            <li>
              <strong className="text-slate-700">チェックボックス：</strong>
              各タスクを完了したらチェックを入れます。チェックを入れると、その行のテキストに打ち消し線が付き、グレー表示になります。状態はブラウザに保存され、再読み込みしても保持されます。
            </li>
            <li>
              <strong className="text-slate-700">セクション完了：</strong>
              そのセクションの作業がすべて終わったら「セクション完了」ボタンを押します。押すと「済」マークが表示されます。「済」をクリックすると未完了に戻せます。
            </li>
          </ul>
        </section>

        {/* ■ TeraTerm セクション */}
        <SectionBlock
          title="TeraTerm"
          sectionId="teraterm"
          isSectionDone={isSectionDone('teraterm')}
          onSectionDone={() => toggleSectionDone('teraterm')}
          tips="現場の鉄則！作業開始前に [設定] > [ログ] から証跡保存を必ず行うこと。"
          items={[
            { idx: 0, checked: isChecked(0), onToggle: () => toggleCheck(0), text: 'TeraTermの用途を調査する' },
            { idx: 1, checked: isChecked(1), onToggle: () => toggleCheck(1), text: `ホスト ${ec2Params.host} にSSH接続する` },
            { idx: 2, checked: isChecked(2), onToggle: () => toggleCheck(2), text: `ユーザ: root / パスワード: ${ec2Params.password} でログイン` },
            { idx: 3, checked: isChecked(3), onToggle: () => toggleCheck(3), text: 'ログイン後、exit でログアウトする' },
          ]}
        />

        {/* ■ sakuraエディタ セクション */}
        <SectionBlock
          title="sakuraエディタ"
          sectionId="sakura"
          isSectionDone={isSectionDone('sakura')}
          onSectionDone={() => toggleSectionDone('sakura')}
          tips="文字コード「UTF-8」、改行コード「LF」で保存。Linux環境との互換性を意識。"
          items={[
            {
              idx: 4,
              checked: isChecked(4),
              onToggle: () => toggleCheck(4),
              text: '下記2つのファイルを新規作成し、ローカルに保存する — 趣味.txt（内容：自分の名前と趣味） / 好きな動物.txt（内容：自分の名前と好きな動物）',
            },
          ]}
        />

        {/* ■ WinMerge セクション */}
        <SectionBlock
          title="WinMerge"
          sectionId="winmerge"
          isSectionDone={isSectionDone('winmerge')}
          onSectionDone={() => toggleSectionDone('winmerge')}
          tips="リリース作業で「何を変えたか」を証明するために必須のツール。"
          items={[
            { idx: 5, checked: isChecked(5), onToggle: () => toggleCheck(5), text: 'WinMergeの用途を調査する' },
            { idx: 6, checked: isChecked(6), onToggle: () => toggleCheck(6), text: '作成した2つのファイルの「差分」を確認する' },
          ]}
        />

        {/* ■ WinSCP セクション */}
        <SectionBlock
          title="WinSCP"
          sectionId="winscp"
          isSectionDone={isSectionDone('winscp')}
          onSectionDone={() => toggleSectionDone('winscp')}
          tips="ファイルを置いたら「消す」までが作業。不要なファイルをサーバに残さない。"
          items={[
            { idx: 7, checked: isChecked(7), onToggle: () => toggleCheck(7), text: `ホスト ${ec2Params.host} に接続` },
            { idx: 8, checked: isChecked(8), onToggle: () => toggleCheck(8), text: `ユーザ: neos-training / パスワード: ${ec2Params.password} でログイン` },
            { idx: 9, checked: isChecked(9), onToggle: () => toggleCheck(9), text: 'ローカルの2ファイルをサーバの /tmp に転送' },
            { idx: 10, checked: isChecked(10), onToggle: () => toggleCheck(10), text: '転送成功を確認後、サーバ側のファイルを右クリックで削除' },
          ]}
        />

        {/* すべて済になったら：課題1-2へ進むメッセージ */}
        {INFRA_BASIC_1_SECTION_IDS.every((id) => isSectionDone(id)) && (
          <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 shadow-soft-card">
            <p className="text-sm font-semibold text-emerald-800">すべてのツール演習が完了しました</p>
            <p className="mt-2 text-sm text-slate-700">
              次は「<strong>課題1-2 · LINUXコマンド</strong>」に進んでください。
            </p>
            <button
              type="button"
              onClick={() => navigate('/training/linux-level1')}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              課題1-2 · LINUXコマンドを開く
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

type SectionItem = {
  idx: number
  checked: boolean
  onToggle: () => void
  text: string
}

function SectionBlock({
  title,
  sectionId,
  isSectionDone,
  onSectionDone,
  tips,
  items,
}: {
  title: string
  sectionId: string
  isSectionDone: boolean
  onSectionDone: () => void
  tips: string
  items: SectionItem[]
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">■ {title}</h2>
        {isSectionDone ? (
          <button
            type="button"
            onClick={onSectionDone}
            className="cursor-pointer rounded-full border border-emerald-500/60 bg-emerald-600/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300 hover:border-emerald-400 hover:bg-emerald-600/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            title="クリックで未完了に戻す"
          >
            済
          </button>
        ) : (
          <button
            type="button"
            onClick={onSectionDone}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-indigo-500 hover:bg-indigo-50"
          >
            セクション完了
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map(({ idx, checked, onToggle, text }) => (
          <li key={idx} className="flex items-start gap-2">
            <input
              type="checkbox"
              id={`infra-basic-1-${sectionId}-${idx}`}
              checked={checked}
              onChange={onToggle}
              className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
            />
            <label
              htmlFor={`infra-basic-1-${sectionId}-${idx}`}
              className={`cursor-pointer text-sm ${checked ? 'text-slate-500 line-through' : 'text-slate-700'}`}
            >
              {text}
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-400">
        <span className="font-medium text-slate-500">Tips:</span> {tips}
      </p>
    </section>
  )
}
