import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const COURSE_VIDEOS = [
  {
    title: 'Intro Video',
    description: 'Welcome to Momentum X and what this course is going to prepare you for.',
    url: ''
  },
  {
    title: 'Why Most People Fail the Business',
    description: 'The real reasons agents quit, lose focus, or never build momentum.',
    url: ''
  },
  {
    title: 'Why Anyone Can Do It',
    description: 'The mindset, activity, and consistency that makes this business simple.',
    url: ''
  },
  {
    title: 'Day-to-Day as an Agent',
    description: 'What your daily schedule should look like and what actually matters.',
    url: ''
  },
  {
    title: 'What Is an IUL + Which Company to Take People To',
    description: 'Basic IUL explanation and where to place people.',
    url: ''
  },
  {
    title: 'How Agents Get Paid',
    description: 'How commissions work, when agents get paid, and what to expect.',
    url: ''
  },
  {
    title: 'Paid Leads: When to Buy Leads',
    description: 'When to buy leads, how to think about lead flow, and how not to waste money.',
    url: ''
  },
  {
    title: 'Lead Spend + Profitability',
    description: 'How much agents spend, what profitable lead spend looks like, and how to scale.',
    url: ''
  },
  {
    title: 'Cameras on Discord and Zoom',
    description: 'Why cameras matter and why agents cannot hide in person or on team calls.',
    url: ''
  },
  {
    title: 'Chargebacks',
    description: 'What chargebacks are, how they happen, and how to protect yourself.',
    url: ''
  }
];

function getStatusLabel(status) {
  if (status === 'approved') return 'Approved';
  if (status === 'pending_review') return 'Pending Review';
  if (status === 'returned') return 'Returned';
  if (status === 'in_progress') return 'In Progress';
  return 'Not Started';
}

function getVideoEmbed(url) {
  if (!url) return null;

  if (url.includes('youtube.com/watch?v=')) {
    const id = url.split('v=')[1]?.split('&')[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (url.includes('vimeo.com/')) {
    const id = url.split('vimeo.com/')[1]?.split('?')[0];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }

  return null;
}

export default function NewAgentCourse() {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [sessionUserId, setSessionUserId] = useState('');
  const [status, setStatus] = useState(null);
  const [progressRows, setProgressRows] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [finalNote, setFinalNote] = useState('');
  const [submittingFinal, setSubmittingFinal] = useState(false);

  async function ensureStatus(userId) {
    const { data: existing, error: existingError } = await supabase
      .from('agent_course_status')
      .select('*')
      .eq('agent_id', userId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data, error } = await supabase
      .from('agent_course_status')
      .insert({
        agent_id: userId,
        status: 'not_started',
        current_step: 0
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function load() {
    setMessage('');

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    setSessionUserId(session.user.id);

    const courseStatus = await ensureStatus(session.user.id);

    const { data: progressData, error: progressError } = await supabase
      .from('agent_course_video_progress')
      .select('*')
      .eq('agent_id', session.user.id)
      .order('video_index');

    if (progressError) throw progressError;

    setStatus(courseStatus);
    setProgressRows(progressData || []);
    setActiveIndex(Math.min(Number(courseStatus.current_step || 0), COURSE_VIDEOS.length));
  }

  useEffect(() => {
    load().catch((error) => {
      console.error('Failed to load course:', error);
      setMessage(error.message || 'Failed to load course.');
    });

    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, []);

  const completedIndexes = useMemo(() => {
    return new Set(
      (progressRows || [])
        .filter((row) => row.completed)
        .map((row) => Number(row.video_index))
    );
  }, [progressRows]);

  const videosCompleted = completedIndexes.size;
  const percentComplete = Math.round((videosCompleted / COURSE_VIDEOS.length) * 100);
  const allVideosComplete = videosCompleted >= COURSE_VIDEOS.length;
  const isApproved = status?.status === 'approved';
  const isPending = status?.status === 'pending_review';

  function isVideoUnlocked(index) {
    if (isApproved) return true;
    if (index === 0) return true;
    return completedIndexes.has(index - 1) || Number(status?.current_step || 0) >= index;
  }

  async function markVideoComplete(index) {
    if (!sessionUserId || saving) return;

    setSaving(true);
    setMessage('');

    try {
      await supabase.from('agent_course_video_progress').upsert(
        {
          agent_id: sessionUserId,
          video_index: index,
          completed: true,
          watched_seconds: Math.floor(videoRef.current?.currentTime || 0),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'agent_id,video_index' }
      );

      const nextStep = Math.max(Number(status?.current_step || 0), index + 1);
      const nextStatus = status?.status === 'approved' ? 'approved' : 'in_progress';

      await supabase
        .from('agent_course_status')
        .update({
          current_step: nextStep,
          status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('agent_id', sessionUserId);

      await load();
      setActiveIndex(Math.min(index + 1, COURSE_VIDEOS.length));
    } catch (error) {
      setMessage(error.message || 'Could not complete video.');
    } finally {
      setSaving(false);
    }
  }

  async function startRecording() {
    setMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);

        if (recordingUrl) URL.revokeObjectURL(recordingUrl);

        setRecordedBlob(blob);
        setRecordingUrl(url);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      setMessage('Microphone permission is required to record inside the site.');
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecording(false);
  }

  async function uploadRecordingIfNeeded() {
    if (!recordedBlob) return status?.final_recording_url || null;

    const fileName = `final-course-recording-${Date.now()}.webm`;
    const path = `${sessionUserId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('course-recordings')
      .upload(path, recordedBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'audio/webm'
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('course-recordings').getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function submitFinalReview() {
    if (!sessionUserId || submittingFinal) return;

    setSubmittingFinal(true);
    setMessage('');

    try {
      const finalRecordingUrl = await uploadRecordingIfNeeded();

      await supabase
        .from('agent_course_status')
        .update({
          status: 'pending_review',
          final_recording_url: finalRecordingUrl,
          final_recording_note: finalNote.trim() || null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('agent_id', sessionUserId);

      setMessage('Submitted for admin review.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not submit final review.');
    } finally {
      setSubmittingFinal(false);
    }
  }

  const activeVideo = COURSE_VIDEOS[activeIndex] || null;
  const embedUrl = getVideoEmbed(activeVideo?.url);

  return (
    <div
      className="page"
      style={{
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        paddingRight: 4
      }}
    >
      <div className="page-header">
        <div>
          <h1>New Agent Course</h1>
          <p>Complete the training and submit your final voice recording to unlock Momentum X.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="glass" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Status</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{getStatusLabel(status?.status)}</div>
        </div>

        <div className="glass" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Videos Complete</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {videosCompleted}/{COURSE_VIDEOS.length}
          </div>
        </div>

        <div className="glass" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Progress</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{percentComplete}%</div>
        </div>

        <div className="glass" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Access</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{isApproved ? 'Unlocked' : 'Locked'}</div>
        </div>
      </div>

      {status?.status === 'returned' ? (
        <div className="glass top-gap" style={{ padding: 16, border: '1px solid rgba(239,68,68,0.25)' }}>
          <h3 style={{ marginTop: 0 }}>Returned by Admin</h3>
          <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {status.returned_note || 'Please review the course and resubmit your final recording.'}
          </p>
        </div>
      ) : null}

      {isPending ? (
        <div className="glass top-gap" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Pending Review</h3>
          <p style={{ marginBottom: 0 }}>
            Your final submission is waiting for admin approval. Once approved, your full Momentum X access unlocks.
          </p>
        </div>
      ) : null}

      {isApproved ? (
        <div className="glass top-gap" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Course Approved</h3>
          <p style={{ marginBottom: 0 }}>
            Your course is complete. You can still come back here anytime to rewatch the training.
          </p>
        </div>
      ) : null}

      <div
        className="top-gap"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(0, 1.5fr)',
          gap: 14,
          alignItems: 'start'
        }}
      >
        <div className="glass" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Course Steps</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COURSE_VIDEOS.map((video, index) => {
              const completed = completedIndexes.has(index);
              const unlocked = isVideoUnlocked(index);
              const active = activeIndex === index;

              return (
                <button
                  key={video.title}
                  type="button"
                  className={active ? 'btn btn-primary' : 'btn btn-ghost'}
                  disabled={!unlocked}
                  onClick={() => setActiveIndex(index)}
                  style={{
                    justifyContent: 'space-between',
                    display: 'flex',
                    gap: 10,
                    opacity: unlocked ? 1 : 0.45
                  }}
                >
                  <span>
                    {index + 1}. {video.title}
                  </span>
                  <span>{completed ? 'Done' : unlocked ? 'Open' : 'Locked'}</span>
                </button>
              );
            })}

            <button
              type="button"
              className={activeIndex === COURSE_VIDEOS.length ? 'btn btn-primary' : 'btn btn-ghost'}
              disabled={!allVideosComplete && !isApproved}
              onClick={() => setActiveIndex(COURSE_VIDEOS.length)}
              style={{ opacity: allVideosComplete || isApproved ? 1 : 0.45 }}
            >
              Final Voice Recording
            </button>
          </div>
        </div>

        <div className="glass" style={{ padding: 16 }}>
          {activeVideo ? (
            <>
              <h2 style={{ marginTop: 0 }}>
                {activeIndex + 1}. {activeVideo.title}
              </h2>
              <p style={{ opacity: 0.75 }}>{activeVideo.description}</p>

              {activeVideo.url ? (
                embedUrl ? (
                  <iframe
                    title={activeVideo.title}
                    src={embedUrl}
                    style={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 14
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={activeVideo.url}
                    controls={false}
                    controlsList="nodownload noplaybackrate"
                    disablePictureInPicture
                    onEnded={() => markVideoComplete(activeIndex)}
                    style={{
                      width: '100%',
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}
                  />
                )
              ) : (
                <div
                  style={{
                    minHeight: 260,
                    borderRadius: 16,
                    border: '1px dashed rgba(255,255,255,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: 20,
                    background: 'rgba(255,255,255,0.02)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>Video Placeholder</div>
                    <div style={{ opacity: 0.75, marginTop: 8 }}>
                      Add the video URL later. For now, use the button below to test course progress.
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                {activeVideo.url && !embedUrl ? (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => videoRef.current?.play()}
                  >
                    Play Video
                  </button>
                ) : null}

                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => markVideoComplete(activeIndex)}
                  disabled={saving || completedIndexes.has(activeIndex)}
                >
                  {completedIndexes.has(activeIndex) ? 'Completed' : saving ? 'Saving...' : 'Mark Complete'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>Final Voice Recording</h2>
              <p style={{ opacity: 0.75 }}>
                Record or submit your final voice assignment. After you submit, an admin must approve it before your full access unlocks.
              </p>

              <div className="glass" style={{ padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 style={{ marginTop: 0 }}>What to include</h3>
                <ul style={{ marginBottom: 0 }}>
                  <li>Who you are and why you joined Momentum X.</li>
                  <li>What you learned from the course.</li>
                  <li>How you are going to approach leads, calls, Zoom, and follow-up.</li>
                  <li>That you understand chargebacks and the expectations.</li>
                </ul>
              </div>

              {recordingUrl ? (
                <div className="top-gap">
                  <audio controls src={recordingUrl} style={{ width: '100%' }} />
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                {!recording ? (
                  <button className="btn btn-primary" type="button" onClick={startRecording}>
                    Start Recording
                  </button>
                ) : (
                  <button className="btn btn-danger" type="button" onClick={stopRecording}>
                    Stop Recording
                  </button>
                )}
              </div>

              <label className="top-gap" style={{ display: 'block' }}>
                Optional Note
                <textarea
                  rows={4}
                  value={finalNote}
                  onChange={(e) => setFinalNote(e.target.value)}
                  placeholder="If you sent the voice recording to Logan, write that here..."
                />
              </label>

              <button
                className="btn btn-primary top-gap"
                type="button"
                onClick={submitFinalReview}
                disabled={submittingFinal || isPending}
              >
                {isPending ? 'Already Submitted' : submittingFinal ? 'Submitting...' : 'Submit for Review'}
              </button>
            </>
          )}
        </div>
      </div>

      {message ? (
        <div className="glass top-gap" style={{ padding: 12 }}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
