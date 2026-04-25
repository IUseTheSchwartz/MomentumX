import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { writeAdminLog } from '../../lib/adminLog';

const PROGRAM_DAYS = 90;

const days = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

const defaultSettings = {
  id: 1,
  weekly_amount: 200,
  aged_amount: 200,
  fresh_amount: 0,
  day_of_week: 'monday',
  active: true
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
  return getDaysLeft(profile) > 0;
}

export default function Distribution() {
  const [settings, setSettings] = useState(defaultSettings);
  const [profiles, setProfiles] = useState([]);
  const [inventory, setInventory] = useState({
    aged: 0,
    fresh: 0
  });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  async function load() {
    setMessage('');

    const [{ data: settingsRow }, { data: profileRows }, { count: agedCount }, { count: freshCount }] =
      await Promise.all([
        supabase
          .from('lead_distribution_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle(),
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

    setSettings(settingsRow || defaultSettings);
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

  const estimatedLeadNeed = useMemo(() => {
    return activeAgents.length * Number(settings.weekly_amount || 0);
  }, [activeAgents.length, settings.weekly_amount]);

  async function saveSettings(e) {
    e.preventDefault();
    setMessage('');
    setSaving(true);

    try {
      const agedAmount = Number(settings.aged_amount || 0);
      const freshAmount = Number(settings.fresh_amount || 0);
      const weeklyAmount = agedAmount + freshAmount;

      if (weeklyAmount <= 0) {
        setMessage('Set at least 1 aged or fresh lead.');
        return;
      }

      const payload = {
        id: 1,
        weekly_amount: weeklyAmount,
        aged_amount: agedAmount,
        fresh_amount: freshAmount,
        day_of_week: settings.day_of_week || 'monday',
        active: Boolean(settings.active),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('lead_distribution_settings')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      await writeAdminLog({
        action: 'Updated lead distribution settings',
        targetType: 'lead_distribution_settings',
        targetId: '1',
        details: payload
      });

      setSettings(data || payload);
      setMessage('Distribution settings saved.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not save distribution settings.');
    } finally {
      setSaving(false);
    }
  }

  async function runDistribution() {
    setMessage('');
    setRunning(true);

    try {
      const res = await fetch('/.netlify/functions/distribution-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Distribution run failed.');
      }

      await writeAdminLog({
        action: 'Forced 90-day program distribution run',
        targetType: 'lead_distribution_settings',
        targetId: '1',
        details: data.summary || {}
      });

      setMessage(
        `Run complete: ${data.summary?.assignedTotal || 0} total leads assigned to ${
          data.summary?.eligibleAgents || 0
        } active agents. Aged: ${data.summary?.assignedAged || 0}. Fresh: ${
          data.summary?.assignedFresh || 0
        }.`
      );

      await load();
    } catch (error) {
      setMessage(error.message || 'Distribution run failed.');
    } finally {
      setRunning(false);
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
            <p>Send weekly leads to active agents inside their 0–90 day Momentum X window.</p>
          </div>
        </div>

        <div
          className="grid grid-4"
          style={{
            marginBottom: 14
          }}
        >
          <div className="glass" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Active Agents</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{activeAgents.length}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Eligible for this run</div>
          </div>

          <div className="glass" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Estimated Need</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{estimatedLeadNeed}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Total leads if fully filled</div>
          </div>

          <div className="glass" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Aged Inventory</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{inventory.aged}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Unassigned New leads</div>
          </div>

          <div className="glass" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Fresh Inventory</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{inventory.fresh}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Unassigned New leads</div>
          </div>
        </div>

        <form className="form glass" onSubmit={saveSettings}>
          <div className="form-grid">
            <label>
              Aged Leads Per Active Agent
              <input
                type="number"
                min="0"
                value={settings.aged_amount}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    aged_amount: e.target.value,
                    weekly_amount: Number(e.target.value || 0) + Number(s.fresh_amount || 0)
                  }))
                }
                placeholder="200"
              />
            </label>

            <label>
              Fresh Leads Per Active Agent
              <input
                type="number"
                min="0"
                value={settings.fresh_amount}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    fresh_amount: e.target.value,
                    weekly_amount: Number(s.aged_amount || 0) + Number(e.target.value || 0)
                  }))
                }
                placeholder="0"
              />
            </label>

            <label>
              Total Leads Per Active Agent
              <input
                type="number"
                value={Number(settings.aged_amount || 0) + Number(settings.fresh_amount || 0)}
                readOnly
              />
            </label>

            <label>
              Weekly Run Day
              <select
                value={settings.day_of_week || 'monday'}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    day_of_week: e.target.value
                  }))
                }
              >
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Scheduled Runs
              <select
                value={settings.active ? 'active' : 'inactive'}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    active: e.target.value === 'active'
                  }))
                }
              >
                <option value="active">Enabled</option>
                <option value="inactive">Disabled</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            <button
              className="btn btn-primary"
              type="button"
              onClick={runDistribution}
              disabled={running}
            >
              {running ? 'Running...' : 'Run Distribution Now'}
            </button>
          </div>

          {message ? <div className="top-gap">{message}</div> : null}
        </form>

        <div className="glass top-gap" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Run Rules</h2>
          <p style={{ marginBottom: 0, opacity: 0.8 }}>
            This sends leads only to agents marked Active on the Agents page, who are not paused,
            not ineligible, and still have days left in their 90-day window. Agents keep access to
            their old leads after their 90 days end.
          </p>
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
    </div>
  );
}
