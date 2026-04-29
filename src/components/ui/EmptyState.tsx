/**
 * EmptyState – Zentrierte Leer-Zustand-Box
 *
 * Ersetzt das Copy-Paste-Muster für "Noch keine Einträge".
 *
 * @example
 * <EmptyState
 *   icon={BarChart2}
 *   title="Noch keine Umfragen"
 *   description="Sobald eine Umfrage gestartet wird, erscheint sie hier."
 * />
 */
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] p-8 text-center', className)}>
      {Icon && (
        <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon className="w-7 h-7 text-primary-400" strokeWidth={1.5} />
        </div>
      )}
      <p className="font-bold text-gray-700 text-sm">{title}</p>
      {description && (
        <p className="text-gray-400 text-xs mt-1 leading-relaxed max-w-xs mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
