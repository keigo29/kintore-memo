import type { Rir, WorkoutSet } from '../data/types'

/*
  計算のきまり（画面の「計算の仕方」にも同じことを書く）
  ・数えるのは「完了した本番セット」だけ。ウォームアップと、完了していないセットは数えない
  ・総挙上量 ＝ 各セットの「重量 × 回数」の合計（kg）
      - 自重の種目と、重量を入れていないセットは数えない（回数だけ数える）
      - 補助ありのセットも数える
  ・推定1RM ＝ 重量 ×（1 ＋ 回数 ÷ 30）（Epley の式）
      - 1回なら重量そのまま
      - 11回以上は誤差が大きいので出さない
      - 補助ありのセットは使わない
  ・最高重量 ＝ 補助なしのセットで一番重い重量
  ・数字は小数第1位まで（四捨五入）
*/

export type SetLike = Pick<WorkoutSet, 'weightKg' | 'reps' | 'assisted' | 'kind' | 'completedAt' | 'rir'>

/** 小数第1位まで */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** 数える対象のセットか（完了した本番セット） */
export function isWorkSet(s: SetLike): boolean {
  return s.completedAt !== null && s.kind === 'normal'
}

/** 推定1RM（Epley）。出せないときは null */
export function e1rm(weightKg: number | null, reps: number | null): number | null {
  if (weightKg === null || reps === null || weightKg <= 0 || reps < 1 || reps > 10) return null
  if (reps === 1) return weightKg
  return round1(weightKg * (1 + reps / 30))
}

/** 1つの種目の数字 */
export type ExerciseStats = {
  /** 完了した本番セットの数 */
  sets: number
  /** 回数の合計 */
  reps: number
  /** 総挙上量（kg）。数えられるセットがなければ 0 */
  volume: number
  /** 最高重量（補助なし）。なければ null */
  topWeight: number | null
  /** 推定1RMの一番大きい値。なければ null */
  bestE1rm: number | null
}

export function exerciseStats(sets: SetLike[], bodyweight: boolean): ExerciseStats {
  const work = sets.filter(isWorkSet)
  let reps = 0
  let volume = 0
  let topWeight: number | null = null
  let bestE1rm: number | null = null
  for (const s of work) {
    reps += s.reps ?? 0
    if (bodyweight) continue
    if (s.weightKg !== null && s.reps !== null) volume += s.weightKg * s.reps
    if (s.assisted || s.weightKg === null) continue
    if (topWeight === null || s.weightKg > topWeight) topWeight = s.weightKg
    const e = e1rm(s.weightKg, s.reps)
    if (e !== null && (bestE1rm === null || e > bestE1rm)) bestE1rm = e
  }
  return { sets: work.length, reps, volume: round1(volume), topWeight, bestE1rm }
}

/** 2つを足す（同じ種目を1回のトレーニングで2回やったときなど） */
export function mergeStats(a: ExerciseStats, b: ExerciseStats): ExerciseStats {
  const max = (x: number | null, y: number | null) => (x === null ? y : y === null ? x : Math.max(x, y))
  return {
    sets: a.sets + b.sets,
    reps: a.reps + b.reps,
    volume: round1(a.volume + b.volume),
    topWeight: max(a.topWeight, b.topWeight),
    bestE1rm: max(a.bestE1rm, b.bestE1rm),
  }
}

/** 前回との差。比べられないときは null */
export type Change = { label: string; diff: number; unit: string }

/**
 * 前回からの変化
 * ・重量の種目：最高重量 → 推定1RM の順で、比べられる最初のもの
 * ・自重の種目：回数の合計
 */
export function compareWithPrevious(now: ExerciseStats, prev: ExerciseStats | null, bodyweight: boolean): Change | null {
  if (!prev || prev.sets === 0 || now.sets === 0) return null
  if (bodyweight) return { label: '合計回数', diff: now.reps - prev.reps, unit: '回' }
  if (now.topWeight !== null && prev.topWeight !== null) {
    return { label: '最高重量', diff: round1(now.topWeight - prev.topWeight), unit: 'kg' }
  }
  if (now.bestE1rm !== null && prev.bestE1rm !== null) {
    return { label: '推定1RM', diff: round1(now.bestE1rm - prev.bestE1rm), unit: 'kg' }
  }
  return null
}

/** あと何回の集計：入れたセットだけを数える。入れていないセットは推測しない */
export function rirSummary(sets: SetLike[]): { counts: Map<Rir, number>; recorded: number; total: number } {
  const work = sets.filter(isWorkSet)
  const counts = new Map<Rir, number>()
  let recorded = 0
  for (const s of work) {
    if (s.rir === null) continue
    recorded++
    counts.set(s.rir, (counts.get(s.rir) ?? 0) + 1)
  }
  return { counts, recorded, total: work.length }
}
