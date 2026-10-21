import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/*
  数字を入れる：［−］ 大きな数字 ［＋］
  ・汗をかいた手でも押せるよう、±ボタンは 56px
  ・数字を押すと、キーボードで直接入れられる
  ・空にすると null（入れていない）。0 は 0 として残す
*/
type Props = {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  step: number
  unit: string
  /** 小数を入れられるか（重量は true、回数は false） */
  decimal?: boolean
  max?: number
}

export function NumberStepper({ label, value, onChange, step, unit, decimal = false, max = 9999 }: Props) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const focused = useRef(false)

  // 外から値が変わったとき（±や「前回と同じ」）は表示も合わせる。入力中は上書きしない
  useEffect(() => {
    if (!focused.current) setText(value === null ? '' : String(value))
  }, [value])

  const clamp = (n: number) => Math.min(max, Math.max(0, Math.round(n * 100) / 100))

  const commit = (raw: string) => {
    const cleaned = raw.normalize('NFKC').replace(/[^0-9.]/g, '')
    if (cleaned === '') return onChange(null)
    const n = decimal ? parseFloat(cleaned) : parseInt(cleaned, 10)
    if (!Number.isNaN(n)) onChange(clamp(n))
  }

  const bump = (dir: 1 | -1) => {
    // 入れていないときに＋を押したら step から、−なら 0 から
    const base = value ?? (dir === 1 ? 0 : step)
    onChange(clamp(base + dir * step))
  }

  return (
    <div className="stepper">
      <span className="field-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="stepper-btn" aria-label={`${label}を${step}${unit}へらす`} onClick={() => bump(-1)}>
          <Minus strokeWidth={2.4} aria-hidden />
        </button>
        <label className="stepper-value">
          <input
            className="stepper-input num"
            inputMode={decimal ? 'decimal' : 'numeric'}
            value={text}
            placeholder="—"
            aria-label={label}
            onFocus={(e) => {
              focused.current = true
              e.target.select()
            }}
            onChange={(e) => {
              setText(e.target.value)
              commit(e.target.value)
            }}
            onBlur={() => {
              focused.current = false
              setText(value === null ? '' : String(value))
            }}
          />
          <span className="stepper-unit">{unit}</span>
        </label>
        <button type="button" className="stepper-btn" aria-label={`${label}を${step}${unit}ふやす`} onClick={() => bump(1)}>
          <Plus strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  )
}
