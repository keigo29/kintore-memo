import type { VoltColor } from '../data/types'

/*
  稲妻の演出の共通部分
  ・電気の色：<html data-volt="cyan|yellow|white"> で切りかえる（色は tokens.css）
  ・演出のオン／オフ：<html data-effects="off"> のとき、CSS の動きを止める
  ・端末で「視差効果を減らす」をオンにしているときも出さない
  ・落雷（空から落ちる雷・画面全体が光る）は使わない。電気が「走る」「たまる」だけ
*/

export function applyEffects(on: boolean, volt: VoltColor): void {
  const el = document.documentElement
  el.dataset.volt = volt
  el.dataset.effects = on ? 'on' : 'off'
}

/** いま演出を出してよいか */
export function effectsOn(): boolean {
  if (document.documentElement.dataset.effects === 'off') return false
  return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
}

export type Pt = { x: number; y: number }

/**
 * 2点の間を、ギザギザの線（電気）にする
 * ・線を半分に分けて、まん中を少し横にずらす、をくり返す
 * ・rough：ずらす大きさ（線の長さに対する割合）、depth：くり返す回数
 */
export function jag(a: Pt, b: Pt, rough = 0.3, depth = 4): Pt[] {
  let pts = [a, b]
  for (let d = 0; d < depth; d++) {
    const out = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]
      const q = pts[i]
      const dx = q.x - p.x
      const dy = q.y - p.y
      const len = Math.hypot(dx, dy) || 1
      const off = (Math.random() - 0.5) * rough * len
      out.push({ x: (p.x + q.x) / 2 - (dy / len) * off, y: (p.y + q.y) / 2 + (dx / len) * off }, q)
    }
    pts = out
  }
  return pts
}

/** SVG の points 属性の形にする */
export const toPoints = (pts: Pt[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
