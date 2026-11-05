import { useLiveQuery } from 'dexie-react-hooks'
import { Maximize2, Minimize2, Target, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { MuscleIcon } from '../components/MuscleIcon'
import { NumberStepper } from '../components/NumberStepper'
import { SkillTreeView } from '../components/SkillTreeView'
import { BoltIcon } from '../components/Volt'
import { db } from '../data/db'
import { saveGoal } from '../data/goals'
import type { GoalGroup } from '../data/goals'
import { groupColor } from '../data/muscleGroups'
import { getSettings, updateSettings } from '../data/settings'
import { BRANCHES, METRIC_UNIT, SLOTS, conditionText, getSkillTree, unseenSkills } from '../data/skills'
import type { SkillState, SkillTree } from '../data/skills'
import { formatDate } from '../lib/format'

/*
  スキルツリー
  1. 解放した数と、ツリー全体の進み具合（％）
  2. 扇の形のツリー（スキルを押すと、下に詳しく出る）
  3. 選んだスキルの詳しい中身：条件・いまの数・解放した日
  4. 系統ごとの進み具合と、次に挑戦するスキル
  ・まだ見ていない解放があれば、開いたときに電気が流れ込む演出をして「見た」にする
*/

export function SkillTreeScreen() {
  const tree = useLiveQuery(() => getSkillTree(), [])
  const settings = useLiveQuery(() => getSettings(), [])
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<SkillState | null>(null)
  // 拡大：ツリーを画面の1.7倍の幅にして、左右にスクロールで見る
  const [zoom, setZoom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // 拡大したら、まん中（根っこ）が見えるところへ
    const el = scrollRef.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [zoom])
  // 開いたときに一度だけ決める「新しく解放したスキル」
  const [fresh, setFresh] = useState<SkillState[] | null>(null)

  useEffect(() => {
    if (!tree || !settings || fresh !== null) return
    const unseen = unseenSkills(tree, settings.skillSeen)
    setFresh(unseen)
    // 開いた時点で「見た」にする（演出の途中で別の画面に移っても、次にまた出さない）
    if (unseen.length > 0) {
      const all = [...tree.skills.values()].filter((s) => s.unlockedAt !== null).map((s) => s.def.id)
      void updateSettings({ skillSeen: all })
    }
    // 最初に選んでおくスキル：新しく解放したもの → いちばん進んでいる挑戦中のもの
    setSelected(unseen.at(-1)?.def.id ?? bestActive(tree)?.def.id ?? null)
  }, [tree, settings, fresh])

  // 毎回新しい配列を渡すと演出が始め直しになるので、fresh が決まったときに1回だけ作る
  const freshIds = useMemo(() => fresh?.map((s) => s.def.id) ?? [], [fresh])

  if (!tree || !settings) return <section className="screen" />

  const pct = Math.round((tree.unlocked / tree.total) * 100)
  const sel = selected ? tree.skills.get(selected) : undefined

  return (
    <section className="screen">
      <header className="screen-head">
        <h1 className="screen-title">スキルツリー</h1>
        <span className="st-count num">
          {tree.unlocked} / {tree.total} 解放
        </span>
      </header>

      {fresh && fresh.length > 0 && (
        <div className="card st-news" role="status">
          <span className="st-news-icon">
            <BoltIcon />
          </span>
          <span>
            <b>新しく解放</b>
            <span className="st-news-list">
              {fresh
                .slice(-3)
                .map((s) => `${BRANCHES.find((b) => b.group === s.def.group)!.name}・${s.def.name}`)
                .join('、')}
              {fresh.length > 3 && ` ほか${fresh.length - 3}個`}
            </span>
          </span>
        </div>
      )}

      <div className="st-card">
        <button type="button" className="st-zoom" aria-pressed={zoom} onClick={() => setZoom((z) => !z)}>
          {zoom ? <Minimize2 strokeWidth={2} aria-hidden /> : <Maximize2 strokeWidth={2} aria-hidden />}
          {zoom ? '全体' : '拡大'}
        </button>
        <div className={zoom ? 'st-scroll is-zoom' : 'st-scroll'} ref={scrollRef}>
          <div className="st-scroll-inner">
            <SkillTreeView
              tree={tree}
              selected={selected}
              onSelect={setSelected}
              fresh={freshIds}
              onPlayed={() => {}}
              labels={zoom}
            />
          </div>
        </div>
        <div className="st-progress">
          <span className="st-pct num">
            {pct}
            <small>%</small>
          </span>
          <span className="st-pct-label">TREE PROGRESS</span>
          <span className="st-bar">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="st-hint">記録した数でスキルが解放されます ・ 週3回で約1年が最終スキルの目安</span>
        </div>
      </div>

      {sel && <SkillDetail s={sel} onEditGoal={() => setEditing(sel)} />}
      {editing && <GoalDialog s={editing} onClose={() => setEditing(null)} />}

      <div>
        <h2 className="section-title">系統</h2>
        <ul className="card list st-branches">
          {BRANCHES.map((b) => {
            const list = SLOTS.map((s) => tree.skills.get(b.group + s)!)
            const done = list.filter((s) => s.unlockedAt !== null).length
            const next = list.filter((s) => s.active).sort((x, y) => y.value / y.def.need - x.value / x.def.need)[0]
            return (
              <li key={b.group}>
                <button
                  type="button"
                  className="list-row list-row-btn st-branch"
                  style={groupColor(b.group)}
                  onClick={() => setSelected((next ?? list[5]).def.id)}
                >
                  <MuscleIcon group={b.group} className="st-branch-icon" />
                  <span className="st-branch-text">
                    <span className="st-branch-top">
                      <span className="list-name">{b.name}</span>
                      <span className="st-en">{b.en}</span>
                      <span className="st-pips" aria-label={`${done} / 6 解放`}>
                        {list.map((s) => (
                          <i key={s.def.id} data-on={s.unlockedAt !== null || undefined} />
                        ))}
                      </span>
                    </span>
                    {next ? (
                      <>
                        <span className="list-sub num">
                          次：{next.def.name} {Math.min(next.value, next.def.need)} / {next.def.need}
                          {METRIC_UNIT[next.def.metric]}
                        </span>
                        <span className="st-mini-bar">
                          <i style={{ width: `${Math.min(100, (next.value / next.def.need) * 100)}%` }} />
                        </span>
                      </>
                    ) : (
                      <span className="list-sub">{done === 6 ? '全て解放しました' : 'まだ始めていません'}</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function bestActive(tree: SkillTree): SkillState | undefined {
  return [...tree.skills.values()].filter((s) => s.active).sort((a, b) => b.value / b.def.need - a.value / a.def.need)[0]
}

function SkillDetail({ s, onEditGoal }: { s: SkillState; onEditGoal: () => void }) {
  const branch = BRANCHES.find((b) => b.group === s.def.group)!
  const on = s.unlockedAt !== null
  const goal = s.def.metric === 'goal'
  const pct = Math.min(100, Math.round((s.value / s.def.need) * 100))
  const level = { '1': '1段目', '2a': '2段目', '2b': '2段目', '3a': '3段目', '3b': '3段目', '4': goal ? '最終・達成目標' : '最終' }[s.def.slot]
  const unit = METRIC_UNIT[s.def.metric]
  // 重量は、前のスキルがまだでも「いまどこまで挙がったか」を見せる
  const showBar = s.active || goal
  return (
    <div className="card st-detail" style={groupColor(s.def.group)}>
      <div className="st-detail-head">
        <span className="dot" aria-hidden />
        <span className="st-detail-branch">
          {branch.name} ・ {level}
        </span>
        <span className={on ? 'st-state is-on' : s.active ? 'st-state is-active' : 'st-state'}>
          {on ? (
            <>
              <Zap strokeWidth={2.4} aria-hidden />
              {goal ? '達成' : '解放済み'}
            </>
          ) : s.active ? (
            '挑戦中'
          ) : (
            '未解放'
          )}
        </span>
      </div>
      <h2 className="st-detail-name">{s.def.name}</h2>
      <p className="st-detail-cond">{goal && s.def.exerciseId === null ? 'この種目が見つかりません。目標を変えて、種目を選び直してください' : conditionText(s.def)}</p>
      {on ? (
        <p className="field-help num">{formatDate(s.unlockedAt!)} に{goal ? '達成' : '解放'}</p>
      ) : (
        <>
          <div className="st-detail-bar">
            <i style={{ width: `${showBar ? pct : 0}%` }} />
          </div>
          <p className="field-help num">
            {goal
              ? s.value >= s.def.need
                ? `重量は達成済み（最高 ${s.value}kg）。前のスキルが揃うと解放されます`
                : `いまの最高 ${s.value}kg / ${s.def.need}kg（${pct}%）${s.active ? '' : '・前のスキルが揃ってから解放'}`
              : s.active
                ? `いま ${Math.min(s.value, s.def.need)} / ${s.def.need}${unit}（${pct}%）`
                : `前のスキルを解放すると挑戦できます（いま ${s.value}${unit}）`}
          </p>
        </>
      )}
      {goal && (
        <button type="button" className="btn st-goal-edit" onClick={onEditGoal}>
          <Target strokeWidth={2} aria-hidden />
          目標を変える
        </button>
      )}
    </div>
  )
}

/** 達成目標を変える：種目（その筋群の、重量を使う種目）と重量 */
function GoalDialog({ s, onClose }: { s: SkillState; onClose: () => void }) {
  const group = s.def.group as GoalGroup
  const exercises = useLiveQuery(
    async () => (await db.exercises.where('muscleGroup').equals(group).toArray()).filter((e) => !e.isBodyweight && !e.archived),
    [group],
  )
  const step = useLiveQuery(async () => (await getSettings()).weightStepKg, []) ?? 2.5
  const [exerciseId, setExerciseId] = useState(s.def.exerciseId ?? '')
  const [kg, setKg] = useState<number | null>(s.def.need)
  const ok = exerciseId !== '' && kg !== null && kg > 0
  return (
    <Dialog
      title="達成目標を変える"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!ok}
            onClick={async () => {
              if (!ok) return
              await saveGoal(group, { exerciseId, targetKg: kg! })
              onClose()
            }}
          >
            保存
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">種目</span>
        <select className="input" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
          <option value="" disabled>
            選んでください
          </option>
          {exercises?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <span className="field-label">目標の重量</span>
        <NumberStepper label="目標の重量" value={kg} onChange={setKg} step={step} unit="kg" decimal max={999} />
      </div>
      <p className="field-help">補助なしで、この重量以上を1セットでも挙げると達成です。前のスキル（3段目の2つ）が揃ってから解放されます。</p>
    </Dialog>
  )
}
