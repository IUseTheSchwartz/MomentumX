import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';

const blank = {
  tier_id: '',
  aged_amount: '',
  aged_day_of_week: 'monday',
  fresh_amount: '',
  fresh_day_of_week: 'monday'
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

    const payload = {
      tier_id: form.tier_id,
      aged_amount: Number(form.aged_amount || 0),
      aged_day_of_week: form.aged_day_of_week,
      fresh_amount: Number(form.fresh_amount || 0),
      fresh_day_of_week: form.fresh_day_of_week
    };

    const { error } = await supabase
      .from('distribution_rules')
      .insert(payload);

    if (error) {
      setMessage(error.message);
      return;
    }

    setForm(blank);
    setMessage('Rule saved.');
    load();
  }

  async function deleteRule(id) {
    await supabase.from('distribution_rules').delete().eq('id', id);
    load();
  }

  async function forceDistribution(row) {
    // UI ONLY for now — backend function comes next
    alert(
      `Force distribution triggered for ${row.tiers?.name}. This will NOT cancel the next scheduled run.`
    );
  }

  const columns = [
    {
      key: 'tiers',
      label: 'Tier',
      render: (_v, row) => row.tiers?.name || '—'
    },
    { key: 'aged_amount', label: 'Aged Amount' },
    { key: 'aged_day_of_week', label: 'Aged Day' },
    { key: 'fresh_amount', label: 'Fresh Amount' },
    { key: 'fresh_day_of_week', label: 'Fresh Day' },

    {
      key: 'actions',
      label: 'Actions',
      render: (_v, row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-danger btn-small"
            onClick={() => deleteRule(row.id)}
          >
            Delete
          </button>

          <button
            className="btn btn-primary btn-small"
            onClick={() => forceDistribution(row)}
          >
            Force Run
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
              value={form.aged_amount}
              onChange={(e) =>
                setForm((s) => ({ ...s, aged_amount: e.target.value }))
              }
            />
          </label>

          <label>
            Aged Day
            <select
              value={form.aged_day_of_week}
              onChange={(e) =>
                setForm((s) => ({ ...s, aged_day_of_week: e.target.value }))
              }
            >
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>

          <label>
            Fresh Leads / Week
            <input
              type="number"
              value={form.fresh_amount}
              onChange={(e) =>
                setForm((s) => ({ ...s, fresh_amount: e.target.value }))
              }
            />
          </label>

          <label>
            Fresh Day
            <select
              value={form.fresh_day_of_week}
              onChange={(e) =>
                setForm((s) => ({ ...s, fresh_day_of_week: e.target.value }))
              }
            >
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>

        <button className="btn btn-primary" type="submit">
          Save Rule
        </button>

        {message && <div className="top-gap">{message}</div>}
      </form>

      <div className="top-gap">
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
