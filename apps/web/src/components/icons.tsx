export function SendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <g clipPath="url(#send-clip)">
        <path d="M10.9507 18H12.9414V16.0052H10.9507V18Z" fill="currentColor"/>
        <path d="M10.9507 16.0206H12.9414V14.0258H10.9507V16.0206Z" fill="currentColor"/>
        <path d="M10.9507 14.0412H12.9414V12.0464H10.9507V14.0412Z" fill="currentColor"/>
        <path d="M10.9507 12.0619H12.9414V10.067H10.9507V12.0619Z" fill="currentColor"/>
        <path d="M8.97508 10.0825H10.9658V8.08763H8.97508V10.0825Z" fill="currentColor"/>
        <path d="M12.9263 10.0825H14.917V8.08763H12.9263V10.0825Z" fill="currentColor"/>
        <path d="M7.00047 12.0619H8.99121V10.067H7.00047V12.0619Z" fill="currentColor"/>
        <path d="M14.9009 12.0619H16.8916V10.067H14.9009V12.0619Z" fill="currentColor"/>
        <path d="M10.9507 8.10309H12.9414V6.10825H10.9507V8.10309Z" fill="currentColor"/>
      </g>
      <defs>
        <clipPath id="send-clip">
          <rect width="12" height="10" fill="currentColor" transform="matrix(0 -1 1 0 7 18)"/>
        </clipPath>
      </defs>
    </svg>
  )
}

export function SpinnerIcon() {
  return (
    <svg className="animate-[spin_1s_linear_infinite]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}
