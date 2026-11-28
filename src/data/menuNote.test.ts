import { describe, expect, it } from 'vitest'
import { formatTarget, parseMenuNote, planMenus, splitGroupHint } from './menuNote'

const NOTE = `---
tags: [プライベート, 筋トレ]
---
# 筋トレメニュー

説明の文は読まない
- これも読まない

## 上半身A
- ベンチプレス 3セット ／ 5〜8回 70kg
- 懸垂 2
- [ ] サイドレイズ 3 セット
- チェストプレス（マシン） 2セット
- ケーブルクロス（胸） 2セット
- ダンベルカール

### 小見出しは見出しにしない
- シーテッドロウ ×3

## 下半身A
1. スクワット 3セット
`

describe('メニューのノート', () => {
  it('## ごとにメニュー、- ごとに種目とセット数', () => {
    const menus = parseMenuNote(NOTE)
    expect(menus.map((m) => m.name)).toEqual(['上半身A', '下半身A'])
    expect(menus[0].items).toEqual([
      { name: 'ベンチプレス', sets: 3 },
      { name: '懸垂', sets: 2 },
      { name: 'サイドレイズ', sets: 3 },
      { name: 'チェストプレス（マシン）', sets: 2 },
      { name: 'ケーブルクロス（胸）', sets: 2 },
      { name: 'ダンベルカール', sets: null },
      { name: 'シーテッドロウ', sets: 3 },
    ].map((x) => expect.objectContaining(x)))
    expect(menus[1].items).toEqual([expect.objectContaining({ name: 'スクワット', sets: 3 })])
    // 「／」のすぐ後ろが回数・重さだけなら、目標として読む
    expect(menus[0].items[0]).toMatchObject({ memo: null, repsMin: 5, repsMax: 8, weightKg: 70 })
  })

  it('回数・重さ・自重・メモを読む（順番は自由、全角の数字も）', () => {
    const [m] = parseMenuNote(`## A
- ベンチプレス 3セット 5〜8回 70kg ／ 2秒で下ろす
- 懸垂 2セット 6-10回 自重
- フェイスプル（肩） １５回 ３セット 22.5kg
- プランク 3セット できるだけ
- レッグレイズ ×3
- スクワット 3セット ／ 5〜8回 130kg ／ 3セットとも8回で 132.5kg
- ディップス 2セット ／ 胸を張る`)
    expect(m.items[0]).toMatchObject({ name: 'ベンチプレス', sets: 3, repsMin: 5, repsMax: 8, weightKg: 70, memo: '2秒で下ろす' })
    expect(m.items[1]).toMatchObject({ name: '懸垂', sets: 2, repsMin: 6, repsMax: 10, weightKg: null, bodyweight: true })
    expect(m.items[2]).toMatchObject({ name: 'フェイスプル（肩）', sets: 3, repsMin: 15, repsMax: 15, weightKg: 22.5 })
    expect(m.items[3]).toMatchObject({ name: 'プランク', sets: 3, repsMin: null })
    expect(m.items[4]).toMatchObject({ name: 'レッグレイズ', sets: 3 })
    expect(m.items[5]).toMatchObject({ name: 'スクワット', sets: 3, repsMin: 5, repsMax: 8, weightKg: 130, memo: '3セットとも8回で 132.5kg' })
    expect(m.items[6]).toMatchObject({ name: 'ディップス', sets: 2, repsMin: null, memo: '胸を張る' })
  })

  it('目標の文', () => {
    expect(formatTarget({ targetSets: 3, repsMin: 5, repsMax: 8, weightKg: 70, memo: '2秒で下ろす' }, false)).toBe('3セット × 5〜8回・70kg ／ 2秒で下ろす')
    expect(formatTarget({ targetSets: 2, repsMin: 10, repsMax: 10 }, true)).toBe('2セット × 10回・自重')
    expect(formatTarget({ targetSets: 2 }, false)).toBeNull()
  })

  it('（筋群）だけを見分ける', () => {
    expect(splitGroupHint('ケーブルクロス（胸）')).toEqual({ name: 'ケーブルクロス', group: 'chest' })
    expect(splitGroupHint('チェストプレス（マシン）')).toEqual({ name: 'チェストプレス（マシン）', group: null })
  })

  it('同じ名前のメニューは上書き、ない種目は新しく作る', () => {
    const ex = [
      { id: 'e1', name: 'ベンチプレス' },
      { id: 'e2', name: 'チェストプレス（マシン）' },
      { id: 'e3', name: 'さいどれいず' },
    ]
    const plan = planMenus(parseMenuNote(NOTE), ex, [{ id: 't1', name: '上半身A' }])
    expect(plan.templates[0].id).toBe('t1')
    expect(plan.templates[1].id).toBeNull()
    const items = plan.templates[0].items
    expect(items[0]).toMatchObject({ exerciseId: 'e1', newKey: null, targetSets: 3 })
    expect(items[2].exerciseId).toBe('e3') // ひらがな・カタカナは同じに見る
    expect(items[1]).toMatchObject({ exerciseId: null, newKey: '懸垂', targetSets: 2 })
    expect(items[3].exerciseId).toBe('e2')
    expect(plan.newExercises.find((n) => n.name === 'ケーブルクロス')?.muscleGroup).toBe('chest')
    expect(plan.newExercises.find((n) => n.name === 'ダンベルカール')?.muscleGroup).toBe('other')
  })
})
