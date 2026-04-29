/**
 * Button – Dorfly Basis-Button-Komponente
 *
 * Varianten: primary | secondary | ghost | danger
 * Größen:    sm | md (Standard) | lg
 *
 * @example
 * <Button variant="primary" size="lg" fullWidth>Speichern</Button>
 * <Button variant="ghost" loading>Lädt...</Button>
 */
import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  loading?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary-500 text-white font-semibold hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50',
  secondary:
    'bg-white border-2 border-primary-500 text-primary-500 font-semibold hover:bg-primary-50 active:bg-primary-100 disabled:opacity-50',
  ghost:
    'bg-transparent text-primary-500 font-semibold hover:bg-primary-50 active:bg-primary-100 disabled:opacity-50',
  danger:
    'bg-accent-500 text-white font-semibold hover:bg-accent-600 active:bg-accent-700 disabled:opacity-50',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
  md: 'px-4 py-3 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3.5 text-base rounded-2xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
