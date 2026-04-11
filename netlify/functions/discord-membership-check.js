import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: 'ok'
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      providerToken,
      userId,
      email,
      fullName,
      avatarUrl,
      discordId,
      discordUsername
    } = body;

    if (!providerToken || !userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Missing provider token or user id' })
      };
    }

    const serverId = process.env.DISCORD_SERVER_ID;

    // STEP 1: confirm user is in guild
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${providerToken}`
      }
    });

    if (!guildsRes.ok) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Discord guild lookup failed' })
      };
    }

    const guilds = await guildsRes.json();
    const inServer = Array.isArray(guilds) && guilds.some((g) => g.id === serverId);

    if (!inServer) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Not in server' })
      };
    }

    // STEP 2: fetch guild member to get nickname
    let nickname = null;

    try {
      const memberRes = await fetch(
        `https://discord.com/api/users/@me/guilds/${serverId}/member`,
        {
          headers: {
            Authorization: `Bearer ${providerToken}`
          }
        }
      );

      if (memberRes.ok) {
        const member = await memberRes.json();
        nickname = member?.nick || null;
      }
    } catch {
      // silently fail — fallback below
    }

    // FINAL NAME PRIORITY
    const finalDisplayName =
      nickname ||
      discordUsername ||
      fullName ||
      email ||
      'Momentum Agent';

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const defaults = {
      id: userId,
      email: email || null,
      discord_id: discordId,
      discord_username: discordUsername || email || 'discord-user',
      display_name: finalDisplayName,
      avatar_url: avatarUrl,
      allowed_lead_types: ['Veteran'],
      leads_paused: false,
      lead_access_banned: false
    };

    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('profiles').insert(defaults);
    } else {
      await supabase
        .from('profiles')
        .update({
          email: email || existing.email,
          discord_id: discordId || existing.discord_id,
          discord_username: discordUsername || existing.discord_username,
          display_name: finalDisplayName, // 🔥 ALWAYS SYNC NAME
          avatar_url: avatarUrl || existing.avatar_url
        })
        .eq('id', userId);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        inServer: true,
        banned: !!profile.lead_access_banned,
        isAdmin: !!profile.is_admin
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        error: error.message || 'Unexpected error'
      })
    };
  }
}
