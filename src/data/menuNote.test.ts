import { describe, expect, it } from 'vitest'
import { parseMenuNote, planMenus, splitGroupHint } from './menuNote'

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
    ])
    expect(menus[1].items).toEqual([{ name: 'スクワット', sets: 3 }])
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
    expect(items[0]).toEqual({ exerciseId: 'e1', newKey: null, targetSets: 3 })
    expect(items[2].exerciseId).toBe('e3') // ひらがな・カタカナは同じに見る
    expect(items[1]).toEqual({ exerciseId: null, newKey: '懸垂', targetSets: 2 })
    expect(items[3].exerciseId).toBe('e2')
    expect(plan.newExercises.find((n) => n.name === 'ケーブルクロス')?.muscleGroup).toBe('chest')
    expect(plan.newExercises.find((n) => n.name === 'ダンベルカール')?.muscleGroup).toBe('other')
  })
})
