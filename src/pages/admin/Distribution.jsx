import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';

const blank = {
  tier_id: '',
  aged_amount: '',
  aged_day_of_week: '',
  fresh_amount: '',
  fresh_day_of_week: ''
};

const days = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

export default function Distribution() {
  const [rows, setRows] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState('');
  const [runningRuleId, setRunningRuleId] = useState('');

  async function load() {
    const [{ data: rules }, { data: tierRows }] = await Promise.all([
      supabase
        .from('distribution_rules')
        .select('*, tiers(name)')
        .order('created_at', { ascending: false }),
      supabase.from('tiers').select('id, name').order('sort_order')
    ]);

    setRows(rules || []);
    setTiers(tierRows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setMessage('');

    if (!form.tier_id) {
      setMessage('Select a tier.');
      return;
    }

    const agedAmount = Number(form.aged_amount || 0);
    const freshAmount = Number(form.fresh_amount || 0);

    const payload = {
      tier_id: form.tier_id,
      frequency: 'weekly',
      day_of_month: null,
      aged_amount: agedAmount,
      aged_day_of_week: agedAmount > 0 ? form.aged_day_of_week || null : null,
      fresh_amount: freshAmount,
      fresh_day_of_week: freshAmount > 0 ? form.fresh_day_of_week || null : null
    };

    const { error } = await supabase
      .from('distribution_rules')
      .insert(payload);

    if (error) {
      setMessage(error.message || 'Could not save rule.');
      return;
    }

    setForm(blank);
    setMessage('Rule saved.');
    load();
  }

  async function deleteRule(id) {
    setMessage('');
    const { error } = await supabase.from('distribution_rules').delete().eq('id', id);

    if (error) {
      setMessage(error.message || 'Could not delete rule.');
      return;
    }

    setMessage('Rule deleted.');
    load();
  }

  async function forceDistribution(row) {
    setMessage('');
    setRunningRuleId(row.id);

    try {
      const res = await fetch('/.netlify/functions/distribution-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId: row.id, force: true })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Force run failed.');
      }

      setMessage(
        `Force run completed for ${row.tiers?.name || 'tier'}: ${data.summary?.assignedAged || 0} aged, ${data.summary?.assignedFresh || 0} fresh.`
      );
    } catch (error) {
      setMessage(error.message || 'Force run failed.');
    } finally {
      setRunningRuleId('');
    }
  }

  const columns = [
    {
      key: 'tiers',
      label: 'Tier',
      render: (_v, row) => row.tiers?.name || '—'
    },
    {
      key: 'aged_amount',
      label: 'Aged / Week',
      render: (value) => Number(value || 0)
    },
    {
      key: 'aged_day_of_week',
      label: 'Aged Day',
      render: (value, row) => Number(row.aged_amount || 0) > 0 ? (value || '—') : 'None'
    },
    {
      key: 'fresh_amount',
      label: 'Fresh / Week',
      render: (value) => Number(value || 0)
    },
    {
      key: 'fresh_day_of_week',
      label: 'Fresh Day',
      render: (value, row) => Number(row.fresh_amount || 0) > 0 ? (value || '—') : 'None'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_v, row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-danger btn-small"
            onClick={() => deleteRule(row.id)}
            type="button"
          >
            Delete
          </button>

          <button
            className="btn btn-primary btn-small"
            onClick={() => forceDistribution(row)}
            type="button"
            disabled={runningRuleId === row.id}
          >
            {runningRuleId === row.id ? 'Running...' : 'Force Run'}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Distribution</h1>
          <p>Set weekly aged and fresh lead drops per tier.</p>
        </div>
      </div>

      <form className="form glass" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Tier
            <select
              value={form.tier_id}
              onChange={(e) =>
                setForm((s) => ({ ...s, tier_id: e.target.value }))
              }
            >
              <option value="">Select Tier</option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Aged Leads / Week
            <input
              type="number"
              min="0"
              value={form.aged_amount}
              onChange={(e) =>
                setForm((s) => ({ ...s, aged_amount: e.target.value }))
              }
              placeholder="0"
            />
          </label>

          <label>
            Aged Day
            <select
              value={form.aged_day_of_week}
              onChange={(e) =>
                setForm((s) => ({ ...s, aged_day_of_week: e.target.value }))
              }
              disabled={Number(form.aged_amount || 0) <= 0}
            >
              <option value="">None</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label>
            Fresh Leads / Week
            <input
              type="number"
              min="0"
              value={form.fresh_amount}
              onChange={(e) =>
                setForm((s) => ({ ...s, fresh_amount: e.target.value }))
              }
              placeholder="0"
            />
          </label>

          <label>
            Fresh Day
            <select
              value={form.fresh_day_of_week}
              onChange={(e) =>
                setForm((s) => ({ ...s, fresh_day_of_week: e.target.value }))
              }
              disabled={Number(form.fresh_amount || 0) <= 0}
            >
              <option value="">None</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button className="btn btn-primary" type="submit">
          Save Rule
        </button>

        {message ? <div className="top-gap">{message}</div> : null}
      </form>

      <div className="top-gap">
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
