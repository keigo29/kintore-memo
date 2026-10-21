import { describe, expect, it } from 'vitest'
import { backupFileName, makeBackup, parseBackup } from './backupFormat'
import type { BackupData } from './backupFormat'

// 小さな正しいデータ（種目1・トレーニング1・種目の行1・セット1）
const sample = (): BackupData => ({
  exercises: [{ id: 'e1', name: 'ベンチプレス', muscleGroup: 'chest', isCustom: false, isBodyweight: false, archived: false, createdAt: 1 }],
  templates: [],
  sessions: [{ id: 's1', startedAt: 10, endedAt: 20, templateId: null, status: 'done', effort: null, note: null }],
  workoutExercises: [{ id: 'w1', sessionId: 's1', exerciseId: 'e1', order: 0, note: null }],
  sets: [
    { id: 'x1', workoutExerciseId: 'w1', sessionId: 's1', order: 0, kind: 'normal', weightKg: 60, reps: 8, assisted: false, rir: null, completedAt: 15, note: null },
  ],
  records: [],
  settings: [],
})
const text = (data: BackupData) => JSON.stringify(makeBackup(data, 100))

describe('parseBackup', () => {
  it('書き出したものは、そのまま読める', () => {
    const r = parseBackup(text(sample()))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.file.data.sets[0].weightKg).toBe(60)
  })

  it('null（入れていない）は null のまま残る', () => {
    const d = sample()
    d.sets[0].weightKg = null
    const r = parseBackup(text(d))
    expect(r.ok && r.file.data.sets[0].weightKg).toBeNull()
  })

  it('JSON でないものは読まない', () => {
    expect(parseBackup('こんにちは')).toMatchObject({ ok: false })
  })

  it('ほかのアプリのファイルは読まない', () => {
    expect(parseBackup(JSON.stringify({ app: 'other', format: 1, data: {} }))).toMatchObject({ ok: false, error: expect.stringContaining('ではありません') })
  })

  it('新しい版のファイルは読まない', () => {
    expect(parseBackup(JSON.stringify({ ...makeBackup(sample()), format: 99 }))).toMatchObject({ ok: false })
  })

  it('項目が足りない行があれば、何件目かを返す', () => {
    const d = sample()
    ;(d.sets[0] as unknown as Record<string, unknown>).reps = '8回'
    expect(parseBackup(text(d))).toEqual({ ok: false, error: '「セット」の 1 件目が読めません' })
  })

  it('ないトレーニングを指すセットがあれば読まない', () => {
    const d = sample()
    d.sets[0].sessionId = 'nope'
    expect(parseBackup(text(d))).toMatchObject({ ok: false })
  })

  it('同じ id が2つあれば読まない', () => {
    const d = sample()
    d.exercises.push({ ...d.exercises[0] })
    expect(parseBackup(text(d))).toMatchObject({ ok: false, error: expect.stringContaining('同じ id') })
  })

  it('ない表は空として読む（古いファイルでも読める）', () => {
    const f = makeBackup(sample())
    delete (f.data as Partial<BackupData>).records
    const r = parseBackup(JSON.stringify(f))
    expect(r.ok && r.file.data.records).toEqual([])
  })
})

it('ファイル名に日付が入る', () => {
  expect(backupFileName(new Date(2026, 9, 21).getTime())).toBe('kintore-memo-backup-2026-10-21.json')
})
