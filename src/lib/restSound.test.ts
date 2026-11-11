import { describe, expect, it } from 'vitest'
import { countdownBeeps, makeWav } from './restSound'

describe('休憩の音', () => {
  it('残り90秒：85〜89秒に1秒ごとのピッ、90秒でピッ・ピッ・ピー', () => {
    const at = countdownBeeps(90).map((b) => b[0])
    expect(at).toEqual([85, 86, 87, 88, 89, 90, 90.25, 90.5])
  })
  it('残り3秒なら、鳴らせる分だけ（過ぎたピッは入れない）', () => {
    const at = countdownBeeps(3).map((b) => b[0])
    expect(at).toEqual([0, 1, 2, 3, 3.25, 3.5])
  })
  it('WAV：長さは残り時間＋1.2秒、残り5秒までは無音', async () => {
    const wav = makeWav(10)
    const bytes = new Uint8Array(await wav.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF')
    expect(bytes.length).toBe(44 + Math.ceil(11.2 * 8000))
    const pcm = bytes.slice(44)
    expect(pcm.slice(0, 5 * 8000 - 1).every((x) => x === 128)).toBe(true)
    expect(pcm.slice(5 * 8000, 5 * 8000 + 960).some((x) => x !== 128)).toBe(true)
  })
})
