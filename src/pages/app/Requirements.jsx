import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

function getStartOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export default function Requirements() {
  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) return;

      // PROFILE
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setProfile(profileData || null);

      // TIER
      if (profileData?.tier_id) {
        const { data: tierData } = await supabase
          .from('tiers')
          .select('*')
          .eq('id', profileData.tier_id)
          .single();

        setTier(tierData || null);
      }

      // RECORDINGS
      const { data: recordingRows } = await supabase
        .from('lead_recordings')
        .select('*')
        .eq('agent_id', session.user.id);

      setRecordings(recordingRows || []);

      // LINKS (stored inside profile JSON)
      setLinks(profileData?.requirements_links || []);

      setLoading(false);
    }

    load();
  }, []);

  const weeklyRecordingCount = useMemo(() => {
    const start = getStartOfWeek();

    return recordings.filter((r) => {
      const d = new Date(r.created_at);
      return d >= start;
    }).length;
  }, [recordings]);

  async function addLink() {
    if (!newLink.trim()) return;

    setSaving(true);

    const updatedLinks = [...links, {
      url: newLink.trim(),
      created_at: new Date().toISOString()
    }];

    const { error } = await supabase
      .from('profiles')
      .update({
        requirements_links: updatedLinks
      })
      .eq('id', profile.id);

    if (!error) {
      setLinks(updatedLinks);
      setNewLink('');
    }

    setSaving(false);
  }

  if (loading) {
    return <div className="page-center">Loading Requirements...</div>;
  }

  const requirements = tier?.requirements_json || {};

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Requirement Checklist</h1>
          <p>Your current tier requirements and weekly progress.</p>
        </div>
      </div>

      {/* TIER INFO */}
      <div className="glass" style={{ padding: 16 }}>
        <h3>{tier?.name || 'No Tier Assigned'}</h3>
      </div>

      {/* REQUIREMENTS */}
      <div className="glass top-gap" style={{ padding: 16 }}>
        <h3>Requirements</h3>

        {Object.keys(requirements).length === 0 ? (
          <p>No requirements set for this tier.</p>
        ) : (
          <ul>
            {Object.entries(requirements).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {String(value)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* RECORDINGS */}
      <div className="glass top-gap" style={{ padding: 16 }}>
        <h3>This Week Recordings</h3>
        <p style={{ fontSize: 22, fontWeight: 600 }}>
          {weeklyRecordingCount}
        </p>
      </div>

      {/* VIDEO LINKS */}
      <div className="glass top-gap" style={{ padding: 16 }}>
        <h3>Submit Video Links</h3>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="Paste video link..."
          />
          <button
            className="btn btn-primary"
            onClick={addLink}
            disabled={saving}
          >
            Add
          </button>
        </div>

        <div className="top-gap">
          {links.map((link, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.url}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
