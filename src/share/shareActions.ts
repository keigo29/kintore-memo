/*
  共有画像の保存と共有
  ・共有：スマホの共有シート（navigator.share）。LINE・Instagram・「画像を保存」などを選べる
      - iPhone は「ボタンを押した直後」でないと共有シートを出せないので、
        画像は先に作っておき、押したらすぐ呼ぶ
  ・保存：
      - iPhone・iPad：ダウンロードすると「ファイル」アプリに入ってしまい、写真（カメラロール）に入らない
        → 共有シートを開く。シートの「画像を保存」で写真アプリに入る
      - Android：ダウンロードすると、ギャラリー（フォト）の「Download」に入る
      - パソコン：ファイルとしてダウンロード
*/

/** ファイル名：kintore-memo-2026-10-21.png */
export function shareFileName(day: string): string {
  return `kintore-memo-${day}.png`
}

/** この端末で、画像ファイルの共有ができるか */
export function canShareImage(): boolean {
  try {
    const probe = new File([new Blob()], 'probe.png', { type: 'image/png' })
    return typeof navigator.share === 'function' && navigator.canShare?.({ files: [probe] }) === true
  } catch {
    return false
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'failed'

export async function shareImage(blob: Blob, fileName: string): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: 'image/png' })
  try {
    await navigator.share({ files: [file], title: '筋トレメモ' })
    return 'shared'
  } catch (e) {
    // 共有シートを閉じただけのときは AbortError
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

/** iPhone・iPad か（iPad は「Mac」と名乗るので、タッチできるかでも見る） */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

/**
 * 写真（カメラロール）に保存する：iPhone では共有シートを開く
 * ・題名などを付けず画像だけ渡すと、シートのいちばん上に「画像を保存」が出る
 */
export async function saveToPhotos(blob: Blob, fileName: string): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: 'image/png' })
  try {
    await navigator.share({ files: [file] })
    return 'shared'
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

export function saveImage(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // すぐ消すと保存が始まらない端末があるので、少し待ってから消す
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
