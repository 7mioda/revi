'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef, useState } from 'react'

type CompletedData = {
  name: string
  purpose: string
  githubToken: string
}

export default function OnboardingChat() {
  const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat({
    api: '/api/onboarding',
  })

  const bottomRef = useRef<HTMLDivElement>(null)
  const [completed, setCompleted] = useState<CompletedData | null>(null)
  const [isTokenStep, setIsTokenStep] = useState(false)
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

  // Detect completion via tool invocation and token step via last AI message
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.toolInvocations) {
        for (const inv of msg.toolInvocations) {
          if (inv.toolName === 'complete_onboarding') {
            const args = inv.args as CompletedData
            setCompleted(args)
            return
          }
        }
      }
    }

    // Detect token step: last assistant message mentions "token"
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant && typeof lastAssistant.content === 'string') {
      setIsTokenStep(/token/i.test(lastAssistant.content))
    }
  }, [messages])

  if (completed) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight">You're all set, {completed.name}.</h1>
          <p className="max-w-sm text-gray-400">
            Revi is ready to learn your review style. We'll analyze your GitHub comments and build
            your voice profile.
          </p>
        </div>
      </main>
    )
  }

  const visibleMessages = messages.filter(
    (m) => !(m.role === 'user' && m.content === '__init__'),
  )

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-8 pb-40">
        <div className="mx-auto w-full max-w-xl space-y-4">
          {visibleMessages.map((msg) => {
            if (msg.role === 'assistant' && msg.toolInvocations?.length) return null
            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-white text-black'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  {typeof msg.content === 'string' ? msg.content : null}
                </div>
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
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl gap-2">
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
    </main>
  )
}
