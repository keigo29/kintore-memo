import { DEFAULT_SETTINGS, db } from './db'
import type { UserSettings } from './types'

/*
  設定
  ・保存は settings テーブルの 'me' の1行だけ
  ・後から足した項目（restAuto など）は、古いデータには入っていない
    → いつも「最初の設定」に保存済みの値を重ねて読む（足りない項目は最初の値になる）
*/

export async function getSettings(): Promise<UserSettings> {
  const saved = await db.settings.get('me')
  return { ...DEFAULT_SETTINGS, ...saved, shareDefaults: { ...DEFAULT_SETTINGS.shareDefaults, ...saved?.shareDefaults } }
}

/** 一部だけ変える（行がなければ作る） */
export async function updateSettings(patch: Partial<Omit<UserSettings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const now = await getSettings()
    await db.settings.put({ ...now, ...patch, id: 'me' })
  })
}
