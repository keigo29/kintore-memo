import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db } from '../data/db'
import { makeWav } from './restSound'
import type { RestSoundMode } from '../data/types'

/*
  休憩タイマー（アプリ全体で1つ）
  ・「何秒たったか」ではなく「何時に終わるか（endsAt）」を持つ
    → 画面を閉じていても、開き直したときに正しい残り時間が出る
  ・端末（localStorage）に保存して、アプリを開き直しても続きから
  ・時間になったら、音とバイブでお知らせ（アプリを開いているとき）
  ・残り5秒から1秒ごとにピッ、0秒でピッ・ピッ・ピー（設定で切れる）
    → 始めたときに「無音＋カウントダウン＋終わりの音」の音声を作って <audio> で流す
      音楽アプリと同じしくみなので、アプリを閉じたり画面を消したりしても鳴る
      （JS のタイマーは裏に回ると止まるので、音の時刻は音声ファイルの中に入れておく）
    → 一時停止・±15秒・やめるときは、作り直すか止める
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

// 残り5秒のカウントダウンを鳴らすか・どう鳴らすか（設定。端末のデータベースを見張って、いつも最新にしておく）
let countdownOn = true
let soundMode: RestSoundMode = 'mix'
liveQuery(() => db.settings.get('me')).subscribe({
  next: (s) => {
    countdownOn = s?.restCountdown ?? true
    const mode = s?.restSoundMode ?? 'mix'
    if (!countdownOn || mode !== soundMode) stopMedia()
    soundMode = mode
  },
  error: () => {},
})

/*
  音の鳴らし方（iPhone の Safari 16.4 から使える navigator.audioSession）
  ・mix（音楽を止めない）：ほかのアプリの音楽と混ぜて鳴らす（ambient）。マナーモードでは鳴らない
                           画面を消したりアプリを閉じたりすると鳴らないことがある
  ・background（閉じても鳴らす）：音楽アプリと同じ扱い（playback）。裏でも鳴るが、流している音楽は止まる
  ・audioSession がない端末（Android など）では何もしない（もともと音楽は止まりにくい）
*/
type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'
function applyAudioSession() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: AudioSessionType } }).audioSession
    if (session) session.type = soundMode === 'background' ? 'playback' : 'ambient'
  } catch {
    // 変えられない端末はそのまま
  }
}

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
  applyAudioSession()
  try {
    if (!audio) audio = new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

/* ---------- 裏でも鳴る音（<audio> で流す音声ファイル） ---------- */

let media: HTMLAudioElement | null = null
let mediaUrl: string | null = null
/** 今、カウントダウンの音声が流れているか（流れていれば、終わりの音は音声のほうに任せる） */
let mediaPlaying = false

function getMedia(): HTMLAudioElement | null {
  if (media) return media
  try {
    media = new Audio()
    media.preload = 'auto'
    media.addEventListener('ended', () => (mediaPlaying = false))
  } catch {
    media = null
  }
  return media
}

/**
 * 音の準備（ボタンを押したその場で呼ぶ）
 * iPhone は「押したとき」にしか音を流し始められない。一度その場で流した <audio> は、あとから流し直せる
 * （セット完了は、記録を保存してから休憩を始めるので、先にこれを呼んでおく）
 */
export function primeRestSound() {
  applyAudioSession()
  prepareSound()
  const m = getMedia()
  if (!m || !countdownOn || mediaPlaying) return
  try {
    if (!m.src) m.src = URL.createObjectURL(makeWav(0.05))
    m.muted = true
    void m
      .play()
      .then(() => {
        if (!mediaPlaying) m.pause()
        m.muted = false
      })
      .catch(() => (m.muted = false))
  } catch {
    // 鳴らせない端末は、今までどおり開いているときだけ鳴らす
  }
}

/** 残り leftMs のカウントダウンを流し始める（前のは止める） */
function playMedia(leftMs: number) {
  stopMedia()
  if (!countdownOn) return
  applyAudioSession()
  const m = getMedia()
  if (!m) return
  try {
    mediaUrl = URL.createObjectURL(makeWav(leftMs / 1000))
    m.src = mediaUrl
    m.muted = false
    mediaPlaying = true
    void m.play().catch(() => (mediaPlaying = false))
    if (soundMode === 'background' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: '休憩タイマー', artist: '筋トレメモ' })
    }
  } catch {
    mediaPlaying = false
  }
}

/*
  アプリに戻ってきたとき：裏に回っている間に iPhone が音声を止めていたら（「音楽を止めない」のとき）、
  残り時間で流し直す。一度流した <audio> なので、押さなくても流せる
*/
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || state.status !== 'running') return
    if (countdownOn && media && media.paused) playMedia(remainingMs(state))
  })
}

function stopMedia() {
  mediaPlaying = false
  if (media) {
    try {
      media.pause()
    } catch {
      /* 何もしない */
    }
  }
  if (mediaUrl) {
    URL.revokeObjectURL(mediaUrl)
    mediaUrl = null
  }
}

/** 時間になった：ピッ・ピッ・ピーと鳴らして、ふるわせる */
function alertDone() {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 400])
  } catch {
    // ふるえない端末は何もしない
  }
  // カウントダウンの音声が流れていれば、終わりの音はその中に入っている（2回鳴らさない）
  // （「音楽を止めない」で裏に回ったときなど、iPhone が止めていたら、こちらで鳴らす）
  if (!audio || (mediaPlaying && media && !media.paused)) return
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
    playMedia(ms)
    set({ status: 'running', endsAt: Date.now() + ms, pausedMs: null, totalMs: ms })
  },
  pause() {
    if (state.status !== 'running') return
    stopMedia()
    set({ ...state, status: 'paused', endsAt: null, pausedMs: remainingMs(state) })
  },
  resume() {
    if (state.status !== 'paused' || state.pausedMs === null) return
    prepareSound()
    playMedia(state.pausedMs)
    set({ ...state, status: 'running', endsAt: Date.now() + state.pausedMs, pausedMs: null })
  },
  /** 残り時間を足す・引く（0秒より下にはしない） */
  add(seconds: number) {
    const left = Math.max(0, remainingMs(state) + seconds * 1000)
    const total = Math.max(state.totalMs + seconds * 1000, left)
    if (state.status === 'running') {
      playMedia(left)
      set({ ...state, endsAt: Date.now() + left, totalMs: total })
    }
    else if (state.status === 'paused') set({ ...state, pausedMs: left, totalMs: total })
  },
  reset() {
    stopMedia()
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
