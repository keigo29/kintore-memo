import { BicepsFlexed, CalendarCheck, Crown, Dumbbell, Flame, Footprints, Layers, Target, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { BRANCHES, SLOTS } from '../data/skills'
import type { SkillIcon, SkillState, SkillTree } from '../data/skills'
import { effectsOn, jag } from '../lib/effects'
import type { Pt } from '../lib/effects'

/*
  スキルツリーの絵（扇の形）
  ・まん中の下が根っこ。左から 胸・肩・腕・背中・下半身・体幹 の6系統が扇に広がる
  ・座標は 1000×590 の箱で決めて、画面の幅に合わせて縮める（縦横の比は変えない）
  ・丸の大きさも幅に比例する（skill.css の cqw）。重ならない大きさを計算して決めた
  ・zoom のとき：箱を画面の 1.7 倍の幅にして、左右にスクロールで見る。系統の名前も出す
  ・線：未解放は暗い灰色、挑戦中は筋群の色をうすく、解放済みは筋群の色
  ・電気（canvas）：
      - ふだん：解放済みの線の上を、ときどき小さな電気が走る。解放済みのスキルのまわりで火花が散る
      - 新しく解放したとき：前のスキルから線をつたって電気が流れ込み、スキルが光る
      - 空から落ちる雷や、画面全体が光る演出は使わない
*/

export const TREE_W = 1000
export const TREE_H = 590
const CX = 500
const CY = 510
/** スキルごとの、根っこからの距離と、系統の向きからずらす角度 */
const PLACE: Record<string, [number, number]> = {
  '1': [165, 0],
  '2a': [280, 7.5],
  '2b': [280, -7.5],
  '3a': [380, 9],
  '3b': [380, -9],
  '4': [470, 0],
}

const ICONS: Record<SkillIcon, LucideIcon> = {
  BicepsFlexed,
  CalendarCheck,
  Crown,
  Dumbbell,
  Flame,
  Footprints,
  Layers,
  Target,
  Trophy,
}

const pt = (r: number, deg: number): Pt => ({
  x: CX + r * Math.cos((deg * Math.PI) / 180),
  y: CY - r * Math.sin((deg * Math.PI) / 180),
})

/** 各スキルの位置（扇の角度は 165° → 15°） */
export function layout(): Map<string, Pt> {
  const m = new Map<string, Pt>([['root', { x: CX, y: CY }]])
  BRANCHES.forEach((b, i) => {
    const ang = 165 - i * 30
    for (const s of SLOTS) m.set(b.group + s, pt(PLACE[s][0], ang + PLACE[s][1]))
  })
  return m
}

type Props = {
  tree: SkillTree
  selected: string | null
  onSelect: (id: string) => void
  /** 新しく解放したスキル（電気が流れ込む演出をする）。終わったら onPlayed */
  fresh: string[]
  onPlayed: () => void
  /** 系統の名前を出すか（拡大しているときだけ。縮めた表示では文字が小さすぎるので出さない） */
  labels?: boolean
}

export function SkillTreeView({ tree, selected, onSelect, fresh, onPlayed, labels = false }: Props) {
  const pos = useMemo(layout, [])
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const skills = [...tree.skills.values()]
  const isOn = (id: string) => id === 'root' || tree.skills.get(id)?.unlockedAt != null

  // 演出のために、いまの状態を ref に入れておく（描き直しのたびに effect を作り直さない）
  const treeRef = useRef(tree)
  treeRef.current = tree
  const freshRef = useRef<{ ids: string[]; started: number } | null>(null)
  const playedRef = useRef(onPlayed)
  playedRef.current = onPlayed

  // 新しく解放したスキルの演出を始める
  useEffect(() => {
    if (fresh.length === 0) return
    if (!effectsOn()) {
      playedRef.current()
      return
    }
    freshRef.current = { ids: fresh.slice(0, 6), started: performance.now() }
  }, [fresh])

  // 電気を描く
  useEffect(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    if (!canvas || !box) return
    const ctx = canvas.getContext('2d')!
    const on = effectsOn()
    let raf = 0
    let w = 0
    let h = 0
    const fit = () => {
      const r = box.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = r.width
      h = r.height
      canvas.width = Math.max(1, w * dpr)
      canvas.height = Math.max(1, h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    if (!on) {
      ctx.clearRect(0, 0, w, h)
      return () => ro.disconnect()
    }

    const css = getComputedStyle(document.documentElement)
    const volt = css.getPropertyValue('--volt').trim() || '#5ce1ff'
    const color = (g: string) => css.getPropertyValue(`--mg-${g}-light`).trim() || volt
    const px = (p: Pt): Pt => ({ x: (p.x / TREE_W) * w, y: (p.y / TREE_H) * h })
    // 線の端を、丸（スキル）の外側までずらす
    const trim = (a: Pt, b: Pt, ra: number, rb: number): [Pt, Pt] => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const l = Math.hypot(dx, dy) || 1
      return [{ x: a.x + (dx / l) * ra, y: a.y + (dy / l) * ra }, { x: b.x - (dx / l) * rb, y: b.y - (dy / l) * rb }]
    }
    // 丸の半径（CSS の cqw と同じ割合）
    const radius = (id: string) => (id === 'root' ? 0.055 : id.endsWith('4') ? 0.045 : 0.033) * w

    type Bolt = { paths: Pt[][]; born: number; life: number; width: number; tint: string }
    let bolts: Bolt[] = []
    let next = 0
    const add = (a: Pt, b: Pt, o: { rough?: number; depth?: number; forks?: number; life?: number; width?: number; tint?: string } = {}) => {
      const main = jag(a, b, o.rough ?? 0.3, o.depth ?? 4)
      const paths = [main]
      for (let i = 0; i < (o.forks ?? 0); i++) {
        const s = main[1 + Math.floor(Math.random() * (main.length - 2))]
        const ang = Math.random() * Math.PI * 2
        const len = 6 + Math.random() * 10
        paths.push(jag(s, { x: s.x + Math.cos(ang) * len, y: s.y + Math.sin(ang) * len }, 0.5, 2))
      }
      bolts.push({ paths, born: performance.now(), life: o.life ?? 240, width: o.width ?? 1.2, tint: o.tint ?? volt })
    }
    const spark = (id: string, tint: string) => {
      const c = px(pos.get(id)!)
      const r = radius(id) + 2
      for (let i = 0; i < 2; i++) {
        const ang = Math.random() * Math.PI * 2
        const len = 6 + Math.random() * 8
        add({ x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r }, { x: c.x + Math.cos(ang) * (r + len), y: c.y + Math.sin(ang) * (r + len) }, { rough: 0.6, depth: 2, life: 180, width: 0.9, tint })
      }
    }
    // 線をつたって流れる電気（親 → 子）
    const flow = (from: string, to: string, tint: string, life = 260) => {
      const [a, b] = trim(px(pos.get(from)!), px(pos.get(to)!), radius(from), radius(to))
      add(a, b, { rough: 0.22, depth: 4, forks: 1, life, width: 1.5, tint })
    }

    // ふだん：解放済みの線と、解放済みのスキルで、ときどき電気
    const ambient = (now: number) => {
      if (now < next) return
      next = now + 450 + Math.random() * 900
      const t = treeRef.current
      const lit: [string, string, string][] = []
      const onIds: SkillState[] = []
      for (const s of t.skills.values()) {
        if (s.unlockedAt === null) continue
        onIds.push(s)
        const parents = s.def.parents.length ? s.def.parents : ['root']
        for (const p of parents) lit.push([p, s.def.id, color(s.def.group)])
      }
      if (lit.length && Math.random() < 0.65) {
        const [a, b, c] = lit[Math.floor(Math.random() * lit.length)]
        flow(a, b, c)
      } else if (onIds.length) {
        const s = onIds[Math.floor(Math.random() * onIds.length)]
        spark(s.def.id, color(s.def.group))
      }
    }

    // 新しく解放：1つずつ、前のスキルから電気が流れ込む（0.9秒ずつずらす）
    const done = new Set<number>()
    const playFresh = (now: number) => {
      const f = freshRef.current
      if (!f) return
      f.ids.forEach((id, i) => {
        const s = treeRef.current.skills.get(id)
        if (!s) return
        const t0 = f.started + 400 + i * 900
        const tint = color(s.def.group)
        const parents = s.def.parents.length ? s.def.parents : ['root']
        // 0.5秒の間に、5回に分けて流す
        for (let k = 0; k < 5; k++) {
          const key = i * 10 + k
          if (!done.has(key) && now >= t0 + k * 100) {
            done.add(key)
            parents.forEach((p) => flow(p, id, k % 2 ? volt : tint, 220))
            if (k === 4) {
              for (let j = 0; j < 3; j++) setTimeout(() => spark(id, volt), j * 90)
              box.querySelector(`[data-skill="${id}"]`)?.classList.add('is-pop')
            }
          }
        }
      })
      if (now > f.started + 400 + f.ids.length * 900 + 600) {
        freshRef.current = null
        playedRef.current()
      }
    }

    const frame = (now: number) => {
      ctx.clearRect(0, 0, w, h)
      if (!document.hidden) {
        ambient(now)
        playFresh(now)
      }
      bolts = bolts.filter((b) => now - b.born < b.life)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const b of bolts) {
        const t = (now - b.born) / b.life
        const a = (1 - t) * (Math.random() < 0.15 ? 0.4 : 1)
        b.paths.forEach((pts, i) => {
          const lw = i ? b.width * 0.6 : b.width
          ctx.beginPath()
          pts.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
          ctx.globalAlpha = 0.5 * a
          ctx.shadowColor = b.tint
          ctx.shadowBlur = 10
          ctx.strokeStyle = b.tint
          ctx.lineWidth = lw * 3
          ctx.stroke()
          ctx.shadowBlur = 0
          ctx.globalAlpha = a
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = lw
          ctx.stroke()
        })
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [pos])

  // 線
  const edges: { from: string; to: string; group: string; lit: boolean; next: boolean }[] = []
  for (const s of skills) {
    for (const p of s.def.parents.length ? s.def.parents : ['root']) {
      edges.push({ from: p, to: s.def.id, group: s.def.group, lit: isOn(p) && s.unlockedAt !== null, next: s.active })
    }
  }

  return (
    <div className="st-box" ref={boxRef}>
      <div className="st-watermark" aria-hidden>
        SKILL TREE
      </div>
      <svg className="st-edges" viewBox={`0 0 ${TREE_W} ${TREE_H}`} preserveAspectRatio="none" aria-hidden>
        {[165, 280, 380, 470].map((r, i) => {
          const a = pt(r, 180)
          const b = pt(r, 0)
          return (
            <path
              key={r}
              d={`M${a.x} ${a.y} A${r} ${r} 0 0 1 ${b.x} ${b.y}`}
              className="st-ring"
              strokeDasharray={i % 2 ? '2 8' : undefined}
            />
          )
        })}
        {edges.map((e) => {
          const a = pos.get(e.from)!
          const b = pos.get(e.to)!
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={e.lit ? 'st-edge is-lit' : e.next ? 'st-edge is-next' : 'st-edge'}
              style={{ '--c': `var(--mg-${e.group})`, '--cl': `var(--mg-${e.group}-light)` } as React.CSSProperties}
            />
          )
        })}
      </svg>
      <canvas className="st-bolts" ref={canvasRef} aria-hidden />
      {labels &&
        BRANCHES.map((b, i) => {
          const p = pos.get(b.group + '4')!
          const ang = 165 - i * 30
          const done = SLOTS.filter((sl) => tree.skills.get(b.group + sl)?.unlockedAt != null).length
          const x = (p.x / TREE_W) * 100
          const y = (p.y / TREE_H) * 100
          // 端の2つは丸の下に、それ以外は丸の外側（左の系統は左、右の系統は右）に出す
          const style: React.CSSProperties =
            ang >= 150
              ? { left: '1%', top: `${y + 9}%` }
              : ang <= 30
                ? { right: '1%', top: `${y + 9}%`, textAlign: 'right' }
                : ang > 90
                  ? { right: `${100 - x + 6}%`, top: `${y}%`, transform: 'translateY(-50%)', textAlign: 'right' }
                  : { left: `${x + 6}%`, top: `${y}%`, transform: 'translateY(-50%)' }
          return (
            <div key={b.group} className="st-label" style={style} aria-hidden>
              <b>{b.name}</b>
              <span>{b.en}</span>
              <small className="num">{done} / 6</small>
            </div>
          )
        })}
      <span className="st-node st-root" style={{ left: `${(CX / TREE_W) * 100}%`, top: `${(CY / TREE_H) * 100}%` }} aria-hidden>
        <Dumbbell strokeWidth={2} />
      </span>
      {skills.map((s) => {
        const p = pos.get(s.def.id)!
        const Icon = ICONS[s.def.icon]
        const on = s.unlockedAt !== null
        const pct = Math.min(100, Math.round((s.value / s.def.need) * 100))
        const name = BRANCHES.find((b) => b.group === s.def.group)!.name
        return (
          <button
            key={s.def.id}
            type="button"
            data-skill={s.def.id}
            className={['st-node', s.def.slot === '4' ? 'is-cap' : '', on ? 'is-on' : '', s.active ? 'is-active' : '', selected === s.def.id ? 'is-sel' : '']
              .filter(Boolean)
              .join(' ')}
            style={
              {
                left: `${(p.x / TREE_W) * 100}%`,
                top: `${(p.y / TREE_H) * 100}%`,
                '--c': `var(--mg-${s.def.group})`,
                '--cl': `var(--mg-${s.def.group}-light)`,
                '--g': `var(--mg-${s.def.group}-grad)`,
                '--p': pct,
              } as React.CSSProperties
            }
            aria-label={`${name}・${s.def.name}（${on ? '解放済み' : s.active ? `挑戦中 ${pct}%` : '未解放'}）`}
            aria-pressed={selected === s.def.id}
            onClick={() => onSelect(s.def.id)}
          >
            <Icon strokeWidth={2} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
