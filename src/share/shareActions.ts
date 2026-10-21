/*
  共有画像の保存と共有
  ・共有：スマホの共有シート（navigator.share）。LINE・Instagram・「画像を保存」などを選べる
      - iPhone は「ボタンを押した直後」でないと共有シートを出せないので、
        画像は先に作っておき、押したらすぐ呼ぶ
  ・保存：ファイルとしてダウンロードする（共有シートが使えないパソコンなど）
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
