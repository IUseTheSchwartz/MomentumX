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

function isSoldLead(lead) {
  if (!lead) return false;

  const status = String(lead.status || '').trim().toLowerCase();
  const apSold = Number(lead.ap_sold || 0);

  return (
    lead.sale === true ||
    status === 'sold' ||
    apSold > 0 ||
    Boolean(lead.sale_date) ||
    Boolean(lead.company_sold) ||
    Boolean(lead.product_sold)
  );
}

function getLeadAp(lead) {
  return isSoldLead(lead) ? Number(lead.ap_sold || 0) : 0;
}

function LeaderboardCard({ title, rows, renderValue }) {
  return (
    <div className="glass" style={{ padding: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{title}</div>

      {!rows.length ? (
        <div style={{ opacity: 0.75 }}>No data yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row, index) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>
                  #{index + 1} {row.display_name || row.email || 'Unnamed Agent'}
                </div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>{row.email || 'No email'}</div>
              </div>

              <div style={{ fontSize: 20, fontWeight: 800 }}>{renderValue(row)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Overview() {
  const [profiles, setProfiles] = useState([]);
  const [assignedLeads, setAssignedLeads] = useState([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [rules, setRules] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [kpiRows, setKpiRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage('');

      try {
        const [
          { data: profileRows, error: profileError },
          { data: leadRows, error: leadError },
          { count: unassignedLeadCount, error: unassignedError },
          { data: ruleRows },
          { data: tierRows },
          { data: kpiEntryRows, error: kpiError }
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name, email, leads_paused, lead_access_banned'),
          supabase
            .from('leads')
            .select(
              'id, assigned_to, sale, ap_sold, status, sale_date, company_sold, product_sold'
            )
            .not('assigned_to', 'is', null),
          supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .is('assigned_to', null),
          supabase.from('distribution_rules').select('id, active'),
          supabase.from('tiers').select('id, active'),
          supabase
            .from('kpi_entries')
            .select('id, agent_id, dials, contacts, sits, sales, ap_sold')
        ]);

        if (profileError) throw profileError;
        if (leadError) throw leadError;
        if (unassignedError) throw unassignedError;
        if (kpiError) throw kpiError;

        setProfiles(profileRows || []);
        setAssignedLeads(leadRows || []);
        setUnassignedCount(unassignedLeadCount || 0);
        setRules(ruleRows || []);
        setTiers(tierRows || []);
        setKpiRows(kpiEntryRows || []);
      } catch (error) {
        console.error('Failed to load admin overview:', error);
        setMessage(error.message || 'Failed to load admin overview.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const stats = useMemo(() => {
    const totalAgents = profiles.length;
    const activeAgents = profiles.filter(
      (row) => !row.leads_paused && !row.lead_access_banned
    ).length;

    const assignedLeadCount = assignedLeads.length;
    const soldLeads = assignedLeads.filter(isSoldLead).length;
    const totalAp = assignedLeads.reduce((sum, row) => sum + getLeadAp(row), 0);

    const conversionRate = assignedLeadCount > 0 ? (soldLeads / assignedLeadCount) * 100 : 0;

    const activeTiers = tiers.filter((row) => row.active).length;
    const activeRules = rules.filter((row) => row.active).length;

    return {
      totalAgents,
      activeAgents,
      unassignedLeads: unassignedCount,
      assignedLeads: assignedLeadCount,
      soldLeads,
      totalAp,
      conversionRate,
      activeTiers,
      activeRules
    };
  }, [profiles, assignedLeads, rules, tiers, unassignedCount]);

  const leaderboards = useMemo(() => {
    const byAgent = new Map();

    for (const profile of profiles) {
      byAgent.set(profile.id, {
        id: profile.id,
        display_name: profile.display_name,
        email: profile.email,
        assignedLeads: 0,
        soldLeads: 0,
        apSold: 0,
        dials: 0,
        contacts: 0,
        sits: 0,
        sales: 0,
        kpiOutput: 0,
        conversionRate: 0
      });
    }

    for (const lead of assignedLeads) {
      if (!lead.assigned_to || !byAgent.has(lead.assigned_to)) continue;

      const row = byAgent.get(lead.assigned_to);
      const sold = isSoldLead(lead);

      row.assignedLeads += 1;

      if (sold) {
        row.soldLeads += 1;
        row.apSold += getLeadAp(lead);
      }
    }

    for (const entry of kpiRows) {
      if (!entry.agent_id || !byAgent.has(entry.agent_id)) continue;

      const row = byAgent.get(entry.agent_id);

      row.dials += Number(entry.dials || 0);
      row.contacts += Number(entry.contacts || 0);
      row.sits += Number(entry.sits || 0);
      row.sales += Number(entry.sales || 0);

      if (Number(entry.ap_sold || 0) > 0 && row.apSold <= 0) {
        row.apSold += Number(entry.ap_sold || 0);
      }

      row.kpiOutput = row.dials + row.contacts + row.sits + row.sales;
    }

    const rows = Array.from(byAgent.values()).map((row) => ({
      ...row,
      conversionRate: row.assignedLeads > 0 ? (row.soldLeads / row.assignedLeads) * 100 : 0
    }));

    return {
      ap: rows
        .filter((row) => row.apSold > 0)
        .sort((a, b) => b.apSold - a.apSold)
        .slice(0, 5),
      sales: rows
        .filter((row) => row.soldLeads > 0)
        .sort((a, b) => b.soldLeads - a.soldLeads)
        .slice(0, 5),
      conversion: rows
        .filter((row) => row.assignedLeads > 0 && row.soldLeads > 0)
        .sort((a, b) => b.conversionRate - a.conversionRate)
        .slice(0, 5),
      kpi: rows
        .filter((row) => row.kpiOutput > 0)
        .sort((a, b) => b.kpiOutput - a.kpiOutput)
        .slice(0, 5)
    };
  }, [profiles, assignedLeads, kpiRows]);

  return (
    <div
      className="page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1>Admin Overview</h1>
          <p>Team-wide performance, assigned lead sales, and admin controls at a glance.</p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          paddingRight: 4
        }}
      >
        {message ? <div className="glass" style={{ padding: 14 }}>{message}</div> : null}

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
            subtext={`${stats.soldLeads} sold assigned leads`}
          />
          <StatCard
            label="Team Conversion"
            value={loading ? '—' : formatPercent(stats.conversionRate)}
            subtext="Sold / assigned leads"
          />
        </div>

        <div className="grid grid-4">
          <StatCard
            label="Assigned Leads"
            value={loading ? '—' : stats.assignedLeads}
            subtext="Only assigned leads are checked for sales"
          />
          <StatCard label="Active Tiers" value={loading ? '—' : stats.activeTiers} />
          <StatCard
            label="Distribution Rules"
            value={loading ? '—' : stats.activeRules}
            subtext="Tier-based rules"
          />
        </div>

        <div>
          <h2 style={{ margin: '0 0 12px' }}>Leaderboards</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12
            }}
          >
            <LeaderboardCard
              title="Highest AP Sold"
              rows={leaderboards.ap}
              renderValue={(row) => formatMoney(row.apSold)}
            />

            <LeaderboardCard
              title="Most Sold Leads"
              rows={leaderboards.sales}
              renderValue={(row) => row.soldLeads.toLocaleString()}
            />

            <LeaderboardCard
              title="Best Conversion Rate"
              rows={leaderboards.conversion}
              renderValue={(row) => formatPercent(row.conversionRate)}
            />

            <LeaderboardCard
              title="Highest KPI Output"
              rows={leaderboards.kpi}
              renderValue={(row) => row.kpiOutput.toLocaleString()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
