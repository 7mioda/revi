'use client'

import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createParagraphNode,
  $getRoot,
  $isParagraphNode,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  type EditorState,
  type LexicalEditor,
} from 'lexical'
import { BeautifulMentionNode, $isBeautifulMentionNode } from 'lexical-beautiful-mentions'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

export type ChatInputHandle = {
  focus: () => void
  clear: () => void
}

function ImperativePlugin({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext()
  editorRef.current = editor
  return null
}

function EditablePlugin({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editor.setEditable(!disabled)
  }, [editor, disabled])
  return null
}

function SubmitOnEnterPlugin({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (!event || event.shiftKey || event.isComposing) return false
        event.preventDefault()
        formRef.current?.requestSubmit()
        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, formRef])
  return null
}

interface ChatInputProps {
  formRef: React.RefObject<HTMLFormElement | null>
  onChange: (text: string) => void
  placeholder?: string
  disabled?: boolean
  plugins?: React.ReactNode
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ formRef, onChange, placeholder = 'Reply', disabled = false, plugins }, ref) => {
    const editorRef = useRef<LexicalEditor | null>(null)

    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      clear: () => {
        editorRef.current?.update(() => {
          const root = $getRoot()
          root.clear()
          root.append($createParagraphNode())
        })
      },
    }))

    const handleChange = useCallback(
      (editorState: EditorState) => {
        editorState.read(() => {
          const root = $getRoot()
          const lines: string[] = []
          for (const child of root.getChildren()) {
            if (!$isParagraphNode(child)) continue
            const parts: string[] = []
            for (const node of child.getChildren()) {
              if ($isBeautifulMentionNode(node)) {
                parts.push(`@${node.getValue()}`)
              } else if ($isTextNode(node)) {
                parts.push(node.getTextContent())
              }
            }
            lines.push(parts.join(''))
          }
          onChange(lines.join('\n'))
        })
      },
      [onChange],
    )

    return (
      <LexicalComposer
        initialConfig={{
          namespace: 'ChatInput',
          nodes: [BeautifulMentionNode],
          onError: (err) => console.error('[ChatInput]', err),
          editable: true,
          theme: {
            beautifulMentions: {
              '@': 'bg-gray-100 text-gray-900 px-1 font-medium text-sm',
              '@Focused': 'bg-gray-200 text-gray-900 px-1 font-medium text-sm outline-none',
            },
          },
        }}
      >
        <div className="relative flex-1">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable
                className="max-h-[40vh] min-h-[60px] w-full overflow-y-auto bg-transparent text-base text-gray-900 caret-black outline-none placeholder:text-gray-400 disabled:opacity-50"
                aria-placeholder={placeholder}
                placeholder={
                  <div className="pointer-events-none absolute top-0 left-0 select-none text-base text-gray-400">
                    {placeholder}
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
          <ImperativePlugin editorRef={editorRef} />
          <EditablePlugin disabled={disabled} />
          <SubmitOnEnterPlugin formRef={formRef} />
          {plugins}
        </div>
      </LexicalComposer>
    )
  },
)

ChatInput.displayName = 'ChatInput'
