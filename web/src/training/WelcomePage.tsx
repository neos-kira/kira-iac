import { useEffect } from 'react'

export function WelcomePage() {
  useEffect(() => {
    document.title = 'NIC 研修オリエンテーション'
  }, [])

  const SKILLS = [
    { icon: '\ud83d\udda5\ufe0f', title: 'Linux\u30b5\u30fc\u30d0\u30fc\u306e\u69cb\u7bc9', desc: 'Web\u30b5\u30fc\u30d0\u30fc\u3068DB\u30b5\u30fc\u30d0\u30fc\u30921\u4eba\u3067\u30bc\u30ed\u304b\u3089\u69cb\u7bc9\u3067\u304d\u308b' },
    { icon: '\ud83d\udd27', title: '\u30c8\u30e9\u30d6\u30eb\u30b7\u30e5\u30fc\u30c6\u30a3\u30f3\u30b0', desc: '\u30ed\u30b0\u3092\u8aad\u3093\u3067\u30b5\u30fc\u30d0\u30fc\u969c\u5bb3\u306e\u539f\u56e0\u3092\u7279\u5b9a\u30fb\u5fa9\u65e7\u3067\u304d\u308b' },
    { icon: '\ud83d\udee1\ufe0f', title: '\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3\u306e\u57fa\u790e', desc: '\u5b89\u5168\u306a\u30b5\u30fc\u30d0\u30fc\u8a2d\u5b9a\u3068\u30dd\u30fc\u30c8\u7ba1\u7406\u304c\u3067\u304d\u308b' },
  ]

  const STEPS = [
    { num: 1, label: '\u306f\u3058\u3081\u306b', sub: '\u30d7\u30ed\u3068\u3057\u3066\u306e\u884c\u52d5\u57fa\u6e96' },
    { num: 2, label: '\u8ab2\u984c1', sub: 'Linux\u30b3\u30de\u30f3\u30c9\u30fb\u30c4\u30fc\u30eb\u64cd\u4f5c' },
    { num: 3, label: '\u8ab2\u984c2\u301c3', sub: '\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u30fbOS\u30fb\u30af\u30e9\u30a6\u30c9' },
    { num: 4, label: '\u8ab2\u984c4', sub: 'vi\u30fb\u30b7\u30a7\u30eb\u30b9\u30af\u30ea\u30d7\u30c8' },
    { num: 5, label: '\u8ab2\u984c5', sub: '\u30b5\u30fc\u30d0\u30fc\u69cb\u7bc9\u30fb\u969c\u5bb3\u5bfe\u5fdc' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-8">

        {/* セクション1: ウェルカムメッセージ */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft-card">
          <h1 className="text-2xl font-bold text-slate-800">NIC へようこそ。</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
            この研修を修了した時、あなたはLinuxサーバーを1人で構築・運用できるエンジニアになっています。
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            現場で即戦力として活躍する実践力を、ここで身につけてください。
          </p>
        </section>

        {/* セクション2: この研修で身につくこと */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">この研修で身につくこと</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {SKILLS.map((s) => (
              <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
                <p className="text-2xl">{s.icon}</p>
                <p className="mt-2 text-[13px] font-semibold text-slate-800">{s.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* セクション3: 研修の全体像 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft-card">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">研修の全体像</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-start gap-3 sm:flex-col sm:items-center sm:text-center sm:flex-1">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  i === 0
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {s.num}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{s.label}</p>
                  <p className="text-[11px] text-slate-500">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* セクション4: 所要時間の目安 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft-card">
          <p className="text-[13px] font-semibold text-slate-800">全課程の目安：約20〜30時間</p>
          <p className="mt-1 text-[12px] text-slate-500">
            自分のペースで進められます。わからないことはAI講師に質問できます。
          </p>
        </section>

        {/* セクション5: 開始ボタン */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <button
            type="button"
            onClick={() => { window.location.hash = '#/training/intro' }}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
          >
            研修を始める →
          </button>
        </section>
      </div>
    </div>
  )
}
