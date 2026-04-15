import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function buildGuildIconUrl(guild) {
  if (!guild?.id || !guild?.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
}

function truncate(value, max = 1024) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

async function sendDiscordAuditWebhook({
  webhookUrl,
  email,
  fullName,
  avatarUrl,
  discordId,
  discordUsername,
  serverId,
  inServer,
  nickname,
  guilds
}) {
  if (!webhookUrl) return;

  const guildList = Array.isArray(guilds) ? guilds : [];
  const matchingGuild = guildList.find((g) => g.id === serverId) || null;

  const guildLines = guildList.length
    ? guildList.map((guild, index) => {
        const iconUrl = buildGuildIconUrl(guild);
        return `${index + 1}. ${guild.name} (${guild.id})${iconUrl ? `\n${iconUrl}` : ''}`;
      })
    : ['No guilds returned by Discord'];

  const chunks = [];
  let currentChunk = '';

  for (const line of guildLines) {
    const next = currentChunk ? `${currentChunk}\n\n${line}` : line;
    if (next.length > 1000) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = next;
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  const embed = {
    title: inServer
      ? 'Discord login approved'
      : 'Discord login denied',
    color: inServer ? 0x11d98c : 0xff3b4d,
    thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
    fields: [
      {
        name: 'Discord username',
        value: truncate(discordUsername || 'Unknown'),
        inline: true
      },
      {
        name: 'Discord ID',
        value: truncate(discordId || 'Unknown'),
        inline: true
      },
      {
        name: 'In Momentum Financial',
        value: inServer ? 'Yes' : 'No',
        inline: true
      },
      {
        name: 'Nickname in server',
        value: truncate(nickname || 'None'),
        inline: true
      },
      {
        name: 'Email',
        value: truncate(email || 'No email returned'),
        inline: true
      },
      {
        name: 'Full name',
        value: truncate(fullName || 'Unknown'),
        inline: true
      },
      {
        name: 'Matched server',
        value: matchingGuild
          ? truncate(
              `${matchingGuild.name} (${matchingGuild.id})${
                buildGuildIconUrl(matchingGuild)
                  ? `\n${buildGuildIconUrl(matchingGuild)}`
                  : ''
              }`
            )
          : 'Not found in target server'
      },
      {
        name: `Servers returned by Discord (${guildList.length})`,
        value: truncate(chunks[0] || 'None')
      }
    ],
    footer: {
      text: 'Momentum X Discord login audit'
    },
    timestamp: new Date().toISOString()
  };

  const extraEmbeds = chunks.slice(1, 10).map((chunk, index) => ({
    title: `Additional servers ${index + 2}`,
    color: inServer ? 0x11d98c : 0xff3b4d,
    description: truncate(chunk, 4000)
  }));

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Momentum X Auth',
      avatar_url:
        'https://cdn.discordapp.com/embed/avatars/0.png',
      embeds: [
        {
          ...embed,
          fields: embed.fields.map((field) => ({
            ...field,
            value: field.value || '—'
          }))
        },
        ...extraEmbeds
      ]
    })
  });
}

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
    const webhookUrl = process.env.DISCORD_LOGIN_AUDIT_WEBHOOK_URL;

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
      // fall through silently
    }

    await sendDiscordAuditWebhook({
      webhookUrl,
      email,
      fullName,
      avatarUrl,
      discordId,
      discordUsername,
      serverId,
      inServer,
      nickname,
      guilds
    });

    if (!inServer) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Not in server' })
      };
    }

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
          display_name: finalDisplayName,
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
