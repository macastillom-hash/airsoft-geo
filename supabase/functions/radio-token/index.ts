// Edge Function: radio-token. NO pegar LIVEKIT_API_SECRET en el frontend ni GitHub.
// Desplegar con verificación de JWT habilitada y guardar LIVEKIT_* en Secrets de Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import { SignJWT } from 'npm:jose@6.1.0';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond(405, { error: 'Método no permitido' });

  const jwt = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt || jwt.length > 4096) return respond(401, { error: 'Sesión requerida' });

  let teamId: string;
  try {
    const body = await request.json();
    teamId = typeof body?.teamId === 'string' ? body.teamId.trim().toLowerCase() : '';
  } catch { return respond(400, { error: 'JSON inválido' }); }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(teamId)) {
    return respond(400, { error: 'Equipo inválido' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
  const url = Deno.env.get('LIVEKIT_URL');
  const apiKey = Deno.env.get('LIVEKIT_API_KEY');
  const secret = Deno.env.get('LIVEKIT_API_SECRET');
  if (!supabaseUrl || !supabaseKey || !url || !apiKey || !secret || !/^wss:\/\//.test(url)) {
    return respond(503, { error: 'Radio no configurada en el servidor' });
  }

  try {
    // El acceso a la base de datos usa las políticas RLS del usuario autenticado.
    const client = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Verificación remota de sesión real; nunca confiar en identidad enviada en JSON.
    const { data: userData, error: authError } = await client.auth.getUser(jwt);
    const user = userData?.user;
    if (authError || !user?.id || user.is_anonymous) return respond(401, { error: 'Sesión inválida' });

    const { data: member, error: memberError } = await client.from('team_members')
      .select('team_id').eq('team_id', teamId).eq('user_id', user.id).maybeSingle();
    if (memberError) return respond(503, { error: 'No se pudo verificar la membresía' });
    if (!member) return respond(403, { error: 'No perteneces a este equipo' });

    const room = `airsoft-team-${teamId}`;
    const token = await new SignJWT({
      name: 'Participante',
      video: {
        roomJoin: true,
        room,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        canPublishSources: ['microphone'],
      },
    }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(apiKey)
      .setSubject(user.id)
      .setIssuedAt()
      .setNotBefore('0s')
      .setExpirationTime('5m')
      .setJti(crypto.randomUUID())
      .sign(new TextEncoder().encode(secret));

    return respond(200, { url, token, room, expiresIn: 300 });
  } catch {
    // No mostrar excepciones, secretos, tokens o errores internos al usuario.
    return respond(500, { error: 'No fue posible preparar la radio' });
  }
});
