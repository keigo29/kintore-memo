import { useState } from 'react'
import { MUSCLE_GROUPS } from '../data/muscleGroups'
import type { MuscleGroup } from '../data/muscleGroups'
import type { DailySets } from '../data/stats'
import { setsOnDay } from '../data/stats'
import { addDays, dayKey, startOfWeek } from '../lib/date'
import { formatDate } from '../lib/format'

/*
  鍛えた日の記録（GitHub の「草」のような表）を1つ描く
  ・1マス＝1日。たては月〜日、よこは週（右がいちばん新しい週）
  ・濃さ＝その日に完了した本番セットの数（5段階）
  ・色は単色のグラデーション：group が null なら黒（ボタンの色）、筋群ならその筋群の色
  ・ホームでは「すべて」と筋群ごとの表を縦に並べる（TrainingHeatmapList）
*/
export const HEATMAP_WEEKS = 17

const CELL = 14
const GAP = 3
const STEP = CELL + GAP
const LEFT = 18 // 曜日の文字のぶん
const TOP = 14 // 月の文字のぶん

// 濃さの段階の区切り（この数以上でその段階）。筋群ごとはセット数が少なくなるので低めに
const LEVELS_ALL = [1, 4, 8, 13]
const LEVELS_GROUP = [1, 3, 6, 10]
// 各段階の色の濃さ（%）
const MIX = [0, 30, 55, 78, 100]

const WEEKDAY_LABELS: [number, string][] = [
  [0, '月'],
  [2, '水'],
  [4, '金'],
]

/** 期間内でトレーニングした日数と、合計セット数 */
export function summarize(daily: DailySets, today: number, group: MuscleGroup | null) {
  const from = addDays(startOfWeek(today), -7 * (HEATMAP_WEEKS - 1))
  let days = 0
  let sets = 0
  for (let ms = from; ms <= today; ms = addDays(ms, 1)) {
    const n = setsOnDay(daily, dayKey(ms), group)
    if (n > 0) days++
    sets += n
  }
  return { days, sets }
}

type Props = {
  daily: DailySets
  /** 今日の 0:00 */
  today: number
  /** null ＝ すべての筋群 */
  group: MuscleGroup | null
}

export function TrainingHeatmap({ daily, today, group }: Props) {
  const [picked, setPicked] = useState<number | null>(null)

  const firstWeek = addDays(startOfWeek(today), -7 * (HEATMAP_WEEKS - 1))
  const levels = group ? LEVELS_GROUP : LEVELS_ALL
  const levelOf = (n: number) => levels.filter((t) => n >= t).length

  // 単色のグラデーション：何も塗らない色（soft）と、本色を混ぜる
  const base = group ? `var(--mg-${group})` : 'var(--accent)'
  const fillOf = (level: number) =>
    level === 0 ? 'var(--soft)' : `color-mix(in srgb, ${base} ${MIX[level]}%, var(--soft))`

  // マスを並べる。未来の日は描かない
  const cells: { x: number; y: number; ms: number; n: number }[] = []
  const monthLabels: { x: number; text: string }[] = []
  let lastMonth = -1
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const weekStart = addDays(firstWeek, w * 7)
    const month = new Date(weekStart).getMonth()
    if (month !== lastMonth) {
      // 月が変わった週の上に「10月」と出す。前の月の文字と近すぎるときは、前のほうを消す
      const x = LEFT + w * STEP
      const prev = monthLabels[monthLabels.length - 1]
      if (prev && x - prev.x < STEP * 2.5) monthLabels.pop()
      if (w < HEATMAP_WEEKS - 1) monthLabels.push({ x, text: `${month + 1}月` })
      lastMonth = month
    }
    for (let d = 0; d < 7; d++) {
      const ms = addDays(weekStart, d)
      if (ms > today) continue
      cells.push({ x: LEFT + w * STEP, y: TOP + d * STEP, ms, n: setsOnDay(daily, dayKey(ms), group) })
    }
  }

  const width = LEFT + HEATMAP_WEEKS * STEP - GAP
  const height = TOP + 7 * STEP - GAP
  const pickedCell = cells.find((c) => c.ms === picked)

  // 押した日の内訳（「すべて」のとき）：胸 6・背中 4
  const breakdown = (ms: number) => {
    const day = daily.get(dayKey(ms)) ?? {}
    return MUSCLE_GROUPS.filter((g) => day[g.id])
      .map((g) => `${g.name} ${day[g.id]}`)
      .join('・')
  }

  return (
    <div className="heatmap">
      <svg className="heatmap-svg" viewBox={`0 0 ${width} ${height}`} aria-hidden>
        {monthLabels.map((m) => (
          <text key={m.x} x={m.x} y={9} className="hm-label">
            {m.text}
          </text>
        ))}
        {WEEKDAY_LABELS.map(([d, t]) => (
          <text key={t} x={0} y={TOP + d * STEP + 11} className="hm-label">
            {t}
          </text>
        ))}
        {cells.map((c) => (
          <rect
            key={c.ms}
            x={c.x}
            y={c.y}
            width={CELL}
            height={CELL}
            rx={2}
            style={{ fill: fillOf(levelOf(c.n)) }}
            className={c.ms === picked ? 'hm-cell is-picked' : 'hm-cell'}
            onClick={() => setPicked(c.ms === picked ? null : c.ms)}
          >
            <title>{`${formatDate(c.ms)} ${c.n}セット`}</title>
          </rect>
        ))}
      </svg>

      {/* マスを押したときだけ、その日の内訳を出す */}
      {pickedCell && (
        <p className="heatmap-info">
          <span className="num">{formatDate(pickedCell.ms)}</span>{' '}
          {pickedCell.n === 0
            ? '記録なし'
            : group
              ? `${pickedCell.n}セット`
              : `${pickedCell.n}セット（${breakdown(pickedCell.ms)}）`}
        </p>
      )}
    </div>
  )
}

/** 濃さの見本：少 □□□□□ 多（「すべて」の黒で見せる） */
export function HeatmapLegend() {
  return (
    <span className="heatmap-legend" aria-hidden>
      少
      {MIX.map((m, i) => (
        <i
          key={i}
          style={{ background: i === 0 ? 'var(--soft)' : `color-mix(in srgb, var(--accent) ${m}%, var(--soft))` }}
        />
      ))}
      多
    </span>
  )
}
