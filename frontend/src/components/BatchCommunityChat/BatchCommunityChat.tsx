import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Paperclip, Send, Smile } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type BatchCommunityChatProps = {
  batchId: string
  senderRole: 'student' | 'trainer' | 'admin'
  senderName: string
}

type BatchCommunityMessage = {
  id: string
  batch_id: string
  sender_role: 'student' | 'trainer' | 'admin'
  sender_name: string
  message_text: string | null
  attachment_url: string | null
  attachment_name: string | null
  attachment_size_bytes: number | null
  created_at: string
}

function formatTime(valueIso: string) {
  try {
    const d = new Date(valueIso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return valueIso
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase() || 'U'
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / Math.pow(1024, i)
  const fixed = i === 0 ? 0 : 1
  return `${v.toFixed(fixed)} ${units[i]}`
}

function sanitizeFileName(name: string) {
  // Keep only safe characters for storage paths.
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function hashStringToInt(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function getAvatarColors(key: string) {
  // Palette of "direct" avatar colors (bg + fg) so each sender gets a stable look.
  const palette = [
    { bg: '#dbeafe', fg: '#1d4ed8' }, // blue
    { bg: '#ede9fe', fg: '#6d28d9' }, // purple
    { bg: '#dcfce7', fg: '#15803d' }, // green
    { bg: '#ffedd5', fg: '#c2410c' }, // orange
    { bg: '#ffe4e6', fg: '#be123c' }, // rose
    { bg: '#cffafe', fg: '#0e7490' }, // cyan
    { bg: '#fef9c3', fg: '#854d0e' }, // yellow
    { bg: '#e0e7ff', fg: '#3730a3' }, // indigo
    { bg: '#fae8ff', fg: '#9d174d' }, // magenta
    { bg: '#e0f2fe', fg: '#0369a1' }, // sky
  ]

  const idx = hashStringToInt(key) % palette.length
  return palette[idx]
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function isImageAttachment(url: string | null, name: string | null) {
  const source = `${name ?? ''} ${url ?? ''}`.toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(source)
}

export function BatchCommunityChat({ batchId, senderRole, senderName }: BatchCommunityChatProps) {
  const [messages, setMessages] = useState<BatchCommunityMessage[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(true)
  const [error, setError] = useState<string>('')

  const pageSize = 30
  const olderPageSize = 20
  const maxFileBytes = 25 * 1024 * 1024

  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sendBusy, setSendBusy] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const oldestLoadedCreatedAtRef = useRef<string | null>(null)
  const latestLoadedCreatedAtRef = useRef<string | null>(null)

  const emojis = useMemo(
    () => ['😊', '👍', '🙏', '🔥', '🎉', '👏', '💡', '❓', '✅', '📄', '📝', '📌'],
    [],
  )

  const isAtBottom = () => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 40
  }

  const upsertMessagesChronological = (incoming: BatchCommunityMessage[]) => {
    setMessages((prev) => {
      const byId = new Map<string, BatchCommunityMessage>()
      for (const m of prev) byId.set(m.id, m)
      for (const m of incoming) byId.set(m.id, m)
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
    })
  }

  const loadInitial = async () => {
    setLoadingInitial(true)
    setError('')
    setHasMoreOlder(true)

    const { data, error: loadError } = await supabase
      .from('batch_community_messages')
      .select(
        'id,batch_id,sender_role,sender_name,message_text,attachment_url,attachment_name,attachment_size_bytes,created_at',
      )
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false })
      .limit(pageSize)

    if (loadError) {
      setError(loadError.message)
      setMessages([])
      setLoadingInitial(false)
      return
    }

    const list = (data ?? []) as BatchCommunityMessage[]
    // Convert to ascending so we can render oldest -> newest.
    const sorted = [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    setMessages(sorted)
    oldestLoadedCreatedAtRef.current = sorted[0]?.created_at ?? null
    latestLoadedCreatedAtRef.current = sorted[sorted.length - 1]?.created_at ?? null
    setHasMoreOlder(sorted.length === pageSize)

    setLoadingInitial(false)

    // Auto scroll to bottom after first load.
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    })
  }

  const loadOlder = async () => {
    const oldestCreatedAt = oldestLoadedCreatedAtRef.current
    if (!oldestCreatedAt) return
    if (loadingOlder) return

    setLoadingOlder(true)
    setError('')

    const el = scrollRef.current
    const prevScrollHeight = el?.scrollHeight ?? 0
    const prevScrollTop = el?.scrollTop ?? 0

    const { data, error: olderError } = await supabase
      .from('batch_community_messages')
      .select(
        'id,batch_id,sender_role,sender_name,message_text,attachment_url,attachment_name,attachment_size_bytes,created_at',
      )
      .eq('batch_id', batchId)
      .lt('created_at', oldestCreatedAt)
      .order('created_at', { ascending: false })
      .limit(olderPageSize)

    if (olderError) {
      setError(olderError.message)
      setLoadingOlder(false)
      return
    }

    const list = (data ?? []) as BatchCommunityMessage[]
    const olderSorted = [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

    if (olderSorted.length < olderPageSize) setHasMoreOlder(false)
    oldestLoadedCreatedAtRef.current = olderSorted[0]?.created_at ?? oldestCreatedAt

    upsertMessagesChronological(olderSorted)

    // Preserve scroll position after prepending.
    requestAnimationFrame(() => {
      const nextEl = scrollRef.current
      if (!nextEl) return
      const nextScrollHeight = nextEl.scrollHeight
      nextEl.scrollTop = prevScrollTop + (nextScrollHeight - prevScrollHeight)
      setLoadingOlder(false)
    })
  }

  useEffect(() => {
    void loadInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId])

  useEffect(() => {
    const channel = supabase
      .channel(`batch_community_messages:${batchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'batch_community_messages',
          filter: `batch_id=eq.${batchId}`,
        },
        (payload) => {
          const newRow = payload.new as BatchCommunityMessage | undefined
          if (!newRow) return
          upsertMessagesChronological([newRow])
          if (isAtBottom()) {
            requestAnimationFrame(() => {
              const el = scrollRef.current
              if (!el) return
              el.scrollTop = el.scrollHeight
            })
          }
        },
      )
    let pollingTimer: number | null = null

    const startPolling = () => {
      if (pollingTimer) return
      pollingTimer = window.setInterval(async () => {
        // Poll latest messages and merge; prevents "stuck" chat if realtime is misconfigured.
        try {
          const { data, error: pollError } = await supabase
            .from('batch_community_messages')
            .select(
              'id,batch_id,sender_role,sender_name,message_text,attachment_url,attachment_name,attachment_size_bytes,created_at',
            )
            .eq('batch_id', batchId)
            .order('created_at', { ascending: false })
            .limit(10)

          if (pollError) return
          const list = (data ?? []) as BatchCommunityMessage[]
          if (!list.length) return
          upsertMessagesChronological(list)
          const last = list.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          )[list.length - 1]
          if (last?.created_at) latestLoadedCreatedAtRef.current = last.created_at

          if (isAtBottom()) {
            requestAnimationFrame(() => {
              const el = scrollRef.current
              if (!el) return
              el.scrollTop = el.scrollHeight
            })
          }
        } catch {
          // ignore polling errors
        }
      }, 5000)
    }

    try {
      // `subscribe` provides a status callback; if realtime fails (schema cache, publication, etc.)
      // we fall back to polling.
      channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
          if (pollingTimer) {
            window.clearInterval(pollingTimer)
            pollingTimer = null
          }
        } else if (status === 'CHANNEL_ERROR') {
          startPolling()
        }
      })
    } catch {
      startPolling()
    }

    return () => {
      if (pollingTimer) window.clearInterval(pollingTimer)
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (loadingInitial) return
    if (!hasMoreOlder) return
    if (loadingOlder) return
    // Load older when user scrolls near the top.
    if (el.scrollTop <= 40) {
      void loadOlder()
    }
  }

  const handleSend = async () => {
    if (sendBusy) return
    const trimmed = text.trim()
    if (!trimmed && !file) return

    setSendBusy(true)
    setError('')

    let attachmentUrl: string | null = null
    let attachmentName: string | null = null
    let attachmentSizeBytes: number | null = null

    try {
      if (file) {
        if (file.size > maxFileBytes) {
          throw new Error(`File too large. Max size is ${formatBytes(maxFileBytes)}.`)
        }

        const safeName = sanitizeFileName(file.name)
        const objectPath = `batch-${batchId}/${Date.now()}-${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('batch-community-chat')
          .upload(objectPath, file, { upsert: false })

        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage.from('batch-community-chat').getPublicUrl(objectPath)
        attachmentUrl = publicData.publicUrl ?? null
        attachmentName = file.name
        attachmentSizeBytes = file.size
      }

      const payload = {
        batch_id: batchId,
        sender_role: senderRole,
        sender_name: senderName,
        message_text: trimmed ? trimmed : null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_size_bytes: attachmentSizeBytes,
      }

      const { error: insertError } = await supabase.from('batch_community_messages').insert(payload)
      if (insertError) throw insertError

      setText('')
      setFile(null)
      setEmojiOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send message.')
    } finally {
      setSendBusy(false)
    }
  }

  return (
    <div className="batch-community-layout">
      <section className="batch-community-chat">
        <div className="batch-community-messages" ref={scrollRef} onScroll={handleScroll}>
          {loadingInitial ? <div className="batch-community-loading">Loading...</div> : null}
          {error ? <div className="batch-community-error">{error}</div> : null}

          {messages.map((m) => {
            const isTrainer = m.sender_role === 'trainer'
            // Normalize to avoid mismatch due to casing/extra spaces from DB vs current profile.
            const isMe = m.sender_role === senderRole && normalizeName(m.sender_name) === normalizeName(senderName)
            const initials = getInitials(m.sender_name)
            const avatarColors = getAvatarColors(`${m.sender_role}:${m.sender_name}`)
            const hasImageAttachment = isImageAttachment(m.attachment_url, m.attachment_name)
            return (
              <div
                key={m.id}
                className={`batch-community-msg ${isTrainer ? 'is-trainer' : ''} ${isMe ? 'is-me' : ''}`}
              >
                <div
                  className="batch-community-msg-avatar"
                  aria-hidden="true"
                  style={{ backgroundColor: avatarColors.bg, color: avatarColors.fg }}
                >
                  {initials}
                </div>
                <div className="batch-community-msg-body">
                  <div className="batch-community-msg-meta">
                    <span className="batch-community-msg-name">{m.sender_name}</span>
                    {isTrainer ? <span className="batch-community-trainer-badge">Trainer</span> : null}
                    <span className="batch-community-msg-time">{formatTime(m.created_at)}</span>
                  </div>

                  {m.message_text ? <div className="batch-community-msg-text">{m.message_text}</div> : null}

                  {m.attachment_url && hasImageAttachment ? (
                    <a
                      className="batch-community-attachment-image-link"
                      href={m.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        className="batch-community-attachment-image"
                        src={m.attachment_url}
                        alt={m.attachment_name ?? 'Image attachment'}
                        loading="lazy"
                      />
                    </a>
                  ) : null}

                  {m.attachment_url && !hasImageAttachment ? (
                    <a
                      className="batch-community-attachment"
                      href={m.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={16} />
                      <div className="batch-community-attachment-meta">
                        <div className="batch-community-attachment-name">{m.attachment_name ?? 'Attachment'}</div>
                        {m.attachment_size_bytes ? (
                          <div className="batch-community-attachment-size">{formatBytes(m.attachment_size_bytes)}</div>
                        ) : null}
                      </div>
                    </a>
                  ) : null}
                </div>
              </div>
            )
          })}

          {loadingOlder ? <div className="batch-community-loading older">Loading more...</div> : null}
        </div>

        <div className="batch-community-input-wrap">
          <div className="batch-community-input-bar">
            <button
              type="button"
              className="batch-community-icon-btn"
              onClick={() => {
                const input = document.getElementById('batch-community-file-input') as HTMLInputElement | null
                input?.click()
              }}
              aria-label="Attach file"
              disabled={sendBusy}
            >
              <Paperclip size={18} />
            </button>
            <input
              id="batch-community-file-input"
              type="file"
              className="batch-community-hidden-file"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null
                setFile(selected)
              }}
            />

            <button
              type="button"
              className="batch-community-icon-btn"
              onClick={() => setEmojiOpen((prev) => !prev)}
              aria-label="Pick emoji"
              disabled={sendBusy}
            >
              <Smile size={18} />
            </button>

            {emojiOpen ? (
              <div className="batch-community-emoji-popover">
                {emojis.map((em) => (
                  <button
                    key={em}
                    type="button"
                    className="batch-community-emoji-btn"
                    onClick={() => setText((prev) => `${prev}${em}`)}
                  >
                    {em}
                  </button>
                ))}
              </div>
            ) : null}

            <textarea
              className="batch-community-textarea"
              placeholder="Type your message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              disabled={sendBusy}
            />

            {file ? (
              <div className="batch-community-file-pill">
                <div className="batch-community-file-pill-name">{file.name}</div>
                <button type="button" onClick={() => setFile(null)} aria-label="Remove file">
                  Remove
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="batch-community-send-btn"
              onClick={() => void handleSend()}
              disabled={sendBusy || (!text.trim() && !file)}
            >
              <Send size={16} />
              Send
            </button>
          </div>
        </div>

        {/* Scroll/pagination handler */}
        <div style={{ display: 'none' }} />
      </section>

      <aside className="batch-community-guidelines">
        <h4>Community Guidelines</h4>
        <ul>
          <li>Be respectful and supportive</li>
          <li>Ask relevant questions</li>
          <li>Avoid personal information</li>
          <li>No spam or self-promotion</li>
          <li>Help others and share knowledge</li>
        </ul>
        <div className="batch-community-info-box">
          By participating in the community, you agree to follow these guidelines.
        </div>
      </aside>
    </div>
  )
}

