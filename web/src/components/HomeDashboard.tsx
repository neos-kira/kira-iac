import { useState, Fragment } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getCurrentRole, getCurrentDisplayName } from '../auth'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { NeOSLogo } from './NeOSLogo'
import { VI_STEPS, SHELL_QUESTIONS } from '../training/InfraBasic4Data'
import { isProgressApiAvailable, postProgress } from '../progressApi'

function getTrainingUrl(path: string) {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') ||
        window.location.origin
      : ''
  return `${base}#${path}`
}

function isKiraTestUser(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return getCurrentDisplayName().trim().toLowerCase() === 'kira-test'
  } catch {
    return false
  }
}

type IllustrationKind = 'terminal' | 'office' | 'network' | 'editor' | 'cloud' | 'server'

function getIllustrationKind(taskName: string): IllustrationKind {
  if (taskName.includes('はじめに') || taskName.includes('IT業界') || taskName.includes('IT基礎')) return 'office'
  if (taskName.includes('クラウド') || taskName.includes('AWS') || taskName.includes('仮想')) return 'cloud'
  if (taskName.includes('構築') || taskName.includes('Ubuntu') || taskName.includes('サーバー')) return 'server'
  if (taskName.includes('vi') || taskName.includes('エディタ') || taskName.includes('シェル') || taskName.includes('スクリプト')) return 'editor'
  if (taskName.includes('TCP') || taskName.includes('ネットワーク')) return 'network'
  return 'terminal'
}

function HeroIllustration({ kind }: { kind: IllustrationKind }) {
  if (kind === 'office') {
    return (
      <svg viewBox="0 0 110 90" width="110" style={{ display: 'block', margin: 'auto' }}>
        <rect x="25" y="20" width="60" height="38" rx="4" fill="#1E3A5F" stroke="#3B82F6" strokeWidth="1.5"/>
        <rect x="29" y="24" width="52" height="30" rx="2" fill="#0EA5E9" opacity="0.2"/>
        <rect x="33" y="28" width="28" height="2.5" rx="1" fill="#7DD3FC" opacity="0.85"/>
        <rect x="33" y="33" width="20" height="2.5" rx="1" fill="#6EE7B7" opacity="0.7"/>
        <rect x="33" y="38" width="34" height="2.5" rx="1" fill="#7DD3FC" opacity="0.55"/>
        <rect x="33" y="43" width="16" height="2.5" rx="1" fill="#FCD34D" opacity="0.7"/>
        <rect x="51" y="58" width="8" height="6" rx="1" fill="#334155"/>
        <rect x="41" y="64" width="28" height="3" rx="1.5" fill="#334155"/>
        <rect x="23" y="71" width="64" height="9" rx="3" fill="#1E293B" stroke="#334155" strokeWidth="1"/>
        <rect x="27" y="74" width="8" height="3" rx="1" fill="#334155"/>
        <rect x="38" y="74" width="32" height="3" rx="1" fill="#334155"/>
        <rect x="73" y="74" width="8" height="3" rx="1" fill="#334155"/>
        <circle cx="55" cy="12" r="7" fill="#FCD34D" opacity="0.9"/>
        <circle cx="52.5" cy="11" r="1" fill="#1E293B"/>
        <circle cx="57.5" cy="11" r="1" fill="#1E293B"/>
        <path d="M52 14 Q55 16 58 14" stroke="#1E293B" strokeWidth="0.8" fill="none"/>
      </svg>
    )
  }
  if (kind === 'network') {
    return (
      <svg viewBox="0 0 110 90" width="110" style={{ display: 'block', margin: 'auto' }}>
        <rect x="4" y="28" width="28" height="20" rx="3" fill="#1E3A5F" stroke="#3B82F6" strokeWidth="1.5"/>
        <rect x="8" y="32" width="20" height="12" rx="1" fill="#0EA5E9" opacity="0.3"/>
        <rect x="13" y="48" width="10" height="4" rx="1" fill="#334155"/>
        <rect x="7" y="52" width="22" height="2" rx="1" fill="#334155"/>
        <rect x="78" y="28" width="28" height="20" rx="3" fill="#1E3A5F" stroke="#3B82F6" strokeWidth="1.5"/>
        <rect x="82" y="32" width="20" height="12" rx="1" fill="#0EA5E9" opacity="0.3"/>
        <rect x="87" y="48" width="10" height="4" rx="1" fill="#334155"/>
        <rect x="81" y="52" width="22" height="2" rx="1" fill="#334155"/>
        <rect x="41" y="33" width="28" height="12" rx="3" fill="#1E293B" stroke="#6366F1" strokeWidth="1"/>
        <circle cx="50" cy="39" r="2" fill="#22C55E"/>
        <rect x="54" y="36" width="11" height="2" rx="1" fill="#475569"/>
        <rect x="54" y="40" width="7" height="2" rx="1" fill="#475569"/>
        <line x1="32" y1="38" x2="41" y2="39" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="3 2"/>
        <line x1="69" y1="39" x2="78" y2="38" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="3 2"/>
        <circle cx="36" cy="38.5" r="2.5" fill="#60A5FA"/>
        <circle cx="74" cy="38.5" r="2.5" fill="#34D399"/>
        <text x="55" y="70" textAnchor="middle" fill="#94A3B8" fontSize="7.5" fontFamily="sans-serif">TCP/IP Network</text>
        <line x1="18" y1="54" x2="18" y2="62" stroke="#334155" strokeWidth="1"/>
        <line x1="92" y1="54" x2="92" y2="62" stroke="#334155" strokeWidth="1"/>
        <rect x="10" y="62" width="16" height="2" rx="1" fill="#334155"/>
        <rect x="84" y="62" width="16" height="2" rx="1" fill="#334155"/>
      </svg>
    )
  }
  if (kind === 'editor') {
    return (
      <svg viewBox="0 0 110 90" width="110" style={{ display: 'block', margin: 'auto' }}>
        <rect x="3" y="5" width="104" height="80" rx="5" fill="#0F172A" stroke="#334155" strokeWidth="1"/>
        <rect x="3" y="5" width="104" height="18" rx="5" fill="#1E293B"/>
        <rect x="3" y="17" width="104" height="6" fill="#1E293B"/>
        <circle cx="13" cy="14" r="3.5" fill="#EF4444"/>
        <circle cx="22" cy="14" r="3.5" fill="#EAB308"/>
        <circle cx="31" cy="14" r="3.5" fill="#22C55E"/>
        <text x="55" y="16" textAnchor="middle" fill="#64748B" fontSize="7" fontFamily="monospace">script.sh</text>
        <rect x="3" y="23" width="16" height="62" fill="#1E293B"/>
        <text x="11" y="35" textAnchor="middle" fill="#475569" fontSize="7" fontFamily="monospace">1</text>
        <text x="11" y="46" textAnchor="middle" fill="#475569" fontSize="7" fontFamily="monospace">2</text>
        <text x="11" y="57" textAnchor="middle" fill="#475569" fontSize="7" fontFamily="monospace">3</text>
        <text x="11" y="68" textAnchor="middle" fill="#475569" fontSize="7" fontFamily="monospace">4</text>
        <text x="11" y="79" textAnchor="middle" fill="#475569" fontSize="7" fontFamily="monospace">5</text>
        <text x="22" y="35" fill="#C084FC" fontSize="8" fontFamily="monospace">#!/bin/bash</text>
        <text x="22" y="46" fill="#60A5FA" fontSize="8" fontFamily="monospace">{'for i in 1..3'}</text>
        <text x="22" y="57" fill="#F472B6" fontSize="8" fontFamily="monospace">{'  echo '}<tspan fill="#FCD34D">{"\"$i\""}</tspan></text>
        <text x="22" y="68" fill="#F472B6" fontSize="8" fontFamily="monospace">done</text>
        <text x="22" y="79" fill="#86EFAC" fontSize="8" fontFamily="monospace">$ </text>
        <rect x="22" y="71" width="4" height="8" rx="1" fill="#60A5FA" opacity="0.85"/>
      </svg>
    )
  }
  if (kind === 'cloud') {
    return (
      <svg viewBox="0 0 110 90" width="110" style={{ display: 'block', margin: 'auto' }}>
        <ellipse cx="35" cy="35" rx="18" ry="14" fill="#1E3A5F" stroke="#3B82F6" strokeWidth="1.5"/>
        <ellipse cx="55" cy="28" rx="20" ry="16" fill="#1E3A5F" stroke="#3B82F6" strokeWidth="1.5"/>
        <ellipse cx="74" cy="35" rx="16" ry="12" fill="#1E3A5F" stroke="#3B82F6" strokeWidth="1.5"/>
        <rect x="17" y="34" width="76" height="14" fill="#1E3A5F"/>
        <text x="55" y="43" textAnchor="middle" fill="#7DD3FC" fontSize="9" fontFamily="sans-serif" fontWeight="bold">AWS Cloud</text>
        <rect x="8" y="56" width="28" height="18" rx="3" fill="#1E293B" stroke="#6366F1" strokeWidth="1"/>
        <circle cx="16" cy="63" r="2.5" fill="#22C55E"/>
        <rect x="21" y="60" width="11" height="2" rx="1" fill="#475569"/>
        <rect x="21" y="64" width="8" height="2" rx="1" fill="#475569"/>
        <text x="22" y="71" textAnchor="middle" fill="#94A3B8" fontSize="6" fontFamily="monospace">EC2</text>
        <rect x="41" y="56" width="28" height="18" rx="3" fill="#1E293B" stroke="#6366F1" strokeWidth="1"/>
        <circle cx="49" cy="63" r="2.5" fill="#22C55E"/>
        <rect x="54" y="60" width="11" height="2" rx="1" fill="#475569"/>
        <rect x="54" y="64" width="8" height="2" rx="1" fill="#475569"/>
        <text x="55" y="71" textAnchor="middle" fill="#94A3B8" fontSize="6" fontFamily="monospace">S3</text>
        <rect x="74" y="56" width="28" height="18" rx="3" fill="#1E293B" stroke="#6366F1" strokeWidth="1"/>
        <circle cx="82" cy="63" r="2.5" fill="#F59E0B"/>
        <rect x="87" y="60" width="11" height="2" rx="1" fill="#475569"/>
        <rect x="87" y="64" width="8" height="2" rx="1" fill="#475569"/>
        <text x="88" y="71" textAnchor="middle" fill="#94A3B8" fontSize="6" fontFamily="monospace">RDS</text>
        <line x1="34" y1="48" x2="22" y2="56" stroke="#3B82F6" strokeWidth="1" strokeDasharray="3 2" opacity="0.7"/>
        <line x1="55" y1="48" x2="55" y2="56" stroke="#3B82F6" strokeWidth="1" strokeDasharray="3 2" opacity="0.7"/>
        <line x1="76" y1="48" x2="88" y2="56" stroke="#3B82F6" strokeWidth="1" strokeDasharray="3 2" opacity="0.7"/>
      </svg>
    )
  }
  if (kind === 'server') {
    return (
      <svg viewBox="0 0 110 90" width="110" style={{ display: 'block', margin: 'auto' }}>
        <rect x="14" y="4" width="82" height="82" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="1.5"/>
        <rect x="8" y="10" width="6" height="70" rx="2" fill="#1E293B" stroke="#334155" strokeWidth="1"/>
        <rect x="96" y="10" width="6" height="70" rx="2" fill="#1E293B" stroke="#334155" strokeWidth="1"/>
        <rect x="18" y="10" width="74" height="14" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1"/>
        <circle cx="26" cy="17" r="3" fill="#22C55E"/>
        <rect x="32" y="14" width="32" height="2.5" rx="1" fill="#334155"/>
        <rect x="32" y="18" width="22" height="2.5" rx="1" fill="#334155"/>
        <rect x="83" y="14" width="5" height="3" rx="0.5" fill="#3B82F6"/>
        <rect x="83" y="19" width="5" height="3" rx="0.5" fill="#3B82F6"/>
        <rect x="18" y="28" width="74" height="14" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1"/>
        <circle cx="26" cy="35" r="3" fill="#22C55E"/>
        <rect x="32" y="32" width="32" height="2.5" rx="1" fill="#334155"/>
        <rect x="32" y="36" width="22" height="2.5" rx="1" fill="#334155"/>
        <rect x="83" y="32" width="5" height="3" rx="0.5" fill="#3B82F6"/>
        <rect x="83" y="37" width="5" height="3" rx="0.5" fill="#3B82F6"/>
        <rect x="18" y="46" width="74" height="14" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1"/>
        <circle cx="26" cy="53" r="3" fill="#F59E0B"/>
        <rect x="32" y="50" width="32" height="2.5" rx="1" fill="#334155"/>
        <rect x="32" y="54" width="22" height="2.5" rx="1" fill="#334155"/>
        <rect x="83" y="50" width="5" height="3" rx="0.5" fill="#475569"/>
        <rect x="83" y="55" width="5" height="3" rx="0.5" fill="#475569"/>
        <rect x="18" y="64" width="74" height="14" rx="2" fill="#1E293B" stroke="#334155" strokeWidth="1"/>
        <rect x="22" y="68" width="6" height="4" rx="0.5" fill="#3B82F6"/>
        <rect x="30" y="68" width="6" height="4" rx="0.5" fill="#3B82F6"/>
        <rect x="38" y="68" width="6" height="4" rx="0.5" fill="#22C55E"/>
        <rect x="46" y="68" width="6" height="4" rx="0.5" fill="#22C55E"/>
        <rect x="54" y="68" width="6" height="4" rx="0.5" fill="#EF4444"/>
        <rect x="62" y="68" width="6" height="4" rx="0.5" fill="#475569"/>
        <rect x="70" y="68" width="6" height="4" rx="0.5" fill="#475569"/>
        <rect x="78" y="68" width="6" height="4" rx="0.5" fill="#475569"/>
      </svg>
    )
  }
  // terminal (default: Linux commands, SSH)
  return (
    <svg viewBox="0 0 110 90" width="110" style={{ display: 'block', margin: 'auto' }}>
      <rect x="1" y="1" width="108" height="88" rx="5" fill="#0F172A"/>
      <circle cx="12" cy="11" r="3.5" fill="#EF4444"/>
      <circle cx="21" cy="11" r="3.5" fill="#EAB308"/>
      <circle cx="30" cy="11" r="3.5" fill="#22C55E"/>
      <text x="6" y="29" fill="#86EFAC" fontSize="9" fontFamily="monospace">$ ls -la</text>
      <text x="6" y="41" fill="#94A3B8" fontSize="8.5" fontFamily="monospace">total 24</text>
      <text x="6" y="53" fill="#94A3B8" fontSize="8.5" fontFamily="monospace">drwxr-xr-x 3</text>
      <text x="6" y="65" fill="#94A3B8" fontSize="8.5" fontFamily="monospace">-rw-r--r-- 1</text>
      <text x="6" y="77" fill="#86EFAC" fontSize="9" fontFamily="monospace">$ </text>
      <rect x="17" y="69" width="5" height="10" rx="1" fill="#86EFAC"/>
    </svg>
  )
}

type Props = {
  serverSnapshot: TraineeProgressSnapshot | null
  isSnapLoaded: boolean
  progressPct: { pct: number; completed: number; total: number } | null
  isIntroCompleted: boolean
  setShowIntroRequiredPopup: React.Dispatch<React.SetStateAction<boolean>>
}

type TabKey = 'all' | 'linux' | 'aws' | 'windows' | 'network' | 'security' | 'db' | 'dev'

const TAB_LABELS: Record<TabKey, string> = {
  all: 'すべて', linux: 'Linux', aws: 'AWS', windows: 'Windows',
  network: 'ネットワーク', security: 'セキュリティ', db: 'データベース', dev: '開発',
}

export function HomeDashboard({
  serverSnapshot,
  isSnapLoaded,
  progressPct,
  isIntroCompleted,
  setShowIntroRequiredPopup,
}: Props) {
  const navigate = useSafeNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const username = getCurrentDisplayName()
  const isManager = getCurrentRole() === 'manager'
  const snap = serverSnapshot
  const canAccessAll = isKiraTestUser()

  // ─── 進捗派生値 ───────────────────────────────────────────
  const introOk = isIntroCompleted
  const introStep = Number(snap?.introStep ?? 0)
  const infra1Ok = snap?.infra1Cleared === true && snap?.l1Cleared === true
  const l1QuizPart = snap?.l1CurrentPart ?? 0
  const l1QuizQ = snap?.l1CurrentQuestion ?? 0
  const l1QuizDone = l1QuizPart * 10 + l1QuizQ  // 30問中の累計完了数
  const l2Done = snap?.l2CurrentQuestion ?? 0
  const infra2Ok = l2Done >= 10 && introOk
  const infra3Ok = Object.values(snap?.infra32Answers ?? {}).some((v) => v && String(v).trim())
  const infra4ViDone = (snap?.infra4ViDoneSteps ?? []).length
  const infra4ShellDone = (snap?.infra4ShellDoneQuestions ?? []).length
  const infra4Ok = infra4ViDone >= VI_STEPS.length && infra4ShellDone >= SHELL_QUESTIONS.length
  const infra4Active = infra4ViDone > 0 || infra4ShellDone > 0
  const infra5PhaseDone = (snap?.infra5PhaseDone ?? []).length
  const infra5Ok = infra5PhaseDone >= 5
  const infra5Active = infra5PhaseDone > 0
  const itClearedCount = Object.values(
    (snap?.itBasicsProgress ?? {}) as Record<string, { cleared: boolean }>,
  ).filter((v) => v.cleared).length
  const itOk = itClearedCount >= 7
  const itActive = itClearedCount > 0

  // ─── lastActive 判定ヘルパー（ステップ一覧より前に定義） ──────
  const isLastActiveModuleDone = (moduleId: string | undefined): boolean => {
    switch (moduleId) {
      case 'linux-level1':    return snap?.l1Cleared === true
      case 'linux-level2':    return infra2Ok
      case 'infra-basic-3-2': return infra3Ok
      case 'infra-basic-4':   return infra4Ok
      case 'infra-basic-5':   return infra5Ok
      default: return false
    }
  }
  /** 指定モジュールIDのいずれかが lastActive で、かつ未完了なら true */
  const isLastActiveFor = (moduleIds: string[]): boolean =>
    !!snap?.lastActive &&
    moduleIds.includes(snap.lastActive.moduleId) &&
    !isLastActiveModuleDone(snap.lastActive.moduleId)

  // ─── ステップ一覧 ─────────────────────────────────────────
  type StepStatus = 'done' | 'active' | 'todo'
  type StepItem = {
    no: number; name: string; sub: string; status: StepStatus
    progress: number | null; progressLabel: string | null
    action: () => void; tab: TabKey | 'all'; appendix?: boolean
  }

  const steps: StepItem[] = [
    {
      no: 1, name: 'はじめに', sub: '行動基準・セキュリティ基礎',
      status: introOk ? 'done' : (introStep >= 1 ? 'active' : 'todo'),
      progress: introOk ? 100 : introStep > 0 ? Math.round((introStep / 5) * 100) : null,
      progressLabel: introStep > 0 && !introOk ? `${introStep} / 5ステップ` : null,
      action: () => navigate('/training/intro'), tab: 'all',
    },
    {
      no: 2, name: 'Linux基本操作・コマンド', sub: 'ツール操作・Linuxコマンド30問',
      status: infra1Ok ? 'done' : (
        (snap?.infra1Checkboxes ?? []).some(Boolean) ||
        (snap?.l1CurrentPart ?? 0) > 0 ||
        (snap?.l1CurrentQuestion ?? 0) > 0 ||
        isLastActiveFor(['linux-level1'])
          ? 'active' : 'todo'
      ),
      progress: infra1Ok ? 100 : l1QuizDone > 0 ? Math.round((l1QuizDone / 30) * 100) : null,
      progressLabel: l1QuizDone > 0 && !infra1Ok ? `${l1QuizDone} / 30問` : null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-top'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'linux',
    },
    {
      no: 3, name: 'ネットワーク基礎', sub: 'ネットワーク実践・TCP/IP10問',
      status: infra2Ok ? 'done' : (l2Done > 0 || isLastActiveFor(['linux-level2']) ? 'active' : 'todo'),
      progress: infra2Ok ? 100 : l2Done > 0 ? Math.round((l2Done / 10) * 100) : null,
      progressLabel: l2Done > 0 && !infra2Ok ? `${l2Done} / 10問` : null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-2-top'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'network',
    },
    {
      no: 4, name: 'ファイル操作・viエディタ', sub: 'OS/仮想化/クラウド解説・記述チェック',
      status: infra3Ok ? 'done' : (Object.keys(snap?.infra32Answers ?? {}).length > 0 || isLastActiveFor(['infra-basic-3-2']) ? 'active' : 'todo'),
      progress: infra3Ok ? 100 : null, progressLabel: null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-3-top'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'linux',
    },
    {
      no: 5, name: 'シェルスクリプト', sub: 'vi演習・シェルスクリプト演習',
      status: infra4Ok ? 'done' : (infra4Active || isLastActiveFor(['infra-basic-4']) ? 'active' : 'todo'),
      progress: infra4Ok ? 100 : infra4Active ? Math.round(((infra4ViDone + infra4ShellDone) / (VI_STEPS.length + SHELL_QUESTIONS.length)) * 100) : null,
      progressLabel: infra4Active && !infra4Ok ? `vi: ${infra4ViDone}/${VI_STEPS.length}  シェル: ${infra4ShellDone}/${SHELL_QUESTIONS.length}` : null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-4'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'linux',
    },
    {
      no: 6, name: 'サーバー構築（Ubuntu）', sub: 'OS設定・ディスク・apache2・AIDE・PostgreSQL',
      status: infra5Ok ? 'done' : (infra5Active || isLastActiveFor(['infra-basic-5']) ? 'active' : 'todo'),
      progress: infra5Ok ? 100 : infra5Active ? Math.round((infra5PhaseDone / 5) * 100) : null,
      progressLabel: infra5Active && !infra5Ok ? `${infra5PhaseDone} / 5フェーズ` : null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-5'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'linux',
    },
    {
      no: 7, name: 'IT業界の歩き方', sub: 'IT業界の基礎知識',
      status: itOk ? 'done' : (itActive ? 'active' : 'todo'),
      progress: itOk ? 100 : itActive ? Math.round((itClearedCount / 7) * 100) : null,
      progressLabel: itActive && !itOk ? `${itClearedCount} / 7項目` : null,
      action: () => navigate('/it-basics'), tab: 'all', appendix: true,
    },
  ]

  const filteredSteps =
    activeTab === 'all' ? steps :
    activeTab === 'linux' ? steps.filter((s) => s.tab === 'linux') :
    activeTab === 'network' ? steps.filter((s) => s.tab === 'network') :
    []

  // ─── 今やる課題カード ─────────────────────────────────────
  type CurrentTask = {
    taskName: string; subtaskName: string; progress: number | null
    progressLabel: string | null; estimatedTime: string
    action: () => void; actionLabel: string
  }

  let currentTask: CurrentTask | null = null
  if (isSnapLoaded && snap) {
    if (snap.lastActive && !isLastActiveModuleDone(snap.lastActive.moduleId)) {
      const la = snap.lastActive
      const m = la.label.match(/(\d+)\/(\d+)/)
      const done2 = m ? parseInt(m[1]) : null
      const total2 = m ? parseInt(m[2]) : null
      const fullLabel = la.label.replace(/\s*\d+\/\d+問$/, '').replace(/\(途中\)/g, '').trim()
      const courseBase = fullLabel.includes('・') ? fullLabel.split('・')[0] : fullLabel
      const partName = fullLabel.includes('・') ? fullLabel.split('・').slice(1).join('・') : ''
      currentTask = {
        taskName: courseBase, subtaskName: partName || fullLabel,
        progress: done2 !== null && total2 !== null ? Math.round((done2 / total2) * 100) : null,
        progressLabel: done2 !== null && total2 !== null ? `${done2} / ${total2}問` : null,
        estimatedTime: '',
        action: () => { if (isIntroCompleted) window.open(getTrainingUrl(la.path), '_blank'); else setShowIntroRequiredPopup(true) },
        actionLabel: '▶ 続きから再開する',
      }
    } else if (introStep === 0) {
      currentTask = { taskName: 'はじめに', subtaskName: 'プロフェッショナルとしての行動基準を確認', progress: 0, progressLabel: null, estimatedTime: '約30分', action: () => navigate('/training/intro'), actionLabel: '▶ はじめに' }
    } else if (introStep >= 1 && introStep <= 4) {
      currentTask = { taskName: 'はじめに', subtaskName: `Step ${introStep} / 5`, progress: Math.round((introStep / 5) * 100), progressLabel: `${introStep} / 5ステップ`, estimatedTime: '約30分', action: () => navigate('/training/intro'), actionLabel: '▶ 続きから' }
    } else {
      const l1Part = snap.l1CurrentPart ?? 0
      const l1Q = snap.l1CurrentQuestion ?? 0
      const l1InProgress = (l1Part > 0 || l1Q > 0) && !(snap.l1Cleared ?? false)
      const infra1InProgress = (snap.infra1Checkboxes ?? []).some(Boolean) && !(snap.infra1Cleared ?? false)
      const l2Q = snap.l2CurrentQuestion ?? 0
      const infra32InProgress = Object.values(snap.infra32Answers ?? {}).some((v) => v && String(v).trim())
      const vi4Done = (snap.infra4ViDoneSteps ?? []).length
      const shell4Done = (snap.infra4ShellDoneQuestions ?? []).length
      if (l1InProgress) {
        const partLabels = ['基本操作', 'サーバー構築', '実践問題']
        currentTask = { taskName: 'Linuxコマンド30問', subtaskName: `Part ${l1Part + 1}: ${partLabels[l1Part] ?? '基本操作'}`, progress: Math.round((l1Q / 10) * 100), progressLabel: `${l1Q} / 10問`, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/linux-level1'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '▶ 続きから再開する' }
      } else if (infra1InProgress) {
        currentTask = { taskName: 'SSH接続確認', subtaskName: 'インフラ基礎課題 1', progress: null, progressLabel: null, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-top'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '▶ 続きから再開する' }
      } else if (l2Q > 0) {
        currentTask = { taskName: 'TCP/IP 理解度確認', subtaskName: 'ネットワーク基礎', progress: Math.round((l2Q / 10) * 100), progressLabel: `${l2Q} / 10問`, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/linux-level2'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '▶ 続きから再開する' }
      } else if (infra32InProgress) {
        currentTask = { taskName: 'OS・仮想化・クラウド理解度確認', subtaskName: 'インフラ基礎課題 3', progress: null, progressLabel: null, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-3-top'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '▶ 続きから再開する' }
      } else if (vi4Done > 0 && vi4Done < VI_STEPS.length) {
        currentTask = { taskName: 'viエディタ演習', subtaskName: 'インフラ基礎課題 4', progress: Math.round((vi4Done / VI_STEPS.length) * 100), progressLabel: `${vi4Done} / ${VI_STEPS.length}ステップ`, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-4'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '▶ 続きから再開する' }
      } else if (shell4Done > 0 && shell4Done < SHELL_QUESTIONS.length) {
        currentTask = { taskName: 'シェルスクリプト演習', subtaskName: 'インフラ基礎課題 4', progress: Math.round((shell4Done / SHELL_QUESTIONS.length) * 100), progressLabel: `${shell4Done} / ${SHELL_QUESTIONS.length}問`, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-4'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '▶ 続きから再開する' }
      }
    }
  }

  // ─── カレンダー ───────────────────────────────────────────
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const studyDates = new Set<number>()
  if (snap?.updatedAt) {
    try {
      const d = new Date(snap.updatedAt)
      if (d.getFullYear() === year && d.getMonth() === month) studyDates.add(d.getDate())
    } catch { /* ignore */ }
  }

  // ─── 連続学習日数 (updatedAt基準の簡易計算) ──────────────
  const streakDays = snap?.updatedAt ? (() => {
    try {
      const last = new Date(snap.updatedAt)
      return Math.floor((today.getTime() - last.getTime()) / 86400000) <= 1 ? 1 : 0
    } catch { return 0 }
  })() : 0

  // ─── 総学習時間目安 ───────────────────────────────────────
  const completedCount = progressPct?.completed ?? 0
  const totalEstHours = completedCount * 3

  return (
    <div className="flex flex-1 w-full" style={{ minHeight: 0 }}>
      {/* ═══════════════════════════════════════════════════════
          左サイドバー PC固定200px
      ═══════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <>
          {/* fixed サイドバー：ビューポート左上原点から描画（ロゴが y=0 に来る） */}
          <aside
            className="hidden md:flex w-[200px] flex-shrink-0 flex-col h-screen border-r border-slate-100 bg-white overflow-y-auto"
            style={{ position: 'fixed', top: 0, left: 0, zIndex: 150 }}
          >
          {/* ロゴ */}
          <div className="flex items-start px-4 pb-3">
            <NeOSLogo height={40} noLink />
          </div>

          {/* ナビ */}
          <nav className="flex-1 px-2 pb-3 space-y-0.5">
            <button type="button" onClick={() => navigate('/')} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold bg-sky-50 text-sky-700">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              ホーム
            </button>
            {isManager && (
              <button type="button" onClick={() => navigate('/wbs')} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                WBS
              </button>
            )}
            <button type="button" onClick={() => navigate('/progress')} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              進捗状況
            </button>
            <button type="button" disabled className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-400 cursor-not-allowed">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
              修了証
              <span className="ml-auto text-[10px] text-slate-300">準備中</span>
            </button>

            <div className="my-2 border-t border-slate-100" />

            <button type="button" onClick={() => navigate('/server')} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
              演習サーバー
            </button>
          </nav>

          {/* サイドバーを閉じる（アイコンのみ） */}
          <div className="px-3 py-3 border-t border-slate-100">
            <button type="button" onClick={() => setSidebarOpen(false)} className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="サイドバーを閉じる">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
          </div>
        </aside>
          {/* フローの中に幅スペーサーを置いてコンテンツをアサイドの右に押し出す */}
          <div className="hidden md:block w-[200px] flex-shrink-0" />
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          メインコンテンツ
      ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="px-4 md:px-8 py-5 md:py-6 max-w-[1200px] mx-auto space-y-5 md:space-y-6">

          {/* サイドバー再表示ボタン (PC・非表示時のみ) */}
          {!sidebarOpen && (
            <button type="button" onClick={() => setSidebarOpen(true)} className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-50">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
              メニューを表示
            </button>
          )}

          {/* manager限定: 進捗リセット */}
          {isManager && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('すべての進捗データをリセットしますか？\n（この操作は元に戻せません）')) return
                  const uname = getCurrentDisplayName()
                  if (!uname || !isProgressApiAvailable()) { alert('リセットできませんでした。'); return }
                  try {
                    await postProgress(uname, {
                      introConfirmed: false, introAt: null, introStep: 0, introRiskAnswers: {},
                      wbsPercent: 0, chapterProgress: [], currentDay: 0, delayedIds: [],
                      updatedAt: new Date().toISOString(), pins: [],
                      infra1Checkboxes: [], infra1Cleared: false, l1CurrentPart: 0, l1CurrentQuestion: 0, l1Cleared: false,
                      l2CurrentQuestion: 0, infra32Answers: {}, infra4ViDoneSteps: [], infra4ShellDoneQuestions: [],
                      infra5PhaseDone: [], infra5BuildDone: [], infra5TroubleDone: [], infra5SecDone: [],
                    })
                    alert('進捗をリセットしました。ページをリロードします。')
                    window.location.reload()
                  } catch { alert('リセットに失敗しました。') }
                }}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-medium text-rose-600 hover:bg-rose-100"
              >
                進捗リセット（開発用）
              </button>
            </div>
          )}

          {/* ── グリーティング ─────────────────────────────── */}
          <div>
            <h1 className="text-[20px] font-medium text-slate-800 leading-tight">
              ようこそ、{username}さん 👋
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              今日もスキルを積み上げて、理想のエンジニアに近づきましょう。
            </p>
          </div>

          {/* ── 次に学習するレッスンカード（Heroカード・最上部） ── */}
          {!isSnapLoaded ? (
            <div className="rounded-2xl p-6 animate-pulse" style={{ background: 'linear-gradient(135deg, #3730a3, #2563EB)' }}>
              <div className="h-3 w-20 rounded bg-white/20 mb-3" />
              <div className="h-6 w-40 rounded bg-white/20 mb-4" />
              <div className="h-10 rounded-xl bg-white/20" />
            </div>
          ) : currentTask ? (
            <div className="rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #3730a3, #2563EB)', borderRadius: 16, padding: '24px 28px' }}>
              {/* テキスト＋イラスト行 */}
              <div className="flex gap-4 md:gap-8 items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>次に学習するレッスン</p>
                  <h2 className="text-[22px] font-medium leading-snug">{currentTask.taskName}</h2>
                  <p className="mt-0.5 text-[13px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{currentTask.subtaskName}</p>
                  {currentTask.estimatedTime && <p className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>⏱ 想定時間：{currentTask.estimatedTime}</p>}
                  {currentTask.progress !== null && (
                    <div className="mt-3 space-y-1">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.25)', margin: '12px 0 0' }}>
                        <div className="h-full rounded-full bg-white transition-all" style={{ width: `${currentTask.progress}%` }} />
                      </div>
                      {currentTask.progressLabel && <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.8)' }}>{currentTask.progressLabel}</p>}
                    </div>
                  )}
                  {/* PCのみ: ボタンをテキスト列の下に表示 */}
                  <div className="hidden md:flex mt-4 flex-row flex-wrap gap-2">
                    <button type="button" onClick={currentTask.action} className="w-auto flex items-center justify-center gap-1.5 font-medium text-[14px] hover:bg-white/90 transition-colors" style={{ background: '#fff', color: '#1E40AF', borderRadius: 10, padding: '9px 18px' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 2.5l8 4.5-8 4.5V2.5z" fill="#1E40AF" stroke="#1E40AF" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      {currentTask.actionLabel.replace(/^▶\s*/, '')}
                    </button>
                    <button type="button" onClick={currentTask.action} className="w-auto text-white font-medium text-[14px] hover:bg-white/20 transition-colors" style={{ background: 'rgba(255,255,255,0.15)', border: '0.5px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '9px 18px' }}>
                      詳細を見る
                    </button>
                  </div>
                </div>
                {/* イラスト（モバイル: 90px, PC: 150px） */}
                <div className="flex w-[90px] md:w-[150px] flex-shrink-0 items-center justify-center p-1" style={{ background: '#1a1a2e', borderRadius: 8 }}>
                  <HeroIllustration kind={getIllustrationKind(currentTask.taskName)} />
                </div>
              </div>
              {/* モバイルのみ: ボタンを全幅横並びで下に表示 */}
              <div className="flex md:hidden mt-4 flex-row gap-2">
                <button type="button" onClick={currentTask.action} className="flex-1 flex items-center justify-center gap-1.5 font-medium text-[14px] hover:bg-white/90 transition-colors" style={{ background: '#fff', color: '#1E40AF', borderRadius: 10, padding: '9px 12px' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 2.5l8 4.5-8 4.5V2.5z" fill="#1E40AF" stroke="#1E40AF" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                  {currentTask.actionLabel.replace(/^▶\s*/, '')}
                </button>
                <button type="button" onClick={currentTask.action} className="flex-1 text-white font-medium text-[14px] hover:bg-white/20 transition-colors" style={{ background: 'rgba(255,255,255,0.15)', border: '0.5px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '9px 12px' }}>
                  詳細を見る
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 md:p-6 text-white" style={{ background: 'linear-gradient(135deg, #059669, #0284c7)' }}>
              <p className="text-[11px] uppercase tracking-widest text-white/70 mb-1">カリキュラム状況</p>
              <h2 className="text-[20px] font-bold">
                {(progressPct?.completed ?? 0) >= 8 ? '全カリキュラム完了！🎉' : 'カリキュラムを確認'}
              </h2>
              <p className="mt-1 text-[13px] text-white/80">
                {(progressPct?.completed ?? 0) >= 8
                  ? 'おめでとうございます。すべての課題をクリアしました。'
                  : '下のロードマップから次に進む課題を選択してください。'}
              </p>
            </div>
          )}

          {/* ── KPI 4カード ──────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">

            {/* 1. 全体の進捗 */}
            <div className="rounded-2xl bg-white shadow-sm" style={{ border: '0.5px solid #E2E8F0', padding: '16px 18px' }}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 md:mb-3">全体の進捗</p>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="relative flex-shrink-0">
                  <svg className="w-12 h-12 md:w-14 md:h-14 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0ea5e9" strokeWidth="3"
                      strokeDasharray={`${(progressPct?.pct ?? 0) * 99.9 / 100} 99.9`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-800">{progressPct?.pct ?? 0}%</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[20px] md:text-[22px] font-bold text-slate-800 leading-none">{progressPct?.pct ?? 0}<span className="text-[12px] text-slate-400 ml-0.5">%</span></p>
                  <p className="mt-0.5 text-[10px] md:text-[11px] text-slate-500 leading-tight">{progressPct?.completed ?? 0}/{progressPct?.total ?? 8}ステージ完了</p>
                </div>
              </div>
            </div>

            {/* 2. 今週の学習時間 */}
            <div className="rounded-2xl bg-white shadow-sm" style={{ border: '0.5px solid #E2E8F0', padding: '16px 18px' }}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 md:mb-3">今週の学習時間</p>
              <p className="text-[20px] md:text-[26px] font-bold text-slate-800 leading-none">—<span className="text-[12px] text-slate-400 ml-0.5">h</span></p>
              <p className="mt-0.5 text-[11px] text-slate-500">学習時間は記録中</p>
              <div className="mt-3 flex items-end gap-0.5 h-5">
                {['月', '火', '水', '木', '金', '土', '日'].map((d, i) => (
                  <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className={`w-full rounded-sm ${i === (new Date().getDay() + 6) % 7 ? 'bg-sky-400' : 'bg-slate-100'}`} style={{ height: '100%' }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {['月', '火', '水', '木', '金', '土', '日'].map((d) => (
                  <span key={d} className="flex-1 text-center text-[9px] text-slate-400">{d}</span>
                ))}
              </div>
            </div>

            {/* 3. 連続学習日数 */}
            <div className="rounded-2xl bg-white shadow-sm" style={{ border: '0.5px solid #E2E8F0', padding: '16px 18px' }}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 md:mb-3">連続学習日数</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-[20px] md:text-[26px] font-bold text-slate-800 leading-none">{streakDays}</p>
                <span className="text-[12px] text-slate-400">日</span>
                {streakDays > 0 && <span className="text-[18px] leading-none">🔥</span>}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{
                streakDays === 0 ? 'ログインして記録スタート' :
                streakDays === 1 ? '今日からスタート！続けよう' :
                streakDays >= 30 ? `${streakDays}日連続！プロ級の継続力です` :
                streakDays >= 7 ? `${streakDays}日連続！素晴らしい習慣です` :
                `${streakDays}日連続！この調子で続けよう`
              }</p>
              <button type="button" onClick={() => navigate('/progress')} className="mt-1.5 text-[11px] text-sky-600 hover:underline">連続記録の詳細を見る→</button>
            </div>

            {/* 4. 総学習時間（目安） */}
            <div className="rounded-2xl bg-white shadow-sm" style={{ border: '0.5px solid #E2E8F0', padding: '16px 18px' }}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 md:mb-3">総学習時間（目安）</p>
              <p className="text-[20px] md:text-[26px] font-bold text-slate-800 leading-none">{totalEstHours}<span className="text-[12px] text-slate-400 ml-0.5">h+</span></p>
              <p className="mt-1 text-[11px] text-slate-500">{completedCount}ステージ × 約3h</p>
            </div>
          </div>

          {/* ── 下部 2カラム ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">

            {/* 左: カリキュラム 2/3 */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-slate-700">カリキュラム</h2>
              </div>

              {/* タブ */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
                {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${activeTab === tab ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>

              {/* ステップ一覧 */}
              <div className="space-y-2">
                {filteredSteps.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                    <p className="text-[13px] text-slate-400">このカテゴリの課題は近日公開予定です。</p>
                  </div>
                ) : (
                  filteredSteps.map((step, idx) => {
                    const isDone = step.status === 'done'
                    const isActive = step.status === 'active'
                    const isFirstAppendix = step.appendix && (idx === 0 || !filteredSteps[idx - 1].appendix)
                    return (
                      <Fragment key={step.no}>
                        {isFirstAppendix && (
                          <div className="flex items-center gap-3 pt-1 pb-0.5">
                            <div className="flex-1 border-t border-dashed border-slate-200" />
                            <span className="text-[10px] font-medium text-slate-400 tracking-widest uppercase shrink-0">付録</span>
                            <div className="flex-1 border-t border-dashed border-slate-200" />
                          </div>
                        )}
                      <div className={`rounded-xl border transition-colors ${isDone ? 'border-slate-100 bg-slate-50/60' : isActive ? 'border-sky-300 bg-white shadow-sm' : 'border-slate-100 bg-white'}`}>
                        <div className="flex items-start gap-3 px-4 py-3.5">
                          <div className="flex-shrink-0 mt-0.5">
                            {isDone ? (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                  <circle cx="10" cy="10" r="9" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.8"/>
                                  <path d="M6 10l3 3 5-5" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </span>
                            ) : isActive ? (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0" style={{ border: '1.5px solid #2563EB', background: '#EFF6FF', color: '#2563EB' }}>{step.no}</span>
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0" style={{ border: '1.5px solid #CBD5E1', background: '#F8FAFC', opacity: 0.7 }}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="7" width="10" height="7" rx="2"/>
                                  <path d="M5 7V5a3 3 0 016 0v2"/>
                                </svg>
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-[13px] font-semibold leading-tight ${isDone ? 'text-slate-400' : isActive ? 'text-slate-800' : 'text-slate-500'}`}>{step.name}</p>
                              {isDone ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">完了</span>
                                  <button type="button" onClick={step.action} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 transition-colors">復習する</button>
                                </div>
                              ) : isActive ? (
                                <button type="button" onClick={step.action} className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700 transition-colors">続きから学習▶</button>
                              ) : (
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">未着手</span>
                                  <button type="button" onClick={step.action} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">詳細を見る</button>
                                </div>
                              )}
                            </div>
                            <p className={`mt-0.5 text-[11px] ${isDone ? 'text-slate-300' : 'text-slate-400'}`}>{step.sub}</p>
                            {isActive && step.progress !== null && step.progress !== undefined && (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${step.progress}%` }} />
                                  </div>
                                  {step.progressLabel && <span className="text-[12px] text-slate-400 shrink-0">{step.progressLabel}</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      </Fragment>
                    )
                  })
                )}
              </div>
            </div>

            {/* 右カラム 1/3 */}
            <div className="space-y-4">

              {/* 学習カレンダー */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-slate-700">学習カレンダー</h3>
                  <p className="text-[11px] text-slate-400">{year}年{month + 1}月</p>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                    <div key={d} className="text-center text-[10px] text-slate-400 font-medium py-0.5">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1
                    const isToday = day === today.getDate()
                    const isStudy = studyDates.has(day) && !isToday
                    return (
                      <div key={day} className={`flex items-center justify-center rounded-full text-[11px] h-6 w-6 mx-auto font-medium
                        ${isToday ? 'bg-sky-500 text-white' : isStudy ? 'bg-sky-100 text-sky-700' : 'text-slate-600'}`}>
                        {day}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-sky-500 inline-block" />
                    <span className="text-[10px] text-slate-500">今日</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-sky-100 inline-block" />
                    <span className="text-[10px] text-slate-500">学習日</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
