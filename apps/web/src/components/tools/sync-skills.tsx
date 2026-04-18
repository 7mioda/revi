'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, LockIcon, SpinnerIcon } from '../icons'
import { STEP_LABELS } from './types'
import type { SyncJob, SyncState } from './types'

export function SyncSkillsTool({
  toolCallId,
  addToolResult,
}: {
  toolCallId: string
  addToolResult: (args: { toolCallId: string; result: unknown }) => void
}) {
  const [state, setState] = useState<SyncState>({ phase: 'enter-token' })
  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state.phase !== 'syncing') return
    const { jobId } = state

    async function poll() {
      try {
        const res = await fetch(`/api/profiles/jobs/${jobId}`)
        if (!res.ok) return
        const job = (await res.json()) as SyncJob
        setState((prev) => {
          if (prev.phase !== 'syncing') return prev
          if (job.status === 'done') {
            if (pollRef.current) clearInterval(pollRef.current)
            return { phase: 'done', username: prev.username }
          }
          if (job.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current)
            const failedStep = job.steps.find((s) => s.status === 'failed')
            return { phase: 'error', message: failedStep?.error ?? 'Sync failed. Try again.' }
          }
          return { ...prev, job }
        })
      } catch {
        // transient — keep polling
      }
    }

    void poll()
    pollRef.current = setInterval(() => void poll(), 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase === 'syncing' ? (state as { jobId: string }).jobId : null])

  useEffect(() => {
    if (state.phase === 'done') {
      addToolResult({ toolCallId, result: { username: state.username } })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setTokenError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/profiles/sync-from-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = (await res.json()) as { jobId?: string; username?: string; message?: string }
      if (!res.ok) { setTokenError(body.message ?? `Request failed (${res.status})`); return }
      setState({ phase: 'syncing', jobId: body.jobId!, username: body.username!, job: null })
    } catch (err) {
      setTokenError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (state.phase === 'enter-token') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Needs the <span className="font-medium text-gray-700">repo</span> scope. Never stored beyond this request.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2">
          <div className="flex flex-1 items-center border border-gray-200 pl-3 pr-2 transition-colors hover:border-gray-300 focus-within:border-gray-400">
            <span className="mr-2 text-gray-300"><LockIcon /></span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_••••••••••••"
              autoComplete="off"
              autoFocus
              disabled={submitting}
              className="flex-1 bg-transparent py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !token.trim()}
            className="border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-40"
          >
            {submitting ? 'Connecting…' : 'Upload'}
          </button>
        </form>
        {tokenError && <p className="text-sm text-red-500">{tokenError}</p>}
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{state.message}</p>
        <button
          type="button"
          onClick={() => setState({ phase: 'enter-token' })}
          className="border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
        >
          Try again
        </button>
      </div>
    )
  }

  if (state.phase === 'syncing') {
    const steps = state.job?.steps ?? []
    return (
      <div className="space-y-2">
        {steps.length === 0 ? (
          <p className="text-sm text-gray-400">Starting up…</p>
        ) : steps.map((step) => (
          <div key={step.name} className="flex items-center gap-2 border border-gray-100 px-3 py-1.5">
            <span className={step.status === 'failed' ? 'text-red-500' : 'text-gray-900'}>
              {step.status === 'running' && <SpinnerIcon />}
              {step.status === 'done' && <CheckIcon />}
              {(step.status === 'pending' || step.status === 'failed') && (
                <span className="inline-block h-3.5 w-3.5 border border-gray-300" />
              )}
            </span>
            <span className={`text-xs ${step.status === 'pending' ? 'text-gray-400' : step.status === 'failed' ? 'text-red-600' : 'text-gray-700'}`}>
              {STEP_LABELS[step.name] ?? step.name}
              {step.status === 'done' && step.count != null && (
                <span className="ml-1 text-gray-400">({step.count})</span>
              )}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return <p className="text-sm text-gray-500">Sync complete for @{state.username}.</p>
}
