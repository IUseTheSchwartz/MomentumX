import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { writeAdminLog } from '../../lib/adminLog';

const PROGRAM_DAYS = 90;

const blankSetup = {
  name: '',
  aged_amount: '200',
  fresh_amount: '0'
};

function getDaysLeft(profile) {
  if (!profile?.lead_program_active) return 0;
  if (!profile?.lead_program_started_at) return PROGRAM_DAYS;

  const start = new Date(profile.lead_program_started_at);
  if (Number.isNaN(start.getTime())) return 0;

  const elapsedDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, PROGRAM_DAYS - elapsedDays);
}

function isActiveProgramAgent(profile) {
  if (!profile?.lead_program_active) return false;
  if (profile?.leads_paused) return false;
  if (profile?.lead_access_banned) return false;
  if (getDaysLeft(profile) <= 0) return false;

  const allowedLeadTypes = Array.isArray(profile.allowed_lead_types)
    ? profile.allowed_lead_types.filter(Boolean)
    : [];

  return allowedLeadTypes.length > 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export default function Distribution() {
  const [setups, setSetups] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [inventory, setInventory] = useState({
    aged: 0,
    fresh: 0
  });
  const [form, setForm] = useState(blankSetup);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [runningSetupId, setRunningSetupId] = useState('');
  const [confirmSetup, setConfirmSetup] = useState(null);

  async function load() {
    setMessage('');

    const [{ data: setupRows }, { data: profileRows }, { count: agedCount }, { count: freshCount }] =
      await Promise.all([
        supabase
          .from('lead_distribution_setups')
          .select('*')
          .eq('active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select(
            'id, display_name, email, lead_program_active, lead_program_started_at, leads_paused, lead_access_banned, allowed_lead_types'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .is('assigned_to', null)
          .eq('lead_category', 'aged')
          .eq('status', 'New'),
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .is('assigned_to', null)
          .eq('lead_category', 'fresh')
          .eq('status', 'New')
      ]);

    setSetups(setupRows || []);
    setProfiles(profileRows || []);
    setInventory({
      aged: agedCount || 0,
      fresh: freshCount || 0
    });
  }

  useEffect(() => {
    load();
  }, []);

  const activeAgents = useMemo(() => {
    return profiles.filter(isActiveProgramAgent);
  }, [profiles]);

  const expiredAgents = useMemo(() => {
    return profiles.filter((profile) => profile.lead_program_active && getDaysLeft(profile) <= 0);
  }, [profiles]);

  function getRunPreview(setup) {
    const agedPerAgent = Number(setup?.aged_amount || 0);
    const freshPerAgent = Number(setup?.fresh_amount || 0);
    const agentCount = activeAgents.length;

    return {
      agentCount,
      agedPerAgent,
      freshPerAgent,
      totalPerAgent: agedPerAgent + freshPerAgent,
      totalAged: agentCount * agedPerAgent,
      totalFresh: agentCount * freshPerAgent,
      totalLeads: agentCount * (agedPerAgent + freshPerAgent)
    };
  }

  async function createSetup(e) {
    e.preventDefault();
    setMessage('');
    setSaving(true);

    try {
      const name = form.name.trim();
      const agedAmount = Number(form.aged_amount || 0);
      const freshAmount = Number(form.fresh_amount || 0);

      if (!name) {
        setMessage('Name the setup first.');
        return;
      }

      if (agedAmount + freshAmount <= 0) {
        setMessage('Set at least 1 aged or fresh lead.');
        return;
      }

      const payload = {
        name,
        aged_amount: agedAmount,
        fresh_amount: freshAmount,
        active: true,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('lead_distribution_setups')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      await writeAdminLog({
        action: 'Created lead distribution setup',
        targetType: 'lead_distribution_setup',
        targetId: data.id,
        details: payload
      });

      setForm(blankSetup);
      setMessage('Setup created.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not create setup.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSetup(setup) {
    setMessage('');

    const { error } = await supabase
      .from('lead_distribution_setups')
      .update({
        active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', setup.id);

    if (error) {
      setMessage(error.message || 'Could not delete setup.');
      return;
    }

    await writeAdminLog({
      action: 'Deleted lead distribution setup',
      targetType: 'lead_distribution_setup',
      targetId: setup.id,
      details: setup
    });

    setMessage('Setup deleted.');
    await load();
  }

  async function runDistribution(setup) {
    setMessage('');
    setRunningSetupId(setup.id);

    try {
      const res = await fetch('/.netlify/functions/distribution-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupId: setup.id })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Distribution run failed.');
      }

      await writeAdminLog({
        action: 'Ran manual 90-day lead distribution',
        targetType: 'lead_distribution_setup',
        targetId: setup.id,
        details: data.summary || {}
      });

      setMessage(
        `Run complete: ${formatNumber(data.summary?.assignedTotal || 0)} total leads assigned to ${
          data.summary?.eligibleAgents || 0
        } active agents. Aged: ${formatNumber(data.summary?.assignedAged || 0)}. Fresh: ${formatNumber(
          data.summary?.assignedFresh || 0
        )}.`
      );

      setConfirmSetup(null);
      await load();
    } catch (error) {
      setMessage(error.message || 'Distribution run failed.');
    } finally {
      setRunningSetupId('');
    }
  }

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
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 4
        }}
      >
        <div className="page-header">
          <div>
            <h1>Distribution</h1>
            <p>Create manual lead-run setups and send them to active 0–90 day agents only.</p>
          </div>
        </div>

        <div className="grid grid-4" style={{ marginBottom: 14 }}>
          <div className="glass" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Active Agents</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{activeAgents.length}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Eligible for manual runs</div>
          </div>

          <div className="glass" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Saved Setups</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{setups.length}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Manual run templates</div>
          </div>

          <div className="glass" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Aged Inventory</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{formatNumber(inventory.aged)}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Unassigned New leads</div>
          </div>

          <div className="glass" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Fresh Inventory</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{formatNumber(inventory.fresh)}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Unassigned New leads</div>
          </div>
        </div>

        <form className="form glass" onSubmit={createSetup}>
          <h2 style={{ marginTop: 0 }}>Create Setup</h2>

          <div className="form-grid">
            <label>
              Setup Name
              <input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Example: 200 aged / 15 fresh"
              />
            </label>

            <label>
              Aged Leads Per Active Agent
              <input
                type="number"
                min="0"
                value={form.aged_amount}
                onChange={(e) => setForm((s) => ({ ...s, aged_amount: e.target.value }))}
              />
            </label>

            <label>
              Fresh Leads Per Active Agent
              <input
                type="number"
                min="0"
                value={form.fresh_amount}
                onChange={(e) => setForm((s) => ({ ...s, fresh_amount: e.target.value }))}
              />
            </label>

            <label>
              Total Per Active Agent
              <input
                type="number"
                value={Number(form.aged_amount || 0) + Number(form.fresh_amount || 0)}
                readOnly
              />
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Setup'}
            </button>
          </div>

          {message ? <div className="top-gap">{message}</div> : null}
        </form>

        <div className="glass top-gap" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Saved Setups</h2>

          {!setups.length ? (
            <div style={{ opacity: 0.75 }}>No setups created yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {setups.map((setup) => {
                const preview = getRunPreview(setup);

                return (
                  <div
                    key={setup.id}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: 12,
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{setup.name}</div>
                      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                        {formatNumber(setup.aged_amount)} aged + {formatNumber(setup.fresh_amount)} fresh per active agent
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                        Current preview: {formatNumber(preview.totalLeads)} total leads to {preview.agentCount} active agents
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-primary btn-small"
                        type="button"
                        onClick={() => setConfirmSetup(setup)}
                        disabled={runningSetupId === setup.id}
                      >
                        {runningSetupId === setup.id ? 'Running...' : 'Run'}
                      </button>

                      <button
                        className="btn btn-danger btn-small"
                        type="button"
                        onClick={() => deleteSetup(setup)}
                        disabled={runningSetupId === setup.id}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass top-gap" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Active Agents Preview</h2>

          {!activeAgents.length ? (
            <div style={{ opacity: 0.75 }}>No active eligible agents right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeAgents.map((agent) => (
                <div
                  key={agent.id}
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
                    <div style={{ fontWeight: 800 }}>
                      {agent.display_name || agent.email || 'Unnamed Agent'}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {(agent.allowed_lead_types || []).join(', ') || 'No lead types selected'}
                    </div>
                  </div>

                  <div style={{ fontWeight: 800, color: '#34d399' }}>
                    {getDaysLeft(agent)} days left
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {expiredAgents.length ? (
          <div className="glass top-gap" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Expired Agents</h2>
            <div style={{ opacity: 0.75 }}>
              These agents are still marked active, but their 90 days are over. They will not
              receive new leads unless you restart their 90 days on the Agents page.
            </div>

            <div className="top-gap" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {expiredAgents.map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(239,68,68,0.22)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {agent.display_name || agent.email || 'Unnamed Agent'}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>{agent.email}</div>
                  </div>

                  <div style={{ fontWeight: 800, color: '#f87171' }}>Expired</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {confirmSetup ? (
        <div
          onClick={() => setConfirmSetup(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(620px, 96vw)',
              padding: 20,
              border: '1px solid rgba(255,255,255,0.12)'
            }}
          >
            {(() => {
              const preview = getRunPreview(confirmSetup);

              return (
                <>
                  <h2 style={{ marginTop: 0 }}>Are you sure?</h2>

                  <p style={{ opacity: 0.8 }}>
                    You are about to run <strong>{confirmSetup.name}</strong>.
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 10,
                      marginTop: 14
                    }}
                  >
                    <div className="glass" style={{ padding: 12 }}>
                      <div style={{ fontSize: 13, opacity: 0.75 }}>Active Agents</div>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.agentCount}</div>
                    </div>

                    <div className="glass" style={{ padding: 12 }}>
                      <div style={{ fontSize: 13, opacity: 0.75 }}>Total Leads</div>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>
                        {formatNumber(preview.totalLeads)}
                      </div>
                    </div>

                    <div className="glass" style={{ padding: 12 }}>
                      <div style={{ fontSize: 13, opacity: 0.75 }}>Aged</div>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>
                        {formatNumber(preview.totalAged)}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {formatNumber(preview.agedPerAgent)} per agent
                      </div>
                    </div>

                    <div className="glass" style={{ padding: 12 }}>
                      <div style={{ fontSize: 13, opacity: 0.75 }}>Fresh</div>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>
                        {formatNumber(preview.totalFresh)}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {formatNumber(preview.freshPerAgent)} per agent
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, opacity: 0.8, fontSize: 14 }}>
                    Inventory now: {formatNumber(inventory.aged)} aged and {formatNumber(inventory.fresh)} fresh.
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 10,
                      marginTop: 18,
                      flexWrap: 'wrap'
                    }}
                  >
                    <button className="btn btn-ghost" type="button" onClick={() => setConfirmSetup(null)}>
                      Cancel
                    </button>

                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => runDistribution(confirmSetup)}
                      disabled={runningSetupId === confirmSetup.id || preview.agentCount <= 0}
                    >
                      {runningSetupId === confirmSetup.id ? 'Running...' : 'Yes, Run It'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
