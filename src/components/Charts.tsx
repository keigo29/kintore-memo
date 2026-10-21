import { useState } from 'react'
import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import type { MuscleGroup } from '../data/muscleGroups'
import { formatShortDate } from '../lib/format'
import { formatNumber } from './SessionReport'

/*
  分析のグラフ（ライブラリを使わず SVG で描く）
  ・LineChart：種目の推移。横は日付（間隔は実際の日数どおり）、点を押すとその日の値が出る
  ・WeeklyBars：週ごとのトレーニング回数
  ・GroupBars：筋群ごとのセット数（筋群の色）
*/

const W = 320
const H = 168
const PAD = { top: 14, right: 12, bottom: 22, left: 40 }

/** 目盛りをきりのいい数にする */
function niceRange(min: number, max: number): { lo: number; hi: number; step: number } {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1)
    min -= pad
    max += pad
  }
  const raw = (max - min) / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.max(0, Math.floor(min / step) * step)
  const hi = Math.ceil(max / step) * step
  return { lo, hi: hi === lo ? lo + step : hi, step }
}

export type LinePoint = { at: number; value: number; id: string }

type LineProps = {
  points: LinePoint[]
  unit: string
  /** 線の色（筋群の色など） */
  color: string
  /** 点を押したとき（その日の記録を開くなど） */
  onOpen?: (id: string) => void
}

export function LineChart({ points, unit, color, onOpen }: LineProps) {
  const [sel, setSel] = useState<number | null>(null)
  const last = points.length - 1
  const active = sel ?? last
  const values = points.map((p) => p.value)
  const { lo, hi, step } = niceRange(Math.min(...values), Math.max(...values))
  const t0 = points[0].at
  const t1 = points[last].at
  const x = (at: number) => (t1 === t0 ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((at - t0) / (t1 - t0)) * (W - PAD.left - PAD.right))
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 10) / 10)

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const area = `${path} L${x(t1).toFixed(1)} ${H - PAD.bottom} L${x(t0).toFixed(1)} ${H - PAD.bottom} Z`
  const a = points[active]

  return (
    <div className="line-chart" style={{ '--line-color': color } as React.CSSProperties}>
      <div className="chart-readout">
        <span className="num chart-readout-value">
          {formatNumber(a.value)}
          <small>{unit}</small>
        </span>
        <span className="num chart-readout-date">{formatShortDate(a.at)}</span>
        {onOpen && (
          <button type="button" className="link-btn chart-open" onClick={() => onOpen(a.id)}>
            この日を見る
          </button>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`推移のグラフ（${points.length}回分）`}>
        <defs>
          <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--line-color)', stopOpacity: 0.22 }} />
            <stop offset="1" style={{ stopColor: 'var(--line-color)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(v) + 3.5} className="chart-tick" textAnchor="end">
              {formatNumber(v)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} className="chart-tick">
          {formatShortDate(t0)}
        </text>
        {last > 0 && (
          <text x={W - PAD.right} y={H - 6} className="chart-tick" textAnchor="end">
            {formatShortDate(t1)}
          </text>
        )}
        {last > 0 && <path d={area} fill="url(#lc-fill)" />}
        {last > 0 && <path d={path} className="chart-line" />}
        <line x1={x(a.at)} x2={x(a.at)} y1={PAD.top} y2={H - PAD.bottom} className="chart-cursor" />
        {points.map((p, i) => (
          <circle key={p.id} cx={x(p.at)} cy={y(p.value)} r={i === active ? 4.5 : 2.6} className={i === active ? 'chart-dot is-active' : 'chart-dot'} />
        ))}
        {/* 押しやすいよう、点ごとに縦長の当たり判定を置く */}
        {points.map((p, i) => {
          const left = i === 0 ? PAD.left : (x(points[i - 1].at) + x(p.at)) / 2
          const right = i === last ? W - PAD.right : (x(p.at) + x(points[i + 1].at)) / 2
          return (
            <rect
              key={`hit-${p.id}`}
              x={last === 0 ? PAD.left : left}
              width={last === 0 ? W - PAD.left - PAD.right : Math.max(1, right - left)}
              y={0}
              height={H}
              fill="transparent"
              onClick={() => setSel(i)}
            />
          )
        })}
      </svg>
    </div>
  )
}

/** 週ごとの回数（直近の週が右） */
export function WeeklyBars({ weekly }: { weekly: { weekStart: number; count: number }[] }) {
  const max = Math.max(1, ...weekly.map((w) => w.count))
  return (
    <div className="week-bars">
      <div className="week-bars-plot">
        {weekly.map((w, i) => (
          <div key={w.weekStart} className="week-bar" data-now={i === weekly.length - 1 || undefined}>
            <span className="week-bar-n num">{w.count || ''}</span>
            <span className="week-bar-fill" style={{ height: `${(w.count / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="week-bars-axis num">
        <span>{formatShortDate(weekly[0].weekStart)}〜</span>
        <span>今週</span>
      </div>
    </div>
  )
}

/** 筋群ごとのセット数 */
export function GroupBars({ groups }: { groups: { group: MuscleGroup; sets: number; volume: number }[] }) {
  const max = Math.max(1, ...groups.map((g) => g.sets))
  const total = groups.reduce((n, g) => n + g.sets, 0)
  return (
    <ul className="group-bars">
      {groups.map((g) => (
        <li key={g.group} className="group-bar" style={groupColor(g.group)}>
          <span className="group-bar-name">{MUSCLE_GROUPS.find((m) => m.id === g.group)?.name}</span>
          <span className="group-bar-track">
            <span className="group-bar-fill" style={{ width: `${(g.sets / max) * 100}%` }} />
          </span>
          <span className="group-bar-n num">
            {g.sets}
            <small>セット</small>
          </span>
          <span className="group-bar-pct num">{Math.round((g.sets / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  )
}
