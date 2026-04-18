'use client'

/**
 * Pixel-art "thinking" loader for AI chat.
 * A tiny brain that pulses while the AI is generating.
 */
export function PixelLoader() {
  return (
    <div className="inline-flex items-center gap-3 px-0 py-2">
      <div className="relative">
        {/* 8x8 pixel-art brain, each "pixel" is a 4x4 CSS square */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 8 8"
          fill="none"
          className="animate-[pixel-pulse_1.2s_ease-in-out_infinite]"
          style={{ imageRendering: 'pixelated' }}
        >
          {/* row 0 */}
          <rect x="2" y="0" width="1" height="1" fill="currentColor" opacity="0.6" />
          <rect x="3" y="0" width="1" height="1" fill="currentColor" opacity="0.8" />
          <rect x="4" y="0" width="1" height="1" fill="currentColor" opacity="0.8" />
          <rect x="5" y="0" width="1" height="1" fill="currentColor" opacity="0.6" />
          {/* row 1 */}
          <rect x="1" y="1" width="1" height="1" fill="currentColor" opacity="0.7" />
          <rect x="2" y="1" width="1" height="1" fill="currentColor" />
          <rect x="3" y="1" width="1" height="1" fill="currentColor" />
          <rect x="4" y="1" width="1" height="1" fill="currentColor" />
          <rect x="5" y="1" width="1" height="1" fill="currentColor" />
          <rect x="6" y="1" width="1" height="1" fill="currentColor" opacity="0.7" />
          {/* row 2 */}
          <rect x="1" y="2" width="1" height="1" fill="currentColor" />
          <rect x="2" y="2" width="1" height="1" fill="currentColor" opacity="0.5" />
          <rect x="3" y="2" width="1" height="1" fill="currentColor" />
          <rect x="4" y="2" width="1" height="1" fill="currentColor" opacity="0.5" />
          <rect x="5" y="2" width="1" height="1" fill="currentColor" />
          <rect x="6" y="2" width="1" height="1" fill="currentColor" />
          {/* row 3 — "fold" line */}
          <rect x="0" y="3" width="1" height="1" fill="currentColor" opacity="0.6" />
          <rect x="1" y="3" width="1" height="1" fill="currentColor" />
          <rect x="2" y="3" width="1" height="1" fill="currentColor" />
          <rect x="3" y="3" width="1" height="1" fill="currentColor" opacity="0.7" />
          <rect x="4" y="3" width="1" height="1" fill="currentColor" />
          <rect x="5" y="3" width="1" height="1" fill="currentColor" opacity="0.7" />
          <rect x="6" y="3" width="1" height="1" fill="currentColor" />
          <rect x="7" y="3" width="1" height="1" fill="currentColor" opacity="0.6" />
          {/* row 4 */}
          <rect x="1" y="4" width="1" height="1" fill="currentColor" />
          <rect x="2" y="4" width="1" height="1" fill="currentColor" />
          <rect x="3" y="4" width="1" height="1" fill="currentColor" />
          <rect x="4" y="4" width="1" height="1" fill="currentColor" />
          <rect x="5" y="4" width="1" height="1" fill="currentColor" />
          <rect x="6" y="4" width="1" height="1" fill="currentColor" />
          {/* row 5 */}
          <rect x="1" y="5" width="1" height="1" fill="currentColor" opacity="0.8" />
          <rect x="2" y="5" width="1" height="1" fill="currentColor" />
          <rect x="3" y="5" width="1" height="1" fill="currentColor" />
          <rect x="4" y="5" width="1" height="1" fill="currentColor" />
          <rect x="5" y="5" width="1" height="1" fill="currentColor" />
          <rect x="6" y="5" width="1" height="1" fill="currentColor" opacity="0.8" />
          {/* row 6 — bottom */}
          <rect x="2" y="6" width="1" height="1" fill="currentColor" opacity="0.7" />
          <rect x="3" y="6" width="1" height="1" fill="currentColor" opacity="0.9" />
          <rect x="4" y="6" width="1" height="1" fill="currentColor" opacity="0.9" />
          <rect x="5" y="6" width="1" height="1" fill="currentColor" opacity="0.7" />
          {/* row 7 — stem */}
          <rect x="3" y="7" width="1" height="1" fill="currentColor" opacity="0.5" />
          <rect x="4" y="7" width="1" height="1" fill="currentColor" opacity="0.5" />
        </svg>

        {/* Sparkle pixels that blink around the brain */}
        <span className="absolute -top-1 -right-1 block h-[3px] w-[3px] animate-[pixel-sparkle_1.4s_ease-in-out_infinite] bg-current opacity-0" />
        <span className="absolute -bottom-0.5 -left-1 block h-[3px] w-[3px] animate-[pixel-sparkle_1.4s_ease-in-out_0.5s_infinite] bg-current opacity-0" />
        <span className="absolute top-1 -left-1.5 block h-[3px] w-[3px] animate-[pixel-sparkle_1.4s_ease-in-out_1s_infinite] bg-current opacity-0" />
      </div>

      {/* Bouncing pixel dots */}
      <div className="flex items-center gap-[3px]">
        <span className="block h-[5px] w-[5px] animate-[bounce-dot_1.4s_ease-in-out_infinite] bg-current opacity-70" />
        <span className="block h-[5px] w-[5px] animate-[bounce-dot_1.4s_ease-in-out_0.2s_infinite] bg-current opacity-70" />
        <span className="block h-[5px] w-[5px] animate-[bounce-dot_1.4s_ease-in-out_0.4s_infinite] bg-current opacity-70" />
      </div>
    </div>
  )
}
