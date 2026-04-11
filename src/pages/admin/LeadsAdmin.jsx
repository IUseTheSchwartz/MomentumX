import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import StatCard from '../../components/StatCard';

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(1)}%`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Overview() {
  const [profiles, setProfiles] = useState([]);
  const [leads, setLeads] = useState([]);
  const [rules, setRules] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [
        { data: profileRows },
        { data: leadRows },
        { data: ruleRows },
        { data: tierRows }
      ] = await Promise.all([
        supabase.from('profiles').select('id, leads_paused, lead_access_banned'),
        supabase.from('leads').select('id, assigned_to, sale, ap_sold, status'),
        supabase.from('distribution_rules').select('id, active'),
        supabase.from('tiers').select('id, active')
      ]);

      setProfiles(profileRows || []);
      setLeads(leadRows || []);
      setRules(ruleRows || []);
      setTiers(tierRows || []);
      setLoading(false);
    }

    load();
  }, []);

  const stats = useMemo(() => {
    const totalAgents = profiles.length;
    const activeAgents = profiles.filter((row) => !row.leads_paused && !row.lead_access_banned).length;

    const unassignedLeads = leads.filter((row) => !row.assigned_to).length;
    const assignedLeads = leads.filter((row) => !!row.assigned_to).length;

    const soldLeads = leads.filter((row) => row.sale === true).length;
    const totalAp = leads.reduce((sum, row) => sum + Number(row.ap_sold || 0), 0);

    const conversionRate = assignedLeads > 0 ? (soldLeads / assignedLeads) * 100 : 0;

    const activeTiers = tiers.filter((row) => row.active).length;
    const activeRules = rules.filter((row) => row.active).length;

    return {
      totalAgents,
      activeAgents,
      unassignedLeads,
      soldLeads,
      totalAp,
      conversionRate,
      activeTiers,
      activeRules
    };
  }, [profiles, leads, rules, tiers]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Admin Overview</h1>
          <p>Team-wide performance, lead inventory, and admin controls at a glance.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard
          label="Agents"
          value={loading ? '—' : stats.totalAgents}
          subtext={loading ? '' : `${stats.activeAgents} eligible for leads`}
        />
        <StatCard
          label="Unassigned Leads"
          value={loading ? '—' : stats.unassignedLeads}
          subtext="Available inventory"
        />
        <StatCard
          label="Team AP"
          value={loading ? '—' : formatMoney(stats.totalAp)}
          subtext={`${stats.soldLeads} sold leads`}
        />
        <StatCard
          label="Team Conversion"
          value={loading ? '—' : formatPercent(stats.conversionRate)}
          subtext="Sold / assigned leads"
        />
      </div>

      <div className="grid grid-4 top-gap">
        <StatCard
          label="Active Tiers"
          value={loading ? '—' : stats.activeTiers}
        />
        <StatCard
          label="Distribution Rules"
          value={loading ? '—' : stats.activeRules}
          subtext="Tier-based rules"
        />
      </div>
    </div>
  );
}
