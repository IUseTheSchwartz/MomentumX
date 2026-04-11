const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getUtcDayName(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC'
  }).toLowerCase();
}

async function assignLeadsForBucket({
  tierId,
  leadCategory,
  amount,
  agentDayName,
  profiles,
  assignedSummary
}) {
  if (!amount || amount <= 0) return 0;

  const eligibleAgents = profiles.filter((profile) => {
    if (profile.leads_paused) return false;
    if (profile.lead_access_banned) return false;
    if (profile.tier_id !== tierId) return false;
    return true;
  });

  if (!eligibleAgents.length) return 0;

  let totalAssigned = 0;

  for (const agent of eligibleAgents) {
    const allowedLeadTypes = Array.isArray(agent.allowed_lead_types)
      ? agent.allowed_lead_types
      : [];

    if (!allowedLeadTypes.length) continue;

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, lead_type')
      .is('assigned_to', null)
      .eq('lead_category', leadCategory)
      .eq('status', 'New')
      .in('lead_type', allowedLeadTypes)
      .limit(amount);

    if (leadsError) {
      throw leadsError;
    }

    if (!leads || !leads.length) continue;

    const leadIds = leads.map((lead) => lead.id);

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        assigned_to: agent.id,
        assigned_at: new Date().toISOString()
      })
      .in('id', leadIds);

    if (updateError) {
      throw updateError;
    }

    totalAssigned += leadIds.length;
  }

  if (leadCategory === 'aged') {
    assignedSummary.assignedAged += totalAssigned;
  } else if (leadCategory === 'fresh') {
    assignedSummary.assignedFresh += totalAssigned;
  }

  return totalAssigned;
}

exports.handler = async function (event) {
  try {
    const method = event.httpMethod || 'GET';

    let body = {};
    if (method === 'POST' && event.body) {
      body = JSON.parse(event.body);
    }

    const force = Boolean(body.force);
    const ruleId = body.ruleId || null;
    const today = getUtcDayName();

    let rulesQuery = supabase
      .from('distribution_rules')
      .select('id, tier_id, aged_amount, aged_day_of_week, fresh_amount, fresh_day_of_week, active');

    if (ruleId) {
      rulesQuery = rulesQuery.eq('id', ruleId);
    } else {
      rulesQuery = rulesQuery.eq('active', true);
    }

    const { data: rules, error: rulesError } = await rulesQuery;

    if (rulesError) {
      throw rulesError;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, tier_id, leads_paused, lead_access_banned, allowed_lead_types');

    if (profilesError) {
      throw profilesError;
    }

    const summary = {
      processedRules: 0,
      assignedAged: 0,
      assignedFresh: 0
    };

    for (const rule of rules || []) {
      summary.processedRules += 1;

      const shouldRunAged =
        force || (
          Number(rule.aged_amount || 0) > 0 &&
          rule.aged_day_of_week &&
          rule.aged_day_of_week.toLowerCase() === today
        );

      const shouldRunFresh =
        force || (
          Number(rule.fresh_amount || 0) > 0 &&
          rule.fresh_day_of_week &&
          rule.fresh_day_of_week.toLowerCase() === today
        );

      if (shouldRunAged) {
        await assignLeadsForBucket({
          tierId: rule.tier_id,
          leadCategory: 'aged',
          amount: Number(rule.aged_amount || 0),
          agentDayName: today,
          profiles,
          assignedSummary: summary
        });
      }

      if (shouldRunFresh) {
        await assignLeadsForBucket({
          tierId: rule.tier_id,
          leadCategory: 'fresh',
          amount: Number(rule.fresh_amount || 0),
          agentDayName: today,
          profiles,
          assignedSummary: summary
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        summary
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: error.message || 'Distribution run failed.'
      })
    };
  }
};
