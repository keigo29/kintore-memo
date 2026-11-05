import { describe, expect, it } from 'vitest'
import { computeSkills, skillDefs, unseenSkills } from './skills'
import type { Goals, SkillSession } from './skills'

const day = 86400000
const T0 = new Date(2026, 0, 5, 19).getTime()
// i 日目に、胸を n セット
const chest = (i: number, n: number): SkillSession => ({ id: `s${i}`, startedAt: T0 + i * day, dayKey: `d${i}`, sets: { chest: n } })

describe('スキルツリー', () => {
  it('6系統×6スキルで36個', () => {
    expect(skillDefs()).toHaveLength(36)
  })

  it('1セット記録すると「始めの一歩」が解放され、次の2つが挑戦中になる', () => {
    const t = computeSkills([chest(0, 1)], [])
    expect(t.skills.get('chest1')!.unlockedAt).toBe(T0)
    expect(t.skills.get('chest2a')!.active).toBe(true)
    expect(t.skills.get('chest2b')!.active).toBe(true)
    expect(t.skills.get('chest3a')!.active).toBe(false)
    expect(t.skills.get('back1')!.unlockedAt).toBeNull()
  })

  it('合計セットが届いた日に「積み上げ」が解放される', () => {
    // 1日10セット × 3日 = 30セット → 3日目（i=2）に解放
    const t = computeSkills([chest(0, 10), chest(1, 10), chest(2, 10)], [])
    expect(t.skills.get('chest2a')!.unlockedAt).toBe(T0 + 2 * day)
    expect(t.skills.get('chest2a')!.value).toBe(30)
  })

  it('同じ日に2回やっても、やった日は1日と数える', () => {
    const a = chest(0, 2)
    const b = { ...chest(0, 2), id: 'x', startedAt: T0 + 3600000 }
    expect(computeSkills([a, b], []).skills.get('chest2b')!.value).toBe(1)
  })

  it('前のスキルが解放されていないと、条件に届いていても解放されない', () => {
    // 自己ベスト5回でも、習慣（8日）が未解放なので「突破」は解放されない
    const prs = Array.from({ length: 5 }, () => ({ sessionId: 's0', group: 'chest' as const }))
    const t = computeSkills([chest(0, 3)], prs)
    expect(t.skills.get('chest3b')!.value).toBe(5)
    expect(t.skills.get('chest3b')!.unlockedAt).toBeNull()
  })

  it('体幹の3段目Bは、自己ベストではなく日数', () => {
    const d = skillDefs().find((x) => x.id === 'core3b')!
    expect(d.metric).toBe('days')
  })

  it('まだ見ていない解放済みのスキルを古い順に返す', () => {
    const t = computeSkills([chest(0, 10), chest(1, 10), chest(2, 10)], [])
    expect(unseenSkills(t, ['chest1']).map((s) => s.def.id)).toEqual(['chest2a'])
  })
})

describe('重量の達成目標（最終スキル）', () => {
  const goals: Goals = new Map([['chest', { group: 'chest', exerciseId: 'bench', exerciseName: 'ベンチプレス', targetKg: 100 }]])
  // 胸の 1〜3段目を全部解放できるだけの記録（10セット×30日、自己ベスト5回）
  const base = Array.from({ length: 30 }, (_, i) => ({ ...chest(i, 10), best: { bench: 80 } }))
  const prs = Array.from({ length: 5 }, (_, i) => ({ sessionId: `s${i}`, group: 'chest' as const }))

  it('胸の最終スキルは「ベンチプレス 100kg」になる', () => {
    const d = skillDefs(goals).find((x) => x.id === 'chest4')!
    expect(d.metric).toBe('goal')
    expect(d.name).toBe('ベンチプレス 100kg')
  })

  it('目標の重量に届いた回で解放される', () => {
    const list = [...base, { ...chest(31, 3), best: { bench: 100 } }]
    const t = computeSkills(list, prs, goals)
    expect(t.skills.get('chest4')!.unlockedAt).toBe(T0 + 31 * day)
    expect(t.skills.get('chest4')!.value).toBe(100)
  })

  it('届かなければ解放されず、いまの最高重量が value に入る', () => {
    const t = computeSkills(base, prs, goals)
    expect(t.skills.get('chest4')!.unlockedAt).toBeNull()
    expect(t.skills.get('chest4')!.value).toBe(80)
  })

  it('先に重量に届いていても、前のスキルが揃った回まで解放されない', () => {
    const early = [{ ...chest(0, 1), best: { bench: 100 } }, ...base.slice(1)]
    const t = computeSkills(early, prs, goals)
    expect(t.skills.get('chest4')!.unlockedAt).toBe(t.skills.get('chest3b')!.unlockedAt! >= t.skills.get('chest3a')!.unlockedAt! ? t.skills.get('chest3b')!.unlockedAt : t.skills.get('chest3a')!.unlockedAt)
  })

  it('体幹の最終スキルは、セット数のまま', () => {
    expect(skillDefs(goals).find((x) => x.id === 'core4')!.metric).toBe('sets')
  })
})
