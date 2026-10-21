import { exerciseStats, mergeStats } from '../lib/calc'
import type { ExerciseStats } from '../lib/calc'
import { addDays, dayKey, startOfDay, startOfWeek } from '../lib/date'
import { db } from './db'
import { MUSCLE_GROUPS } from './muscleGroups'
import type { MuscleGroup } from './muscleGroups'
import type { Exercise, PersonalRecord, WorkoutSet } from './types'

/*
  分析
  ・数えるのは「終えた」トレーニングの、完了した本番セットだけ（計算のきまりは lib/calc.ts と同じ）
  ・期間：1か月／3か月／1年／全期間（今日から数えて）
  ・週ごとの回数は、期間に関係なく直近12週
  ・種目の推移は「1回のトレーニング＝1点」。同じ回に同じ種目を2回やったら合わせる
*/

export type Period = '1m' | '3m' | '1y' | 'all'

export const PERIODS: { id: Period; label: string }[] = [
  { id: '1m', label: '1か月' },
  { id: '3m', label: '3か月' },
  { id: '1y', label: '1年' },
  { id: 'all', label: '全期間' },
]

/** 期間のはじまり（全期間なら 0） */
export function periodStart(period: Period, now: number): number {
  const d = new Date(startOfDay(now))
  if (period === '1m') d.setMonth(d.getMonth() - 1)
  else if (period === '3m') d.setMonth(d.getMonth() - 3)
  else if (period === '1y') d.setFullYear(d.getFullYear() - 1)
  else return 0
  return d.getTime()
}

export type ExercisePoint = { sessionId: string; at: number; stats: ExerciseStats }

export type ExerciseLine = {
  exercise: Exercise
  /** 古い順 */
  points: ExercisePoint[]
}

export type AnalysisData = {
  /** 終えたトレーニングが1回でもあるか */
  hasAny: boolean
  summary: { days: number; sessions: number; sets: number; volume: number }
  /** 直近12週の、週ごとのトレーニング回数（古い順） */
  weekly: { weekStart: number; count: number }[]
  /** 期間内の筋群ごとのセット数（多い順、0 は入れない） */
  groups: { group: MuscleGroup; sets: number; volume: number }[]
  /** 期間内にやった種目（やった回数の多い順） */
  lines: ExerciseLine[]
}

export const WEEKLY_WEEKS = 12

export async function getAnalysis(period: Period, now = Date.now()): Promise<AnalysisData> {
  const from = periodStart(period, now)
  const sessions = (await db.sessions.toArray()).filter((s) => s.status === 'done')
  const doneIds = new Set(sessions.map((s) => s.id))
  const startedAt = new Map(sessions.map((s) => [s.id, s.startedAt]))

  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
  const wes = (await db.workoutExercises.toArray()).filter((w) => doneIds.has(w.sessionId))
  const setsByWe = new Map<string, WorkoutSet[]>()
  for (const s of await db.sets.toArray()) {
    if (!doneIds.has(s.sessionId)) continue
    const list = setsByWe.get(s.workoutExerciseId)
    if (list) list.push(s)
    else setsByWe.set(s.workoutExerciseId, [s])
  }

  // 種目×トレーニングごとの数字
  const perSession = new Map<string, Map<string, ExerciseStats>>() // exerciseId → sessionId → stats
  for (const we of wes) {
    const e = exercises.get(we.exerciseId)
    const stats = exerciseStats(setsByWe.get(we.id) ?? [], e?.isBodyweight ?? false)
    if (stats.sets === 0) continue
    let bySession = perSession.get(we.exerciseId)
    if (!bySession) perSession.set(we.exerciseId, (bySession = new Map()))
    const prev = bySession.get(we.sessionId)
    bySession.set(we.sessionId, prev ? mergeStats(prev, stats) : stats)
  }

  // セットが1つもないトレーニングは数えない
  const counted = new Set<string>()
  for (const m of perSession.values()) for (const id of m.keys()) counted.add(id)
  const inPeriod = (id: string) => (startedAt.get(id) ?? 0) >= from

  const summary = { days: 0, sessions: 0, sets: 0, volume: 0 }
  const days = new Set<string>()
  for (const id of counted) {
    if (!inPeriod(id)) continue
    summary.sessions++
    days.add(dayKey(startedAt.get(id)!))
  }
  summary.days = days.size

  const groupMap = new Map<MuscleGroup, { sets: number; volume: number }>()
  const lines: ExerciseLine[] = []
  for (const [exerciseId, bySession] of perSession) {
    const exercise = exercises.get(exerciseId)
    if (!exercise) continue
    const points: ExercisePoint[] = []
    for (const [sessionId, stats] of bySession) {
      if (!inPeriod(sessionId)) continue
      points.push({ sessionId, at: startedAt.get(sessionId)!, stats })
      summary.sets += stats.sets
      summary.volume += stats.volume
      const g = groupMap.get(exercise.muscleGroup) ?? { sets: 0, volume: 0 }
      g.sets += stats.sets
      g.volume += stats.volume
      groupMap.set(exercise.muscleGroup, g)
    }
    if (points.length === 0) continue
    points.sort((a, b) => a.at - b.at)
    lines.push({ exercise, points })
  }
  summary.volume = Math.round(summary.volume * 10) / 10
  lines.sort((a, b) => b.points.length - a.points.length || b.points[b.points.length - 1].at - a.points[a.points.length - 1].at)

  const order = MUSCLE_GROUPS.map((g) => g.id)
  const groups = [...groupMap]
    .map(([group, v]) => ({ group, sets: v.sets, volume: Math.round(v.volume * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets || order.indexOf(a.group) - order.indexOf(b.group))

  const firstWeek = addDays(startOfWeek(now), -7 * (WEEKLY_WEEKS - 1))
  const weekly = Array.from({ length: WEEKLY_WEEKS }, (_, i) => ({ weekStart: addDays(firstWeek, 7 * i), count: 0 }))
  for (const id of counted) {
    const at = startedAt.get(id)!
    if (at < firstWeek) continue
    const w = weekly.find((x, i) => at >= x.weekStart && (i === WEEKLY_WEEKS - 1 || at < weekly[i + 1].weekStart))
    if (w) w.count++
  }

  return { hasAny: counted.size > 0, summary, weekly, groups, lines }
}

/** その種目の自己ベスト（新しい順）。終えたトレーニングのものだけ */
export async function getExerciseRecords(exerciseId: string): Promise<PersonalRecord[]> {
  const list = await db.records.where('exerciseId').equals(exerciseId).toArray()
  return list.sort((a, b) => b.achievedAt - a.achievedAt)
}
