import { describe, expect, it } from 'vitest'
import { compareWithPrevious, e1rm, exerciseStats, mergeStats, rirSummary } from './calc'
import type { SetLike } from './calc'

// テスト用のセットを作る（指定しないところは「完了した本番セット」）
const set = (weightKg: number | null, reps: number | null, more: Partial<SetLike> = {}): SetLike => ({
  weightKg,
  reps,
  assisted: false,
  kind: 'normal',
  completedAt: 1,
  rir: null,
  ...more,
})

describe('推定1RM（Epley）', () => {
  it('重量 ×（1 ＋ 回数 ÷ 30）', () => {
    expect(e1rm(60, 8)).toBe(76) // 60 × 1.2667 = 76.0
    expect(e1rm(100, 5)).toBe(116.7)
  })
  it('1回なら重量そのまま', () => {
    expect(e1rm(120, 1)).toBe(120)
  })
  it('11回以上・0回・重量なしは出さない', () => {
    expect(e1rm(40, 11)).toBeNull()
    expect(e1rm(40, 0)).toBeNull()
    expect(e1rm(null, 5)).toBeNull()
    expect(e1rm(60, null)).toBeNull()
  })
})

describe('種目の数字', () => {
  it('総挙上量は 重量×回数 の合計。ウォームアップと未完了は数えない', () => {
    const s = exerciseStats(
      [
        set(40, 10, { kind: 'warmup' }),
        set(60, 8),
        set(60, 8),
        set(60, 7),
        set(62.5, 8, { completedAt: null }),
      ],
      false,
    )
    expect(s.sets).toBe(3)
    expect(s.reps).toBe(23)
    expect(s.volume).toBe(1380)
    expect(s.topWeight).toBe(60)
    expect(s.bestE1rm).toBe(76)
  })
  it('補助ありは総挙上量に入れるが、最高重量と推定1RMには使わない', () => {
    const s = exerciseStats([set(60, 8), set(80, 3, { assisted: true })], false)
    expect(s.volume).toBe(720)
    expect(s.topWeight).toBe(60)
    expect(s.bestE1rm).toBe(76)
  })
  it('自重の種目は総挙上量に入れず、回数だけ数える', () => {
    const s = exerciseStats([set(null, 15), set(null, 12)], true)
    expect(s.volume).toBe(0)
    expect(s.reps).toBe(27)
    expect(s.topWeight).toBeNull()
  })
  it('重量を入れていないセットは総挙上量に入れない（0kg と区別する）', () => {
    expect(exerciseStats([set(null, 10)], false).volume).toBe(0)
    expect(exerciseStats([set(0, 10)], false).topWeight).toBe(0)
  })
  it('小数の重量も正しく足す', () => {
    expect(exerciseStats([set(62.5, 3), set(62.5, 3)], false).volume).toBe(375)
  })
  it('2つを足し合わせる', () => {
    const a = exerciseStats([set(60, 8)], false)
    const b = exerciseStats([set(70, 5)], false)
    expect(mergeStats(a, b)).toEqual({ sets: 2, reps: 13, volume: 830, topWeight: 70, bestE1rm: 81.7 })
  })
})

describe('前回からの変化', () => {
  it('重量の種目は最高重量の差', () => {
    const now = exerciseStats([set(62.5, 8)], false)
    const prev = exerciseStats([set(60, 8)], false)
    expect(compareWithPrevious(now, prev, false)).toEqual({ label: '最高重量', diff: 2.5, unit: 'kg' })
  })
  it('自重の種目は合計回数の差', () => {
    const now = exerciseStats([set(null, 12), set(null, 10)], true)
    const prev = exerciseStats([set(null, 10), set(null, 10)], true)
    expect(compareWithPrevious(now, prev, true)).toEqual({ label: '合計回数', diff: 2, unit: '回' })
  })
  it('前回がなければ比べない', () => {
    expect(compareWithPrevious(exerciseStats([set(60, 8)], false), null, false)).toBeNull()
  })
})

describe('あと何回', () => {
  it('入れたセットだけを数え、入れていないセットは推測しない', () => {
    const r = rirSummary([set(60, 8, { rir: 2 }), set(60, 8, { rir: 2 }), set(60, 7, { rir: 'unknown' }), set(60, 6)])
    expect(r.recorded).toBe(3)
    expect(r.total).toBe(4)
    expect(r.counts.get(2)).toBe(2)
    expect(r.counts.get('unknown')).toBe(1)
  })
})
