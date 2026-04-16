'use client'

import { useChat } from 'ai/react'
import type { ToolInvocation } from 'ai'
import { useEffect, useRef, useState } from 'react'

const PURPOSE_OPTIONS = [
  'I want to review PRs more consistently across my team',
  'I want to share my review style so others can learn from it',
  'I want faster, more thorough code reviews',
  "I'm curious what patterns show up in my review history",
]

function toolLabel(inv: ToolInvocation): string | null {
  const running = inv.state === 'call' || inv.state === 'partial-call'
  if (!running && inv.state === 'result' && (inv.result as { error?: unknown } | undefined)?.error) {
    return null
  }
  switch (inv.toolName) {
    case 'fetch_comments':
      return running ? 'Fetching your GitHub comments...' : 'Comments fetched'
    case 'generate_skills':
      return running ? 'Building your skill profile...' : 'Skill profile ready'
    case 'review_pr':
      return running ? 'Reviewing pull request...' : 'Review posted'
    default:
      return inv.toolName
  }
}

/** Minimal inline markdown: bold and italic only. */
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

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
      setIsPurposeStep(/brings you|hoping.*help|help.*you/i.test(text) && !/token/i.test(text))
    }
  }, [messages])

  function selectOption(option: string) {
    void append({ role: 'user', content: option })
  }

  const visibleMessages = messages.filter(
    (m) => !(m.role === 'user' && m.content === '__init__'),
  )

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-8 pb-40">
        <div className="mx-auto w-full max-w-xl space-y-3">
          {visibleMessages.map((msg) => {
            const textContent = typeof msg.content === 'string' ? msg.content : null
            const invocations = msg.toolInvocations ?? []

            return (
              <div key={msg.id} className="flex flex-col gap-2">
                {textContent && (
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-white text-black'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      {msg.role === 'assistant' ? renderMarkdown(textContent) : textContent}
                    </div>
                  </div>
                )}
                {invocations.map((inv) => {
                  const label = toolLabel(inv)
                  if (label === null) return null
                  return (
                    <div key={inv.toolCallId} className="flex justify-start">
                      <div className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-400">
                        {label}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-800 px-4 py-2.5 text-sm text-gray-400">
                <span className="animate-pulse">···</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-black px-4 py-4">
        <div className="mx-auto max-w-xl">
          {isPurposeStep && !isLoading && (
            <div className="mb-3 flex flex-wrap gap-2">
              {PURPOSE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => selectOption(opt)}
                  className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type={isTokenStep ? 'password' : 'text'}
              value={input}
              onChange={handleInputChange}
              placeholder={isTokenStep ? 'ghp_••••••••••••••••' : 'Type a message…'}
              disabled={isLoading}
              autoComplete={isTokenStep ? 'off' : 'on'}
              className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition-opacity disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
