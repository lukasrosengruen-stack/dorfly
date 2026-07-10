import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  const { data, error } = await supabase.rpc('debug_auth')

  return NextResponse.json({
    user_id: user?.id ?? null,
    user_error: userError?.message ?? null,
    rpc_data: data,
    rpc_error: error?.message ?? null,
  })
}
