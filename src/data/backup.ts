import { THEME_KEY } from '../lib/theme'
import { db } from './db'
import { TABLES, makeBackup } from './backupFormat'
import type { BackupData, BackupFile } from './backupFormat'
import { getSettings, updateSettings } from './settings'
import { rebuildAllRecords } from './summary'

/*
  書き出し・読み込み・全部消す
  ・データは端末の中だけにある。機種変更やブラウザのデータ削除にそなえて、ファイルに書き出しておく
  ・読み込みは「置きかえ」：いまのデータを消して、ファイルの中身にする（足し合わせはしない）
    途中で失敗したら、1つのトランザクションなので元のまま
*/

const tables = () => TABLES.map((t) => db.table(t))

export async function exportBackup(now = Date.now()): Promise<BackupFile> {
  const data = {} as Record<string, unknown[]>
  await db.transaction('r', tables(), async () => {
    for (const t of TABLES) data[t] = await db.table(t).toArray()
  })
  return makeBackup(data as BackupData, now)
}

/** 書き出したことを覚えておく（設定画面に「最後に書き出した日」を出す） */
export async function markExported(now = Date.now()): Promise<void> {
  await updateSettings({ lastExportAt: now })
}

export async function restoreBackup(file: BackupFile): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      const rows = file.data[t]
      if (rows.length) await db.table(t).bulkAdd(rows)
    }
  })
  // 設定が入っていなかったファイルでも、行を作っておく
  await updateSettings({})
  // 自己ベストは記録から計算し直す（ファイルの中の自己ベストと記録が食いちがっていても正しくなる）
  await rebuildAllRecords()
  // 休憩タイマーは、読み込む前のトレーニングのものなので止める
  localStorage.removeItem('kintore-memo:rest-timer')
  const theme = (await getSettings()).theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* 保存できない端末もある */
  }
}

/** 全部消す：データベースを消して開き直す（最初の種目と設定が入り直す） */
export async function deleteAllData(): Promise<void> {
  await db.delete()
  for (const key of ['kintore-memo:rest-timer', THEME_KEY]) localStorage.removeItem(key)
  location.reload()
}

/** 件数（確認のダイアログに出す） */
export function countBackup(data: BackupData) {
  return {
    sessions: data.sessions.filter((s) => s.status === 'done').length,
    exercises: data.exercises.length,
    templates: data.templates.length,
    sets: data.sets.length,
  }
}
