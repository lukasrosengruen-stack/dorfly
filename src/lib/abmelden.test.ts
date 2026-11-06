import { describe, expect, it, vi } from 'vitest'
import { abmelden } from './abmelden'

describe('abmelden', () => {
  it('meldet erst bei OneSignal ab, dann bei Supabase', async () => {
    const reihenfolge: string[] = []
    await abmelden({
      oneSignalAbmelden: async () => { reihenfolge.push('onesignal') },
      signOut: async () => { reihenfolge.push('supabase') },
    })
    expect(reihenfolge).toEqual(['onesignal', 'supabase'])
  })

  it('meldet bei Supabase auch ab, wenn OneSignal scheitert', async () => {
    const signOut = vi.fn(async () => {})
    const konsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    await abmelden({
      oneSignalAbmelden: async () => { throw new Error('SDK nicht geladen') },
      signOut,
    })
    expect(signOut).toHaveBeenCalledOnce()
    expect(konsole).toHaveBeenCalled()
    konsole.mockRestore()
  })

  it('reicht einen Fehler von Supabase weiter', async () => {
    await expect(abmelden({
      oneSignalAbmelden: async () => {},
      signOut: async () => { throw new Error('Netzwerk weg') },
    })).rejects.toThrow('Netzwerk weg')
  })
})
