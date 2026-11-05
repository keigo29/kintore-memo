import { db } from './db'
import { GOAL_GROUPS, getGoals } from './goals'
import type { GoalGroup, ResolvedGoal } from './goals'
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
      4  達成目標　：重量の目標（例：ベンチプレス 100kg）を挙げる（3a・3b の両方を解放してから）
                    体幹だけは「体幹の極み：合計◯セット」（自重の種目が多いので）
  ・解放は、記録から毎回計算する（解放した状態は保存しない。記録を直せば、ツリーも合わせて変わる）
  ・前のスキルが解放されていないと、条件に届いていても解放されない（解放された日は、届いた日と前のスキルの日の遅いほう）
  ・必要な数は、週3回のペースで続けると、だいたい1年で最終スキルに届く目安
    胸・背中・下半身はセット数が多くなりやすいので多め、肩・腕は少し少なめ、体幹は半分
  ・どのスキルを「もう見た」かだけ、設定（skillSeen）に保存する
*/

export type SkillSlot = '1' | '2a' | '2b' | '3a' | '3b' | '4'
export type SkillMetric = 'sets' | 'days' | 'prs' | 'goal'

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

/**
 * スキルのアイコン：スキルの中身に合わせる（同じ段は、どの系統でも同じでよい）
 *   1  始めの一歩 → 足あと　2a 積み上げ → 重なった層　2b 習慣 → カレンダー
 *   3a 鍛錬 → ダンベル　3b 突破（自己ベスト） → トロフィー／継続（体幹） → 炎
 *   4  重量の達成目標 → 的（腕だけ力こぶ）／体幹の極み → 王冠
 */
const BASE_ICONS = { '1': 'Footprints', '2a': 'Layers', '2b': 'CalendarCheck', '3a': 'Dumbbell', '3b': 'Trophy', '4': 'Target' } as const
const ICON_TABLE = {
  chest: BASE_ICONS,
  shoulders: BASE_ICONS,
  arms: { ...BASE_ICONS, '4': 'BicepsFlexed' },
  back: BASE_ICONS,
  legs: BASE_ICONS,
  core: { ...BASE_ICONS, '3b': 'Flame', '4': 'Crown' },
} as const

export type SkillIcon = (typeof ICON_TABLE)[keyof typeof ICON_TABLE][SkillSlot]

export type SkillDef = {
  id: string // 例：chest2a
  group: MuscleGroup
  slot: SkillSlot
  name: string
  /** アイコン（SkillTreeView の SKILL_ICONS の名前） */
  icon: SkillIcon
  metric: SkillMetric
  need: number
  parents: string[]
  /** 達成目標のとき：どの種目か（見つからなければ null） */
  exerciseId?: string | null
}

export type Goals = Map<GoalGroup, ResolvedGoal>

export function skillDefs(goals: Goals = new Map()): SkillDef[] {
  return BRANCHES.flatMap(({ group, name }) => {
    const goal = GOAL_GROUPS.includes(group as GoalGroup) ? goals.get(group as GoalGroup) : undefined
    const k = SCALE[group]
    const core = group === 'core'
    const list: Omit<SkillDef, 'id' | 'group' | 'parents' | 'icon'>[] = [
      { slot: '1', name: '始めの一歩', metric: 'sets', need: 1 },
      { slot: '2a', name: '積み上げ', metric: 'sets', need: roundNice(30 * k) },
      { slot: '2b', name: '習慣', metric: 'days', need: 8 },
      { slot: '3a', name: '鍛錬', metric: 'sets', need: roundNice(120 * k) },
      core
        ? { slot: '3b', name: '継続', metric: 'days', need: 30 }
        : { slot: '3b', name: '突破', metric: 'prs', need: 5 },
      goal
        ? { slot: '4', name: `${goal.exerciseName} ${goal.targetKg}kg`, metric: 'goal', need: goal.targetKg, exerciseId: goal.exerciseId }
        : { slot: '4', name: `${name}の極み`, metric: 'sets', need: roundNice(300 * k) },
    ]
    return list.map((d) => ({
      ...d,
      id: group + d.slot,
      group,
      icon: ICON_TABLE[group as keyof typeof ICON_TABLE][d.slot],
      parents: PARENTS[d.slot].map((p) => group + p),
    }))
  })
}

/** 条件の説明（例：胸を合計30セット記録する） */
export function conditionText(d: SkillDef): string {
  const g = BRANCHES.find((b) => b.group === d.group)!.name
  if (d.metric === 'goal') return `${d.name.replace(/ [\d.]+kg$/, '')}で ${d.need}kg 以上を挙げる（補助なし）`
  if (d.metric === 'days') return `${g}を鍛えた日が${d.need}日になる`
  if (d.metric === 'prs') return `${g}の種目で、自己ベストを${d.need}回更新する`
  return d.need === 1 ? `${g}の種目を1セット記録する` : `${g}を合計${d.need}セット記録する`
}

export const METRIC_UNIT: Record<SkillMetric, string> = { sets: 'セット', days: '日', prs: '回', goal: 'kg' }

// ---------- 計算 ----------

/** 1回のトレーニングで、筋群ごとに何セットやったか（完了した本番セットだけ） */
export type SkillSession = {
  id: string
  startedAt: number
  dayKey: string
  sets: Partial<Record<MuscleGroup, number>>
  /** 種目ごとの、その回の最高重量（補助なし・完了した本番セット） */
  best?: Record<string, number>
}
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
export function computeSkills(sessions: SkillSession[], prs: SkillPr[], goals: Goals = new Map()): SkillTree {
  const defs = skillDefs(goals)
  // 達成目標の種目の、これまでの最高重量
  const bestSoFar = new Map<string, number>()
  const state = new Map<string, SkillState>(
    defs.map((def) => [def.id, { def, value: 0, unlockedAt: null, sessionId: null, active: false }]),
  )
  const totals = new Map<MuscleGroup, { sets: number; days: Set<string>; prs: number }>()
  const prBySession = new Map<string, MuscleGroup[]>()
  for (const p of prs) prBySession.set(p.sessionId, [...(prBySession.get(p.sessionId) ?? []), p.group])

  // 古い順に積み上げて、条件に届いたところで解放する
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    for (const [id, kg] of Object.entries(s.best ?? {})) bestSoFar.set(id, Math.max(bestSoFar.get(id) ?? 0, kg))
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
        const value = valueOf(st.def, t, bestSoFar)
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
    st.value = !t ? 0 : valueOf(st.def, t, bestSoFar)
    st.active = st.unlockedAt === null && st.def.parents.every((p) => state.get(p)!.unlockedAt !== null)
  }
  const unlocked = [...state.values()].filter((s) => s.unlockedAt !== null).length
  return { skills: state, unlocked, total: state.size }
}

function valueOf(def: SkillDef, t: { sets: number; days: Set<string>; prs: number }, best: Map<string, number>): number {
  if (def.metric === 'goal') return def.exerciseId ? (best.get(def.exerciseId) ?? 0) : 0
  return def.metric === 'sets' ? t.sets : def.metric === 'days' ? t.days.size : t.prs
}

/** データベースから集めて計算する */
export async function getSkillTree(): Promise<SkillTree> {
  const sessions = (await db.sessions.toArray()).filter((s) => s.status === 'done')
  const done = new Set(sessions.map((s) => s.id))
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e.muscleGroup]))
  const weGroup = new Map<string, MuscleGroup>()
  const weExercise = new Map<string, string>()
  for (const we of await db.workoutExercises.toArray()) {
    if (!done.has(we.sessionId)) continue
    weGroup.set(we.id, exercises.get(we.exerciseId) ?? 'other')
    weExercise.set(we.id, we.exerciseId)
  }
  const setsBySession = new Map<string, Partial<Record<MuscleGroup, number>>>()
  const bestBySession = new Map<string, Record<string, number>>()
  for (const set of await db.sets.toArray()) {
    if (!done.has(set.sessionId) || set.completedAt === null || set.kind !== 'normal') continue
    const g = weGroup.get(set.workoutExerciseId)
    if (!g) continue
    const m = setsBySession.get(set.sessionId) ?? {}
    m[g] = (m[g] ?? 0) + 1
    setsBySession.set(set.sessionId, m)
    if (!set.assisted && set.weightKg !== null) {
      const b = bestBySession.get(set.sessionId) ?? {}
      const ex = weExercise.get(set.workoutExerciseId)!
      b[ex] = Math.max(b[ex] ?? 0, set.weightKg)
      bestBySession.set(set.sessionId, b)
    }
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
    sessions.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      dayKey: dk(s.startedAt),
      sets: setsBySession.get(s.id) ?? {},
      best: bestBySession.get(s.id) ?? {},
    })),
    prs,
    await getGoals(),
  )
}

/** まだ見ていない（お知らせしていない）解放済みのスキル */
export function unseenSkills(tree: SkillTree, seen: string[]): SkillState[] {
  const s = new Set(seen)
  return [...tree.skills.values()].filter((x) => x.unlockedAt !== null && !s.has(x.def.id)).sort((a, b) => a.unlockedAt! - b.unlockedAt!)
}
