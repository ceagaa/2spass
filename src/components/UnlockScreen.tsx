import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, LogOut } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { AUTO_LOCK_MS } from '../context/VaultContext'

export function UnlockScreen() {
  const { user, unlock, signOut } = useVault()
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minutes = Math.round(AUTO_LOCK_MS / 60000)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await unlock(password)
      setPassword('')
      toast('Cofre desbloqueado.', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desbloquear.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Cofre bloqueado</h1>
          <p className="mt-1 text-sm text-ink-secondary">{user?.email}</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6 shadow-2xl">
          <Input
            name="master"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus
            label="Senha mestra"
            placeholder="••••••••••"
            leading={<KeyRound size={16} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            trailing={
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                className="rounded-md p-2 text-ink-tertiary transition hover:text-ink"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />

          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <Button type="submit" loading={busy} className="w-full">
            Desbloquear
          </Button>

          <p className="text-center text-xs text-ink-tertiary">
            Bloqueio automático após {minutes} min de inatividade.
          </p>
        </form>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mx-auto mt-6 flex items-center gap-2 text-sm text-ink-tertiary transition hover:text-ink"
        >
          <LogOut size={15} /> Sair da conta
        </button>
      </div>
    </div>
  )
}
