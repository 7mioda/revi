'use client'

import { useChat } from '@ai-sdk/react'
import type { ToolInvocation } from 'ai'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { ArrowRightIcon, CheckIcon, LockIcon, SendIcon, SpinnerIcon } from './icons'
import { mdComponents } from './markdown'
import { PixelLoader } from './pixel-loader'
import { ProfilePickerTool } from './tools/profile-picker'
import { SyncSkillsTool } from './tools/sync-skills'
import { useClerk } from '@clerk/nextjs'
import { ChatInput, type ChatInputHandle } from './chat-input'
import { CommandsPlugin } from './commands-plugin'
import { ProfileMentionsPlugin } from './profile-mentions-plugin'

type PersonaProfile = {
  username: string
  name: string | null
  avatarUrl: string | null
}

type MentionPersona = {
  username: string
  name: string | null
  avatarUrl: string | null
  avatar: string | null
}

/** Pull the persona info the API attached to an assistant message. */
function getMentionPersona(msg: { annotations?: unknown[] }): MentionPersona | null {
  const ann = msg.annotations
  if (!Array.isArray(ann)) return null
  for (const a of ann) {
    if (!a || typeof a !== 'object') continue
    const maybe = (a as { persona?: unknown }).persona
    if (!maybe || typeof maybe !== 'object') continue
    const p = maybe as Partial<MentionPersona>
    if (typeof p.username === 'string') {
      return {
        username: p.username,
        name: typeof p.name === 'string' ? p.name : null,
        avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl : null,
        avatar: typeof p.avatar === 'string' ? p.avatar : null,
      }
    }
  }
  return null
}

const PURPOSE_OPTIONS = [
  'I want to review PRs more consistently across my team',
  'I want to share my review style so others can learn from it',
  'I want faster, more thorough code reviews',
  "I'm curious what patterns show up in my review history",
]

function maskIfToken(content: string): string {
  return /^(ghp_|github_pat_|ghs_|gho_|ghu_)\S+/.test(content.trim())
    ? '••••••••••••••••••••'
    : content
}

function toolLabel(inv: ToolInvocation): { text: string; running: boolean } | null {
  const running = inv.state === 'call' || inv.state === 'partial-call'
  if (!running && inv.state === 'result' && (inv.result as { error?: unknown } | undefined)?.error) return null
  switch (inv.toolName) {
    case 'fetch_comments': return { text: running ? 'Fetching your GitHub comments' : 'Comments fetched', running }
    case 'generate_skills': return { text: running ? 'Building your skill profile' : 'Skill profile ready', running }
    case 'review_pr': return { text: running ? 'Reviewing pull request' : 'Review posted', running }
    case 'pick_profile':
    case 'sync_skills':
    case 'pick_persona': return null
    default: return { text: inv.toolName, running }
  }
}

function ReviLogo() {
  return (
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
  )
}

export default function Chat() {
  const { signOut } = useClerk()

  const {
    messages,
    input: mainInput,
    setInput: setMainInput,
    handleSubmit: mainHandleSubmit,
    append,
    status: mainStatus,
    addToolResult,
  } = useChat({ api: '/api/chat' })

  const [personaProfile, setPersonaProfile] = useState<PersonaProfile | null>(null)

  const {
    messages: personaMessages,
    input: personaInput,
    setInput: setPersonaInput,
    handleSubmit: personaHandleSubmit,
    append: personaAppend,
    status: personaStatus,
  } = useChat({
    api: '/api/persona',
    body: { username: personaProfile?.username ?? '' },
  })

  const hasPersonaInited = useRef(false)

  useEffect(() => {
    if (!personaProfile || hasPersonaInited.current) return
    hasPersonaInited.current = true
    void personaAppend({ role: 'user', content: '__init__' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaProfile])

  const mainIsLoading = mainStatus === 'submitted' || mainStatus === 'streaming'
  const personaIsLoading = personaStatus === 'submitted' || personaStatus === 'streaming'
  const isLoading = mainIsLoading || personaIsLoading
  const input = personaProfile ? personaInput : mainInput
  const setInput = personaProfile ? setPersonaInput : setMainInput
  const handleSubmit = personaProfile ? personaHandleSubmit : mainHandleSubmit

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<ChatInputHandle>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [isTokenStep, setIsTokenStep] = useState(false)
  const [isPurposeStep, setIsPurposeStep] = useState(false)
  const hasGreeted = useRef(false)

  const [introPhase, setIntroPhase] = useState<'streaming' | 'ready' | 'done'>('streaming')
  const [introVisible, setIntroVisible] = useState(true)

  useEffect(() => {
    if (hasGreeted.current) return
    hasGreeted.current = true
    void append({ role: 'user', content: '__init__' })
  }, [append])

  useEffect(() => {
    if (introPhase === 'done') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, personaMessages, introPhase])

  useEffect(() => {
    if (introPhase === 'streaming' && !isLoading && visibleMessages.some((m) => m.role === 'assistant')) {
      setIntroPhase('ready')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, introPhase, messages])

  useEffect(() => {
    if (introPhase === 'done') {
      // slight delay so the editor has mounted before focusing
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [introPhase])

  useEffect(() => {
    if (introPhase !== 'done') return
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant && typeof lastAssistant.content === 'string') {
      const text = lastAssistant.content
      setIsTokenStep(/token/i.test(text))
      const userMessageCount = messages.filter((m) => m.role === 'user' && m.content !== '__init__').length
      setIsPurposeStep(
        userMessageCount >= 1 &&
        /brings you|hoping.*help|help.*you/i.test(text) &&
        !/token/i.test(text),
      )
    }
  }, [messages, introPhase])

  function handleExecuteCommand(command: string) {
    if (command === 'logout') void signOut()
  }

  function handleStartChat(message?: string) {
    setIntroVisible(false)
    setTimeout(() => {
      setIntroPhase('done')
      if (message) void append({ role: 'user', content: message })
    }, 300)
  }

  const visibleMessages = messages.filter((m) => !(m.role === 'user' && m.content === '__init__'))
  const visiblePersonaMessages = personaMessages.filter((m) => !(m.role === 'user' && m.content === '__init__'))
  const allVisibleMessages = [
    ...visibleMessages.map((m) => ({ msg: m, source: 'main' as const })),
    ...visiblePersonaMessages.map((m) => ({ msg: m, source: 'persona' as const })),
  ]

  const firstAssistantText = (() => {
    const msg = visibleMessages.find((m) => m.role === 'assistant')
    return typeof msg?.content === 'string' ? msg.content : null
  })()

  /* ── Intro phase ────────────────────────────────────────────────── */
  if (introPhase !== 'done') {
    return (
      <main className={`min-h-screen flex items-center justify-center bg-white px-8 font-[var(--font-inter)] transition-opacity duration-300 ${introVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-full max-w-2xl">
          {firstAssistantText ? (
            <div className="text-base leading-relaxed text-gray-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" style={{ animation: 'intro-fade-in 1.2s ease-out' }}>
              <Markdown components={mdComponents}>{firstAssistantText}</Markdown>
            </div>
          ) : (
            <PixelLoader />
          )}
          <div className={`mt-8 flex items-center justify-between transition-opacity duration-500 ${introPhase === 'ready' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="flex gap-3">
              <button type="button" onClick={() => handleStartChat('I want to review a PR')} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900">
                Review a PR
              </button>
              <button type="button" onClick={() => handleStartChat('I want to upload my skills')} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900">
                Build my profile
              </button>
            </div>
            <button type="button" onClick={() => handleStartChat('I want to talk')} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900">
              Talk <ArrowRightIcon />
            </button>
          </div>
        </div>
      </main>
    )
  }

  /* ── Chat phase ─────────────────────────────────────────────────── */
  return (
    <main className="flex min-h-screen flex-col bg-white font-[var(--font-inter)]" style={{ animation: 'message-in 0.3s ease-out' }}>
      <header className="flex h-14 shrink-0 items-center px-6">
        <ReviLogo />
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-44">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {allVisibleMessages.map(({ msg, source }) => {
            const textContent = typeof msg.content === 'string' ? msg.content : null
            const invocations = msg.toolInvocations ?? []
            const mentionPersona = source === 'main' && msg.role === 'assistant' ? getMentionPersona(msg) : null
            const isPersonaAssistant =
              (source === 'persona' && msg.role === 'assistant') || !!mentionPersona
            const avatarSrc = mentionPersona
              ? (mentionPersona.avatar ?? mentionPersona.avatarUrl)
              : (personaProfile?.avatarUrl ?? null)
            const avatarAlt = mentionPersona
              ? (mentionPersona.name ?? mentionPersona.username)
              : (personaProfile?.name ?? personaProfile?.username ?? '')

            return (
              <div key={`${source}-${msg.id}`} className="flex flex-col gap-2" style={{ animation: 'message-in 0.3s ease-out' }}>
                {textContent && (
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {isPersonaAssistant && (
                      <div className="mr-2 mt-0.5 shrink-0">
                        {avatarSrc ? (
                          <Image src={avatarSrc} alt={avatarAlt} width={24} height={24} className="object-cover" />
                        ) : (
                          <div className="h-6 w-6 bg-gray-200" />
                        )}
                      </div>
                    )}
                    <div className={`max-w-[75%] text-base leading-relaxed ${msg.role === 'user' ? 'bg-gray-100 px-4 py-2.5 text-gray-900' : 'text-gray-800'}`}>
                      {msg.role === 'assistant' ? (
                        <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <Markdown components={mdComponents}>{textContent}</Markdown>
                        </div>
                      ) : maskIfToken(textContent)}
                    </div>
                  </div>
                )}
                {invocations.map((inv) => {
                  if (inv.toolName === 'pick_profile' && inv.state === 'call') {
                    return (
                      <div key={inv.toolCallId} className="flex justify-start">
                        <div className="w-full max-w-[75%]">
                          <ProfilePickerTool toolCallId={inv.toolCallId} addToolResult={addToolResult} />
                        </div>
                      </div>
                    )
                  }
                  if (inv.toolName === 'pick_persona' && inv.state === 'call') {
                    return (
                      <div key={inv.toolCallId} className="flex justify-start">
                        <div className="w-full max-w-[75%]">
                          <ProfilePickerTool
                            toolCallId={inv.toolCallId}
                            addToolResult={addToolResult}
                            onSelect={(p) => setPersonaProfile({ username: p.username, name: p.name, avatarUrl: p.avatarUrl })}
                          />
                        </div>
                      </div>
                    )
                  }
                  if (inv.toolName === 'sync_skills' && inv.state === 'call') {
                    return (
                      <div key={inv.toolCallId} className="flex justify-start">
                        <div className="w-full max-w-[75%]">
                          <SyncSkillsTool toolCallId={inv.toolCallId} addToolResult={addToolResult} />
                        </div>
                      </div>
                    )
                  }
                  if (inv.toolName === 'pick_profile' || inv.toolName === 'sync_skills' || inv.toolName === 'pick_persona') return null
                  const label = toolLabel(inv)
                  if (!label) return null
                  return (
                    <div key={inv.toolCallId} className="flex justify-start">
                      <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
                        <span className="text-gray-900">{label.running ? <SpinnerIcon /> : <CheckIcon />}</span>
                        {label.text}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {isLoading && !allVisibleMessages.some(({ msg }) =>
            msg.role === 'assistant' &&
            msg.id === allVisibleMessages[allVisibleMessages.length - 1]?.msg.id &&
            typeof msg.content === 'string' && msg.content
          ) && (
            <div className="flex justify-start" style={{ animation: 'message-in 0.3s ease-out' }}>
              {personaIsLoading && personaProfile ? (
                <div className="flex items-center gap-2">
                  {personaProfile.avatarUrl ? (
                    <Image src={personaProfile.avatarUrl} alt={personaProfile.name ?? personaProfile.username} width={24} height={24} className="shrink-0 object-cover" />
                  ) : (
                    <div className="h-6 w-6 shrink-0 bg-gray-200" />
                  )}
                  <div className="flex items-center gap-[3px] px-1 py-2">
                    <span className="block h-[4px] w-[4px] animate-[bounce-dot_1.4s_ease-in-out_infinite] bg-gray-400" />
                    <span className="block h-[4px] w-[4px] animate-[bounce-dot_1.4s_ease-in-out_0.2s_infinite] bg-gray-400" />
                    <span className="block h-[4px] w-[4px] animate-[bounce-dot_1.4s_ease-in-out_0.4s_infinite] bg-gray-400" />
                  </div>
                </div>
              ) : (
                <PixelLoader />
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pb-6 pt-4">
        <div className="mx-auto max-w-2xl">
          {isPurposeStep && !isLoading && !personaProfile && (
            <div className="mb-4 flex flex-col gap-1">
              {PURPOSE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => void append({ role: 'user', content: opt })}
                  className="flex items-center gap-3 px-3 py-3 text-left text-base text-gray-900 transition-colors hover:bg-gray-50"
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
          <form
            ref={formRef}
            onSubmit={(e) => {
              handleSubmit(e)
              inputRef.current?.clear()
            }}
            className="flex flex-col min-h-[100px] border border-gray-200 bg-white px-3 pt-3 pb-2 transition-colors hover:border-gray-300"
          >
            {isTokenStep && !personaProfile ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-300"><LockIcon /></span>
                <input
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="ghp_••••••••••••"
                  disabled={isLoading}
                  autoComplete="off"
                  className="flex-1 bg-transparent min-h-[60px] text-base text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50"
                />
              </div>
            ) : (
              <ChatInput
                ref={inputRef}
                formRef={formRef}
                onChange={setInput}
                placeholder="Talk and share your tech philosophy ✨"
                disabled={isLoading}
                plugins={<><ProfileMentionsPlugin /><CommandsPlugin onExecute={handleExecuteCommand} /></>}
              />
            )}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center bg-black text-white transition-all hover:bg-gray-800 disabled:opacity-30"
              >
                <SendIcon />
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
