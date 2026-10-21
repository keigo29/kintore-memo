import { Trophy } from 'lucide-react'
import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import type { Rir } from '../data/types'
import type { SessionSummary } from '../data/summary'
import { formatDuration, formatKg } from '../lib/format'

/*
  1回のトレーニングのまとめを見せる部品（振り返り画面と終了画面で使う）
  ・数字はすべて記録から計算したもの（客観）。きつさやメモ（主観）は別の場所に出す
*/

/** 1,234 のように3けたで区切る */
export function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 1 })
}

const RECORD_LABEL = { maxWeight: '最高重量', e1rm: '推定1RM', maxVolume: '総挙上量' } as const

/** 大きな数字のタイル：時間・種目・セット・総挙上量・自己ベスト */
export function StatGrid({ summary }: { summary: SessionSummary }) {
  const { totals, durationMs, recordCount } = summary
  const tiles: { label: string; value: string; unit: string; strong?: boolean }[] = [
    { label: '時間', value: formatDuration(durationMs), unit: '' },
    { label: '種目', value: String(totals.exercises), unit: '種目' },
    { label: 'セット', value: String(totals.sets), unit: 'セット' },
    { label: '総挙上量', value: formatNumber(totals.volume), unit: 'kg' },
    { label: '合計回数', value: String(totals.reps), unit: '回' },
    { label: '自己ベスト', value: String(recordCount), unit: '更新', strong: recordCount > 0 },
  ]
  return (
    <div className="stat-grid">
      {tiles.map((t) => (
        <div key={t.label} className={t.strong ? 'stat stat-strong' : 'stat'}>
          <span className="stat-label">{t.label}</span>
          <span className="stat-value num">
            {t.value}
            {t.unit && <small>{t.unit}</small>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 鍛えた筋群の札 */
export function GroupChips({ summary }: { summary: SessionSummary }) {
  return (
    <div className="report-groups">
      {summary.groups.map((g) => (
        <span key={g} className="tag report-group" style={groupColor(g)}>
          <span className="dot" aria-hidden />
          {MUSCLE_GROUPS.find((m) => m.id === g)?.name}
        </span>
      ))}
    </div>
  )
}

/** 種目ごとの結果：セット数・最高重量・前回からの変化・自己ベスト */
export function ExerciseResults({ summary }: { summary: SessionSummary }) {
  return (
    <ul className="card list report-list">
      {summary.exercises.map((e) => {
        const main = e.bodyweight
          ? `${e.stats.sets}セット・合計${e.stats.reps}回`
          : `${e.stats.sets}セット・最高 ${formatKg(e.stats.topWeight)}kg・${formatNumber(e.stats.volume)}kg`
        const diff = e.change?.diff ?? 0
        return (
          <li key={e.exerciseId} className="report-row" style={groupColor(e.group)}>
            <span className="dot" aria-hidden />
            <span className="report-text">
              <span className="list-name">{e.name}</span>
              <span className="list-sub num">{main}</span>
              <span className="report-tags">
                {e.isFirst ? (
                  <span className="tag">はじめて</span>
                ) : e.change ? (
                  <span className={diff > 0 ? 'tag tag-ok num' : 'tag num'}>
                    前回比 {e.change.label} {diff > 0 ? '+' : diff < 0 ? '−' : '±'}
                    {formatKg(Math.abs(diff))}
                    {e.change.unit}
                  </span>
                ) : null}
                {e.records.map((r) => (
                  <span key={r} className="tag tag-pr">
                    <Trophy strokeWidth={2.4} aria-hidden />
                    {RECORD_LABEL[r]}
                  </span>
                ))}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** あと何回の集計：入れたセットだけ。入れていなければ「記録なし」 */
export function RirBlock({ summary }: { summary: SessionSummary }) {
  const { counts, recorded, total } = summary.rir
  if (recorded === 0) {
    return <p className="field-help">あと何回を入れたセットがないので、出していません（推測はしません）</p>
  }
  const order: Rir[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'unknown']
  return (
    <div className="rir-summary">
      <span className="field-help num">
        入れたセット {recorded} / {total}
      </span>
      <div className="rir-bars">
        {order
          .filter((r) => counts.get(r))
          .map((r) => (
            <span key={String(r)} className="rir-count">
              <span className="rir-count-key num">{r === 'unknown' ? '?' : r}</span>
              <span className="num">×{counts.get(r)}</span>
            </span>
          ))}
      </div>
    </div>
  )
}

/** 計算のしかた（画面で確かめられるように） */
export function CalcHelp() {
  return (
    <details className="calc-help">
      <summary>計算のしかた</summary>
      <ul>
        <li>数えるのは「完了した本番セット」だけです。ウォームアップと、完了していないセットは数えません。</li>
        <li>総挙上量 ＝ 各セットの「重量 × 回数」の合計です。自重の種目と、重量を入れていないセットは数えません（回数だけ数えます）。補助ありのセットは数えます。</li>
        <li>推定1RM ＝ 重量 ×（1 ＋ 回数 ÷ 30）（Epley の式）。1回なら重量そのまま、11回以上は誤差が大きいので出しません。補助ありのセットは使いません。</li>
        <li>最高重量は、補助なしのセットでいちばん重い重量です。</li>
        <li>前回比は、同じ種目をやった前回のトレーニングとの差です。重量の種目は最高重量、自重の種目は合計回数で比べます。</li>
        <li>自己ベストは、これまでのすべての記録と比べて上回ったものです。はじめての種目は比べる相手がないので数えません。</li>
        <li>あと何回は、入れたセットだけを数えます。入れていないセットを推測することはしません。</li>
      </ul>
    </details>
  )
}
