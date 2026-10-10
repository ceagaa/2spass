import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

interface ThemeToggleProps {
  className?: string
}

/** Light/dark theme switch. Preference persists in localStorage (non-sensitive). */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Ativar tema escuro' : 'Ativar tema claro'}
      title={isLight ? 'Tema escuro' : 'Tema claro'}
      aria-pressed={isLight}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-tertiary transition',
        'hover:bg-hover/[0.06] hover:text-ink',
        className,
      ].join(' ')}
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
