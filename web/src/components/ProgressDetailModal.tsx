import type { AdminUser } from '../accountsApi'

type Props = {
  user: AdminUser
  onClose: () => void
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '—' }
}

function getBarColor(pct: number): string {
  if (pct <= 30) return 'bg-red-500'
  if (pct <= 69) return 'bg-amber-400'
  return 'bg-emerald-500'
}

export function ProgressDetailModal({ user, onClose }: Props) {
  const doneCheckboxes = (user.infra1Checkboxes ?? []).filter(Boolean).length
  const totalCheckboxes = (user.infra1Checkboxes ?? []).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* ヘッダー */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user.username[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">{user.username}</h2>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${user.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                {user.role}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* 全体進捗 */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">全体進捗</p>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold text-slate-800">{user.wbsPercent}<span className="text-base font-medium text-slate-400 ml-0.5">%</span></span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.wbsPercent >= 70 ? 'bg-emerald-100 text-emerald-700' : user.wbsPercent >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                  {user.wbsPercent >= 100 ? '完了' : user.wbsPercent > 0 ? '進行中' : '未着手'}
                </span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${getBarColor(user.wbsPercent)}`} style={{ width: `${user.wbsPercent}%` }} />
              </div>
            </div>
          </section>

          {/* 課題別進捗カード */}
          {user.chapterProgress.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">課題別進捗</p>
              <div className="grid grid-cols-1 gap-2.5">
                {user.chapterProgress.map((ch) => {
                  const pct = Math.round(ch.percent)
                  return (
                    <div key={ch.chapter} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700">{ch.label || `課題${ch.chapter}`}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ch.cleared ? 'bg-emerald-100 text-emerald-700' : pct > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                          {ch.cleared ? '✓ 完了' : pct > 0 ? '実施中' : '未着手'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${getBarColor(pct)}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 tabular-nums w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* 課題1-1 チェックボックス */}
          {totalCheckboxes > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">課題1-1 チェックボックス</p>
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">完了ステップ</span>
                  <span className="text-sm font-bold text-slate-800">{doneCheckboxes} <span className="text-slate-400 font-normal">/ {totalCheckboxes}</span></span>
                </div>
                <div className="flex gap-1 flex-wrap mt-2">
                  {(user.infra1Checkboxes ?? []).map((done, i) => (
                    <div
                      key={i}
                      className={`h-5 w-5 rounded flex items-center justify-center ${done ? 'bg-sky-500' : 'bg-slate-100'}`}
                      title={`ステップ${i + 1}: ${done ? '完了' : '未完了'}`}
                    >
                      {done && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* サーバー情報＋基本情報（横2カラム） */}
          <div className="grid grid-cols-2 gap-3">
            <section className="col-span-2 sm:col-span-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">サーバー</p>
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">状態</span>
                  <span className="font-semibold text-slate-700">
                    {user.ec2State === 'running' ? '🟢 起動中' : user.ec2State === 'stopped' ? '⚫ 停止中' : '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400 flex-shrink-0">IPアドレス</span>
                  <span className="font-mono text-slate-700 truncate">{user.ec2PublicIp ?? user.ec2Host ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">作成日</span>
                  <span className="text-slate-700">{user.ec2CreatedAt ? user.ec2CreatedAt.split('T')[0] : '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400 flex-shrink-0">キーペア</span>
                  <span className="font-mono text-slate-700 truncate">{user.keyPairName ?? '—'}</span>
                </div>
              </div>
            </section>
            <section className="col-span-2 sm:col-span-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">基本情報</p>
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">最終ログイン</span>
                  <span className="text-slate-700">{formatDate(user.lastLogin)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">アカウント作成</span>
                  <span className="text-slate-700">{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">はじめに</span>
                  <span className={`font-medium ${user.introConfirmed ? 'text-emerald-600' : 'text-slate-400'}`}>{user.introConfirmed ? '✓ 完了' : '未完了'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">遅延タスク</span>
                  <span className={`font-semibold ${user.delayedIds.length > 0 ? 'text-red-600' : 'text-slate-500'}`}>{user.delayedIds.length}件</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
