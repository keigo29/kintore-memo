import { db } from './db'
import type { MuscleGroup } from './muscleGroups'

/*
  スキルツリー
  ・系統は筋群の6つ（胸・肩・腕・背中・下半身・体幹）。「その他」は入れない
  ・各系統に6つのスキル：1段目 → 2段目A・B → 3段目A・B → 最終
      1  始めの一歩：その筋群を1セット記録する
      2a 積み上げ　：その筋群を合計◯セット
      2b 習慣　　　：その筋群をやった日が◯日
      3a 鍛錬　　　：その筋群を合計◯セット
      3b 突破　　　：その筋群の種目で自己ベストを◯回更新（体幹は、やった日が◯日）
      4  ◯の極み　：その筋群を合計◯セット（3a・3b の両方を解放してから）
  ・解放は、記録から毎回計算する（解放した状態は保存しない。記録を直せば、ツリーも合わせて変わる）
  ・前のスキルが解放されていないと、条件に届いていても解放されない（解放された日は、届いた日と前のスキルの日の遅いほう）
  ・必要な数は、週3回のペースで続けると、だいたい1年で最終スキルに届く目安
    胸・背中・下半身はセット数が多くなりやすいので多め、肩・腕は少し少なめ、体幹は半分
  ・どのスキルを「もう見た」かだけ、設定（skillSeen）に保存する
*/

export type SkillSlot = '1' | '2a' | '2b' | '3a' | '3b' | '4'
export type SkillMetric = 'sets' | 'days' | 'prs'

export const SLOTS: SkillSlot[] = ['1', '2a', '2b', '3a', '3b', '4']
export const PARENTS: Record<SkillSlot, SkillSlot[]> = { '1': [], '2a': ['1'], '2b': ['1'], '3a': ['2a'], '3b': ['2b'], '4': ['3a', '3b'] }
export const LEVEL: Record<SkillSlot, number> = { '1': 1, '2a': 2, '2b': 2, '3a': 3, '3b': 3, '4': 4 }

export type SkillBranch = { group: MuscleGroup; name: string; en: string }

/** 扇の左から右への並び */
export const BRANCHES: SkillBranch[] = [
  { group: 'chest', name: '胸', en: 'CHEST' },
  { group: 'shoulders', name: '肩', en: 'SHOULDERS' },
  { group: 'arms', name: '腕', en: 'ARMS' },
  { group: 'back', name: '背中', en: 'BACK' },
  { group: 'legs', name: '下半身', en: 'LEGS' },
  { group: 'core', name: '体幹', en: 'CORE' },
]

/** 筋群ごとの、必要な数の倍率 */
const SCALE: Record<string, number> = { chest: 1, back: 1, legs: 1, shoulders: 0.8, arms: 0.8, core: 0.5 }
const roundNice = (n: number) => (n < 10 ? Math.max(1, Math.round(n)) : Math.round(n / 5) * 5)

export type SkillDef = {
  id: string // 例：chest2a
  group: MuscleGroup
  slot: SkillSlot
  name: string
  icon: 'footprints' | 'layers' | 'calendar-check' | 'dumbbell' | 'trophy' | 'flame' | 'crown'
  metric: SkillMetric
  need: number
  parents: string[]
}

export function skillDefs(): SkillDef[] {
  return BRANCHES.flatMap(({ group, name }) => {
    const k = SCALE[group]
    const core = group === 'core'
    const list: Omit<SkillDef, 'id' | 'group' | 'parents'>[] = [
      { slot: '1', name: '始めの一歩', icon: 'footprints', metric: 'sets', need: 1 },
      { slot: '2a', name: '積み上げ', icon: 'layers', metric: 'sets', need: roundNice(30 * k) },
      { slot: '2b', name: '習慣', icon: 'calendar-check', metric: 'days', need: 8 },
      { slot: '3a', name: '鍛錬', icon: 'dumbbell', metric: 'sets', need: roundNice(120 * k) },
      core
        ? { slot: '3b', name: '継続', icon: 'flame', metric: 'days', need: 30 }
        : { slot: '3b', name: '突破', icon: 'trophy', metric: 'prs', need: 5 },
      { slot: '4', name: `${name}の極み`, icon: 'crown', metric: 'sets', need: roundNice(300 * k) },
    ]
    return list.map((d) => ({ ...d, id: group + d.slot, group, parents: PARENTS[d.slot].map((p) => group + p) }))
  })
}

/** 条件の説明（例：胸を合計30セット記録する） */
export function conditionText(d: SkillDef): string {
  const g = BRANCHES.find((b) => b.group === d.group)!.name
  if (d.metric === 'days') return `${g}を鍛えた日が${d.need}日になる`
  if (d.metric === 'prs') return `${g}の種目で、自己ベストを${d.need}回更新する`
  return d.need === 1 ? `${g}の種目を1セット記録する` : `${g}を合計${d.need}セット記録する`
}

export const METRIC_UNIT: Record<SkillMetric, string> = { sets: 'セット', days: '日', prs: '回' }

// ---------- 計算 ----------

/** 1回のトレーニングで、筋群ごとに何セットやったか（完了した本番セットだけ） */
export type SkillSession = { id: string; startedAt: number; dayKey: string; sets: Partial<Record<MuscleGroup, number>> }
/** 自己ベストを更新した（トレーニング・筋群） */
export type SkillPr = { sessionId: string; group: MuscleGroup }

export type SkillState = {
  def: SkillDef
  /** 条件の数の、いまの値 */
  value: number
  /** 解放された日時（まだなら null） */
  unlockedAt: number | null
  /** 解放したトレーニング */
  sessionId: string | null
  /** 前のスキルが全部解放されていて、いま挑戦中か */
  active: boolean
}

export type SkillTree = {
  skills: Map<string, SkillState>
  unlocked: number
  total: number
}

/** 記録から、全部のスキルの状態を出す（データベースを使わないので、テストできる） */
export function computeSkills(sessions: SkillSession[], prs: SkillPr[]): SkillTree {
  const defs = skillDefs()
  const state = new Map<string, SkillState>(
    defs.map((def) => [def.id, { def, value: 0, unlockedAt: null, sessionId: null, active: false }]),
  )
  const totals = new Map<MuscleGroup, { sets: number; days: Set<string>; prs: number }>()
  const prBySession = new Map<string, MuscleGroup[]>()
  for (const p of prs) prBySession.set(p.sessionId, [...(prBySession.get(p.sessionId) ?? []), p.group])

  // 古い順に積み上げて、条件に届いたところで解放する
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    for (const b of BRANCHES) {
      const t = totals.get(b.group) ?? { sets: 0, days: new Set<string>(), prs: 0 }
      const n = s.sets[b.group] ?? 0
      if (n > 0) {
        t.sets += n
        t.days.add(s.dayKey)
      }
      t.prs += (prBySession.get(s.id) ?? []).filter((g) => g === b.group).length
      totals.set(b.group, t)
      // 段の順に見るので、同じ日に続けて解放されることもある
      for (const slot of SLOTS) {
        const st = state.get(b.group + slot)!
        if (st.unlockedAt !== null) continue
        const value = st.def.metric === 'sets' ? t.sets : st.def.metric === 'days' ? t.days.size : t.prs
        const parentsOk = st.def.parents.every((p) => state.get(p)!.unlockedAt !== null)
        if (parentsOk && value >= st.def.need) {
          st.unlockedAt = s.startedAt
          st.sessionId = s.id
        }
      }
    }
  }
  // いまの値と、挑戦中かどうか
  for (const st of state.values()) {
    const t = totals.get(st.def.group)
    st.value = !t ? 0 : st.def.metric === 'sets' ? t.sets : st.def.metric === 'days' ? t.days.size : t.prs
    st.active = st.unlockedAt === null && st.def.parents.every((p) => state.get(p)!.unlockedAt !== null)
  }
  const unlocked = [...state.values()].filter((s) => s.unlockedAt !== null).length
  return { skills: state, unlocked, total: state.size }
}

/** データベースから集めて計算する */
export async function getSkillTree(): Promise<SkillTree> {
  const sessions = (await db.sessions.toArray()).filter((s) => s.status === 'done')
  const done = new Set(sessions.map((s) => s.id))
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e.muscleGroup]))
  const weGroup = new Map<string, MuscleGroup>()
  for (const we of await db.workoutExercises.toArray()) {
    if (done.has(we.sessionId)) weGroup.set(we.id, exercises.get(we.exerciseId) ?? 'other')
  }
  const setsBySession = new Map<string, Partial<Record<MuscleGroup, number>>>()
  for (const set of await db.sets.toArray()) {
    if (!done.has(set.sessionId) || set.completedAt === null || set.kind !== 'normal') continue
    const g = weGroup.get(set.workoutExerciseId)
    if (!g) continue
    const m = setsBySession.get(set.sessionId) ?? {}
    m[g] = (m[g] ?? 0) + 1
    setsBySession.set(set.sessionId, m)
  }
  // 自己ベストは「同じトレーニングの同じ種目」で1回と数える（最高重量と推定1RMを同時に更新しても1回）
  const prKeys = new Set<string>()
  const prs: SkillPr[] = []
  for (const r of await db.records.toArray()) {
    const key = `${r.sessionId}:${r.exerciseId}`
    const g = exercises.get(r.exerciseId)
    if (!done.has(r.sessionId) || !g || prKeys.has(key)) continue
    prKeys.add(key)
    prs.push({ sessionId: r.sessionId, group: g })
  }
  const dk = (ms: number) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  }
  return computeSkills(
    sessions.map((s) => ({ id: s.id, startedAt: s.startedAt, dayKey: dk(s.startedAt), sets: setsBySession.get(s.id) ?? {} })),
    prs,
  )
}

/** まだ見ていない（お知らせしていない）解放済みのスキル */
export function unseenSkills(tree: SkillTree, seen: string[]): SkillState[] {
  const s = new Set(seen)
  return [...tree.skills.values()].filter((x) => x.unlockedAt !== null && !s.has(x.def.id)).sort((a, b) => a.unlockedAt! - b.unlockedAt!)
}
