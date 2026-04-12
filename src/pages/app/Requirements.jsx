import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

function startOfWeek(value = new Date()) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function isOnOrAfter(value, floorDate) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= floorDate;
}

function countSince(rows, floorDate, field = 'created_at') {
  return (rows || []).filter((row) => isOnOrAfter(row[field], floorDate)).length;
}

function getTierRules(tierName) {
  const normalized = String(tierName || '').toLowerCase();

  if (normalized.includes('tier 1')) {
    return {
      recordingsWeekly: 2,
      videosWeekly: 0,
      leadPacksMonthlyStay: 0,
      leadPacksMonthlyAdvance: 0,
      kpiRequired: true
    };
  }

  if (normalized.includes('tier 2')) {
    return {
      recordingsWeekly: 1,
      videosWeekly: 2,
      leadPacksMonthlyStay: 1,
      leadPacksMonthlyAdvance: 2,
      kpiRequired: false
    };
  }

  if (normalized.includes('tier 3')) {
    return {
      recordingsWeekly: 0,
      videosWeekly: 0,
      leadPacksMonthlyStay: 4,
      leadPacksMonthlyAdvance: 0,
      kpiRequired: false
    };
  }

  return {
    recordingsWeekly: 0,
    videosWeekly: 0,
    leadPacksMonthlyStay: 0,
    leadPacksMonthlyAdvance: 0,
    kpiRequired: false
  };
}

function ChecklistItem({ label, current, target, passed, subtext }) {
  const active = target > 0 || label.toLowerCase().includes('kpi');
  const borderColor = passed ? 'rgba(16,185,129,0.45)' : 'rgba(239,68,68,0.45)';
  const background = passed ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)';
  const color = passed ? '#34d399' : '#f87171';

  return (
    <div
      className="glass"
      style={{
        padding: 14,
        border: `1px solid ${borderColor}`,
        background,
        opacity: active ? 1 : 0.65
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>
        {target > 0 ? `${current} / ${target}` : passed ? 'Passed' : 'Failed'}
      </div>
      {subtext ? (
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>{subtext}</div>
      ) : null}
    </div>
  );
}

export default function Requirements() {
  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [videos, setVideos] = useState([]);
  const [kpiRows, setKpiRows] = useState([]);
  const [proofs, setProofs] = useState([]);

  const [showSystem, setShowSystem] = useState(false);
  const [submittingVideo, setSubmittingVideo] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const pasteZoneRef = useRef(null);

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const [
      { data: profileData },
      { data: recs },
      { data: vids },
      { data: kpi },
      { data: proofRows }
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, tiers(*)')
        .eq('id', session.user.id)
        .single(),
      supabase
        .from('lead_recordings')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('agent_videos')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('kpi_entries')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('entry_date', { ascending: false }),
      supabase
        .from('lead_pack_proofs')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false })
    ]);

    setProfile(profileData || null);
    setTier(profileData?.tiers || null);
    setRecordings(recs || []);
    setVideos(vids || []);
    setKpiRows(kpi || []);
    setProofs(proofRows || []);
  }

  useEffect(() => {
    load();
  }, []);

  const tierRules = useMemo(() => getTierRules(tier?.name), [tier]);

  const weekStart = useMemo(() => startOfWeek(), []);
  const monthStart = useMemo(() => startOfMonth(new Date()), []);

  const recordingsThisWeek = useMemo(() => {
    return countSince(recordings, weekStart);
  }, [recordings, weekStart]);

  const videosThisWeek = useMemo(() => {
    return countSince(videos, weekStart);
  }, [videos, weekStart]);

  const proofsThisMonth = useMemo(() => {
    return countSince(proofs, monthStart);
  }, [proofs, monthStart]);

  const hasKpiThisWeek = useMemo(() => {
    return (kpiRows || []).some((row) => {
      const sourceDate = row.entry_date || row.created_at;
      return isOnOrAfter(sourceDate, weekStart);
    });
  }, [kpiRows, weekStart]);

  const checklist = useMemo(() => {
    return {
      recordingsPassed:
        tierRules.recordingsWeekly === 0
          ? true
          : recordingsThisWeek >= tierRules.recordingsWeekly,
      videosPassed:
        tierRules.videosWeekly === 0 ? true : videosThisWeek >= tierRules.videosWeekly,
      leadStayPassed:
        tierRules.leadPacksMonthlyStay === 0
          ? true
          : proofsThisMonth >= tierRules.leadPacksMonthlyStay,
      leadAdvancePassed:
        tierRules.leadPacksMonthlyAdvance === 0
          ? true
          : proofsThisMonth >= tierRules.leadPacksMonthlyAdvance,
      kpiPassed: tierRules.kpiRequired ? hasKpiThisWeek : true
    };
  }, [
    tierRules,
    recordingsThisWeek,
    videosThisWeek,
    proofsThisMonth,
    hasKpiThisWeek
  ]);

  async function addVideo(e) {
    e.preventDefault();
    setSubmittingVideo(true);
    setStatusMessage('');

    try {
      const url = e.target.url.value?.trim();

      if (!url) return;

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setStatusMessage('No session found.');
        return;
      }

      const { error } = await supabase.from('agent_videos').insert({
        agent_id: session.user.id,
        url
      });

      if (error) throw error;

      e.target.reset();
      setStatusMessage('Video submitted.');
      await load();
    } catch (error) {
      console.error('Failed to add video:', error);
      setStatusMessage(error.message || 'Failed to submit video.');
    } finally {
      setSubmittingVideo(false);
    }
  }

  function handleProofFileChange(e) {
    const file = e.target.files?.[0] || null;
    setProofFile(file);

    if (!file) {
      setProofPreview('');
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setProofPreview(nextPreview);
  }

  function handlePasteProof(e) {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));

    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    setProofFile(file);
    const nextPreview = URL.createObjectURL(file);
    setProofPreview(nextPreview);
    setStatusMessage('Pasted screenshot ready to upload.');
  }

  async function uploadLeadPackProof() {
    setUploadingProof(true);
    setStatusMessage('');

    try {
      if (!proofFile) {
        setStatusMessage('Upload or paste an image first.');
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setStatusMessage('No session found.');
        return;
      }

      const ext = proofFile.name?.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `lead-pack-proof-${Date.now()}.${ext}`;
      const storagePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('lead-pack-proofs')
        .upload(storagePath, proofFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: proofFile.type || 'image/png'
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('lead-pack-proofs')
        .getPublicUrl(storagePath);

      const imageUrl = publicUrlData?.publicUrl || null;

      const { error: insertError } = await supabase.from('lead_pack_proofs').insert({
        agent_id: session.user.id,
        image_url: imageUrl
      });

      if (insertError) throw insertError;

      setProofFile(null);
      setProofPreview('');
      if (pasteZoneRef.current) {
        pasteZoneRef.current.textContent = '';
      }

      setStatusMessage('Lead pack proof uploaded.');
      await load();
    } catch (error) {
      console.error('Failed to upload proof:', error);
      setStatusMessage(error.message || 'Failed to upload proof.');
    } finally {
      setUploadingProof(false);
    }
  }

  if (!tier) {
    return <div className="page">Loading...</div>;
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
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1>Requirements</h1>
          <p>Your current tier requirements, checklist status, and submissions.</p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingRight: 4
        }}
      >
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0 }}>{tier.name}</h2>
              <div style={{ marginTop: 6, opacity: 0.75, fontSize: 14 }}>
                {profile?.display_name || profile?.email || 'Agent'}
              </div>
            </div>

            <div
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 14,
                alignSelf: 'start'
              }}
            >
              This week starts {weekStart.toLocaleDateString()}
            </div>
          </div>

          <div
            className="top-gap"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12
            }}
          >
            {tierRules.recordingsWeekly > 0 ? (
              <ChecklistItem
                label="Recordings"
                current={recordingsThisWeek}
                target={tierRules.recordingsWeekly}
                passed={checklist.recordingsPassed}
                subtext="Weekly requirement"
              />
            ) : null}

            {tierRules.videosWeekly > 0 ? (
              <ChecklistItem
                label="Videos"
                current={videosThisWeek}
                target={tierRules.videosWeekly}
                passed={checklist.videosPassed}
                subtext="Weekly Instagram links"
              />
            ) : null}

            {tierRules.leadPacksMonthlyStay > 0 ? (
              <ChecklistItem
                label="Lead Packs"
                current={proofsThisMonth}
                target={tierRules.leadPacksMonthlyStay}
                passed={checklist.leadStayPassed}
                subtext="Monthly minimum to stay"
              />
            ) : null}

            {tierRules.leadPacksMonthlyAdvance > 0 ? (
              <ChecklistItem
                label="Lead Packs to Advance"
                current={proofsThisMonth}
                target={tierRules.leadPacksMonthlyAdvance}
                passed={checklist.leadAdvancePassed}
                subtext="Monthly target to advance"
              />
            ) : null}

            {tierRules.kpiRequired ? (
              <ChecklistItem
                label="KPI Tracking"
                current={hasKpiThisWeek ? 1 : 0}
                target={1}
                passed={checklist.kpiPassed}
                subtext="At least one KPI entry this week"
              />
            ) : (
              <div
                className="glass"
                style={{
                  padding: 14,
                  border: '1px solid rgba(255,255,255,0.08)',
                  opacity: 0.7
                }}
              >
                <div style={{ fontSize: 14, opacity: 0.75 }}>KPI Tracking</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Not Required</div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
                  This tier does not require KPI tracking.
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="glass"
          style={{
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16
          }}
        >
          <div>
            <h3 style={{ marginTop: 0 }}>Add Video</h3>
            <form onSubmit={addVideo}>
              <input
                name="url"
                placeholder="Paste Instagram video link..."
                style={{ marginBottom: 10 }}
              />
              <button className="btn btn-primary" disabled={submittingVideo}>
                {submittingVideo ? 'Submitting...' : 'Submit Video'}
              </button>
            </form>
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>Lead Pack Proof</h3>

            <label style={{ display: 'block', marginBottom: 10 }}>
              Upload screenshot
              <input
                type="file"
                accept="image/*"
                onChange={handleProofFileChange}
                style={{ marginTop: 8 }}
              />
            </label>

            <div
              ref={pasteZoneRef}
              onPaste={handlePasteProof}
              contentEditable
              suppressContentEditableWarning
              className="glass"
              style={{
                minHeight: 90,
                padding: 12,
                border: '1px dashed rgba(255,255,255,0.18)',
                outline: 'none',
                marginBottom: 10
              }}
            >
              Paste screenshot here with Ctrl/Cmd + V
            </div>

            {proofPreview ? (
              <div style={{ marginBottom: 10 }}>
                <img
                  src={proofPreview}
                  alt="Lead pack proof preview"
                  style={{
                    width: '100%',
                    maxHeight: 220,
                    objectFit: 'contain',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                />
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-primary"
              onClick={uploadLeadPackProof}
              disabled={uploadingProof}
            >
              {uploadingProof ? 'Uploading...' : 'Upload Proof'}
            </button>
          </div>
        </div>

        {statusMessage ? (
          <div className="glass" style={{ padding: 12 }}>
            {statusMessage}
          </div>
        ) : null}

        <div className="glass" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>This Month&apos;s Lead Pack Proofs</h3>

          {!proofs.length ? (
            <div style={{ opacity: 0.75 }}>No lead pack proofs uploaded yet.</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12
              }}
            >
              {proofs.map((proof) => (
                <a
                  key={proof.id}
                  href={proof.image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="glass"
                  style={{
                    padding: 10,
                    border: '1px solid rgba(255,255,255,0.08)',
                    textDecoration: 'none',
                    color: 'inherit'
                  }}
                >
                  <img
                    src={proof.image_url}
                    alt="Lead pack proof"
                    style={{
                      width: '100%',
                      height: 180,
                      objectFit: 'cover',
                      borderRadius: 10,
                      marginBottom: 8
                    }}
                  />
                  <div style={{ fontSize: 13, opacity: 0.75 }}>
                    Uploaded {new Date(proof.created_at).toLocaleString()}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            className="btn btn-ghost"
            onClick={() => setShowSystem((s) => !s)}
            type="button"
          >
            {showSystem ? 'Hide System' : 'View Full System'}
          </button>

          {showSystem ? (
            <div
              className="glass top-gap"
              style={{ padding: 16, whiteSpace: 'pre-wrap' }}
            >
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
- Buy 4 lead packs
- KPI not required

PROMOTION:
$45k/month OR $12k/week x2

BOTTOM LINE:
Produce → Earn More → Scale`}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
