import { ShieldCheck } from 'lucide-react'

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' }[size]
  const icon = { sm: 16, md: 20, lg: 28 }[size]
  return (
    <div
      className={`flex ${dims} items-center justify-center rounded-lg bg-brand text-white shadow-[0_8px_24px_-10px_rgba(255,65,3,.9)]`}
      aria-hidden
    >
      <ShieldCheck size={icon} strokeWidth={2.4} />
    </div>
  )
}
