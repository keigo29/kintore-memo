import { useCallback, useEffect, useState } from 'react'

// 画面の下の中央に短いお知らせを出す
export function useToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const id = setTimeout(() => setMessage(null), 2200)
    return () => clearTimeout(id)
  }, [message])

  const show = useCallback((text: string) => setMessage(text), [])

  const node = message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null

  return { show, node }
}
