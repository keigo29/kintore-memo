import { db } from './db'
import { normalize } from './exercises'
import type { MuscleGroup } from './muscleGroups'
import { getSettings, updateSettings } from './settings'
import type { WeightGoal } from './types'

/*
  重量の達成目標（例：ベンチプレス 100kg）
  ・胸・肩・腕・背中・下半身に1つずつ。スキルツリーの最終スキルになる（体幹は自重の種目が多いので、セット数のまま）
  ・最初の目標は下の DEFAULT_GOALS。設定（goals）に保存すると、そちらを使う
  ・達成：完了した本番セットで、補助なしの重量が目標以上になったとき
    （補助ありのセットは、本当の重さが分からないので数えない）
*/

export type GoalGroup = Exclude<MuscleGroup, 'core' | 'other'>
export const GOAL_GROUPS: GoalGroup[] = ['chest', 'shoulders', 'arms', 'back', 'legs']

/** 最初の目標（種目は名前で探す。消したり名前を変えたりしていたら、種目を選び直してもらう） */
export const DEFAULT_GOALS: Record<GoalGroup, { name: string; targetKg: number }> = {
  chest: { name: 'ベンチプレス', targetKg: 100 },
  shoulders: { name: 'ショルダープレス', targetKg: 60 },
  arms: { name: 'バーベルカール', targetKg: 40 },
  back: { name: 'デッドリフト', targetKg: 140 },
  legs: { name: 'スクワット', targetKg: 120 },
}

/** 使う目標：保存した目標 → なければ最初の目標（種目が見つからなければ exerciseId は null） */
export type ResolvedGoal = { group: GoalGroup; exerciseId: string | null; exerciseName: string; targetKg: number }

export async function getGoals(): Promise<Map<GoalGroup, ResolvedGoal>> {
  const saved = (await getSettings()).goals
  const exercises = await db.exercises.toArray()
  const map = new Map<GoalGroup, ResolvedGoal>()
  for (const g of GOAL_GROUPS) {
    const s = saved[g]
    const e = s ? exercises.find((x) => x.id === s.exerciseId) : exercises.find((x) => normalize(x.name) === normalize(DEFAULT_GOALS[g].name))
    map.set(g, {
      group: g,
      exerciseId: e?.id ?? null,
      exerciseName: e?.name ?? DEFAULT_GOALS[g].name,
      targetKg: s?.targetKg ?? DEFAULT_GOALS[g].targetKg,
    })
  }
  return map
}

export async function saveGoal(group: GoalGroup, goal: WeightGoal): Promise<void> {
  const goals = { ...(await getSettings()).goals, [group]: goal }
  await updateSettings({ goals })
}

/**
 * このセットで、初めて目標の重量に届いたか（セット完了の直後に呼ぶ）
 * ・届いていれば、その目標を返す。前にもう届いていたら null
 */
export async function goalReachedBy(setId: string): Promise<ResolvedGoal | null> {
  const set = await db.sets.get(setId)
  if (!set || set.completedAt === null || set.kind !== 'normal' || set.assisted || set.weightKg === null) return null
  const we = await db.workoutExercises.get(set.workoutExerciseId)
  if (!we) return null
  const goal = [...(await getGoals()).values()].find((g) => g.exerciseId === we.exerciseId)
  if (!goal || set.weightKg < goal.targetKg) return null
  // この種目の、ほかの完了したセットで、もう届いていたか
  const weIds = new Set((await db.workoutExercises.where('exerciseId').equals(we.exerciseId).toArray()).map((w) => w.id))
  const before = await db.sets
    .filter(
      (s) =>
        s.id !== set.id &&
        weIds.has(s.workoutExerciseId) &&
        s.completedAt !== null &&
        s.kind === 'normal' &&
        !s.assisted &&
        (s.weightKg ?? 0) >= goal.targetKg,
    )
    .count()
  return before === 0 ? goal : null
}
