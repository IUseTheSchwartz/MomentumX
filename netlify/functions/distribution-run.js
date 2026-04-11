const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getBusinessDayName(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'America/Chicago'
  }).toLowerCase();
}

function buildTypeTargets(total, leadTypes) {
  const safeTypes = Array.isArray(leadTypes) ? leadTypes.filter(Boolean) : [];
  if (!safeTypes.length || total <= 0) return [];

  const base = Math.floor(total / safeTypes.length);
  const remainder = total % safeTypes.length;

  return safeTypes.map((leadType, index) => ({
    leadType,
    target: base + (index < remainder ? 1 : 0)
  }));
}

async function fetchUnassignedLeadIds({ leadCategory, leadType, limit }) {
  if (!leadType || limit <= 0) return [];

  const { data, error } = await supabase
    .from('leads')
    .select('id')
    .is('assigned_to', null)
    .eq('lead_category', leadCategory)
    .eq('lead_type', leadType)
    .eq('status', 'New')
    .limit(limit);

  if (error) throw error;
  return (data || []).map((row) => row.id);
}

async function assignLeadIdsToAgent({ leadIds, agentId }) {
  if (!leadIds.length) return 0;

  const { data, error } = await supabase
    .from('leads')
    .update({
      assigned_to: agentId,
      assigned_at: new Date().toISOString()
    })
    .in('id', leadIds)
    .is('assigned_to', null)
    .select('id');

  if (error) throw error;
  return (data || []).length;
}

async function assignForAgent({
  agent,
  leadCategory,
  totalAmount,
  assignedSummary
}) {
  const allowedLeadTypes = Array.isArray(agent.allowed_lead_types)
    ? agent.allowed_lead_types.filter(Boolean)
    : [];

  if (!allowedLeadTypes.length || totalAmount <= 0) return 0;

  const targets = buildTypeTargets(totalAmount, allowedLeadTypes);
  let assignedForAgent = 0;

  for (const item of targets) {
    const ids = await fetchUnassignedLeadIds({
      leadCategory,
      leadType: item.leadType,
      limit: item.target
    });

    const assignedCount = await assignLeadIdsToAgent({
      leadIds: ids,
      agentId: agent.id
    });

    assignedForAgent += assignedCount;
  }

  if (!assignedSummary.byAgent[agent.id]) {
    assignedSummary.byAgent[agent.id] = {
      agentId: agent.id,
      assignedAged: 0,
      assignedFresh: 0
    };
  }

  if (leadCategory === 'aged') {
    assignedSummary.assignedAged += assignedForAgent;
    assignedSummary.byAgent[agent.id].assignedAged += assignedForAgent;
  } else if (leadCategory === 'fresh') {
    assignedSummary.assignedFresh += assignedForAgent;
    assignedSummary.byAgent[agent.id].assignedFresh += assignedForAgent;
  }

  return assignedForAgent;
}

async function assignLeadsForBucket({
  tierId,
  leadCategory,
  amount,
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
    const assignedCount = await assignForAgent({
      agent,
      leadCategory,
      totalAmount: amount,
      assignedSummary
    });

    totalAssigned += assignedCount;
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
    const today = getBusinessDayName();

    let rulesQuery = supabase
      .from('distribution_rules')
      .select('id, tier_id, aged_amount, aged_day_of_week, fresh_amount, fresh_day_of_week, active');

    if (ruleId) {
      rulesQuery = rulesQuery.eq('id', ruleId);
    } else {
      rulesQuery = rulesQuery.eq('active', true);
    }

    const { data: rules, error: rulesError } = await rulesQuery;
    if (rulesError) throw rulesError;

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, tier_id, leads_paused, lead_access_banned, allowed_lead_types');

    if (profilesError) throw profilesError;

    const summary = {
      processedRules: 0,
      assignedAged: 0,
      assignedFresh: 0,
      businessDay: today,
      byAgent: {}
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
          profiles,
          assignedSummary: summary
        });
      }

      if (shouldRunFresh) {
        await assignLeadsForBucket({
          tierId: rule.tier_id,
          leadCategory: 'fresh',
          amount: Number(rule.fresh_amount || 0),
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
