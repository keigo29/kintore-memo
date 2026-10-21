import { useId } from 'react'
import type { MuscleGroup } from '../data/muscleGroups'

/*
  筋群アイコン（オリジナル）
  ・筋肉を1つずつ丸いかたまりで描き、上が明るく下が暗いグラデーションで立体に見せる
  ・上半身は胸から上の「胸像」、下半身（脚とお尻）は腰からひざを前から切り取る
  ・右半分だけ描いて、左は鏡写し
  ・色は白黒：体は濃いグレー、鍛える筋肉だけ白く光る（tokens.css の --mi-*）
*/

/*
  比率（頭の高さ H = 14）
  ・幅：肩（三角筋の外側）2.2H／わきの下の胴 1.6H／ウエスト 1.2H／腰 1.35H
  ・高さ：あご→胸の下 1H、→へそ 1H、→股 1H。ひじはへその高さ
  ・あごを y=0、体の真ん中を x=24 とし、右半分の形だけを書く
*/
const UPPER_FRONT = {
  trap: 'M24.6 0.4 L27.4 0.4 C28 1.6 29 2.4 30.4 2.8 C32.2 3.4 33.4 3.8 34.4 4.4 C31 5 27.6 5.2 24.6 5.2 Z',
  delt: 'M34.2 4.6 C37 4.4 39.2 6 39.8 8.8 C40.2 10.8 39.8 12.6 38.6 13.8 C37.6 11.4 36 9.2 33.8 7.8 C33.6 6.6 33.8 5.4 34.2 4.6 Z',
  pec: 'M24.6 5.8 C27.8 5.6 30.8 5.9 33 7 C34.6 8 35.2 9.6 35 11.2 C33.6 13.4 31.2 14.6 28.4 14.8 C26.8 14.9 25.6 14.6 24.6 14.2 Z',
  side: 'M35 12.6 C35.4 15 35 17.8 34 20.6 C33.2 22.6 32.6 24.4 32.4 26 C31.8 24 31.4 21.4 31.4 19 C32.8 17.4 34 15.2 35 12.6 Z',
  arm: 'M36.2 13.8 C37.6 12.8 39.4 13.2 40 15.2 C40.6 17.8 40.4 21 39.6 23.6 C39 25.4 38.2 26.6 37.2 27 C36.4 25 35.9 22.4 35.8 19.8 C35.7 17.6 35.8 15.4 36.2 13.8 Z',
  abs1: 'M24.6 15.4 C26.2 15.6 27.9 15.6 29.4 15.2 C29.6 16.6 29.6 18 29.4 19.4 C27.8 19.7 26.2 19.7 24.6 19.5 Z',
  abs2: 'M24.6 20.4 C26.2 20.6 27.8 20.6 29.3 20.3 C29.3 21.6 29.2 22.9 29 24.1 C27.6 24.4 26 24.4 24.6 24.3 Z',
  abs3: 'M24.6 25.1 C26 25.3 27.4 25.3 28.9 25 C28.8 26.8 28.4 28.6 27.6 30.2 C26.6 30.8 25.6 31 24.6 31 Z',
  obl: 'M30.4 16.4 C31.4 18.6 31.8 21 31.8 23.6 C31.6 26 31.2 28 30.4 29.8 C29.8 28.6 29.6 27 29.8 25.4 C30 22.6 30.2 19.6 30.4 16.4 Z',
}

/*
  背中（後ろから）
  ・僧帽筋：首から肩へ広がり、背中の真ん中で先がとがるひし形
  ・棘下筋：肩甲骨の上の丸い膨らみ
  ・広背筋：わきの下から出て、腰に向かって内側へ巻き込む「つばさ」。真ん中は覆わない
  ・脊柱起立筋：背骨の両わきを縦に走る2本の柱
*/
const UPPER_BACK = {
  trap: 'M24.6 0.4 L27.4 0.4 C28 1.6 29.2 2.4 30.6 2.9 C32.4 3.5 33.6 4 34.4 4.6 C33 5.8 31 7.4 29.4 9.4 C27.8 12.4 26.4 16 25.2 19.6 L24.6 20.4 Z',
  delt: UPPER_FRONT.delt,
  infra: 'M30.4 9 C31.8 7.4 33.2 6.4 34.4 6 C35.4 7.6 35.8 9.6 35.6 11.6 C34 12.6 32 13 30 12.8 C29.8 11.4 29.9 10.2 30.4 9 Z',
  lat: 'M30 13.6 C32 13.8 34 13.2 35.6 12.4 C35.6 15.6 35 19 33.8 22.4 C32.8 25 31.6 27 30.2 28.6 C29.2 27.4 28.4 25.4 27.9 23 C27.6 21 27.6 19.4 27.8 18 C28.4 16.4 29.1 14.9 30 13.6 Z',
  erect: 'M24.8 21.4 C25.6 20.6 26.4 19.8 27 19.4 C27.2 22.6 27.6 26 28.2 29.2 C27.6 30.2 26.4 30.8 24.8 31 Z',
  arm: UPPER_FRONT.arm,
}

/*
  下半身の比率（同じく H = 14。人体画の基準：ルーミス／バメス）
  ・腰幅 約1.45H。太ももの外側は腰より外に出さない
  ・太もも1本の幅：付け根 0.7H → 真ん中 0.6H → ひざ 0.45H
  ・股→ひざ 2H（股 y=5、ひざ y=33）。ひざどうしはほぼくっつく
*/
/*
  脚の前
  ・縫工筋：外側の腰骨から内ひざへ「ななめ」に走る。この1本の線で外（大腿四頭筋）と内（内転筋）を分ける
  ・小さく描くと線が多すぎて読めないので、外側・真ん中（ひざ上のしずくまで）・内ももの3つにまとめる
*/
const LOWER_FRONT = {
  // 下腹：股に向かってとがる V 字（鼠径部の線）。太ももはこの V の外側から生える
  lowAbs: 'M24.6 -5.4 C26.4 -5.2 28.2 -5.2 29.8 -5.6 C29.8 -3 28.8 -0.4 27.2 1.8 C26.4 2.8 25.6 3.6 24.6 4.2 Z',
  // 腰骨の上のわき腹
  hip: 'M30.8 -5.6 C32.4 -5.2 33.6 -4.2 34.2 -2.8 C34.4 -2 34.4 -1.4 34.2 -0.8 C33 -0.8 31.6 -0.6 30 0 C30.6 -1.8 30.9 -3.6 30.8 -5.6 Z',
  // 太ももは1つの形（外へ少し膨らみ、ひざに向かって細くなる）。筋肉の境目は LINES で線だけ描く
  thigh: 'M34.2 -0.4 C35 4 35.2 9 34.6 14 C34 19.4 32.8 24.6 31 29.6 C30.2 30.2 28.6 30.4 27.2 30 C26.2 27 25.6 22 25.2 16 C24.9 11.6 24.8 8 24.9 5.2 C28 3.6 31.4 1.4 34.2 -0.4 Z',
  // ひざは中心に寄せる
  knee: 'M28.8 31 C29.7 31 30.3 31.6 30.3 32.5 C30.3 33.4 29.7 34 28.8 34 C27.9 34 27.3 33.4 27.3 32.5 C27.3 31.6 27.9 31 28.8 31 Z',
  // ひざの下で外と内に膨らむふくらはぎ
  calfOut: 'M30.6 31 C32.2 31.8 33 33.6 33 35.8 L32.8 38 L30.4 38 C30 35.6 30 33.2 30.6 31 Z',
  calfIn: 'M26 33.2 C25.2 34 24.9 35.2 24.9 36.6 L25 38 L27.4 38 C27.6 36.2 27.2 34.6 26 33.2 Z',
}

type Shapes = Record<string, string>

// 筋肉の境目を、形の上に細い線で描く（右半分）
const LINES = new Map<Shapes, string[]>([
  [
    LOWER_FRONT,
    [
      // 縫工筋のななめの線（外の四頭筋と内ももを分ける）。小さく見せるので線はこの1本だけ
      'M32.8 0.6 C31 8 29.4 17 28.4 29.6',
    ],
  ],
])

// 筋群ごとに「どの絵を使い、どの筋肉を塗るか」
const SPEC: Record<MuscleGroup, { shapes: Shapes; on: string[] | 'all' }> = {
  chest: { shapes: UPPER_FRONT, on: ['pec'] },
  back: { shapes: UPPER_BACK, on: ['infra', 'lat', 'erect'] },
  shoulders: { shapes: UPPER_FRONT, on: ['delt'] },
  arms: { shapes: UPPER_FRONT, on: ['arm'] },
  legs: { shapes: LOWER_FRONT, on: ['thigh'] },
  core: { shapes: UPPER_FRONT, on: ['abs1', 'abs2', 'abs3', 'obl'] },
  // その他：どこも光らせない（全身のグレーだけ）
  other: { shapes: UPPER_FRONT, on: [] },
}

type Props = { group: MuscleGroup; className?: string }

export function MuscleIcon({ group, className }: Props) {
  const id = useId().replace(/:/g, '')
  const { shapes, on } = SPEC[group]
  const lower = shapes === LOWER_FRONT
  const isOn = (k: string) => on === 'all' || on.includes(k)

  const entries = Object.entries(shapes)
  // 1枚目：筋肉の形を太い線でなぞって、すき間を「溝の色」で埋める（体がひとかたまりに見える）
  const groove = entries.map(([k, d]) => <path key={k} d={d} />)
  // 2枚目：筋肉そのもの。鍛える筋肉だけ白く光らせる
  const muscles = (
    <>
      {entries.map(([k, d]) => (
        <path key={k} d={d} fill={isOn(k) ? `url(#${id}-on)` : `url(#${id}-base)`} />
      ))}
      {LINES.get(shapes)?.map((d) => (
        <path key={d} d={d} fill="none" style={{ stroke: 'var(--mi-groove)' }} strokeWidth=".7" strokeLinecap="round" />
      ))}
    </>
  )

  return (
    <svg
      className={className}
      // 上半身：肩からおへその上まで（横長）／下半身：へそ下からひざ下まで
      viewBox={lower ? '7 -6.2 34 44.2' : '6.4 0 35.2 30.5'}
      aria-hidden
    >
      <defs>
        {/* 上が明るく下が暗い＝立体に見える */}
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--mi-base-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--mi-base-bottom)' }} />
        </linearGradient>
        <linearGradient id={`${id}-on`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--mi-on-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--mi-on-bottom)' }} />
        </linearGradient>
      </defs>
      <g style={{ fill: 'var(--mi-groove)', stroke: 'var(--mi-groove)' }} strokeWidth="1.1" strokeLinejoin="round">
        <g>{groove}</g>
        <g transform="translate(48 0) scale(-1 1)">{groove}</g>
      </g>
      <g>{muscles}</g>
      <g transform="translate(48 0) scale(-1 1)">{muscles}</g>
    </svg>
  )
}
