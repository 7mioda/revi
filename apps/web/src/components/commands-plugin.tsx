'use client'

import { forwardRef, useCallback } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createParagraphNode, $getRoot } from 'lexical'
import {
  BeautifulMentionsPlugin,
  type BeautifulMentionsMenuItem,
  type BeautifulMentionsMenuItemProps,
  type BeautifulMentionsMenuProps,
} from 'lexical-beautiful-mentions'

type Command = {
  value: string
  label: string
  description: string
}

const COMMANDS: Command[] = [
  { value: 'logout', label: 'Logout', description: 'Sign out of your account' },
]

const ITEMS = {
  '/': COMMANDS.map((c) => ({ value: c.value, label: c.label, description: c.description })),
}

const CommandsMenu = forwardRef<HTMLUListElement, BeautifulMentionsMenuProps>(
  ({ loading: _loading, ...props }, ref) => (
    <ul
      ref={ref}
      className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden border border-gray-200 bg-white shadow-md"
      {...props}
    >
      <div className="flex flex-col">
        {props.children}
      </div>
    </ul>
  ),
)
CommandsMenu.displayName = 'CommandsMenu'

const CommandsMenuItem = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(
  ({ selected, item, label: _label, itemValue: _itemValue, children: _children, ...props }, ref) => {
    const description = typeof item?.data?.description === 'string' ? item.data.description : null
    const label = typeof item?.data?.label === 'string' ? item.data.label : item.value

    return (
      <li
        ref={ref}
        className={`flex cursor-pointer list-none items-center gap-3 px-3 py-2 transition-colors ${selected ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
        {...props}
      >
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {description && <span className="text-xs text-gray-400">{description}</span>}
      </li>
    )
  },
)
CommandsMenuItem.displayName = 'CommandsMenuItem'

export type CommandsPluginProps = {
  onExecute: (command: string) => void
}

export function CommandsPlugin({ onExecute }: CommandsPluginProps) {
  const [editor] = useLexicalComposerContext()

  const onMenuItemSelect = useCallback(
    (item: BeautifulMentionsMenuItem) => {
      onExecute(item.value)
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        root.append($createParagraphNode())
      })
    },
    [editor, onExecute],
  )

  return (
    <BeautifulMentionsPlugin
      triggers={['/']}
      items={ITEMS}
      menuItemLimit={false}
      allowSpaces={false}
      insertOnBlur={false}
      menuComponent={CommandsMenu}
      menuItemComponent={CommandsMenuItem}
      onMenuItemSelect={onMenuItemSelect}
    />
  )
}
