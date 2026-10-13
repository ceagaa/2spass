export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' }[size]
  return (
    <svg
      viewBox="0 0 512 512"
      className={`${dims} shadow-[0_8px_24px_-10px_rgba(255,65,3,.9)]`}
      aria-hidden
    >
      <rect width="512" height="512" rx="112" fill="#FF4103" />
      <path
        d="M256 128c-26 0-47 21-47 47v33h20v-33c0-15 12-27 27-27s27 12 27 27v33h20v-33c0-26-21-47-47-47z"
        fill="#fff"
      />
      <rect x="150" y="256" width="212" height="180" rx="54" fill="#fff" />
      <circle cx="256" cy="330" r="24" fill="#FF4103" />
      <rect x="243" y="340" width="26" height="52" rx="13" fill="#FF4103" />
    </svg>
  )
}
