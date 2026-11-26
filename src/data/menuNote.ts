import { normalize } from './normalize'
import { MUSCLE_GROUPS } from './muscleGroups'
import type { MuscleGroup } from './muscleGroups'

/*
  Cmd のメニューのノート（Markdown）を読む（データベースを使わないので、テストしやすい）

  ノートの形：
    ## 上半身A                         ← 「## 」の見出しが1つのメニュー（名前）
    - ベンチプレス 3セット ／ 5〜8回 70kg  ← 種目名・セット数。「／」から後ろはメモ（アプリは使わない）
    - 懸垂 2セット
    - ケーブルクロス（胸） 2セット       ← アプリにない種目は、（筋群）を付けると、その筋群で新しく作る
  ・先頭のプロパティ（--- で囲んだ所）と、「## 」より前の文は読まない
  ・セット数がない行は「セット数なし」
*/

export type MenuLine = { name: string; sets: number | null }
export type MenuNote = { name: string; items: MenuLine[] }

const GROUP_BY_NAME = new Map(MUSCLE_GROUPS.map((g) => [g.name, g.id]))

export function parseMenuNote(text: string): MenuNote[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let i = 0
  if (lines[0]?.trim() === '---') {
    i = lines.findIndex((l, k) => k > 0 && l.trim() === '---') + 1
    if (i === 0) i = lines.length
  }
  const menus: MenuNote[] = []
  let current: MenuNote | null = null
  for (; i < lines.length; i++) {
    const line = lines[i]
    const head = /^##\s+(.+?)\s*#*\s*$/.exec(line)
    if (head && !line.startsWith('###')) {
      current = { name: head[1].trim(), items: [] }
      menus.push(current)
      continue
    }
    if (/^#\s/.test(line)) {
      current = null
      continue
    }
    if (!current) continue
    const item = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(line)
    if (!item) continue
    const parsed = parseItem(item[1])
    if (parsed) current.items.push(parsed)
  }
  return menus.filter((m) => m.name !== '')
}

function parseItem(raw: string): MenuLine | null {
  // 「／」「 / 」から後ろはメモ
  const head = raw.split(/／|\s\/\s/)[0].replace(/\*\*/g, '').trim()
  const m = /^(.*?)\s*[x×]?\s*(\d+)\s*(?:セット|sets?)?$/i.exec(head)
  const name = (m && m[1].trim() ? m[1] : head).trim()
  if (!name) return null
  const sets = m && m[1].trim() ? Math.min(20, Math.max(1, Number(m[2]))) : null
  return { name, sets }
}

/** 種目名の後ろの（筋群）を見る。「チェストプレス（マシン）」のような筋群でないカッコはそのまま */
export function splitGroupHint(name: string): { name: string; group: MuscleGroup | null } {
  const m = /^(.+?)\s*[（(]([^（）()]+)[）)]$/.exec(name)
  const group = m ? GROUP_BY_NAME.get(m[2].trim()) : undefined
  return group ? { name: m![1].trim(), group } : { name, group: null }
}

type ExerciseLike = { id: string; name: string }
type TemplateLike = { id: string; name: string }

export type MenuPlan = {
  /** 新しく作る種目（名前の重なりはまとめてある） */
  newExercises: { key: string; name: string; muscleGroup: MuscleGroup }[]
  /** 保存するメニュー。id があれば上書き、null なら新しく作る */
  templates: { id: string | null; name: string; items: { exerciseId: string | null; newKey: string | null; targetSets: number | null }[] }[]
}

/** ノートのメニューを、アプリの種目・メニューに当てはめる（何を作り、何を上書きするか） */
export function planMenus(menus: MenuNote[], exercises: ExerciseLike[], templates: TemplateLike[]): MenuPlan {
  const byName = new Map(exercises.map((e) => [normalize(e.name), e.id]))
  const tplByName = new Map(templates.map((t) => [normalize(t.name), t.id]))
  const newExercises: MenuPlan['newExercises'] = []
  const plan: MenuPlan['templates'] = []
  const seenMenu = new Set<string>()
  for (const menu of menus) {
    const mkey = normalize(menu.name)
    if (seenMenu.has(mkey)) continue // 同じ名前のメニューが2つあれば、先のほうを使う
    seenMenu.add(mkey)
    const items = menu.items.map((it) => {
      const exact = byName.get(normalize(it.name))
      if (exact) return { exerciseId: exact, newKey: null, targetSets: it.sets }
      const hint = splitGroupHint(it.name)
      const id = byName.get(normalize(hint.name))
      if (id) return { exerciseId: id, newKey: null, targetSets: it.sets }
      const key = normalize(hint.name)
      if (!newExercises.some((n) => n.key === key)) newExercises.push({ key, name: hint.name, muscleGroup: hint.group ?? 'other' })
      return { exerciseId: null, newKey: key, targetSets: it.sets }
    })
    plan.push({ id: tplByName.get(mkey) ?? null, name: menu.name, items })
  }
  return { newExercises, templates: plan }
}
