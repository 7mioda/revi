# Plan — Onboarding Chat UI: Intro → Chat Transition

## Context

`OnboardingChat` renders a standard chat layout from the start. The request is a
two-phase experience:

1. **Intro phase** — the greeting streams in centered on a blank screen. No input.
   When streaming ends a "Start to chat" button fades in below the text.

2. **Chat phase** — clicking the button slides the message to the top and reveals
   the textarea. From here the conversation proceeds normally.

---

## State machine

```
'intro-streaming'  →  'intro-ready'  →  'chatting'
      │                    │                 │
  (first msg           (isLoading         (button
   streaming)          becomes false)       clicked)
```

Single state variable: `introPhase: 'streaming' | 'ready' | 'done'`
- `'streaming'` — initial state; AI is generating the first message
- `'ready'`     — first message fully received; show "Start to chat" button
- `'done'`      — button was clicked; switch to normal chat layout

Transition rules:
- `'streaming'` → `'ready'` when `isLoading` flips to `false` AND we are still in
  intro (only the `__init__` user turn + one assistant turn exist)
- `'ready'` → `'done'` when the user clicks "Start to chat"
- Never goes backwards

---

## Layout specs

### Intro phase (`introPhase !== 'done'`)

```
┌────────────────────── viewport ──────────────────────┐
│                                                       │
│                                                       │
│          ┌──────── max-w-2xl, px-8 ────────┐         │
│          │                                 │         │
│          │  Hey Edaly! 👋 Welcome to Revi. │         │
│          │  …                              │         │
│          │                                 │         │
│          │  [ Start to chat → ]            │  ← fades│
│          │   (hidden while streaming)      │    in   │
│          └─────────────────────────────────┘         │
│                                                       │
│                                                       │
└───────────────────────────────────────────────────────┘
```

- Container: `min-h-screen flex items-center justify-center px-8`
- Content block: `w-full max-w-2xl`
- Message: same Markdown renderer as today, no bubble/background
- "Start to chat" button: appears `mt-8` below the message text, `opacity-0 →
  opacity-100` transition when `introPhase` changes from `'streaming'` to `'ready'`
- No header, no input form visible

### Chat phase (`introPhase === 'done'`)

- Identical to the current layout (header, scrollable messages, fixed bottom input)
- The greeting message is now at the top as the first item in the message list
- On transition: intro container fades out (`opacity-0`), chat layout fades in
  (`opacity-0 → opacity-100`), textarea auto-focuses

---

## Animation approach

No animation libraries. Pure CSS transitions via Tailwind utility classes and a
`data-phase` attribute on the root element.

1. **Intro → ready**: button fades in
   ```
   transition-opacity duration-500
   opacity-0 (streaming) → opacity-100 (ready)
   ```

2. **Ready → done** (button click):
   - Intro container: `opacity-100 → opacity-0` (300ms)
   - After 300ms: swap to chat layout
   - Chat layout: `opacity-0 → opacity-100` (300ms)
   - Total perceived transition: ~300ms fade-swap

   Implemented with a 300ms `setTimeout` inside `handleStartChat`.

---

## Component changes

### `OnboardingChat` (`components/onboarding-chat.tsx`)

**New state:**
```ts
const [introPhase, setIntroPhase] = useState<'streaming' | 'ready' | 'done'>('streaming')
const [introVisible, setIntroVisible] = useState(true)  // for fade-out
```

**New effect** (replace/extend the existing `isLoading` effect):
```ts
useEffect(() => {
  if (introPhase === 'streaming' && !isLoading && messages.length >= 2) {
    setIntroPhase('ready')
  }
}, [isLoading, introPhase, messages.length])
```

**New handler:**
```ts
function handleStartChat() {
  setIntroVisible(false)          // triggers fade-out CSS
  setTimeout(() => {
    setIntroPhase('done')         // swap layout after fade
    setIntroVisible(true)         // reset for chat layout fade-in
  }, 300)
}
```

**Intro render** (shown when `introPhase !== 'done'`):
```tsx
<main
  className={`min-h-screen flex items-center justify-center px-8 transition-opacity duration-300 ${
    introVisible ? 'opacity-100' : 'opacity-0'
  }`}
>
  <div className="w-full max-w-2xl">
    {/* First assistant message rendered with Markdown (same renderer) */}
    {/* PixelLoader if still streaming */}
    <div className={`mt-8 transition-opacity duration-500 ${
      introPhase === 'ready' ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}>
      <button onClick={handleStartChat}>
        Start to chat →
      </button>
    </div>
  </div>
</main>
```

**Chat render** (shown when `introPhase === 'done'`):
- Identical to current layout, wrapped in a fade-in container
- `textarea` auto-focuses via `useEffect` once `introPhase === 'done'`

---

## Tasks

### Task 1 — Add `introPhase` state + transition logic
Add state, the loading effect, and `handleStartChat` to `OnboardingChat`.
No visual changes yet.

**Acceptance criteria:**
- `introPhase` starts as `'streaming'`
- Transitions to `'ready'` automatically when `isLoading` becomes false
  (only while intro, not on subsequent messages)
- `handleStartChat` transitions to `'done'` after 300ms
- Zero TypeScript errors

---

### Task 2 — Intro layout: centered message
Replace the current top-of-page render with the centered intro layout when
`introPhase !== 'done'`.

**Acceptance criteria:**
- First assistant message is vertically + horizontally centered on screen
- No header, no input form visible during intro
- `PixelLoader` shown while `isLoading`
- Existing chat layout is preserved when `introPhase === 'done'`
- No regressions in normal chat flow

---

### Task 3 — "Start to chat" button
Add the button below the intro message with fade-in behaviour.

**Acceptance criteria:**
- Button invisible while `introPhase === 'streaming'`
- Button fades in (500ms) when `introPhase === 'ready'`
- `pointer-events-none` while invisible (no accidental clicks)
- Clicking triggers `handleStartChat`
- Button styled: subtle pill or inline text link, consistent with the grey/black palette

---

### Task 4 — Transition: intro → chat
Implement the fade-swap: intro fades out → chat layout fades in, textarea auto-focuses.

**Acceptance criteria:**
- Intro container fades out over 300ms on button click
- Chat layout replaces it and fades in
- Input/textarea is focused automatically
- All messages (including the greeting) visible in the chat layout
- `isPurposeStep` quick-replies still work after transition

---

### CHECKPOINT
```
yarn workspace @revi/web typecheck   # 0 errors
Manual test:
1. Load page → greeting streams in, no textarea visible, page is centered
2. After stream ends → "Start to chat" fades in
3. Click → message moves to top, textarea appears, autofocused
4. Reply → normal chat works
```

---

## Hard rules
1. No new dependencies (no Framer Motion, no animation libraries)
2. All transitions via Tailwind + CSS; no inline `style` animation strings
3. `introPhase` only ever moves forward: streaming → ready → done
4. The existing chat logic (step detection, token masking, tool badges) is untouched
5. Zero TypeScript errors after each task
