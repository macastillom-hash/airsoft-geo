// Edge Function: radio-token. NO pegar LIVEKIT_API_SECRET en el frontend ni GitHub.
// Verifica el JWT explícitamente con Supabase Auth; deploy verify_jwt=false para claves publishable.
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
  let supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseKey) {
    try {
      const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
      supabaseKey = typeof keys.default === 'string' ? keys.default : null;
    } catch { supabaseKey = null; }
  }
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

    // Diagnóstico temporal: verificar desde el servidor la pareja API Key/Secret
    // sin exponer secretos, tokens de administración ni el listado de salas.
    // El resultado de la solicitud se usa solo para distinguir credenciales
    // rechazadas de errores del navegador o un token con permisos incorrectos.
    if (secret !== secret.trim() || secret.length < 32 || /[\r\n]/.test(secret) ||
        secret.startsWith('LIVEKIT_API_SECRET=') || secret.includes('•')) {
      return respond(503, { error: 'La variable LIVEKIT_API_SECRET parece incompleta o incluye texto adicional. Vuelve a copiar solo el valor real desde LiveKit Cloud a Supabase Secrets.' });
    }
    if (apiKey !== apiKey.trim() || apiKey.includes('=') || apiKey.length < 12) {
      return respond(503, { error: 'LIVEKIT_API_KEY no tiene el formato esperado. Vuelve a copiar la API Key del mismo proyecto LiveKit.' });
    }
    const cloud = new URL(url.replace(/^wss:/, 'https:'));
    if (cloud.protocol !== 'https:' || !cloud.hostname.endsWith('.livekit.cloud')) {
      return respond(503, { error: 'LIVEKIT_URL no corresponde a una dirección de proyecto LiveKit Cloud.' });
    }
    const controlToken = await new SignJWT({ video: { roomList: true } })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(apiKey).setIssuedAt().setNotBefore('-30s')
      .setExpirationTime('2m')
      .sign(new TextEncoder().encode(secret));
    let controlResponse: Response;
    try {
      controlResponse = await fetch(cloud.origin + '/twirp/livekit.RoomService/ListRooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${controlToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: AbortSignal.timeout(6500),
      });
    } catch {
      return respond(503, { error: 'No se pudo verificar la conexión segura entre Supabase y LiveKit. Reintenta más tarde.' });
    }
    if (controlResponse.status === 401 || controlResponse.status === 403) {
      return respond(503, { error: 'LiveKit rechaza las credenciales del servidor. Comprueba que LIVEKIT_API_KEY y LIVEKIT_API_SECRET pertenezcan al proyecto indicado por LIVEKIT_URL y vuelve a guardarlas en Supabase.' });
    }
    if (!controlResponse.ok) {
      return respond(503, { error: 'LiveKit no aceptó la prueba de conexión del servidor (HTTP ' + controlResponse.status + ').' });
    }

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
      .setSubject(user.id + ':' + crypto.randomUUID())
      .setIssuedAt()
      .setNotBefore('-30s')
      .setExpirationTime('5m')
      .setJti(crypto.randomUUID())
      .sign(new TextEncoder().encode(secret));

    return respond(200, { url, token, room, expiresIn: 300 });
  } catch {
    // No mostrar excepciones, secretos, tokens o errores internos al usuario.
    return respond(500, { error: 'No fue posible preparar la radio' });
  }
});
