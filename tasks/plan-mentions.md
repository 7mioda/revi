# Plan — @mention Profile Support in Chat Input

## Context

The chat app uses two `useChat` hooks: a main hook (`/api/chat`) and a persona hook
(`/api/persona`). Setting `personaProfile` state activates the persona sub-agent.
Currently, personas are only triggered via the `pick_persona` tool → `ProfilePickerTool` UI.

The goal is to let users type `@` in the chat input to browse and select a profile,
which immediately activates that persona's sub-agent — without waiting for a tool call.

---

## Architecture

```
chat-input.tsx          (Lexical editor — gains plugin injection + BeautifulMentionNode)
    │
    ├── ProfileMentionsPlugin   (new component — fetches profiles, owns dropdown UI)
    │       ├── ProfileMentionsMenu       (forwardRef → <ul>, square, shadowed)
    │       └── ProfileMentionsMenuItem  (forwardRef → <li>, avatar + name + @handle)
    │
chat.tsx                (wires onSelectProfile → setPersonaProfile)
```

All tasks are sequential; each depends on the previous.

---

## Task 1 — Install `lexical-beautiful-mentions`

```bash
yarn workspace @revi/web add lexical-beautiful-mentions
```

**Acceptance:** `apps/web/package.json` lists `lexical-beautiful-mentions`.

---

## Task 2 — Update `chat-input.tsx` to support mention nodes and plugin injection

**File:** `apps/web/src/components/chat-input.tsx`

### Changes

1. Add `BeautifulMentionNode` to the `nodes` array in `LexicalComposer initialConfig`.

2. Add `theme.beautifulMentions` config:
   - `'@'` trigger class: `bg-gray-100 text-gray-900 px-1 font-medium text-sm`
   - `'@Focused'` trigger class: `bg-gray-200 text-gray-900 px-1 font-medium text-sm outline-none`

3. Add `plugins?: React.ReactNode` to `ChatInputProps`.

4. Render `{plugins}` inside `LexicalComposer` alongside existing plugins.

5. Update `OnChangePlugin` handler: iterate paragraph children; for each node check
   `$isBeautifulMentionNode` first (yields `@${node.getValue()}`), then `$isTextNode`
   (yields `node.getTextContent()`). Join results.

### Imports to add

```ts
import { BeautifulMentionNode, $isBeautifulMentionNode } from 'lexical-beautiful-mentions'
```

**Acceptance:** Plain text still works; mention nodes render as styled chips; external
plugins can be injected via the `plugins` prop.

---

## Task 3 — Create `apps/web/src/components/profile-mentions-plugin.tsx`

A self-contained Lexical plugin that owns profile fetching, filtering, and the dropdown UI.

### `ProfileMentionsMenu` (forwardRef → `<ul>`)

```
className: absolute bottom-full left-0 mb-2 z-50 w-72 border border-gray-200
           bg-white shadow-md overflow-hidden
```

Inner wrapper: `<div className="flex flex-col max-h-[220px] overflow-y-auto">`

No rounded corners anywhere (square, consistent with app palette).

### `ProfileMentionsMenuItem` (forwardRef → `<li>`)

Layout: `flex items-center gap-2 px-3 py-2 cursor-pointer list-none`

- Avatar: 16×16, square (`object-cover`), or gray placeholder div when no `avatarUrl`
- Primary label: `name ?? username` — `text-sm text-gray-900`
- Secondary label: `@username` — `text-xs text-gray-400`
- Selected state: `bg-gray-50`

### `ProfileMentionsPlugin`

```ts
type ProfileMentionsPluginProps = {
  onSelectProfile: (profile: Profile) => void
}
```

- Fetches `GET /api/profiles` once on mount via plain `useState` + `useEffect` (no SWR).
- `onSearch(trigger, query)`: filters local list by name or username (case-insensitive),
  maps to `BeautifulMentionsItem[]` with shape `{ value: username, name, avatarUrl }`.
- `onMenuItemSelect(item)`: finds profile by `item.value` (username) from local list,
  calls `onSelectProfile(profile)`.
- `BeautifulMentionsPlugin` props:
  - `triggers={['@']}`
  - `searchDelay={0}`
  - `allowSpaces={false}`
  - `insertOnBlur={false}`
  - `menuItemLimit={8}`
  - `menuComponent={ProfileMentionsMenu}`
  - `menuItemComponent={ProfileMentionsMenuItem}`

**Acceptance:** Typing `@` opens the menu; typing after `@` filters by name/handle;
click or Enter selects and calls `onSelectProfile`.

---

## Task 4 — Wire mentions into `chat.tsx`

**File:** `apps/web/src/components/chat.tsx`

### Changes

1. Import `ProfileMentionsPlugin` from `./profile-mentions-plugin`.

2. Add `handleSelectMentionedProfile`:

```ts
function handleSelectMentionedProfile(profile: Profile) {
  if (personaProfile?.username === profile.username) return
  hasPersonaInited.current = false
  setPersonaProfile({
    username: profile.username,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
  })
}
```

3. Pass `plugins` prop to `ChatInput`:

```tsx
<ChatInput
  ...existingProps
  plugins={
    <ProfileMentionsPlugin onSelectProfile={handleSelectMentionedProfile} />
  }
/>
```

**Acceptance:** Selecting `@alice` sets `personaProfile` to alice; subsequent messages
route to alice's persona sub-agent; plain typing without `@` continues routing to the
main Revi chat.

---

## Dependency Graph

```
Task 1 (install package)
    └── Task 2 (update chat-input.tsx — needs package installed)
          └── Task 3 (create plugin — needs BeautifulMentionNode available)
                └── Task 4 (wire into chat.tsx — needs plugin + updated ChatInput)
```

---

## Verification Checklist

1. `yarn workspace @revi/web dev` starts without errors.
2. Open chat, reach chat phase.
3. Type `@` → dropdown appears with profile list.
4. Type a letter → filters to matching profiles by name or handle.
5. Click or press Enter on a profile → mention chip inserted in editor.
6. Type a question and press Enter → message routes to persona chat.
7. Persona avatar appears in AI response header.
8. Plain typing without `@` still routes to main Revi chat.
9. Shift+Enter still inserts newlines.
10. Cmd+Z (undo) still works correctly.
