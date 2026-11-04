/**
 * Minimaler Ersatz für den Supabase-Client in Route-Tests.
 *
 * Jede Abfrage (`from(...)…`) und jeder RPC-Aufruf wird mitgeschrieben; die
 * Antwort liefert ein Responder, den der Test vorgibt. So prüfen Tests, WAS eine
 * Route an die Datenbank schickt (z.B. die Akteur-ID aus der Session), ohne
 * echtes Postgres. Die Regeln selbst testen die PGlite-Tests der Migrationen.
 */

export interface Abfrage {
  tabelle: string
  /** Aufgerufene Builder-Methoden in Reihenfolge, z.B. ['select', ['id']], ['eq', ['id', 'x']] */
  ops: [string, unknown[]][]
}

export interface Antwort {
  data?: unknown
  error?: { code?: string; message: string } | null
  count?: number | null
}

export type Responder = (abfrage: Abfrage) => Antwort | undefined
export type RpcResponder = (name: string, args: Record<string, unknown>) => Antwort | undefined

/** Wert eines `.eq(spalte, wert)` in einer Abfrage, oder undefined. */
export function eqWert(a: Abfrage, spalte: string): unknown {
  return a.ops.find(([op, args]) => op === 'eq' && args[0] === spalte)?.[1][1]
}

export function hatOp(a: Abfrage, op: string): boolean {
  return a.ops.some(([o]) => o === op)
}

const BUILDER_METHODEN = [
  'select', 'insert', 'update', 'delete', 'upsert',
  'eq', 'neq', 'in', 'is', 'not', 'or', 'ilike', 'gte', 'lte', 'order', 'limit',
  'single', 'maybeSingle',
] as const

export function fakeSupabase(responder: Responder = () => undefined, rpcResponder: RpcResponder = () => undefined) {
  const abfragen: Abfrage[] = []
  const rpcs: { name: string; args: Record<string, unknown> }[] = []

  function from(tabelle: string) {
    const abfrage: Abfrage = { tabelle, ops: [] }
    abfragen.push(abfrage)
    const builder: Record<string, unknown> = {}
    for (const m of BUILDER_METHODEN) {
      builder[m] = (...args: unknown[]) => { abfrage.ops.push([m, args]); return builder }
    }
    // Wie bei supabase-js: der Builder ist awaitable
    builder.then = (ok: (v: unknown) => unknown, fehler?: (e: unknown) => unknown) => {
      const einzeln = hatOp(abfrage, 'single') || hatOp(abfrage, 'maybeSingle')
      const a = responder(abfrage) ?? {}
      return Promise.resolve({
        data: a.data !== undefined ? a.data : (einzeln ? null : []),
        error: a.error ?? null,
        count: a.count ?? 0,
      }).then(ok, fehler)
    }
    return builder
  }

  async function rpc(name: string, args: Record<string, unknown> = {}) {
    rpcs.push({ name, args })
    const a = rpcResponder(name, args) ?? {}
    return { data: a.data ?? null, error: a.error ?? null }
  }

  return { client: { from, rpc } as unknown, abfragen, rpcs }
}
