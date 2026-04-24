import { useState } from 'react'
import { BASE_URL, buildAuthHeaders } from '../progressApi'

async function postTermsAgree(): Promise<{ termsAgreedAt: string } | null> {
  try {
    const res = await fetch(`${BASE_URL}/terms/agree`, {
      method: 'POST',
      headers: buildAuthHeaders(),
      credentials: 'omit',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

type Props = {
  onAgreed: (termsAgreedAt: string) => void
}

export function TermsModal({ onAgreed }: Props) {
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAgree() {
    if (!checked || loading) return
    setLoading(true)
    setError('')
    const result = await postTermsAgree()
    setLoading(false)
    if (!result) {
      setError('同意の記録に失敗しました。再度お試しください。')
      return
    }
    onAgreed(result.termsAgreedAt)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* ヘッダー */}
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">利用規約への同意</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            NIC（NeOS IT College）研修プラットフォームをご利用いただく前に、利用規約をご確認ください。
          </p>
        </div>

        {/* 規約本文 */}
        <div className="max-h-72 overflow-y-auto px-6 py-4 text-sm text-slate-700 space-y-4">
          <div>
            <p className="font-semibold text-slate-800 mb-1">第1条（目的）</p>
            <p className="text-xs leading-relaxed text-slate-600">
              本規約は、NIC研修プラットフォーム（以下「本サービス」）の利用条件を定めるものです。
              受講生は本規約に同意した上で本サービスを利用するものとします。
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-1">第2条（禁止事項）</p>
            <p className="text-xs leading-relaxed text-slate-600">
              受講生は以下の行為を行ってはなりません。
              （1）他の受講生・講師への迷惑行為、（2）本サービスのシステムへの不正アクセス、
              （3）課題の回答や学習コンテンツの無断複製・転載、（4）その他法令または公序良俗に違反する行為。
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-1">第3条（AI講師の利用）</p>
            <p className="text-xs leading-relaxed text-slate-600">
              本サービスに搭載されているAI講師は学習支援を目的としています。
              AI講師との会話内容は学習品質の向上を目的として管理者が閲覧する場合があります。
              個人情報や機密情報をAI講師に入力しないようご注意ください。
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-1">第4条（個人情報の取り扱い）</p>
            <p className="text-xs leading-relaxed text-slate-600">
              本サービスは受講生の学習進捗・操作ログ等を収集します。
              収集した情報は研修運営の改善および成績管理の目的にのみ使用し、
              第三者に提供することはありません。
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-1">第5条（免責事項）</p>
            <p className="text-xs leading-relaxed text-slate-600">
              本サービスの利用により生じた損害について、運営者は故意または重過失がある場合を除き責任を負いません。
              本サービスは予告なく変更・停止される場合があります。
            </p>
          </div>
        </div>

        {/* 同意チェック + ボタン */}
        <div className="border-t border-slate-200 px-6 py-4 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-500 cursor-pointer"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              上記の利用規約をすべて読み、内容に同意します。
            </span>
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={() => void handleAgree()}
            disabled={!checked || loading}
            className="w-full rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '送信中...' : '同意してはじめる'}
          </button>
        </div>
      </div>
    </div>
  )
}
