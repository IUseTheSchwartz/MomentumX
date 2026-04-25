import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function CourseProgress() {
  const [rows, setRows] = useState([]);

  async function load() {
    const { data } = await supabase
      .from('agent_course_status')
      .select('*, profiles(display_name, email)');

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(row) {
    await supabase
      .from('agent_course_status')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', row.id);

    load();
  }

  async function returnUser(row) {
    const note = prompt('Return reason:');

    await supabase
      .from('agent_course_status')
      .update({
        status: 'returned',
        returned_note: note
      })
      .eq('id', row.id);

    load();
  }

  async function setStep(row) {
    const step = prompt('Set step number:');

    await supabase
      .from('agent_course_status')
      .update({
        current_step: Number(step || 0)
      })
      .eq('id', row.id);

    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Course Progress</h1>
      </div>

      <div className="glass">
        {rows.map((row) => (
          <div key={row.id} style={{ padding: 12 }}>
            <strong>
              {row.profiles?.display_name || row.profiles?.email}
            </strong>

            <div>Status: {row.status}</div>
            <div>Step: {row.current_step}</div>

            <button onClick={() => approve(row)}>Approve</button>
            <button onClick={() => returnUser(row)}>Return</button>
            <button onClick={() => setStep(row)}>Set Step</button>
          </div>
        ))}
      </div>
    </div>
  );
}
