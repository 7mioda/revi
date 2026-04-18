'use client'

import Image from 'next/image'
import { forwardRef, useCallback, useEffect, useState } from 'react'
import {
  BeautifulMentionsPlugin,
  type BeautifulMentionsItem,
  type BeautifulMentionsMenuItem,
  type BeautifulMentionsMenuItemProps,
  type BeautifulMentionsMenuProps,
} from 'lexical-beautiful-mentions'
import type { Profile } from './tools/types'

const ProfileMentionsMenu = forwardRef<HTMLUListElement, BeautifulMentionsMenuProps>(
  ({ loading: _loading, ...props }, ref) => (
    <ul
      ref={ref}
      className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden border border-gray-200 bg-white shadow-md"
      {...props}
    >
      <div className="flex max-h-[220px] flex-col overflow-y-auto">
        {props.children}
      </div>
    </ul>
  ),
)
ProfileMentionsMenu.displayName = 'ProfileMentionsMenu'

const ProfileMentionsMenuItem = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(
  ({ selected, item: _item, label: _label, itemValue: _itemValue, children, ...props }, ref) => {
    const avatarUrl = typeof _item?.data?.avatarUrl === 'string' ? _item.data.avatarUrl : null
    const name = typeof _item?.data?.name === 'string' ? _item.data.name : null

    return (
      <li
        ref={ref}
        className={`flex cursor-pointer list-none items-center gap-2 px-3 py-2 transition-colors ${selected ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
        {...props}
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt={name ?? _item.value} width={20} height={20} className="shrink-0 object-cover" />
        ) : (
          <div className="h-5 w-5 shrink-0 bg-gray-200" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{name ?? _item.value}</span>
        <span className="shrink-0 text-xs text-gray-400">@{_item.value}</span>
      </li>
    )
  },
)
ProfileMentionsMenuItem.displayName = 'ProfileMentionsMenuItem'

export type ProfileMentionsPluginProps = {
  onSelectProfile?: (profile: Profile) => void
}

export function ProfileMentionsPlugin({ onSelectProfile }: ProfileMentionsPluginProps = {}) {
  const [profiles, setProfiles] = useState<Profile[]>([])

  useEffect(() => {
    fetch('/api/profiles')
      .then((r) => r.json())
      .then((data: Profile[]) => setProfiles(data))
      .catch(() => {})
  }, [])

  const onSearch = useCallback(
    async (_trigger: string, query: string | null | undefined): Promise<BeautifulMentionsItem[]> => {
      const q = query?.toLowerCase() ?? ''
      return profiles
        .filter((p) =>
          !q ||
          p.username.toLowerCase().includes(q) ||
          (p.name ?? '').toLowerCase().includes(q),
        )
        .slice(0, 8)
        .map((p): BeautifulMentionsItem => ({
          value: p.username,
          name: p.name ?? p.username,
          avatarUrl: p.avatarUrl ?? '',
        }))
    },
    [profiles],
  )

  const onMenuItemSelect = useCallback(
    (item: BeautifulMentionsMenuItem) => {
      if (onSelectProfile) {
        const profile = profiles.find((p) => p.username === item.value)
        if (profile) onSelectProfile(profile)
      }
    },
    [profiles, onSelectProfile],
  )

  return (
    <BeautifulMentionsPlugin
      triggers={['@']}
      onSearch={onSearch}
      searchDelay={0}
      menuItemLimit={8}
      allowSpaces={false}
      insertOnBlur={false}
      menuComponent={ProfileMentionsMenu}
      menuItemComponent={ProfileMentionsMenuItem}
      onMenuItemSelect={onMenuItemSelect}
    />
  )
}
