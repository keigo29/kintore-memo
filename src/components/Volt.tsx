import { useEffect, useRef } from 'react'
import { effectsOn, jag, toPoints } from '../lib/effects'

/*
  稲妻の演出の部品
  ・BoltIcon：稲妻のマーク（塗りつぶし）
  ・EdgeZap：ボタンの縁を、電気が0.5秒で一周する（セット完了）
  ・ArcRun：カードの上の辺 → 右の辺へ、ギザギザの電気が走る（自己ベスト）
  ・ChargeArc：満タンのゲージの上を、電気がずっと小さく走る（今週のチャージ）
  どれも、演出がオフ・視差効果を減らす設定のときは何も出さない
*/

export function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M13.2 2 4.6 13.4h6.1L9.8 22l8.6-11.6h-6.1z" fill="currentColor" />
    </svg>
  )
}

/** ボタンの縁を一周する電気。出すたびに key を変えて、作り直す */
export function EdgeZap() {
  if (!effectsOn()) return null
  return (
    <svg className="edge-zap" aria-hidden>
      <rect x="0" y="0" width="100%" height="100%" rx="3" pathLength="1" />
    </svg>
  )
}

/** カードの角から角へ走る電気（親は position: relative にする） */
export function ArcRun({ delay = 0 }: { delay?: number }) {
  const ref = useRef<SVGPolylineElement>(null)
  useEffect(() => {
    const line = ref.current
    const box = line?.ownerSVGElement?.parentElement
    if (!line || !box || !effectsOn()) return
    let n = 0
    let timer = 0
    const tick = () => {
      const w = box.offsetWidth
      const h = box.offsetHeight
      if (n > 9) {
        line.setAttribute('points', '')
        return
      }
      // はじめの5コマで伸びて、残りで消えていく
      const t = Math.min(1, n / 5)
      const top = jag({ x: 0, y: 0 }, { x: w * Math.min(1, t * 2), y: 0 }, 0.08, 4)
      const pts = t > 0.5 ? [...top, ...jag({ x: w, y: 0 }, { x: w, y: h * (t - 0.5) * 2 }, 0.12, 3)] : top
      line.setAttribute('points', toPoints(pts))
      line.style.opacity = n > 5 ? String(1 - (n - 5) / 5) : '1'
      n++
      timer = window.setTimeout(tick, 70)
    }
    timer = window.setTimeout(tick, delay)
    return () => clearTimeout(timer)
  }, [delay])
  return (
    <svg className="arc-run" aria-hidden>
      <polyline ref={ref} />
    </svg>
  )
}

/** 満タンのゲージの上を走る電気（画面が見えている間だけ動かす） */
export function ChargeArc() {
  const ref = useRef<SVGPolylineElement>(null)
  useEffect(() => {
    const line = ref.current
    const box = line?.ownerSVGElement?.parentElement
    if (!line || !box || !effectsOn()) return
    const timer = window.setInterval(() => {
      if (document.hidden) return
      const w = box.offsetWidth
      const h = box.offsetHeight
      line.setAttribute('points', toPoints(jag({ x: 8, y: h / 2 }, { x: w - 8, y: h / 2 }, 0.06, 5)))
    }, 160)
    return () => clearInterval(timer)
  }, [])
  return (
    <svg className="charge-arc" aria-hidden>
      <polyline ref={ref} />
    </svg>
  )
}
