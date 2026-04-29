/**
 * Badge – Status- und Tag-Label
 *
 * Varianten: default | success | warning | danger | info | purple | orange
 *
 * @example
 * <Badge variant="success">Erledigt</Badge>
 * <Badge variant="warning">In Bearbeitung</Badge>
 * <Badge variant="danger">Offen</Badge>
 */
import { cn } from '@/lib/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'orange'
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default:  'bg-gray-100 text-gray-600',
  success:  'bg-green-50 text-green-700',
  warning:  'bg-amber-50 text-amber-700',
  danger:   'bg-red-50 text-red-600',
  info:     'bg-primary-100 text-primary-700',
  purple:   'bg-purple-100 text-purple-700',
  orange:   'bg-orange-100 text-orange-700',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
