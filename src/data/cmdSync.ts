import { exportBackup } from './backup'
import { backupFileName } from './backupFormat'

/*
  Cmd（GitHub のリポジトリ）に保存する
  ・バックアップ（JSON）を、GitHub の API で Cmd の Data/kintore/ に置く
  ・トークンはこの端末の localStorage にだけ保存する
    （設定テーブルに入れると、書き出したバックアップにトークンが入ってしまうので入れない）
  ・使うトークン：Fine-grained personal access token。対象は Cmd だけ、Contents の Read and write
  ・同じ日に何回保存しても、その日のファイル1つを上書きする
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
}

export const DEFAULT_CMD_SYNC: CmdSync = {
  token: '',
  repo: 'keigo29/Cmd',
  dir: 'Data/kintore',
  auto: true,
  lastAt: null,
  lastError: null,
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
