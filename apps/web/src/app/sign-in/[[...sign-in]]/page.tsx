import { SignIn } from '@clerk/nextjs'

function ReviLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" shapeRendering="crispEdges" aria-label="Revi">
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

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <ReviLogo />
        <SignIn />
      </div>
    </div>
  )
}
