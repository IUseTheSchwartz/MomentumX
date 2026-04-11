import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../lib/utils';

const blank = {
  url: '',
  week_start: new Date().toISOString().slice(0, 10)
};

export default function Content() {
  const [form, setForm] = useState(blank);
  const [rows, setRows] = useState([]);

  async function loadRows() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data } = await supabase
      .from('content_submissions')
      .select('*')
      .eq('agent_id', session.user.id)
      .order('created_at', { ascending: false });

    setRows(data || []);
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function submit(e) {
    e.preventDefault();

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    await supabase.from('content_submissions').insert({
      agent_id: session.user.id,
      platform: 'Instagram',
      content_type: 'Reel',
      url: form.url,
      week_start: form.week_start
    });

    setForm(blank);
    loadRows();
  }

  const columns = [
    { key: 'platform', label: 'Platform' },
    { key: 'content_type', label: 'Type' },
    { key: 'url', label: 'Link' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Submitted', render: (v) => formatDate(v) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Content</h1>
          <p>Submit Instagram Reels for weekly requirement tracking.</p>
        </div>
      </div>

      <form className="form glass" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Reel URL
            <input
              value={form.url}
              onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))}
              placeholder="https://www.instagram.com/reel/..."
            />
          </label>

          <label>
            Week Start
            <input
              type="date"
              value={form.week_start}
              onChange={(e) => setForm((s) => ({ ...s, week_start: e.target.value }))}
            />
          </label>
        </div>

        <button className="btn btn-primary" type="submit">
          Submit Reel
        </button>
      </form>

      <div className="top-gap">
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
