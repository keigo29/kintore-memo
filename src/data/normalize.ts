/** 検索や重なりチェック用に、文字を揃える：全角英数→半角、ひらがな→カタカナ、大文字→小文字、空白を消す */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .toLowerCase()
    .replace(/\s+/g, '')
}
