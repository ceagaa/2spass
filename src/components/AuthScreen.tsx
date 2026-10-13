import { useRef, useState, type FormEvent } from 'react'
import {
  AtSign,
  Cloud,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  WifiOff,
} from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { estimateStrength } from '../lib/crypto'
import { downloadTextFile } from '../lib/download'

type Mode = 'signin' | 'signup'

const HIGHLIGHTS = [
  { icon: <Lock size={15} />, text: 'Suas senhas são criptografadas no seu aparelho antes de qualquer envio.' },
  { icon: <Cloud size={15} />, text: 'O cofre acompanha você em qualquer dispositivo, com sincronização automática.' },
  { icon: <WifiOff size={15} />, text: 'Funciona offline e bloqueia sozinho após 15 minutos de inatividade.' },
]

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
  const emailRef = useRef<HTMLInputElement>(null)

  const strength = estimateStrength(password)
  const isSignup = mode === 'signup'
  const canDownload = isSignup && password.length >= 8 && confirm.length > 0 && password === confirm

  function goTo(next: Mode) {
    setMode(next)
    setError(null)
    requestAnimationFrame(() => emailRef.current?.focus())
  }

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

  function onDownloadMasterPassword() {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      `2spass-senha-mestra-${stamp}.txt`,
      [
        '2sPass — Senha mestra',
        '',
        `Conta: ${email.trim()}`,
        `Senha mestra: ${password}`,
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        '',
        'Guarde este arquivo em um local seguro e não compartilhe com ninguém.',
        '',
      ].join('\n'),
    )
    toast('Senha mestra baixada. Guarde o arquivo em local seguro.', 'success')
  }

  return (
    <div className="screen-safe relative flex min-h-full items-center justify-center">
      <div className="top-safe absolute right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 items-center gap-10 px-4 py-10 lg:grid-cols-2 lg:gap-16">
        {/* CTA + explicação (primeiro no mobile) */}
        <section className="animate-fade-in">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink">2sPass</h1>
              <p className="text-sm text-ink-secondary">Cofre de senhas</p>
            </div>
          </div>

          <h2 className="mt-8 text-3xl font-bold leading-tight tracking-tight text-ink lg:text-4xl">
            Suas senhas trancadas no seu dispositivo.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-secondary lg:text-[16px]">
            O 2sPass guarda suas senhas em um cofre criptografado dentro do navegador. Você abre
            ele com a sua senha mestra — e só você tem essa chave.
          </p>

          <ul className="mt-6 space-y-3">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight.text} className="flex items-start gap-3 text-sm text-ink-secondary">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
                  {highlight.icon}
                </span>
                {highlight.text}
              </li>
            ))}
          </ul>
        </section>

        {/* Formulário */}
        <section className="card w-full animate-fade-in p-6 shadow-2xl sm:max-w-md lg:mx-0 lg:max-w-none">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-line bg-base p-1">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => goTo(m)}
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
              ref={emailRef}
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

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canDownload}
                  onClick={onDownloadMasterPassword}
                  className="w-full"
                >
                  <Download size={14} /> Baixar senha mestra (.txt)
                </Button>
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
        </section>
      </div>
    </div>
  )
}
