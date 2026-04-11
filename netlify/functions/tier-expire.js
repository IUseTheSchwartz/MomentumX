const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getChicagoNowIso() {
  return new Date().toISOString();
}

exports.handler = async function () {
  try {
    const { data: tiers, error: tiersError } = await supabase
      .from('tiers')
      .select('id, name, duration_days')
      .not('duration_days', 'is', null);

    if (tiersError) throw tiersError;

    const tier1Like = (tiers || []).find((tier) => Number(tier.duration_days || 0) > 0);

    if (!tier1Like) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          expiredCount: 0,
          message: 'No timed tiers found.'
        })
      };
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, email, tier_id, tier_assigned_at')
      .eq('tier_id', tier1Like.id)
      .not('tier_assigned_at', 'is', null);

    if (profilesError) throw profilesError;

    const now = new Date();
    const expiredProfiles = (profiles || []).filter((profile) => {
      const assignedAt = new Date(profile.tier_assigned_at);
      if (Number.isNaN(assignedAt.getTime())) return false;

      const elapsedMs = now.getTime() - assignedAt.getTime();
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

      return elapsedDays >= Number(tier1Like.duration_days || 0);
    });

    let expiredCount = 0;

    for (const profile of expiredProfiles) {
      const before = {
        tier_id: profile.tier_id,
        tier_assigned_at: profile.tier_assigned_at
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          tier_id: null,
          tier_assigned_at: null
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('admin_logs')
        .insert({
          admin_id: null,
          action: 'Tier auto-expired',
          target_type: 'profile',
          target_id: profile.id,
          details: {
            summary: `system auto-expired ${profile.display_name || profile.email || 'agent'} from ${tier1Like.name} after ${tier1Like.duration_days} days`,
            before,
            patch: {
              tier_id: null,
              tier_assigned_at: null
            },
            system_generated: true,
            expired_at: getChicagoNowIso(),
            expired_tier_name: tier1Like.name
          }
        });

      if (logError) throw logError;

      expiredCount += 1;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        expiredCount
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: error.message || 'Tier expiration failed.'
      })
    };
  }
};
