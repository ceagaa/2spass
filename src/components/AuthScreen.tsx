import { useState, type FormEvent } from 'react'
import { AtSign, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { estimateStrength } from '../lib/crypto'

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const { signIn, register } = useVault()
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = estimateStrength(password)
  const isSignup = mode === 'signup'

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!email.trim()) return setError('Informe seu e-mail.')
    if (password.length < 8) return setError('A senha mestra deve ter pelo menos 8 caracteres.')
    if (isSignup && password !== confirm) return setError('As senhas não conferem.')
    if (isSignup && strength.score < 2) {
      return setError('Senha mestra muito fraca. Use letras, números e símbolos.')
    }

    setBusy(true)
    try {
      if (isSignup) {
        const result = await register(email, password)
        if (result.needsEmailConfirmation) {
          toast('Confirme seu e-mail para ativar a conta e depois faça login.', 'info')
          setMode('signin')
        } else {
          toast('Cofre criado e criptografado localmente.', 'success')
        }
      } else {
        await signIn(email, password)
        toast('Cofre desbloqueado.', 'success')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na autenticação.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Lock</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Cofre de senhas <span className="text-brand">zero-knowledge</span>
          </p>
        </div>

        <div className="card p-6 shadow-2xl">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-line bg-base p-1">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
                className={`h-9 rounded-md text-sm font-medium transition ${
                  mode === m ? 'bg-brand text-white' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                {m === 'signin' ? 'Entrar' : 'Criar cofre'}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              name="email"
              type="email"
              autoComplete="username"
              label="E-mail"
              placeholder="voce@exemplo.com"
              leading={<AtSign size={16} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              name="master"
              type={show ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
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

            {isSignup && (
              <>
                <div className="space-y-1.5">
                  <div className="flex h-1.5 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`h-full flex-1 rounded-full transition ${
                          i < strength.score
                            ? strength.score >= 3
                              ? 'bg-success'
                              : strength.score === 2
                                ? 'bg-warning'
                                : 'bg-danger-solid'
                            : 'bg-hover/10'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-ink-tertiary">
                    Força: {strength.label} · {strength.bits} bits
                  </p>
                </div>

                <Input
                  name="confirm"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  label="Confirmar senha mestra"
                  placeholder="••••••••••"
                  leading={<Lock size={16} />}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}

            <Button type="submit" loading={busy} className="w-full">
              {isSignup ? 'Criar cofre criptografado' : 'Desbloquear cofre'}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2.5 rounded-md border border-line bg-base p-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand" />
            <p className="text-xs leading-relaxed text-ink-tertiary">
              Sua senha mestra nunca sai deste dispositivo. A derivação <strong>Argon2id</strong> e a
              cifragem <strong>AES-256-GCM</strong> acontecem 100% no navegador. Se você esquecê-la,
              os dados são irrecuperáveis.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
