import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Download, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Switch } from '../components/Switch'
import { DEFAULT_SETTINGS, db } from '../data/db'
import { getSessionSummary } from '../data/summary'
import type { ShareDefaults } from '../data/types'
import { drawShareImage } from '../share/drawShareImage'
import { canShareImage, saveImage, shareFileName, shareImage } from '../share/shareActions'
import { MESSAGE_PRESETS, availableItems, buildContent } from '../share/shareLayout'
import { dayKey } from '../lib/date'

/*
  共有画像のプレビュー
  ・出す項目のオン/オフと、メッセージを選ぶ（選んだものは次回も使う）
  ・変えるたびに描き直して、プレビューに出す
  ・「共有」はスマホの共有シート、「保存」はファイルとして保存
*/
type Props = {
  sessionId: string
  onBack: () => void
  onToast: (message: string) => void
}

const ITEMS: { key: keyof ShareDefaults; label: string }[] = [
  { key: 'muscleGroups', label: '鍛えた筋群' },
  { key: 'totalVolume', label: '総挙上量' },
  { key: 'totalSets', label: 'セット数' },
  { key: 'exerciseCount', label: '種目数' },
  { key: 'duration', label: 'トレーニング時間' },
  { key: 'personalRecords', label: '自己ベストの数' },
  { key: 'growth', label: '前回からの伸び・自己ベスト' },
  { key: 'effort', label: 'きつさ（自分の感じ方）' },
  { key: 'note', label: '振り返りメモ' },
  { key: 'message', label: 'メッセージ' },
]

export function ShareScreen({ sessionId, onBack, onToast }: Props) {
  const summary = useLiveQuery(() => getSessionSummary(sessionId), [sessionId])
  const settings = useLiveQuery(async () => (await db.settings.get('me')) ?? DEFAULT_SETTINGS, [])

  // 選んだ項目とメッセージ（設定から始める）
  const [show, setShow] = useState<ShareDefaults | null>(null)
  const [message, setMessage] = useState('')
  const [custom, setCustom] = useState(false)
  useEffect(() => {
    if (!settings || show) return
    setShow(settings.shareDefaults)
    const m = settings.shareMessage || MESSAGE_PRESETS[0]
    setMessage(m)
    setCustom(!MESSAGE_PRESETS.includes(m))
  }, [settings, show])

  // できた画像
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const run = useRef(0)

  useEffect(() => {
    if (!summary || !show) return
    const id = ++run.current
    setDrawing(true)
    // 続けて変えたときは、最後の1回だけ描く
    const t = setTimeout(async () => {
      const b = await drawShareImage(buildContent(summary, show, message))
      if (id !== run.current) return
      setBlob(b)
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(b)
      })
      setDrawing(false)
    }, 150)
    return () => clearTimeout(t)
  }, [summary, show, message])

  // 画面を閉じるとき、プレビューの画像を片づける
  useEffect(() => () => setUrl((old) => (old && URL.revokeObjectURL(old), null)), [])

  if (!summary || !show) return null
  const ok = availableItems(summary)
  // ファイル名は端末の日付で（夜中でもずれないように）
  const fileName = shareFileName(dayKey(summary.session.startedAt))
  const shareable = canShareImage()

  const toggle = (key: keyof ShareDefaults, value: boolean) => {
    const next = { ...show, [key]: value }
    setShow(next)
    void db.settings.update('me', { shareDefaults: next })
  }
  const pickMessage = (m: string) => {
    setMessage(m)
    void db.settings.update('me', { shareMessage: m })
  }

  const onShare = async () => {
    if (!blob) return
    const r = await shareImage(blob, fileName)
    if (r === 'failed') onToast('共有できませんでした。「保存」を使ってください')
  }
  const onSave = () => {
    if (!blob) return
    saveImage(blob, fileName)
    onToast('画像を保存しました')
  }

  return (
    <section className="screen share">
      <header className="screen-head record-head">
        <button type="button" className="icon-btn" aria-label="もどる" onClick={onBack}>
          <ChevronLeft strokeWidth={2} />
        </button>
        <h1 className="screen-title review-title">共有画像</h1>
        <span style={{ width: 34 }} />
      </header>

      <div className="share-preview" data-drawing={drawing || undefined}>
        {url ? <img src={url} alt="共有画像のプレビュー" /> : <span className="share-loading">画像を作っています…</span>}
      </div>

      <div>
        <h2 className="section-title">出す項目</h2>
        <ul className="card list">
          {ITEMS.map(({ key, label }) => (
            <li key={key} className="list-row share-item" data-off={!ok[key] || undefined}>
              <span className="list-name">{label}</span>
              {!ok[key] && <span className="list-sub">記録なし</span>}
              <Switch checked={show[key] && ok[key]} onChange={(v) => ok[key] && toggle(key, v)} label={label} />
            </li>
          ))}
        </ul>
        <p className="field-help share-help">記録していない項目は出せません。メモは自分で選んだときだけ出します。</p>
      </div>

      {show.message && (
        <div>
          <h2 className="section-title">メッセージ</h2>
          <div className="card share-messages">
            {MESSAGE_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={!custom && message === m}
                className="share-msg"
                onClick={() => {
                  setCustom(false)
                  pickMessage(m)
                }}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={custom}
              className="share-msg"
              onClick={() => {
                setCustom(true)
                pickMessage(MESSAGE_PRESETS.includes(message) ? '' : message)
              }}
            >
              自分で書く
            </button>
            {custom && (
              <input
                className="input"
                value={message}
                maxLength={40}
                placeholder="40文字まで"
                autoFocus
                onChange={(e) => pickMessage(e.target.value)}
              />
            )}
          </div>
        </div>
      )}

      <div className="action-bar">
        <div className="action-pair">
          <button type="button" className={shareable ? 'btn btn-xl' : 'btn btn-primary btn-xl'} onClick={onSave} disabled={!blob}>
            <Download strokeWidth={2} aria-hidden />
            保存
          </button>
          {shareable && (
            <button type="button" className="btn btn-primary btn-xl" onClick={onShare} disabled={!blob}>
              <Share2 strokeWidth={2} aria-hidden />
              共有
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
