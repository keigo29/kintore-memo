import { useEffect, useState } from 'react'
import type { Charge } from '../data/home'
import { BoltIcon, ChargeArc } from './Volt'

/*
  今週のチャージ（ホーム）
  ・週の目標の日数ぶん、マスが並ぶ。トレーニングした日の数だけ、マスに電気がたまる
  ・前に見たときから増えたマスだけ、下から満ちる動きをつける（どこまで見たかは、この端末に覚えておく）
  ・目標に届くと、マスの上を電気が走り続ける
  ・「◯週連続」は、目標を達成した週の連続数
*/

const SEEN_KEY = 'kintore-memo:charge-seen'

function readSeen(weekStart: number): number {
  try {
    const [w, n] = (localStorage.getItem(SEEN_KEY) ?? '').split(':').map(Number)
    return w === weekStart ? n : 0
  } catch {
    return 0
  }
}

export function ChargeCard({ charge }: { charge: Charge }) {
  const { goal, days, streak, weekStart } = charge
  // 最初に表示したときの「前に見た数」。ここから先のマスだけ動かす
  const [seen] = useState(() => readSeen(weekStart))
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, `${weekStart}:${days}`)
    } catch {
      /* 保存できなくても表示は変わらない */
    }
  }, [weekStart, days])

  const full = days >= goal
  const cells = Math.max(goal, Math.min(days, 7))
  return (
    <div className="charge" data-full={full || undefined}>
      <div className="row-between">
        <h2 className="section-title charge-title">今週のチャージ</h2>
        {streak > 0 && (
          <span className="charge-streak num">
            <BoltIcon />
            {streak}週連続
          </span>
        )}
      </div>
      <div className="charge-cells" style={{ '--n': cells } as React.CSSProperties}>
        {Array.from({ length: cells }, (_, i) => {
          const on = i < days
          const fresh = on && i >= seen
          return (
            <span
              key={i}
              className="charge-cell"
              data-on={on || undefined}
              data-fresh={fresh || undefined}
              data-extra={i >= goal || undefined}
              style={fresh ? ({ '--d': `${(i - seen) * 220}ms` } as React.CSSProperties) : undefined}
            >
              <BoltIcon />
            </span>
          )
        })}
        {full && <ChargeArc />}
      </div>
      <p className="charge-foot">
        <span className="num">
          {days} / {goal}日
        </span>
        <span className={full ? 'charge-msg is-full' : 'charge-msg'}>
          {full ? (days > goal ? `目標より${days - goal}日多くチャージ！` : '今週はフルチャージ！') : `あと${goal - days}日でフルチャージ`}
        </span>
      </p>
    </div>
  )
}
