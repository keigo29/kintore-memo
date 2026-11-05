import { describe, expect, it } from 'vitest'
import { computeCharge } from './home'

// 2026-11-05（木）を「今日」にする。今週は 11/2（月）〜 11/8（日）
const NOW = new Date(2026, 10, 5, 20, 0).getTime()
const at = (m: number, d: number, h = 19) => new Date(2026, m - 1, d, h).getTime()

describe('今週のチャージ', () => {
  it('今週トレーニングした日を数える（同じ日に2回は1日）', () => {
    const c = computeCharge([at(11, 2), at(11, 2, 21), at(11, 4)], 3, NOW)
    expect(c.days).toBe(2)
    expect(c.goal).toBe(3)
  })

  it('先週からさかのぼって、目標に届いた週を数える', () => {
    // 先週（10/26〜）3日・先々週（10/19〜）3日・その前（10/12〜）1日
    const list = [at(10, 26), at(10, 28), at(10, 30), at(10, 19), at(10, 21), at(10, 23), at(10, 13)]
    expect(computeCharge(list, 3, NOW).streak).toBe(2)
  })

  it('今週がまだ届いていなくても、連続は途切れない', () => {
    const list = [at(10, 26), at(10, 28), at(10, 30), at(11, 3)]
    const c = computeCharge(list, 3, NOW)
    expect(c.streak).toBe(1)
    expect(c.days).toBe(1)
  })

  it('今週も届いたら、連続に足す', () => {
    const list = [at(10, 26), at(10, 28), at(10, 30), at(11, 2), at(11, 3), at(11, 4)]
    expect(computeCharge(list, 3, NOW).streak).toBe(2)
  })

  it('先週が届いていなければ 0', () => {
    expect(computeCharge([at(10, 27), at(11, 2)], 2, NOW).streak).toBe(0)
  })
})
