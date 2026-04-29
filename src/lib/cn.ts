/**
 * cn – className-Hilfsfunktion
 *
 * Kombiniert clsx (konditionelle Klassen) mit tailwind-merge
 * (löst Tailwind-Klassen-Konflikte auf).
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary-500', 'px-6')
 * // → 'py-2 bg-primary-500 px-6'  (px-4 wird durch px-6 überschrieben)
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
