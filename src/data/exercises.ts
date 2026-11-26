import { db } from './db'
import type { MuscleGroup } from './muscleGroups'
import type { Exercise } from './types'
import { normalize } from './normalize'

/*
  種目のデータ操作
  ・種目は削除しない。「隠す」だけにする
    （削除すると、その種目を使った過去の記録の名前が分からなくなるため）
*/

export { normalize } from './normalize'

/** 同じ名前の種目がすでにあるか（隠した種目も含む。exceptId は自分自身を除くため） */
export async function findSameName(name: string, exceptId?: string): Promise<Exercise | undefined> {
  const key = normalize(name)
  const all = await db.exercises.toArray()
  return all.find((e) => e.id !== exceptId && normalize(e.name) === key)
}

export type ExerciseInput = {
  name: string
  muscleGroup: MuscleGroup
  isBodyweight: boolean
}

export async function addExercise(input: ExerciseInput): Promise<Exercise> {
  const exercise: Exercise = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    muscleGroup: input.muscleGroup,
    isCustom: true,
    isBodyweight: input.isBodyweight,
    archived: false,
    createdAt: Date.now(),
  }
  await db.exercises.add(exercise)
  return exercise
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  await db.exercises.update(id, {
    name: input.name.trim(),
    muscleGroup: input.muscleGroup,
    isBodyweight: input.isBodyweight,
  })
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await db.exercises.update(id, { archived })
}
