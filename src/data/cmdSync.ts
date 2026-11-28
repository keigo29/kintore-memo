import { exportBackup } from './backup'
import { backupFileName } from './backupFormat'
import { db } from './db'
import { parseMenuNote, planMenus } from './menuNote'
import type { Exercise } from './types'

/*
  Cmd（GitHub のリポジトリ）に保存する
  ・バックアップ（JSON）を、GitHub の API で Cmd の Data/kintore/ に置く
  ・トークンはこの端末の localStorage にだけ保存する
    （設定テーブルに入れると、書き出したバックアップにトークンが入ってしまうので入れない）
  ・使うトークン：Fine-grained personal access token。対象は Cmd だけ、Contents の Read and write
  ・同じ日に何回保存しても、その日のファイル1つを上書きする
  ・メニューは逆向き：Cmd のノート（Notes/筋トレメニュー.md）を読んで、アプリのメニューにする
    AI がノートを直す → アプリを開いたとき（ノートが変わっていれば）読み込む
*/

const KEY = 'kintore-memo:cmd-sync'

export type CmdSync = {
  token: string
  /** owner/name */
  repo: string
  /** 置き場所のフォルダ */
  dir: string
  /** トレーニングを終えたら自動で保存するか */
  auto: boolean
  /** 最後に保存できた日時（まだなら null） */
  lastAt: number | null
  /** 最後に失敗したときの説明（成功したら null） */
  lastError: string | null
  /** メニューのノートの場所 */
  menuPath: string
  /** アプリを開いたとき、ノートが変わっていればメニューを読み込むか */
  menuAuto: boolean
  /** 最後に読み込んだノートの版（GitHub の sha）。同じなら読み込まない */
  menuSha: string | null
  /** 最後にメニューを読み込んだ日時 */
  menuAt: number | null
}

export const DEFAULT_CMD_SYNC: CmdSync = {
  token: '',
  repo: 'keigo29/Cmd',
  dir: 'Data/kintore',
  auto: true,
  lastAt: null,
  lastError: null,
  menuPath: 'Notes/筋トレメニュー.md',
  menuAuto: true,
  menuSha: null,
  menuAt: null,
}

export function getCmdSync(): CmdSync {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_CMD_SYNC, ...(JSON.parse(raw) as Partial<CmdSync>) } : { ...DEFAULT_CMD_SYNC }
  } catch {
    return { ...DEFAULT_CMD_SYNC }
  }
}

export function setCmdSync(patch: Partial<CmdSync>): CmdSync {
  const next = { ...getCmdSync(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* 保存できない端末もある */
  }
  return next
}

export function clearCmdSync(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 何もしない */
  }
}

export const isCmdSyncReady = (c: CmdSync) => c.token.trim() !== '' && /^[\w.-]+\/[\w.-]+$/.test(c.repo.trim())

/** 日本語も入る文字を base64 にする（btoa は ASCII しか受けない） */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function explain(status: number): string {
  if (status === 401) return 'トークンが違うか、期限が切れています'
  if (status === 403) return 'トークンに書き込みの権限がありません（Contents を Read and write に）'
  if (status === 404) return 'リポジトリが見つかりません（名前か、トークンの対象リポジトリを確認）'
  if (status === 409 || status === 422) return '保存がぶつかりました。少し待ってもう一度'
  return `保存できませんでした（${status}）`
}

function contentsUrl(c: CmdSync, path: string) {
  return `https://api.github.com/repos/${c.repo.trim()}/contents/${path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')}`
}

function apiHeaders(c: CmdSync) {
  return {
    Authorization: `Bearer ${c.token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/** base64（改行入り）を日本語の文字にもどす */
function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export type MenuPullResult = { changed: boolean; menus: number; created: string[] }

/**
 * Cmd のメニューのノートを読んで、アプリのメニューにする
 * ・同じ名前のメニューは中身を上書き、ないメニューは新しく作る。ノートにないメニューはそのまま（消さない）
 * ・アプリにない種目は、新しく作る（ノートで（胸）のように筋群を書いていればその筋群、なければ「その他」）
 * ・onlyIfChanged：前に読んだときからノートが変わっていなければ、何もしない
 */
export async function pullMenusFromCmd(onlyIfChanged = false): Promise<MenuPullResult> {
  const c = getCmdSync()
  if (!isCmdSyncReady(c)) throw new Error('トークンとリポジトリを入れてください')
  let text: string
  let sha: string
  try {
    const res = await fetch(contentsUrl(c, c.menuPath), { headers: apiHeaders(c), cache: 'no-store' })
    if (res.status === 404) throw new Error(`Cmd に ${c.menuPath} が見つかりません`)
    if (!res.ok) throw new Error(explain(res.status))
    const body = (await res.json()) as { content?: string; sha?: string }
    text = fromBase64(body.content ?? '')
    sha = body.sha ?? ''
  } catch (e) {
    throw new Error(e instanceof TypeError ? 'つながりませんでした。電波を確認してください' : (e as Error).message)
  }
  if (onlyIfChanged && sha && sha === c.menuSha) return { changed: false, menus: 0, created: [] }
  const menus = parseMenuNote(text)
  if (menus.length === 0) throw new Error('ノートに「## メニュー名」が見つかりませんでした')

  const created: string[] = []
  await db.transaction('rw', db.exercises, db.templates, async () => {
    const plan = planMenus(menus, await db.exercises.toArray(), await db.templates.toArray())
    const now = Date.now()
    const newIds = new Map<string, string>()
    for (const n of plan.newExercises) {
      const exercise: Exercise = {
        id: crypto.randomUUID(),
        name: n.name,
        muscleGroup: n.muscleGroup,
        isCustom: true,
        isBodyweight: n.isBodyweight,
        archived: false,
        createdAt: now,
      }
      await db.exercises.add(exercise)
      newIds.set(n.key, exercise.id)
      created.push(n.name)
    }
    for (const t of plan.templates) {
      const items = t.items
        .map((i) => ({
          exerciseId: i.exerciseId ?? newIds.get(i.newKey ?? '') ?? '',
          targetSets: i.targetSets,
          repsMin: i.repsMin,
          repsMax: i.repsMax,
          weightKg: i.weightKg,
          memo: i.memo,
        }))
        .filter((i) => i.exerciseId !== '')
      if (t.id) await db.templates.update(t.id, { name: t.name, items, updatedAt: now })
      else await db.templates.add({ id: crypto.randomUUID(), name: t.name, items, createdAt: now, updatedAt: now })
    }
  })
  setCmdSync({ menuSha: sha, menuAt: Date.now() })
  return { changed: true, menus: menus.length, created }
}

/** アプリを開いたとき：自動がオンで、ノートが変わっていれば読み込む。読み込んだらお知らせの文を返す */
export async function autoPullMenus(): Promise<string | null> {
  const c = getCmdSync()
  if (!c.menuAuto || !isCmdSyncReady(c)) return null
  try {
    const r = await pullMenusFromCmd(true)
    if (!r.changed) return null
    return `Cmd のメニューを読み込みました（${r.menus}件${r.created.length ? `・新しい種目 ${r.created.length}つ` : ''}）`
  } catch {
    return null // 開いたときは静かに失敗する（設定の「メニューを読み込む」で理由が分かる）
  }
}

/** 今のデータを Cmd に保存する。成功したら保存したパスを返す */
export async function pushToCmd(now = Date.now()): Promise<string> {
  const c = getCmdSync()
  if (!isCmdSyncReady(c)) throw new Error('トークンとリポジトリを入れてください')
  const file = await exportBackup(now)
  const path = `${c.dir.replace(/^\/+|\/+$/g, '')}/${backupFileName(now)}`
  const url = `https://api.github.com/repos/${c.repo.trim()}/contents/${path.split('/').map(encodeURIComponent).join('/')}`
  const headers = {
    Authorization: `Bearer ${c.token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  try {
    // 同じ日のファイルがあれば、上書きするために sha が要る
    const head = await fetch(url, { headers, cache: 'no-store' })
    if (!head.ok && head.status !== 404) throw new Error(explain(head.status))
    const sha = head.ok ? ((await head.json()) as { sha?: string }).sha : undefined
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `筋トレメモのバックアップ ${backupFileName(now)}`,
        content: toBase64(JSON.stringify(file, null, 1)),
        ...(sha ? { sha } : {}),
      }),
    })
    if (!res.ok) throw new Error(explain(res.status))
  } catch (e) {
    const message = e instanceof TypeError ? 'つながりませんでした。電波を確認してください' : (e as Error).message
    setCmdSync({ lastError: message })
    throw new Error(message)
  }
  setCmdSync({ lastAt: now, lastError: null })
  return path
}

/** トレーニングを終えたとき：自動がオンなら、裏で保存する（失敗しても記録には影響しない） */
export function autoPushToCmd(): void {
  const c = getCmdSync()
  if (!c.auto || !isCmdSyncReady(c)) return
  void pushToCmd().catch(() => {
    /* lastError に残っているので、設定画面で分かる */
  })
}
