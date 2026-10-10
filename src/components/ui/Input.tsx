import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, leading, trailing, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="label-base">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leading && (
          <span className="pointer-events-none absolute left-3 text-ink-tertiary">{leading}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'input-base',
            leading ? 'pl-10' : '',
            trailing ? 'pr-10' : '',
            className,
          ].join(' ')}
          {...rest}
        />
        {trailing && <span className="absolute right-1.5 flex items-center">{trailing}</span>}
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-tertiary">{hint}</p>}
    </div>
  )
})
