import { useLiveQuery } from 'dexie-react-hooks'
import { Pause, Play, Timer, X } from 'lucide-react'
import { DEFAULT_SETTINGS, db } from '../data/db'
import { formatDuration } from '../lib/format'
import { remainingMs, restTimer, useRestTimer } from '../lib/restTimer'

/*
  休憩タイマーの帯（画面の下、「セット完了」ボタンの上）
  ・止まっている：「休憩 1:30」と ±15秒・はじめる。±は次からの最初の秒数として保存
  ・動いている：残り時間と、減っていく緑のバー。±15秒・一時停止・やめる
  ・おわり：「休憩おわり」。押すと消える
*/
const STEP = 15
const MIN = 15
const MAX = 600

export function RestTimer() {
  const timer = useRestTimer()
  const settings = useLiveQuery(() => db.settings.get('me'), [])
  const defaultSec = (settings ?? DEFAULT_SETTINGS).restSeconds

  const setDefault = (sec: number) => {
    const next = Math.min(MAX, Math.max(MIN, sec))
    void db.settings.update('me', { restSeconds: next })
  }

  if (timer.status === 'idle') {
    return (
      <div className="rest rest-idle">
        <span className="rest-label">
          <Timer strokeWidth={2} aria-hidden />
          休憩
        </span>
        <span className="rest-time num">{formatDuration(defaultSec * 1000)}</span>
        <span className="rest-actions">
          <button type="button" className="rest-btn num" aria-label="休憩を15秒みじかく" onClick={() => setDefault(defaultSec - STEP)}>
            −15
          </button>
          <button type="button" className="rest-btn num" aria-label="休憩を15秒ながく" onClick={() => setDefault(defaultSec + STEP)}>
            +15
          </button>
          <button type="button" className="rest-btn rest-btn-go" aria-label="休憩タイマーをはじめる" onClick={() => restTimer.start(defaultSec)}>
            <Play strokeWidth={2.4} aria-hidden />
          </button>
        </span>
      </div>
    )
  }

  if (timer.status === 'done') {
    return (
      <button type="button" className="rest rest-done" onClick={() => restTimer.reset()}>
        <span className="rest-label">
          <Timer strokeWidth={2} aria-hidden />
          休憩おわり
        </span>
        <span className="rest-done-sub">次のセットへ</span>
        <X className="rest-close" strokeWidth={2} aria-label="閉じる" />
      </button>
    )
  }

  const left = remainingMs(timer, timer.now)
  const ratio = timer.totalMs > 0 ? left / timer.totalMs : 0
  const running = timer.status === 'running'

  return (
    <div className="rest rest-running" data-paused={!running || undefined}>
      {/* 減っていくバー */}
      <span className="rest-bar" style={{ transform: `scaleX(${ratio})` }} aria-hidden />
      <span className="rest-label">
        <Timer strokeWidth={2} aria-hidden />
        {running ? '休憩中' : '一時停止'}
      </span>
      {/* 秒は切り上げて出す（残り 89.4 秒なら 1:30）。0:00 になった瞬間に終わるように */}
      <span className="rest-time num" role="timer">
        {formatDuration(Math.ceil(left / 1000) * 1000)}
      </span>
      <span className="rest-actions">
        <button type="button" className="rest-btn num" aria-label="15秒へらす" onClick={() => restTimer.add(-STEP)}>
          −15
        </button>
        <button type="button" className="rest-btn num" aria-label="15秒ふやす" onClick={() => restTimer.add(STEP)}>
          +15
        </button>
        <button
          type="button"
          className="rest-btn"
          aria-label={running ? '一時停止' : '再開'}
          onClick={() => (running ? restTimer.pause() : restTimer.resume())}
        >
          {running ? <Pause strokeWidth={2.4} aria-hidden /> : <Play strokeWidth={2.4} aria-hidden />}
        </button>
        <button type="button" className="rest-btn" aria-label="休憩をやめる" onClick={() => restTimer.reset()}>
          <X strokeWidth={2.4} aria-hidden />
        </button>
      </span>
    </div>
  )
}
