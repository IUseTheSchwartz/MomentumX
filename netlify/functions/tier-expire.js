const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isTierOne(tier) {
  const name = String(tier?.name || '').trim().toLowerCase();
  return name.includes('tier 1');
}

exports.handler = async function () {
  try {
    const { data: tiers, error: tiersError } = await supabase
      .from('tiers')
      .select('id, name, duration_days, sort_order');

    if (tiersError) throw tiersError;

    const tier1 = (tiers || []).find((tier) => isTierOne(tier));

    if (!tier1) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          expiredCount: 0,
          message: 'Tier 1 not found.'
        })
      };
    }

    if (!tier1.duration_days || Number(tier1.duration_days) <= 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          expiredCount: 0,
          message: 'Tier 1 has no timed duration configured.'
        })
      };
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, email, tier_id, tier_assigned_at')
      .eq('tier_id', tier1.id)
      .not('tier_assigned_at', 'is', null);

    if (profilesError) throw profilesError;

    const now = new Date();
    const expiredProfiles = (profiles || []).filter((profile) => {
      const assignedAt = new Date(profile.tier_assigned_at);
      if (Number.isNaN(assignedAt.getTime())) return false;

      const elapsedMs = now.getTime() - assignedAt.getTime();
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

      return elapsedDays >= Number(tier1.duration_days);
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
          action: 'Tier 1 auto-expired',
          target_type: 'profile',
          target_id: profile.id,
          details: {
            summary: `system auto-expired ${profile.display_name || profile.email || 'agent'} from ${tier1.name} after ${tier1.duration_days} days`,
            before,
            patch: {
              tier_id: null,
              tier_assigned_at: null
            },
            system_generated: true,
            expired_tier_name: tier1.name,
            expired_after_days: tier1.duration_days,
            expired_at: new Date().toISOString()
          }
        });

      if (logError) throw logError;

      expiredCount += 1;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        expiredCount,
        tierName: tier1.name
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
