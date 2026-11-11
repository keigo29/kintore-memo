/*
  休憩タイマーの音声ファイルを作る（画面やデータベースを使わないので、テストしやすい）
  ・残り leftSec 秒の間は無音、残り5秒から1秒ごとにピッ、0秒でピッ・ピッ・ピー
*/

const RATE = 8000 // 音は 880Hz と 1175Hz だけなので、これで足りる（10分で約5MB）
/** ピッの並び：[鳴らし始める秒, 高さ(Hz), 長さ(秒)] */
export function countdownBeeps(leftSec: number): [number, number, number][] {
  const beeps: [number, number, number][] = []
  for (let k = 5; k >= 1; k--) if (leftSec - k >= 0) beeps.push([leftSec - k, 880, 0.12])
  // 0秒：ピッ・ピッ・ピー（今までの終わりの音と同じ）
  beeps.push([leftSec, 880, 0.15], [leftSec + 0.25, 880, 0.15], [leftSec + 0.5, 1175, 0.35])
  return beeps
}

/** 無音のあとにピッが入った WAV（8bit・モノラル）を作る */
export function makeWav(leftSec: number): Blob {
  const beeps = countdownBeeps(leftSec)
  const n = Math.ceil((leftSec + 1.2) * RATE)
  const buf = new ArrayBuffer(44 + n)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + n, true)
  str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // モノラル
  v.setUint32(24, RATE, true)
  v.setUint32(28, RATE, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  str(36, 'data')
  v.setUint32(40, n, true)
  const pcm = new Uint8Array(buf, 44)
  pcm.fill(128) // 8bit の無音は 128
  for (const [at, freq, len] of beeps) {
    const start = Math.round(at * RATE)
    const count = Math.round(len * RATE)
    const fade = Math.round(0.01 * RATE)
    for (let i = 0; i < count && start + i < n; i++) {
      const env = Math.min(1, i / fade, (count - i) / fade) // プツッと鳴らないよう、はじめと終わりをなめらかに
      pcm[start + i] = Math.round(128 + 90 * env * Math.sin((2 * Math.PI * freq * i) / RATE))
    }
  }
  return new Blob([buf], { type: 'audio/wav' })
}
