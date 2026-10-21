import { useState } from 'react'
import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import type { MuscleGroup } from '../data/muscleGroups'
import type { DailySets } from '../data/stats'
import { setsOnDay } from '../data/stats'
import { addDays, dayKey, startOfWeek } from '../lib/date'
import { formatDate } from '../lib/format'

/*
  鍛えた日の記録（GitHub の「草」のような表）
  ・1マス＝1日。たては月〜日、よこは週（右がいちばん新しい週）
  ・濃さ＝その日に完了した本番セットの数（5段階）
  ・色は単色のグラデーション：「すべて」は黒（ボタンの色）、筋群を選ぶとその筋群の色
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

type Props = {
  daily: DailySets
  /** 今日（テストで日付を固定できるように外から渡す） */
  today: number
}

export function TrainingHeatmap({ daily, today }: Props) {
  const [group, setGroup] = useState<MuscleGroup | null>(null)
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
  let trainedDays = 0
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
      const n = setsOnDay(daily, dayKey(ms), group)
      if (n > 0) trainedDays++
      cells.push({ x: LEFT + w * STEP, y: TOP + d * STEP, ms, n })
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
      <div className="heatmap-filter" role="radiogroup" aria-label="筋群で切りかえる">
        <button type="button" role="radio" aria-checked={group === null} className="hm-chip" onClick={() => setGroup(null)}>
          すべて
        </button>
        {MUSCLE_GROUPS.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={group === id}
            className="hm-chip"
            style={groupColor(id)}
            onClick={() => setGroup(group === id ? null : id)}
          >
            <span className="dot" aria-hidden />
            {name}
          </button>
        ))}
      </div>

      <svg className="heatmap-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`直近${HEATMAP_WEEKS}週で${trainedDays}日`}>
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

      <div className="heatmap-foot">
        <span className="heatmap-info">
          {pickedCell ? (
            <>
              <span className="num">{formatDate(pickedCell.ms)}</span>{' '}
              {pickedCell.n === 0
                ? '記録なし'
                : group
                  ? `${pickedCell.n}セット`
                  : `${pickedCell.n}セット（${breakdown(pickedCell.ms)}）`}
            </>
          ) : (
            <>
              直近{HEATMAP_WEEKS}週で <span className="num">{trainedDays}</span>日
            </>
          )}
        </span>
        {/* 日を押しているときは内訳を広く見せるため、濃さの見本は隠す */}
        {!pickedCell && (
          <span className="heatmap-legend" aria-hidden>
            少
            {MIX.map((_, i) => (
              <i key={i} style={{ background: fillOf(i) }} />
            ))}
            多
          </span>
        )}
      </div>
    </div>
  )
}
