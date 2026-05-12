'use client'

import type { ProduzentenAccount } from './types'

type Props = {
  rolle: string
  accounts: ProduzentenAccount[]
}

export default function ProduzentenTab({ rolle, accounts }: Props) {
  const active = accounts.filter(a => a.is_active).length
  const hasSubscribers = rolle === 'verein' || rolle === 'gewerbe'

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        <span className="font-semibold text-gray-900">{active}</span>
        {' / '}
        <span className="font-semibold text-gray-900">{accounts.length}</span>
        {' aktiv'}
        {accounts.length > 0 && (
          <span className="ml-1 text-gray-400">
            ({Math.round((active / accounts.length) * 100)} %)
          </span>
        )}
      </p>

      {accounts.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Keine Accounts gefunden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-medium text-gray-500">Name</th>
                <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Posts 7d</th>
                <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Posts 30d</th>
                {hasSubscribers && (
                  <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Abonnenten</th>
                )}
                <th className="px-4 py-2.5 font-medium text-gray-500 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map(account => (
                <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[200px] truncate">
                    {account.name}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {account.posts_7d}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {account.posts_30d}
                  </td>
                  {hasSubscribers && (
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {account.subscribers ?? '–'}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-center">
                    {account.is_active ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Aktiv
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Inaktiv
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
