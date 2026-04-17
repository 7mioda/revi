'use client'

import { useChat } from 'ai/react'
import type { ToolInvocation } from 'ai'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

const PURPOSE_OPTIONS = [
  'I want to review PRs more consistently across my team',
  'I want to share my review style so others can learn from it',
  'I want faster, more thorough code reviews',
  "I'm curious what patterns show up in my review history",
]

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG)                                                */
/* ------------------------------------------------------------------ */

function SendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <g clipPath="url(#send-clip)">
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
        <clipPath id="send-clip">
          <rect width="12" height="10" fill="currentColor" transform="matrix(0 -1 1 0 7 18)"/>
        </clipPath>
      </defs>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-[spin_1s_linear_infinite]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function maskIfToken(content: string): string {
  return /^(ghp_|github_pat_|ghs_|gho_|ghu_)\S+/.test(content.trim())
    ? '••••••••••••••••••••'
    : content
}

function toolLabel(inv: ToolInvocation): { text: string; running: boolean } | null {
  const running = inv.state === 'call' || inv.state === 'partial-call'
  if (!running && inv.state === 'result' && (inv.result as { error?: unknown } | undefined)?.error) {
    return null
  }
  switch (inv.toolName) {
    case 'fetch_comments':
      return { text: running ? 'Fetching your GitHub comments' : 'Comments fetched', running }
    case 'generate_skills':
      return { text: running ? 'Building your skill profile' : 'Skill profile ready', running }
    case 'review_pr':
      return { text: running ? 'Reviewing pull request' : 'Review posted', running }
    default:
      return { text: inv.toolName, running }
  }
}


/* ------------------------------------------------------------------ */
/*  Pixel loader                                                      */
/* ------------------------------------------------------------------ */

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
        {LOADER_FRAMES[f].map((row, y) =>
          row.map((on, x) =>
            on ? <rect key={`${x}${y}`} x={x * (LOADER_PX + LOADER_GAP)} y={y * (LOADER_PX + LOADER_GAP)} width={LOADER_PX} height={LOADER_PX} fill="#000" /> : null
          )
        )}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function OnboardingChat() {
  const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat({
    api: '/api/onboarding',
  })

  const bottomRef = useRef<HTMLDivElement>(null)
  const [isTokenStep, setIsTokenStep] = useState(false)
  const [isPurposeStep, setIsPurposeStep] = useState(false)
  const hasGreeted = useRef(false)

  // Trigger initial AI greeting on mount
  useEffect(() => {
    if (hasGreeted.current) return
    hasGreeted.current = true
    void append({ role: 'user', content: '__init__' })
  }, [append])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Detect current step from last assistant message
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant && typeof lastAssistant.content === 'string') {
      const text = lastAssistant.content
      setIsTokenStep(/token/i.test(text))
      // Only show purpose buttons if there are at least 2 user messages (name was already given)
      const userMessageCount = messages.filter((m) => m.role === 'user' && m.content !== '__init__').length
      setIsPurposeStep(
        userMessageCount >= 1 &&
        /brings you|hoping.*help|help.*you/i.test(text) &&
        !/token/i.test(text)
      )
    }
  }, [messages])

  function selectOption(option: string) {
    void append({ role: 'user', content: option })
  }

  const visibleMessages = messages.filter(
    (m) => !(m.role === 'user' && m.content === '__init__'),
  )

  return (
    <main className="flex min-h-screen flex-col bg-white font-[var(--font-inter)]">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center px-6">
        <svg width="30" height="30" viewBox="0 0 100 100" fill="none" shapeRendering="crispEdges" aria-label="Revi">
          <rect x="19" y="59" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="19" y="75" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="19" y="11" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="35" y="11" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="19" y="27" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="19" y="43" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="35" y="43" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="51" y="11" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="67" y="27" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="51" y="43" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="51" y="59" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="67" y="43" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="67" y="75" width="14.125" height="14.125" fill="#2F3030"/>
          <rect x="67" y="11" width="14.125" height="14.125" fill="#2F3030"/>
        </svg>
      </header>

      {/* Messages */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-44">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {visibleMessages.map((msg) => {
            const textContent = typeof msg.content === 'string' ? msg.content : null
            const invocations = msg.toolInvocations ?? []

            return (
              <div
                key={msg.id}
                className="flex flex-col gap-2"
                style={{ animation: 'message-in 0.3s ease-out' }}
              >
                {msg.role === 'assistant' && textContent && isLoading && msg.id === visibleMessages[visibleMessages.length - 1]?.id && (
                  <div className="flex justify-start">
                    <PixelLoader />
                  </div>
                )}
                {textContent && (
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] text-base leading-relaxed ${
                        msg.role === 'user'
                          ? 'rounded-2xl bg-gray-100 px-4 py-2.5 text-gray-900 font-[var(--font-inter)]'
                          : 'text-gray-800 font-[var(--font-inter)]'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <Markdown
                            components={{
                              h1: 'span', h2: 'span', h3: 'span', h4: 'span', h5: 'span', h6: 'span',
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
                              li: ({ children }) => <li className="mb-0.5">{children}</li>,
                              code: ({ children }) => <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">{children}</code>,
                              pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded-lg bg-gray-100 p-3 text-sm last:mb-0">{children}</pre>,
                              a: ({ href, children }) => <a href={href} className="underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            }}
                          >
                            {textContent}
                          </Markdown>
                        </div>
                      ) : maskIfToken(textContent)}
                    </div>
                  </div>
                )}
                {invocations.map((inv) => {
                  const status = toolLabel(inv)
                  if (!status) return null
                  return (
                    <div key={inv.toolCallId} className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
                        {status.running ? (
                          <span className="text-gray-900"><SpinnerIcon /></span>
                        ) : (
                          <span className="text-gray-900"><CheckIcon /></span>
                        )}
                        {status.text}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {isLoading && !visibleMessages.some(m => m.role === 'assistant' && m.id === visibleMessages[visibleMessages.length - 1]?.id && typeof m.content === 'string' && m.content) && (
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
          {/* Purpose quick-select */}
          {isPurposeStep && !isLoading && (
            <div className="mb-4 flex flex-col gap-1">
              {PURPOSE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => selectOption(opt)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-base text-gray-900 transition-colors hover:bg-gray-50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M4 5v6a4 4 0 0 0 4 4h8" />
                    <polyline points="13 11 17 15 13 19" />
                  </svg>
                  {opt}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex min-h-14 items-center gap-2 rounded-xl border border-gray-200 bg-white pl-4 pr-3 py-3 transition-colors hover:border-gray-300">
            {isTokenStep && (
              <span className="text-gray-300"><LockIcon /></span>
            )}
            <input
              type={isTokenStep ? 'password' : 'text'}
              value={input}
              onChange={handleInputChange}
              placeholder={isTokenStep ? 'ghp_••••••••••••' : 'Reply'}
              disabled={isLoading}
              autoComplete={isTokenStep ? 'off' : 'on'}
              className="flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-black text-white transition-all hover:bg-gray-800 disabled:opacity-30"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
