/**
 * Card – Weiße Box mit abgerundeten Ecken und Schatten
 *
 * @example
 * <Card>Inhalt</Card>
 * <Card padding="none"><img /></Card>
 * <Card className="mt-4">Mit extra Abstand</Card>
 */
import { cn } from '@/lib/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Innenabstand: 'default' (p-4) | 'lg' (p-6) | 'none' */
  padding?: 'default' | 'lg' | 'none'
}

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  default: 'p-4',
  lg: 'p-6',
  none: '',
}

export function Card({ padding = 'default', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] overflow-hidden',
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
