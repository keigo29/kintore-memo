import { db } from './db'
import type { MuscleGroup } from './muscleGroups'
import type { WorkoutTemplate } from './types'
import { startSession } from './workout'

/*
  トレーニングメニュー
  ・中身は「種目」と「何セットやるか」の並び
  ・メニューからはじめると、そのセット数ぶんを前回の重量・回数で用意する
*/

export type TemplateItem = WorkoutTemplate['items'][number]

/** 一覧の1行ぶん */
export type TemplateRow = {
  template: WorkoutTemplate
  names: string[]
  groups: MuscleGroup[]
  sets: number
}

export async function listTemplates(): Promise<TemplateRow[]> {
  const list = await db.templates.orderBy('updatedAt').reverse().toArray()
  return Promise.all(
    list.map(async (t) => {
      const names: string[] = []
      const groups: MuscleGroup[] = []
      for (const item of t.items) {
        const e = await db.exercises.get(item.exerciseId)
        if (!e) continue
        names.push(e.name)
        if (!groups.includes(e.muscleGroup)) groups.push(e.muscleGroup)
      }
      return { template: t, names, groups, sets: t.items.reduce((n, i) => n + (i.targetSets ?? 1), 0) }
    }),
  )
}

/** 保存する（id があれば上書き、なければ新しく作る）。戻り値は id */
export async function saveTemplate(input: { id?: string; name: string; items: TemplateItem[] }): Promise<string> {
  const now = Date.now()
  if (input.id) {
    await db.templates.update(input.id, { name: input.name.trim(), items: input.items, updatedAt: now })
    return input.id
  }
  const id = crypto.randomUUID()
  await db.templates.add({ id, name: input.name.trim(), items: input.items, createdAt: now, updatedAt: now })
  return id
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.templates.delete(id)
}

/** 複製：「◯◯のコピー」を作る */
export async function duplicateTemplate(id: string): Promise<string | null> {
  const t = await db.templates.get(id)
  if (!t) return null
  return saveTemplate({ name: `${t.name}のコピー`, items: t.items.map((i) => ({ ...i })) })
}

/** 過去のトレーニングから、メニューの中身を作る（種目と、完了した本番セットの数） */
export async function itemsFromSession(sessionId: string): Promise<TemplateItem[]> {
  const items: TemplateItem[] = []
  for (const we of await db.workoutExercises.where('sessionId').equals(sessionId).sortBy('order')) {
    const n = await db.sets
      .where('workoutExerciseId')
      .equals(we.id)
      .filter((s) => s.completedAt !== null && s.kind === 'normal')
      .count()
    if (n === 0) continue
    const same = items.find((i) => i.exerciseId === we.exerciseId)
    if (same) same.targetSets = (same.targetSets ?? 0) + n
    else items.push({ exerciseId: we.exerciseId, targetSets: n })
  }
  return items
}

/** メニューからはじめる（隠した種目・消えた種目は飛ばす） */
export async function startFromTemplate(id: string): Promise<string | null> {
  const t = await db.templates.get(id)
  if (!t) return null
  const items = []
  for (const i of t.items) {
    const e = await db.exercises.get(i.exerciseId)
    if (e && !e.archived) items.push({ exerciseId: i.exerciseId, sets: i.targetSets ?? 1 })
  }
  return startSession(undefined, items, id)
}
