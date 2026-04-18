'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { PixelLoader } from '../pixel-loader'
import type { Profile } from './types'

export function ProfilePickerTool({
  toolCallId,
  addToolResult,
  onSelect,
}: {
  toolCallId: string
  addToolResult: (args: { toolCallId: string; result: unknown }) => void
  onSelect?: (p: Profile) => void
}) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(false)

  useEffect(() => {
    fetch('/api/profiles')
      .then((r) => r.json() as Promise<Profile[]>)
      .then(setProfiles)
      .catch(() => setError('Could not load profiles.'))
  }, [])

  function handleSelect(p: Profile) {
    if (selected) return
    setSelected(true)
    onSelect?.(p)
    addToolResult({ toolCallId, result: { username: p.username, name: p.name } })
  }

  if (error) return <p className="text-sm text-gray-500">{error}</p>
  if (!profiles) return <PixelLoader />
  if (profiles.length === 0) return <p className="text-sm text-gray-500">No profiles yet. Upload your skills first.</p>

  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${selected ? 'pointer-events-none opacity-50' : ''}`}>
      {profiles.map((p) => (
        <button
          key={p.username}
          type="button"
          onClick={() => handleSelect(p)}
          className="flex items-start gap-3 border border-gray-200 p-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          {p.avatarUrl ? (
            <Image src={p.avatarUrl} alt={p.username} width={32} height={32} className="shrink-0 object-cover" />
          ) : (
            <div className="h-8 w-8 shrink-0 bg-gray-100" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{p.name ?? p.username}</p>
            <p className="text-xs text-gray-400">@{p.username}</p>
            {p.bio && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{p.bio}</p>}
          </div>
        </button>
      ))}
    </div>
  )
}
