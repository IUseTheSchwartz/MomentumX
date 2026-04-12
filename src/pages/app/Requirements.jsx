import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Requirements() {
  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [videos, setVideos] = useState([]);
  const [showSystem, setShowSystem] = useState(false);

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, tiers(*)')
      .eq('id', session.user.id)
      .single();

    setProfile(profileData || null);
    setTier(profileData?.tiers || null);

    const { data: recs } = await supabase
      .from('lead_recordings')
      .select('*')
      .eq('agent_id', session.user.id);

    setRecordings(recs || []);

    const { data: vids } = await supabase
      .from('agent_videos')
      .select('*')
      .eq('agent_id', session.user.id);

    setVideos(vids || []);
  }

  useEffect(() => {
    load();
  }, []);

  function getThisWeekCount(list, field = 'created_at') {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());

    return list.filter((x) => new Date(x[field]) >= start).length;
  }

  const recordingsThisWeek = useMemo(() => {
    return getThisWeekCount(recordings);
  }, [recordings]);

  const videosThisWeek = useMemo(() => {
    return getThisWeekCount(videos);
  }, [videos]);

  async function addVideo(e) {
    e.preventDefault();
    const url = e.target.url.value;

    if (!url) return;

    const {
      data: { session }
    } = await supabase.auth.getSession();

    await supabase.from('agent_videos').insert({
      agent_id: session.user.id,
      url
    });

    e.target.reset();
    load();
  }

  if (!tier) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Requirements</h1>
          <p>Your current tier requirements & accountability.</p>
        </div>
      </div>

      <div className="glass" style={{ padding: 16 }}>
        <h2>{tier.name}</h2>

        <div style={{ marginTop: 10 }}>
          <div>🎯 Recordings this week: <strong>{recordingsThisWeek}</strong></div>
          <div>🎥 Videos this week: <strong>{videosThisWeek}</strong></div>
        </div>

        <div className="top-gap">
          <h3>Add Video</h3>
          <form onSubmit={addVideo}>
            <input name="url" placeholder="Paste video link..." />
            <button className="btn btn-primary">Submit</button>
          </form>
        </div>
      </div>

      {/* 🔽 SYSTEM DOC (HIDDEN TOGGLE) */}
      <div className="top-gap">
        <button
          className="btn btn-ghost"
          onClick={() => setShowSystem((s) => !s)}
        >
          {showSystem ? 'Hide System' : 'View Full System'}
        </button>

        {showSystem && (
          <div className="glass top-gap" style={{ padding: 16, whiteSpace: 'pre-wrap' }}>
{`MOMENTUM X TEAM LEAD SYSTEM

PURPOSE
Scale fast. Reward performance. Maximize leads.

TIER 1:
- 500 aged leads
- KPI tracking REQUIRED
- 2 recordings/week
- Attend all meetings
- Dial unmuted

TIER 2:
- 60 fresh + 500 total
- 1 recording/week
- 2 IG videos/week
- Buy 1–2 lead packs

TIER 3:
- 100 fresh + 600 total
- 2–3 IG videos/week
- Buy 4 lead packs
- KPI only if performance drops

PROMOTION:
$45k/month OR $12k/week x2

BOTTOM LINE:
Produce → Earn More → Scale`}
          </div>
        )}
      </div>
    </div>
  );
}
