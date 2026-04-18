'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG)                                                */
/* ------------------------------------------------------------------ */

function SendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <g clipPath="url(#send-clip-p)">
        <path d="M10.9507 18H12.9414V16.0052H10.9507V18Z" fill="currentColor"/>
        <path d="M10.9507 16.0206H12.9414V14.0258H10.9507V16.0206Z" fill="currentColor"/>
        <path d="M10.9507 14.0412H12.9414V12.0464H10.9507V14.0412Z" fill="currentColor"/>
        <path d="M10.9507 12.0619H12.9414V10.067H10.9507V12.0619Z" fill="currentColor"/>
        <path d="M8.97508 10.0825H10.9658V8.08763H8.97508V10.0825Z" fill="currentColor"/>
        <path d="M12.9263 10.0825H14.917V8.08763H12.9263V10.0825Z" fill="currentColor"/>
        <path d="M7.00047 12.0619H8.99121V10.067H7.00047V12.0619Z" fill="currentColor"/>
        <path d="M14.9009 12.0619H16.8916V10.067H14.9009V12.0619Z" fill="currentColor"/>
        <path d="M10.9507 8.10309H12.9414V6.10825H10.9507V8.10309Z" fill="currentColor"/>
      </g>
      <defs>
        <clipPath id="send-clip-p">
          <rect width="12" height="10" fill="currentColor" transform="matrix(0 -1 1 0 7 18)"/>
        </clipPath>
      </defs>
    </svg>
  )
}

const LOADER_PX = 3
const LOADER_GAP = 2
const LOADER_FRAMES = [
  [[1,1,1],[0,0,1],[0,0,0]],
  [[0,0,1],[0,0,1],[0,0,1]],
  [[0,0,0],[0,0,1],[1,1,1]],
  [[0,0,0],[1,0,0],[1,1,1]],
  [[1,0,0],[1,0,0],[1,0,0]],
  [[1,1,1],[1,0,0],[0,0,0]],
]

function PixelLoader() {
  const [f, setF] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setF(i => (i + 1) % LOADER_FRAMES.length), 120)
    return () => clearInterval(id)
  }, [])
  const s = 3 * LOADER_PX + 2 * LOADER_GAP
  return (
    <div className="flex items-center px-1 py-2">
      <svg width={s} height={s}>
        {LOADER_FRAMES[f]?.map((row, y) =>
          row.map((on, x) =>
            on ? <rect key={`${x}${y}`} x={x * (LOADER_PX + LOADER_GAP)} y={y * (LOADER_PX + LOADER_GAP)} width={LOADER_PX} height={LOADER_PX} fill="#000" /> : null
          )
        )}
      </svg>
    </div>
  )
}

const mdComponents: React.ComponentProps<typeof Markdown>['components'] = {
  h1: 'span', h2: 'span', h3: 'span', h4: 'span', h5: 'span', h6: 'span',
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 text-sm">{children}</code>,
  pre: ({ children }) => <pre className="mb-2 overflow-x-auto bg-gray-100 p-3 text-sm last:mb-0">{children}</pre>,
  a: ({ href, children }) => <a href={href} className="underline" target="_blank" rel="noopener noreferrer">{children}</a>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
}

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface PersonaProfile {
  username: string
  name: string | null
  avatarUrl: string | null
}

interface Props {
  profile: PersonaProfile
}

/* ------------------------------------------------------------------ */
/*  PersonaChat                                                       */
/* ------------------------------------------------------------------ */

export default function PersonaChat({ profile }: Props) {
  const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat({
    api: '/api/persona',
    body: { username: profile.username },
  })

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasInited = useRef(false)

  // Auto-send __init__ to trigger the persona's greeting
  useEffect(() => {
    if (hasInited.current) return
    hasInited.current = true
    void append({ role: 'user', content: '__init__' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const visibleMessages = messages.filter(
    (m) => !(m.role === 'user' && m.content === '__init__'),
  )

  const displayName = profile.name ?? `@${profile.username}`

  return (
    <main
      className="flex min-h-screen flex-col bg-white font-[var(--font-inter)]"
      style={{ animation: 'message-in 0.3s ease-out' }}
    >
      {/* Header — profile avatar instead of logo */}
      <header className="flex h-14 shrink-0 items-center gap-3 px-6">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={displayName}
            width={28}
            height={28}
            className="shrink-0 object-cover"
          />
        ) : (
          <div className="h-7 w-7 shrink-0 bg-gray-200" />
        )}
        <span className="text-sm font-medium text-gray-900">{displayName}</span>
      </header>

      {/* Messages */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-44">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {visibleMessages.map((msg) => {
            const textContent = typeof msg.content === 'string' ? msg.content : null
            return (
              <div
                key={msg.id}
                className="flex flex-col gap-2"
                style={{ animation: 'message-in 0.3s ease-out' }}
              >
                {textContent && (
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] text-base leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-gray-100 px-4 py-2.5 text-gray-900 font-[var(--font-inter)]'
                          : 'text-gray-800 font-[var(--font-inter)]'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <Markdown components={mdComponents}>{textContent}</Markdown>
                        </div>
                      ) : textContent}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {isLoading && !visibleMessages.some(
            (m) => m.role === 'assistant' &&
              m.id === visibleMessages[visibleMessages.length - 1]?.id &&
              typeof m.content === 'string' && m.content,
          ) && (
            <div
              className="flex justify-start"
              style={{ animation: 'message-in 0.3s ease-out' }}
            >
              <PixelLoader />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pb-6 pt-4">
        <div className="mx-auto max-w-2xl">
          <form
            onSubmit={handleSubmit}
            className="flex min-h-14 items-center gap-2 border border-gray-200 bg-white pl-4 pr-3 py-3 transition-colors hover:border-gray-300"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Reply"
              disabled={isLoading}
              className="flex-1 bg-transparent h-10 text-base text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center bg-black text-white transition-all hover:bg-gray-800 disabled:opacity-30"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
