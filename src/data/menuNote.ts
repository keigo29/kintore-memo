import { normalize } from './normalize'
import { MUSCLE_GROUPS } from './muscleGroups'
import type { MuscleGroup } from './muscleGroups'

/*
  Cmd のメニューのノート（Markdown）を読む（データベースを使わないので、テストしやすい）

  ノートの形：
    ## 上半身A                                  ← 「## 」の見出しが1つのメニュー（名前）
    - ベンチプレス 3セット 5〜8回 70kg ／ 2秒で下ろす ← 種目名・セット数・回数・重さ。「／」から後ろはメモ
    - ベンチプレス 3セット ／ 5〜8回 70kg ／ 2秒で下ろす ← 「／」のすぐ後ろが回数・重さだけなら、それも目標として読む
    - 懸垂 2セット 6〜10回 自重
    - ケーブルクロス（胸） 2セット 12〜15回 20kg   ← アプリにない種目は、（筋群）を付けると、その筋群で新しく作る
  ・セット数・回数・重さは、どれもなくてよい。順番も自由
  ・「自重」と書くと、新しく作る種目は自重の種目になる
  ・「できるだけ」の回数は、回数なしとして読む
  ・先頭のプロパティ（--- で囲んだ所）と、「## 」より前の文は読まない
*/

export type MenuLine = {
  name: string
  sets: number | null
  repsMin?: number | null
  repsMax?: number | null
  weightKg?: number | null
  bodyweight?: boolean
  memo?: string | null
}
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

// 種目名の後ろに続く「3セット」「8〜12回」「60kg」「自重」「できるだけ」（全角の数字も読む）
const TOKEN = /(\d+)\s*(?:セット|sets?)|(\d+)\s*(?:[〜~～\-–]\s*(\d+)\s*)?(?:回|reps?)|(\d+(?:\.\d+)?)\s*kg|自重|できるだけ|[x×]\s*(\d+)(?!\s*(?:回|kg|reps?))/gi

/** 全角の数字だけ半角にする（種目名の（）はそのまま残す） */
const halfDigits = (s: string) => s.replace(/[０-９．]/g, (c) => (c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xfee0)))

/** 目標の言葉（回数・重さ・自重・できるだけ）だけでできた文か */
const onlyTargets = (s: string) => s.trim() !== '' && s.replace(TOKEN, '').replace(/[\s・,、]/g, '') === ''

function parseItem(raw: string): MenuLine | null {
  // 「／」「 / 」で区切る。1つ目が種目名（とセット数など）、そのあとはメモ
  // ただし2つ目が「5〜8回 70kg」のように目標の言葉だけなら、目標として読む
  //   （「- ベンチプレス 3セット ／ 5〜8回 70kg ／ メモ」は、前の版のアプリでも種目名を正しく読める書き方）
  const [headRaw, ...rest] = raw.split(/／|\s\/\s/)
  let targetPart = ''
  if (rest.length && onlyTargets(halfDigits(rest[0]))) targetPart = halfDigits(rest.shift()!)
  const memo = rest.join('／').trim() || null
  const head = halfDigits(headRaw.replace(/\*\*/g, '')).trim()
  let sets: number | null = null
  let repsMin: number | null = null
  let repsMax: number | null = null
  let weightKg: number | null = null
  let bodyweight = false
  let first = -1
  const matches = [...head.matchAll(TOKEN)]
  for (const m of [...matches, ...targetPart.matchAll(TOKEN)]) {
    if (first < 0 && matches.includes(m)) first = m.index ?? 0
    if (m[1] || m[5]) sets = Number(m[1] ?? m[5])
    else if (m[2]) {
      repsMin = Number(m[2])
      repsMax = m[3] ? Number(m[3]) : repsMin
    } else if (m[4]) weightKg = Number(m[4])
    else if (m[0] === '自重') bodyweight = true
  }
  let name = (first >= 0 ? head.slice(0, first) : head).replace(/[\s・,、×x]+$/i, '').trim()
  // 「懸垂 2」のように、数字だけならセット数（前の形）
  if (sets === null && first < 0) {
    const m = /^(.*?)\s+(\d+)$/.exec(name)
    if (m && m[1].trim()) {
      name = m[1].trim()
      sets = Number(m[2])
    }
  }
  if (!name) return null
  if (sets !== null) sets = Math.min(20, Math.max(1, sets))
  if (repsMin !== null && repsMax !== null && repsMin > repsMax) [repsMin, repsMax] = [repsMax, repsMin]
  return { name, sets, repsMin, repsMax, weightKg, bodyweight, memo }
}

/** 種目名の後ろの（筋群）を見る。「チェストプレス（マシン）」のような筋群でないカッコはそのまま */
export function splitGroupHint(name: string): { name: string; group: MuscleGroup | null } {
  const m = /^(.+?)\s*[（(]([^（）()]+)[）)]$/.exec(name)
  const group = m ? GROUP_BY_NAME.get(m[2].trim()) : undefined
  return group ? { name: m![1].trim(), group } : { name, group: null }
}

type ExerciseLike = { id: string; name: string }

export type PlanItem = {
  exerciseId: string | null
  newKey: string | null
  targetSets: number | null
  repsMin: number | null
  repsMax: number | null
  weightKg: number | null
  memo: string | null
}
type TemplateLike = { id: string; name: string }

export type MenuPlan = {
  /** 新しく作る種目（名前の重なりはまとめてある） */
  newExercises: { key: string; name: string; muscleGroup: MuscleGroup; isBodyweight: boolean }[]
  /** 保存するメニュー。id があれば上書き、null なら新しく作る */
  templates: { id: string | null; name: string; items: PlanItem[] }[]
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
    const items = menu.items.map((it): PlanItem => {
      const target = {
        targetSets: it.sets,
        repsMin: it.repsMin ?? null,
        repsMax: it.repsMax ?? null,
        weightKg: it.weightKg ?? null,
        memo: it.memo ?? null,
      }
      const exact = byName.get(normalize(it.name))
      if (exact) return { exerciseId: exact, newKey: null, ...target }
      const hint = splitGroupHint(it.name)
      const id = byName.get(normalize(hint.name))
      if (id) return { exerciseId: id, newKey: null, ...target }
      const key = normalize(hint.name)
      if (!newExercises.some((n) => n.key === key)) {
        newExercises.push({ key, name: hint.name, muscleGroup: hint.group ?? 'other', isBodyweight: Boolean(it.bodyweight) })
      }
      return { exerciseId: null, newKey: key, ...target }
    })
    plan.push({ id: tplByName.get(mkey) ?? null, name: menu.name, items })
  }
  return { newExercises, templates: plan }
}

/** 目標の文：「3セット × 8〜12回・60kg ／ メモ」。何もなければ null */
export function formatTarget(item: { targetSets: number | null; repsMin?: number | null; repsMax?: number | null; weightKg?: number | null; memo?: string | null }, bodyweight: boolean): string | null {
  const parts: string[] = []
  const reps =
    item.repsMin != null ? (item.repsMax != null && item.repsMax !== item.repsMin ? `${item.repsMin}〜${item.repsMax}回` : `${item.repsMin}回`) : null
  if (item.targetSets != null && reps) parts.push(`${item.targetSets}セット × ${reps}`)
  else if (item.targetSets != null) parts.push(`${item.targetSets}セット`)
  else if (reps) parts.push(reps)
  if (item.weightKg != null) parts.push(`${item.weightKg}kg`)
  else if (bodyweight && parts.length) parts.push('自重')
  // セット数だけで、回数・重さ・メモがなければ、目標として出すほどでもない
  if (item.repsMin == null && item.weightKg == null && !item.memo) return null
  const main = parts.join('・')
  return item.memo ? (main ? `${main} ／ ${item.memo}` : item.memo) : main
}
