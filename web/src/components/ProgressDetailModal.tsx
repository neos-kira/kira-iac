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

function ProgressBar({ pct }: { pct: number }) {
  const color = pct <= 30 ? 'bg-red-500' : pct <= 70 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 tabular-nums">{pct}%</span>
    </div>
  )
}

export function ProgressDetailModal({ user, onClose }: Props) {
  const doneCheckboxes = (user.infra1Checkboxes ?? []).filter(Boolean).length
  const totalCheckboxes = (user.infra1Checkboxes ?? []).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* ヘッダー */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{user.username}</h2>
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              user.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {user.role}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
          >
            閉じる
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* 全体進捗 */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">全体進捗</p>
            <ProgressBar pct={user.wbsPercent} />
          </section>

          {/* 各課題進捗 */}
          {user.chapterProgress.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">課題別進捗</p>
              <ul className="space-y-2">
                {user.chapterProgress.map((ch) => (
                  <li key={ch.chapter} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700">{ch.label || `課題${ch.chapter}`}</span>
                      {ch.cleared ? (
                        <span className="text-[11px] font-semibold text-emerald-600">✓ 完了</span>
                      ) : ch.percent > 0 ? (
                        <span className="text-[11px] text-amber-600">実施中</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">未着手</span>
                      )}
                    </div>
                    <ProgressBar pct={Math.round(ch.percent)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 課題1-1 チェックボックス */}
          {totalCheckboxes > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">課題1-1 チェックボックス</p>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-700">完了ステップ</span>
                  <span className="text-xs font-semibold text-slate-800">{doneCheckboxes} / {totalCheckboxes}</span>
                </div>
                <div className="flex gap-0.5 flex-wrap mt-1">
                  {(user.infra1Checkboxes ?? []).map((done, i) => (
                    <span
                      key={i}
                      className={`inline-block h-3 w-3 rounded-sm ${done ? 'bg-teal-500' : 'bg-slate-200'}`}
                      title={`ステップ${i + 1}: ${done ? '完了' : '未完了'}`}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* サーバー情報 */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">サーバー情報</p>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">状態</span>
                <span className="font-medium text-slate-800">
                  {user.ec2State === 'running' ? '🟢 起動中' : user.ec2State === 'stopped' ? '⚫ 停止中' : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">IPアドレス</span>
                <span className="font-mono text-slate-800">{user.ec2PublicIp ?? user.ec2Host ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">作成日時</span>
                <span className="text-slate-800">{user.ec2CreatedAt ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">起動時刻</span>
                <span className="text-slate-800">{user.ec2StartTime ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">キーペア名</span>
                <span className="font-mono text-slate-800">{user.keyPairName ?? '—'}</span>
              </div>
            </div>
          </section>

          {/* 基本情報 */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">基本情報</p>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">最終ログイン</span>
                <span className="text-slate-800">{formatDate(user.lastLogin)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">アカウント作成日</span>
                <span className="text-slate-800">{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">はじめに完了</span>
                <span className="text-slate-800">{user.introConfirmed ? '✓ 完了' : '未完了'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">遅延タスク数</span>
                <span className={`font-semibold ${user.delayedIds.length > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {user.delayedIds.length}件
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
