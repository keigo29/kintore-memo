import { useSyncExternalStore } from 'react'

/*
  休憩タイマー（アプリ全体で1つ）
  ・「何秒たったか」ではなく「何時に終わるか（endsAt）」を持つ
    → 画面を閉じていても、開き直したときに正しい残り時間が出る
  ・端末（localStorage）に保存して、アプリを開き直しても続きから
  ・時間になったら、音とバイブでお知らせ（アプリを開いているとき）
  ・画面を閉じている間のお知らせは、サーバーなしの PWA では確実にはできない
*/

export type RestStatus = 'idle' | 'running' | 'paused' | 'done'

export type RestState = {
  status: RestStatus
  /** 動いているとき：終わる時刻 */
  endsAt: number | null
  /** 一時停止中：残りのミリ秒 */
  pausedMs: number | null
  /** 今回の休憩の長さ（バーの割合を出すため） */
  totalMs: number
}

const KEY = 'kintore-memo:rest-timer'
const IDLE: RestState = { status: 'idle', endsAt: null, pausedMs: null, totalMs: 0 }

let state: RestState = load()
const listeners = new Set<() => void>()
// 画面に渡すもの。更新のたびに作り直す（中身が同じでも「今」の時刻が進むので、画面が描き直される）
let snapshot: RestState & { now: number } = { ...state, now: Date.now() }
function notify() {
  snapshot = { ...state, now: Date.now() }
  listeners.forEach((l) => l())
}
let ticker: ReturnType<typeof setInterval> | null = null
let audio: AudioContext | null = null

function load(): RestState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return IDLE
    const s = JSON.parse(raw) as RestState
    // 閉じている間に時間が来ていたら「終わり」にする（音は鳴らさない）
    if (s.status === 'running' && s.endsAt !== null && s.endsAt <= Date.now()) return { ...s, status: 'done' }
    return s
  } catch {
    return IDLE
  }
}

function set(next: RestState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 保存できなくても、タイマーそのものは動かす
  }
  updateTicker()
  notify()
}

// 動いている間だけ、0.25 秒ごとに画面を更新して、時間切れを見張る
function updateTicker() {
  if (state.status === 'running' && !ticker) {
    ticker = setInterval(() => {
      if (state.status === 'running' && state.endsAt !== null && state.endsAt <= Date.now()) {
        set({ ...state, status: 'done' })
        alertDone()
      } else {
        notify()
      }
    }, 250)
  } else if (state.status !== 'running' && ticker) {
    clearInterval(ticker)
    ticker = null
  }
}
updateTicker()

/** 音の準備。ブラウザは「ボタンを押したとき」にしか音を出せないので、開始のときに作っておく */
function prepareSound() {
  try {
    if (!audio) audio = new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

/** 時間になった：ピッ・ピッ・ピーと鳴らして、ふるわせる */
function alertDone() {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 400])
  } catch {
    // ふるえない端末は何もしない
  }
  if (!audio) return
  try {
    const now = audio.currentTime
    ;[0, 0.25, 0.5].forEach((t, i) => {
      const osc = audio!.createOscillator()
      const gain = audio!.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 2 ? 1175 : 880
      const len = i === 2 ? 0.35 : 0.15
      gain.gain.setValueAtTime(0.0001, now + t)
      gain.gain.exponentialRampToValueAtTime(0.3, now + t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + len)
      osc.connect(gain).connect(audio!.destination)
      osc.start(now + t)
      osc.stop(now + t + len + 0.05)
    })
  } catch {
    // 音が出せなくても、表示とバイブでお知らせする
  }
}

/** 残りのミリ秒 */
export function remainingMs(s: RestState, now = Date.now()): number {
  if (s.status === 'running' && s.endsAt !== null) return Math.max(0, s.endsAt - now)
  if (s.status === 'paused' && s.pausedMs !== null) return s.pausedMs
  return 0
}

export const restTimer = {
  start(seconds: number) {
    prepareSound()
    const ms = seconds * 1000
    set({ status: 'running', endsAt: Date.now() + ms, pausedMs: null, totalMs: ms })
  },
  pause() {
    if (state.status !== 'running') return
    set({ ...state, status: 'paused', endsAt: null, pausedMs: remainingMs(state) })
  },
  resume() {
    if (state.status !== 'paused' || state.pausedMs === null) return
    prepareSound()
    set({ ...state, status: 'running', endsAt: Date.now() + state.pausedMs, pausedMs: null })
  },
  /** 残り時間を足す・引く（0秒より下にはしない） */
  add(seconds: number) {
    const left = Math.max(0, remainingMs(state) + seconds * 1000)
    const total = Math.max(state.totalMs + seconds * 1000, left)
    if (state.status === 'running') set({ ...state, endsAt: Date.now() + left, totalMs: total })
    else if (state.status === 'paused') set({ ...state, pausedMs: left, totalMs: total })
  },
  reset() {
    set(IDLE)
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 画面で使う：タイマーの状態と今の時刻（動いている間は0.25秒ごとに更新される） */
export function useRestTimer(): RestState & { now: number } {
  return useSyncExternalStore(subscribe, () => snapshot)
}
