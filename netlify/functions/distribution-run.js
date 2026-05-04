const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROGRAM_DAYS = 70;

function getDaysLeft(profile) {
  if (!profile?.lead_program_active) return 0;
  if (!profile?.lead_program_started_at) return PROGRAM_DAYS;

  const start = new Date(profile.lead_program_started_at);
  if (Number.isNaN(start.getTime())) return 0;

  const elapsedDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, PROGRAM_DAYS - elapsedDays);
}

function isEligibleAgent(profile) {
  if (!profile?.lead_program_active) return false;
  if (profile?.leads_paused) return false;
  if (profile?.lead_access_banned) return false;
  if (getDaysLeft(profile) <= 0) return false;

  const allowedLeadTypes = Array.isArray(profile.allowed_lead_types)
    ? profile.allowed_lead_types.filter(Boolean)
    : [];

  return allowedLeadTypes.length > 0;
}

async function fetchUnassignedLeadIds({ leadCategory, leadType, limit }) {
  if (!leadCategory || !leadType || limit <= 0) return [];

  const { data, error } = await supabase
    .from('leads')
    .select('id')
    .is('assigned_to', null)
    .eq('lead_category', leadCategory)
    .eq('lead_type', leadType)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row) => row.id);
}

async function assignLeadIdsToAgent({ leadIds, agentId }) {
  if (!leadIds.length || !agentId) return 0;

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

async function fetchAvailableCountsByType({ leadCategory, leadTypes }) {
  const safeTypes = Array.isArray(leadTypes) ? leadTypes.filter(Boolean) : [];
  const counts = {};

  await Promise.all(
    safeTypes.map(async (leadType) => {
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .is('assigned_to', null)
        .eq('lead_category', leadCategory)
        .eq('lead_type', leadType);

      if (error) throw error;
      counts[leadType] = Number(count || 0);
    })
  );

  return counts;
}

function buildPreferredTypeOrder({ leadTypes, availableCounts }) {
  return [...leadTypes].sort((a, b) => {
    const aCount = Number(availableCounts[a] || 0);
    const bCount = Number(availableCounts[b] || 0);

    if (bCount !== aCount) return bCount - aCount;
    return a.localeCompare(b);
  });
}

async function assignCategoryForAgent({ agent, leadCategory, amount, summary }) {
  const targetAmount = Number(amount || 0);
  if (targetAmount <= 0) return 0;

  const allowedLeadTypes = Array.isArray(agent.allowed_lead_types)
    ? agent.allowed_lead_types.filter(Boolean)
    : [];

  if (!allowedLeadTypes.length) return 0;

  const availableCounts = await fetchAvailableCountsByType({
    leadCategory,
    leadTypes: allowedLeadTypes
  });

  const orderedTypes = buildPreferredTypeOrder({
    leadTypes: allowedLeadTypes,
    availableCounts
  });

  let remainingNeeded = targetAmount;
  let assignedForAgent = 0;
  const assignedByType = {};

  for (const leadType of orderedTypes) {
    if (remainingNeeded <= 0) break;

    const available = Number(availableCounts[leadType] || 0);
    if (available <= 0) continue;

    const requested = Math.min(remainingNeeded, available);

    const ids = await fetchUnassignedLeadIds({
      leadCategory,
      leadType,
      limit: requested
    });

    const assignedCount = await assignLeadIdsToAgent({
      leadIds: ids,
      agentId: agent.id
    });

    if (assignedCount > 0) {
      assignedForAgent += assignedCount;
      remainingNeeded -= assignedCount;
      assignedByType[leadType] = Number(assignedByType[leadType] || 0) + assignedCount;
      availableCounts[leadType] = Math.max(0, available - assignedCount);
    }
  }

  if (!summary.byAgent[agent.id]) {
    summary.byAgent[agent.id] = {
      agentId: agent.id,
      agentName: agent.display_name || agent.email || 'Unnamed Agent',
      daysLeft: getDaysLeft(agent),
      assignedAged: 0,
      assignedFresh: 0,
      assignedTotal: 0,
      assignedAgedByType: {},
      assignedFreshByType: {}
    };
  }

  const agentSummary = summary.byAgent[agent.id];

  if (leadCategory === 'aged') {
    summary.assignedAged += assignedForAgent;
    agentSummary.assignedAged += assignedForAgent;

    for (const [leadType, count] of Object.entries(assignedByType)) {
      agentSummary.assignedAgedByType[leadType] =
        Number(agentSummary.assignedAgedByType[leadType] || 0) + count;
    }
  }

  if (leadCategory === 'fresh') {
    summary.assignedFresh += assignedForAgent;
    agentSummary.assignedFresh += assignedForAgent;

    for (const [leadType, count] of Object.entries(assignedByType)) {
      agentSummary.assignedFreshByType[leadType] =
        Number(agentSummary.assignedFreshByType[leadType] || 0) + count;
    }
  }

  summary.assignedTotal += assignedForAgent;
  agentSummary.assignedTotal += assignedForAgent;

  return assignedForAgent;
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({
          ok: false,
          error: 'Method not allowed.'
        })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const setupId = body.setupId || null;

    if (!setupId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          error: 'Missing setupId.'
        })
      };
    }

    const { data: setup, error: setupError } = await supabase
      .from('lead_distribution_setups')
      .select('*')
      .eq('id', setupId)
      .eq('active', true)
      .maybeSingle();

    if (setupError) throw setupError;

    if (!setup) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          ok: false,
          error: 'Distribution setup not found or inactive.'
        })
      };
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(
        'id, display_name, email, lead_program_active, lead_program_started_at, leads_paused, lead_access_banned, allowed_lead_types'
      );

    if (profilesError) throw profilesError;

    const eligibleAgents = (profiles || []).filter(isEligibleAgent);

    const summary = {
      setupId: setup.id,
      setupName: setup.name,
      agedPerAgent: Number(setup.aged_amount || 0),
      freshPerAgent: Number(setup.fresh_amount || 0),
      totalPerAgent: Number(setup.aged_amount || 0) + Number(setup.fresh_amount || 0),
      eligibleAgents: eligibleAgents.length,
      assignedAged: 0,
      assignedFresh: 0,
      assignedTotal: 0,
      byAgent: {}
    };

    for (const agent of eligibleAgents) {
      await assignCategoryForAgent({
        agent,
        leadCategory: 'aged',
        amount: Number(setup.aged_amount || 0),
        summary
      });

      await assignCategoryForAgent({
        agent,
        leadCategory: 'fresh',
        amount: Number(setup.fresh_amount || 0),
        summary
      });
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
