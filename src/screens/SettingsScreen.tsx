import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, CloudUpload, Download, Minus, Monitor, Moon, Plus, Sun, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { CalcHelp } from '../components/SessionReport'
import { Switch } from '../components/Switch'
import { clearCmdSync, getCmdSync, isCmdSyncReady, pushToCmd, setCmdSync } from '../data/cmdSync'
import type { CmdSync } from '../data/cmdSync'
import { countBackup, deleteAllData, exportBackup, markExported, restoreBackup } from '../data/backup'
import { backupFileName, parseBackup } from '../data/backupFormat'
import type { BackupFile } from '../data/backupFormat'
import { db } from '../data/db'
import { getSettings, updateSettings } from '../data/settings'
import type { UserSettings } from '../data/types'
import { formatDate, formatDuration } from '../lib/format'
import { saveImage } from '../share/shareActions'

/*
  設定
  ・見た目：テーマ（ライト／ダーク／端末に合わせる）
  ・記録：重量の刻み・休憩の長さ・セット完了で休憩を始めるか
  ・やる気：週の目標日数（今週のチャージ）・稲妻の演出・電気の色
  ・バックアップ：JSON ファイルに書き出す／読み込む（置き換え）
  ・Cmd に保存：GitHub の Cmd にバックアップを置く（AI で分析する用。トークンはこの端末だけ）
  ・データ：保存のようす・全て削除
  ・このアプリについて：版・計算の仕方
  変えたらすぐ保存する（「保存」ボタンはない）
*/
type Props = {
  onBack: () => void
  onToast: (message: string) => void
}

const THEMES: { id: UserSettings['theme']; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'ライト', icon: Sun },
  { id: 'dark', label: 'ダーク', icon: Moon },
  { id: 'system', label: '端末に合わせる', icon: Monitor },
]
const VOLTS: { id: UserSettings['voltColor']; label: string }[] = [
  { id: 'cyan', label: '水色' },
  { id: 'yellow', label: '黄' },
  { id: 'white', label: '白' },
]
const STEPS = [1, 1.25, 2.5, 5]
const REST_STEP = 15
const REST_MIN = 15
const REST_MAX = 600
/** これより前に書き出したきりなら、書き出しを勧める */
const STALE_DAYS = 30

export function SettingsScreen({ onBack, onToast }: Props) {
  const settings = useLiveQuery(() => getSettings(), [])
  const doneCount = useLiveQuery(() => db.sessions.where('status').equals('done').count(), [])
  const storage = useStorageInfo()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState<BackupFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!settings) return null
  const set = (patch: Partial<UserSettings>) => void updateSettings(patch)

  const onExport = async () => {
    const file = await exportBackup()
    const name = backupFileName(file.exportedAt)
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
    // スマホは共有シート（「ファイルに保存」やクラウドに送れる）、パソコンはダウンロード
    const jsonFile = new File([blob], name, { type: 'application/json' })
    const touch = matchMedia('(pointer: coarse)').matches
    if (touch && typeof navigator.share === 'function' && navigator.canShare?.({ files: [jsonFile] })) {
      try {
        await navigator.share({ files: [jsonFile], title: '筋トレメモのバックアップ' })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return // 閉じただけ
        saveImage(blob, name)
      }
    } else {
      saveImage(blob, name)
    }
    await markExported(file.exportedAt)
    onToast('バックアップを書き出しました')
  }

  const onPickFile = async (f: File | undefined) => {
    if (!f) return
    const result = parseBackup(await f.text())
    if (fileRef.current) fileRef.current.value = '' // 同じファイルをもう一度選べるように
    if (!result.ok) {
      onToast(result.error)
      return
    }
    setImporting(result.file)
  }

  const exportDays = settings.lastExportAt === null ? null : Math.floor((Date.now() - settings.lastExportAt) / 86400000)
  const stale = (doneCount ?? 0) > 0 && (exportDays === null || exportDays >= STALE_DAYS)

  return (
    <section className="screen review settings">
      <header className="screen-head record-head">
        <button type="button" className="icon-btn" aria-label="戻る" onClick={onBack}>
          <ChevronLeft strokeWidth={2} />
        </button>
        <h1 className="screen-title review-title">設定</h1>
        <span style={{ width: 34 }} />
      </header>

      {/* 見た目 */}
      <div>
        <h2 className="section-title">見た目</h2>
        <div className="card">
          <div className="seg seg-3" role="radiogroup" aria-label="テーマ">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="radio" className="seg-btn" aria-checked={settings.theme === id} onClick={() => set({ theme: id })}>
                <Icon strokeWidth={2} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 記録 */}
      <div>
        <h2 className="section-title">記録</h2>
        <div className="card settings-list">
          <div className="settings-row settings-row-col">
            <div>
              <span className="settings-name">重量の刻み</span>
              <span className="field-help">記録の画面の −・＋ で変わる重さ</span>
            </div>
            <div className="seg" role="radiogroup" aria-label="重量の刻み">
              {STEPS.map((s) => (
                <button key={s} type="button" role="radio" className="seg-btn num" aria-checked={settings.weightStepKg === s} onClick={() => set({ weightStepKg: s })}>
                  {s}kg
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <div>
              <span className="settings-name">休憩の長さ</span>
              <span className="field-help">休憩タイマーの最初の時間</span>
            </div>
            <span className="settings-rest">
              <button
                type="button"
                className="rest-btn num"
                aria-label="15秒短く"
                disabled={settings.restSeconds <= REST_MIN}
                onClick={() => set({ restSeconds: Math.max(REST_MIN, settings.restSeconds - REST_STEP) })}
              >
                −15
              </button>
              <span className="settings-rest-time num">{formatDuration(settings.restSeconds * 1000)}</span>
              <button
                type="button"
                className="rest-btn num"
                aria-label="15秒長く"
                disabled={settings.restSeconds >= REST_MAX}
                onClick={() => set({ restSeconds: Math.min(REST_MAX, settings.restSeconds + REST_STEP) })}
              >
                +15
              </button>
            </span>
          </div>
          <div className="settings-row">
            <div>
              <span className="settings-name">セット完了で休憩を始める</span>
              <span className="field-help">オフにすると、休憩タイマーは自分で押して始めます</span>
            </div>
            <Switch checked={settings.restAuto} onChange={(v) => set({ restAuto: v })} label="セット完了で休憩を始める" />
          </div>
        </div>
      </div>

      {/* やる気 */}
      <div>
        <h2 className="section-title">やる気</h2>
        <div className="card settings-list">
          <div className="settings-row">
            <div>
              <span className="settings-name">週の目標</span>
              <span className="field-help">ホームの「今週のチャージ」が満タンになる日数</span>
            </div>
            <span className="settings-rest">
              <button
                type="button"
                className="rest-btn num"
                aria-label="1日減らす"
                disabled={settings.weeklyGoal <= 1}
                onClick={() => set({ weeklyGoal: Math.max(1, settings.weeklyGoal - 1) })}
              >
                <Minus strokeWidth={2.4} />
              </button>
              <span className="settings-rest-time num">{settings.weeklyGoal}日</span>
              <button
                type="button"
                className="rest-btn num"
                aria-label="1日増やす"
                disabled={settings.weeklyGoal >= 7}
                onClick={() => set({ weeklyGoal: Math.min(7, settings.weeklyGoal + 1) })}
              >
                <Plus strokeWidth={2.4} />
              </button>
            </span>
          </div>
          <div className="settings-row">
            <div>
              <span className="settings-name">稲妻の演出</span>
              <span className="field-help">セット完了・自己ベスト・チャージ・スキルツリーで電気が走ります</span>
            </div>
            <Switch checked={settings.effects} onChange={(v) => set({ effects: v })} label="稲妻の演出" />
          </div>
          <div className="settings-row settings-row-col">
            <span className="settings-name">電気の色</span>
            <div className="seg seg-3" role="radiogroup" aria-label="電気の色">
              {VOLTS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  className="seg-btn"
                  aria-checked={settings.voltColor === id}
                  disabled={!settings.effects}
                  onClick={() => set({ voltColor: id })}
                >
                  <span className="volt-swatch" data-volt={id} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* バックアップ */}
      <div>
        <h2 className="section-title">バックアップ</h2>
        <div className="card settings-backup">
          <p className="field-help">
            記録はこの端末の中だけにあります。機種変更やブラウザのデータ削除に備えて、時々ファイルに書き出してください。
          </p>
          <p className={stale ? 'settings-last is-stale' : 'settings-last'}>
            {settings.lastExportAt === null ? 'まだ書き出していません' : `最後に書き出した日：${formatDate(settings.lastExportAt)}`}
          </p>
          <div className="action-pair">
            <button type="button" className={stale ? 'btn btn-primary btn-lg' : 'btn btn-lg'} onClick={onExport}>
              <Download strokeWidth={2} aria-hidden />
              書き出す
            </button>
            <button type="button" className="btn btn-lg" onClick={() => fileRef.current?.click()}>
              <Upload strokeWidth={2} aria-hidden />
              読み込む
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onPickFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <CmdSyncCard onToast={onToast} />

      {/* データ */}
      <div>
        <h2 className="section-title">データ</h2>
        <div className="card settings-list">
          <div className="settings-row">
            <span className="settings-name">記録したトレーニング</span>
            <span className="num settings-value">{doneCount ?? '—'}回</span>
          </div>
          <div className="settings-row">
            <div>
              <span className="settings-name">消されにくい保存</span>
              <span className="field-help">オフでも使えます。端末の空きが少ないと、ブラウザが消すことがあります</span>
            </div>
            <span className="settings-value">{storage.persisted === null ? '—' : storage.persisted ? 'オン' : 'オフ'}</span>
          </div>
          {storage.usage !== null && (
            <div className="settings-row">
              <span className="settings-name">使っている容量</span>
              <span className="num settings-value">{formatBytes(storage.usage)}</span>
            </div>
          )}
          <div className="settings-row">
            <button type="button" className="link-btn link-danger" onClick={() => setDeleting(true)}>
              全てのデータを削除
            </button>
          </div>
        </div>
      </div>

      {/* このアプリについて */}
      <div>
        <h2 className="section-title">このアプリについて</h2>
        <div className="card settings-list">
          <div className="settings-row">
            <span className="settings-name">筋トレメモ</span>
            <span className="num settings-value">
              v{__APP_VERSION__}（{__BUILT_AT__}）
            </span>
          </div>
          <p className="field-help settings-about">サーバーを使わず、記録はこの端末の中だけに保存します。「Cmd に保存」をオンにしたときだけ、自分の GitHub のリポジトリに送ります。</p>
        </div>
        <CalcHelp />
      </div>

      {importing && (
        <Dialog
          title="バックアップを読み込みますか？"
          onClose={() => !busy && setImporting(null)}
          footer={
            <>
              <span className="spacer" />
              <button type="button" className="btn" disabled={busy} onClick={() => setImporting(null)}>
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await restoreBackup(importing)
                    setImporting(null)
                    onToast('バックアップを読み込みました')
                  } catch {
                    onToast('読み込めませんでした。今のデータはそのままです')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? '読み込み中…' : '置き換える'}
              </button>
            </>
          }
        >
          <ImportSummary file={importing} />
        </Dialog>
      )}

      {deleting && (
        <Dialog
          title="全てのデータを削除しますか？"
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={onExport}>
                <Download strokeWidth={2} aria-hidden />
                先に書き出す
              </button>
              <span className="spacer" />
              <button type="button" className="btn btn-danger" onClick={() => void deleteAllData()}>
                削除する
              </button>
            </>
          }
        >
          <p className="field-help">記録・メニュー・自分で足した種目・設定が消えて、初めて開いたときの状態に戻ります。元には戻せません。</p>
        </Dialog>
      )}
    </section>
  )
}

/** Cmd に保存（GitHub の自分のリポジトリにバックアップを置いて、AI で分析する） */
function CmdSyncCard({ onToast }: { onToast: (message: string) => void }) {
  const [sync, setSync] = useState<CmdSync>(() => getCmdSync())
  const [busy, setBusy] = useState(false)
  const save = (patch: Partial<CmdSync>) => setSync(setCmdSync(patch))
  const ready = isCmdSyncReady(sync)

  const onPush = async () => {
    setBusy(true)
    try {
      const path = await pushToCmd()
      onToast(`Cmd に保存しました（${path}）`)
    } catch (e) {
      onToast((e as Error).message)
    } finally {
      setSync(getCmdSync())
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="section-title">Cmd に保存（AI で分析）</h2>
      <div className="card settings-backup">
        <p className="field-help">
          バックアップを GitHub の自分のリポジトリ（Cmd）に置きます。Cmd の中でノートと表に作り直され、AI で分析できます。
          トークンは Fine-grained personal access token で、対象は Cmd だけ、権限は Contents の Read and write にしてください。トークンはこの端末にだけ保存し、バックアップのファイルにも入りません。
        </p>
        <label className="field">
          <span className="field-label">トークン</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            placeholder="github_pat_…"
            value={sync.token}
            onChange={(e) => save({ token: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">リポジトリ</span>
          <input className="input" autoComplete="off" value={sync.repo} onChange={(e) => save({ repo: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">フォルダ</span>
          <input className="input" autoComplete="off" value={sync.dir} onChange={(e) => save({ dir: e.target.value })} />
        </label>
        <div className="settings-row">
          <div>
            <span className="settings-name">終えたら自動で保存</span>
            <span className="field-help">振り返りで「保存して終える」を押すと、裏で Cmd に保存します</span>
          </div>
          <Switch checked={sync.auto} onChange={(v) => save({ auto: v })} label="終えたら自動で保存" />
        </div>
        <p className={sync.lastError ? 'settings-last is-stale' : 'settings-last'}>
          {sync.lastError
            ? `前回は失敗：${sync.lastError}`
            : sync.lastAt === null
              ? 'まだ保存していません'
              : `最後に保存した日：${formatDate(sync.lastAt)}`}
        </p>
        <div className="action-pair">
          <button type="button" className="btn btn-primary btn-lg" disabled={!ready || busy} onClick={() => void onPush()}>
            <CloudUpload strokeWidth={2} aria-hidden />
            {busy ? '保存中…' : '今すぐ保存'}
          </button>
          <button
            type="button"
            className="btn btn-lg"
            disabled={busy || sync.token === ''}
            onClick={() => {
              clearCmdSync()
              setSync(getCmdSync())
              onToast('トークンを消しました')
            }}
          >
            トークンを消す
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportSummary({ file }: { file: BackupFile }) {
  const c = countBackup(file.data)
  return (
    <div className="import-summary">
      <p className="field-help">
        {file.exportedAt ? `${formatDate(file.exportedAt)} に書き出したファイル` : '書き出した日が分からないファイル'}
      </p>
      <ul className="import-counts num">
        <li>
          <span>トレーニング</span>
          {c.sessions}回
        </li>
        <li>
          <span>セット</span>
          {c.sets}
        </li>
        <li>
          <span>種目</span>
          {c.exercises}
        </li>
        <li>
          <span>メニュー</span>
          {c.templates}
        </li>
      </ul>
      <p className="field-error">今のデータは全て消えて、このファイルの中身に置き換わります。</p>
    </div>
  )
}

/** 保存のようす（ブラウザが教えてくれないときは null） */
function useStorageInfo() {
  const [info, setInfo] = useState<{ persisted: boolean | null; usage: number | null }>({ persisted: null, usage: null })
  useEffect(() => {
    let alive = true
    void (async () => {
      const persisted = (await navigator.storage?.persisted?.()) ?? null
      const usage = (await navigator.storage?.estimate?.())?.usage ?? null
      if (alive) setInfo({ persisted, usage })
    })()
    return () => {
      alive = false
    }
  }, [])
  return info
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}
