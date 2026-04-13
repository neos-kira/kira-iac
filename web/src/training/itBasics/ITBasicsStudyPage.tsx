import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { IT_BASICS_CATEGORIES } from '../itBasicsData'
import { Server, Code2, ShieldCheck, Cloud, GitCommitHorizontal, RefreshCw, KanbanSquare, ClipboardCheck, MessageSquare, Mail, Clock, Users, Lock, AlertTriangle, FileSearch, Shield, Building2, FileText, UserCheck, Handshake, AlertOctagon, Settings, Search, Wrench, Bot, Sparkles, ShieldAlert, HelpCircle } from 'lucide-react'

function getTrainingUrl(path: string) {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin
      : ''
  return `${base}#${path}`
}

// Lucideアイコンをティール背景カードで包むヘルパー
type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
const iconCard = (Icon: LucideIcon, key: string) => (
  <div key={key} style={{ flexShrink: 0, width: 80, height: 80, background: '#f0fdf9', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Icon size={40} color="#0d9488" strokeWidth={1.5} />
  </div>
)

const STUDY_ILLUSTRATIONS: Record<string, React.ReactNode[]> = {
  'engineer-types': [
    iconCard(Server, 'infra'), iconCard(Code2, 'dev'), iconCard(ShieldCheck, 'sec'), iconCard(Cloud, 'sre'),
  ],
  'project-management': [
    iconCard(GitCommitHorizontal, 'wf'), iconCard(RefreshCw, 'agile'), iconCard(KanbanSquare, 'kanban'), iconCard(ClipboardCheck, 'review'),
  ],
  'business-manner': [
    iconCard(MessageSquare, 'hrsn'), iconCard(Mail, 'mail'), iconCard(Clock, 'clock'), iconCard(Users, 'mtg'),
  ],
  'security': [
    iconCard(Lock, 'pw'), iconCard(AlertTriangle, 'phish'), iconCard(FileSearch, 'classify'), iconCard(Shield, 'incident'),
  ],
  'ses-manner': [
    iconCard(Building2, 'day1'), iconCard(FileText, 'nda'), iconCard(UserCheck, 'belong'), iconCard(Handshake, 'trust'),
  ],
  'incidents': [
    iconCard(AlertOctagon, 'misop'), iconCard(Settings, 'config'), iconCard(Search, 'leak'), iconCard(Wrench, 'fw'),
  ],
  'generative-ai': [
    iconCard(Bot, 'llm'), iconCard(Sparkles, 'copilot'), iconCard(ShieldAlert, 'aisec'), iconCard(HelpCircle, 'limit'),
  ],
}

export function ITBasicsStudyPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const cat = IT_BASICS_CATEGORIES.find((c) => c.id === categoryId)

  useEffect(() => {
    document.title = cat ? `${cat.title} — 座学` : 'IT業界の歩き方'
  }, [cat])

  if (!cat) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">カテゴリが見つかりません</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          
          <button
            type="button"
            onClick={() => { window.location.hash = '#/it-basics' }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50"
          >
            カテゴリ一覧へ
          </button>
        </div>

        <div>
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{cat.subtitle}</p>
          <h1 className="mt-1 text-lg font-bold text-slate-800">{cat.title} — 座学</h1>
        </div>

        <div className="space-y-4">
          {cat.study.map((section, i) => {
            const illust = STUDY_ILLUSTRATIONS[cat.id]?.[i]
            return (
            <details key={i} className="group rounded-2xl border border-slate-200 bg-white shadow-sm" open={i === 0}>
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-slate-800">
                <span>{i + 1}. {section.title}</span>
                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="border-t border-slate-100 px-5 py-4">
                <div className={illust ? 'flex flex-col sm:flex-row items-center sm:items-start gap-4' : ''}>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap flex-1">{section.body}</p>
                  {illust && <div className="shrink-0 flex justify-center sm:justify-end [&_svg]:w-20 [&_svg]:h-20 sm:[&_svg]:w-[120px] sm:[&_svg]:h-[120px]">{illust}</div>}
                </div>
              </div>
            </details>
            )
          })}
        </div>

        <div className="flex justify-center pt-4">
          <a
            href={getTrainingUrl(`/it-basics/${cat.id}/test`)}
            className="rounded-xl bg-teal-600 px-8 py-3 text-sm font-semibold text-white hover:bg-teal-700 shadow-sm"
          >
            テストを受ける →
          </a>
        </div>
      </div>
    </div>
  )
}
