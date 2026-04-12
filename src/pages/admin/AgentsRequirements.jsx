import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AgentsRequirements() {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name');

    const { data: recs } = await supabase
      .from('lead_recordings')
      .select('*');

    const { data: vids } = await supabase
      .from('agent_videos')
      .select('*');

    const { data: kpi } = await supabase
      .from('kpi_entries')
      .select('*');

    const grouped = profiles.map((agent) => ({
      ...agent,
      recordings: recs.filter((r) => r.agent_id === agent.id),
      videos: vids.filter((v) => v.agent_id === agent.id),
      kpi: kpi.filter((k) => k.agent_id === agent.id)
    }));

    setAgents(grouped);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Agent Requirements</h1>
      </div>

      {agents.map((agent) => (
        <details key={agent.id} className="glass top-gap" style={{ padding: 12 }}>
          <summary>{agent.display_name}</summary>

          <div className="top-gap">
            <div>🎯 Recordings: {agent.recordings.length}</div>
            <div>🎥 Videos: {agent.videos.length}</div>
            <div>📊 KPI Entries: {agent.kpi.length}</div>
          </div>
        </details>
      ))}
    </div>
  );
}
