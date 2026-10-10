import { useEffect, useRef, useState } from 'react'
import { Dices, Eye, EyeOff } from 'lucide-react'
import { estimateStrength, generatePassword, type GeneratorOptions } from '../lib/crypto'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  autoComplete?: string
}

const STRENGTH_COLORS = ['bg-hover/10', 'bg-danger-solid', 'bg-warning', 'bg-success', 'bg-success']

export function PasswordInput({
  value,
  onChange,
  label = 'Senha',
  placeholder = '••••••••••',
  autoComplete = 'new-password',
}: PasswordInputProps) {
  const [show, setShow] = useState(false)
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<GeneratorOptions>({
    length: 20,
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
  })
  const wrapRef = useRef<HTMLDivElement>(null)
  const strength = estimateStrength(value)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function applyGenerate() {
    onChange(generatePassword(options))
    setShow(true)
    setOpen(false)
  }

  return (
    <div className="w-full" ref={wrapRef}>
      {label && <label className="label-base">{label}</label>}
      <div className="relative flex items-center">
        <input
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          spellCheck={false}
          className="input-base pr-20 font-mono text-sm tracking-wide"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="absolute right-1.5 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Gerar senha"
            title="Gerar senha"
            className="rounded-md p-2 text-ink-tertiary transition hover:text-brand"
          >
            <Dices size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            className="rounded-md p-2 text-ink-tertiary transition hover:text-ink"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {open && (
          <div className="absolute right-0 top-full z-20 mt-2 w-72 animate-scale-in rounded-lg border border-line bg-elevated p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                Comprimento
              </span>
              <span className="font-mono text-sm text-ink">{options.length}</span>
            </div>
            <input
              type="range"
              min={8}
              max={64}
              value={options.length}
              onChange={(e) => setOptions((o) => ({ ...o, length: Number(e.target.value) }))}
              className="mb-4 w-full accent-brand"
            />
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(
                [
                  ['upper', 'A-Z'],
                  ['lower', 'a-z'],
                  ['digits', '0-9'],
                  ['symbols', '!@#'],
                ] as const
              ).map(([key, text]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(options[key])}
                    onChange={(e) => setOptions((o) => ({ ...o, [key]: e.target.checked }))}
                    className="accent-brand"
                  />
                  <span className="font-mono text-xs">{text}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={applyGenerate}
              className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              Gerar senha
            </button>
          </div>
        )}
      </div>

      {value && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex h-1 flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-full flex-1 rounded-full ${i < strength.score ? STRENGTH_COLORS[strength.score] : 'bg-hover/10'}`}
              />
            ))}
          </div>
          <span className="text-[11px] tabular-nums text-ink-tertiary">{strength.bits} bits</span>
        </div>
      )}
    </div>
  )
}
