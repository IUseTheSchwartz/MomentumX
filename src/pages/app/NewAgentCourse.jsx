import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const COURSE_VIDEOS = [
  {
    title: 'Intro',
    description: 'Course intro and what new agents need to understand first.',
    url: 'https://youtu.be/Ed-3HnJ7sXE'
  },
  {
    title: 'Why People Fail',
    description: 'Why most people fail in the business and what to avoid.',
    url: 'https://youtu.be/qD9nHMHi_6g'
  },
  {
    title: 'Anyone Can Do It',
    description: 'Why anyone can succeed if they follow the system.',
    url: 'https://youtu.be/KmL0w2wWgPw'
  },
  {
    title: 'What Is an IUL and Where to Go',
    description: 'What an IUL is and which direction/company to take people.',
    url: 'https://youtu.be/PcnmOvwMBJ8'
  },
  {
    title: 'How to Get Paid + Day to Day as an Agent',
    description: 'How agents get paid and what the day-to-day looks like.',
    url: 'https://youtu.be/eMqrmrULL58'
  },
  {
    title: 'Paid Leads',
    description: 'Paid leads, when to buy, and how to think about lead flow.',
    url: 'https://youtu.be/L-soCdg_DHM'
  },
  {
    title: 'Cameras on Video',
    description: 'Why cameras matter on Discord/Zoom and why agents cannot hide.',
    url: 'https://youtu.be/5CptFiykupY'
  },
  {
    title: 'Chargebacks',
    description: 'What chargebacks are and how to prevent them.',
    url: 'https://youtu.be/3Oxzuc-qRgQ'
  },
  {
    title: 'Final Voice Note Instructions',
    description: 'Final video explaining what to do for the voice note.',
    url: 'https://youtu.be/CIhV9yg63gA'
  }
];

function getStatusLabel(status) {
  if (status === 'approved') return 'Approved';
  if (status === 'pending_review') return 'Pending Review';
  if (status === 'returned') return 'Returned';
  if (status === 'in_progress') return 'In Progress';
  return 'Not Started';
}

function getYouTubeId(url) {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) return url.split('v=')[1]?.split('&')[0] || '';
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split('?')[0] || '';
  return '';
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function loadYouTubeApi() {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');

    window.onYouTubeIframeAPIReady = () => {
      resolve(window.YT);
    };

    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  });
}

export default function NewAgentCourse() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const activeIndexRef = useRef(0);
  const maxWatchedRef = useRef(0);
  const saveTimerRef = useRef(null);

  const [sessionUserId, setSessionUserId] = useState('');
  const [status, setStatus] = useState(null);
  const [progressRows, setProgressRows] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [videoReady, setVideoReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [maxWatched, setMaxWatched] = useState(0);

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
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (playerRef.current?.destroy) playerRef.current.destroy();
    };
  }, []);

  const completedIndexes = useMemo(() => {
    return new Set(
      (progressRows || [])
        .filter((row) => row.completed)
        .map((row) => Number(row.video_index))
    );
  }, [progressRows]);

  const progressByIndex = useMemo(() => {
    const map = new Map();
    (progressRows || []).forEach((row) => {
      map.set(Number(row.video_index), row);
    });
    return map;
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

  async function saveVideoProgress(index, watchedSeconds, completed = false) {
    if (!sessionUserId) return;

    const existingRow = progressByIndex.get(index);
    const nextWatched = Math.max(
      Number(existingRow?.watched_seconds || 0),
      Number(watchedSeconds || 0)
    );

    await supabase.from('agent_course_video_progress').upsert(
      {
        agent_id: sessionUserId,
        video_index: index,
        completed: completed || Boolean(existingRow?.completed),
        watched_seconds: Math.floor(nextWatched),
        completed_at: completed
          ? existingRow?.completed_at || new Date().toISOString()
          : existingRow?.completed_at || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'agent_id,video_index' }
    );

    if (completed) {
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
    } else {
      setProgressRows((rows) => {
        const otherRows = (rows || []).filter((row) => Number(row.video_index) !== index);
        return [
          ...otherRows,
          {
            ...(existingRow || {}),
            agent_id: sessionUserId,
            video_index: index,
            completed: Boolean(existingRow?.completed),
            watched_seconds: Math.floor(nextWatched)
          }
        ].sort((a, b) => Number(a.video_index) - Number(b.video_index));
      });
    }
  }

  function queueSaveProgress(index, watchedSeconds) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      saveVideoProgress(index, watchedSeconds, false).catch((error) => {
        console.error('Could not save video progress:', error);
      });
    }, 900);
  }

  async function completeVideo(index) {
    if (!sessionUserId || saving || completedIndexes.has(index)) return;

    setSaving(true);
    setMessage('');

    try {
      await saveVideoProgress(index, duration || maxWatchedRef.current, true);
    } catch (error) {
      setMessage(error.message || 'Could not complete video.');
    } finally {
      setSaving(false);
    }
  }

  const activeVideo = COURSE_VIDEOS[activeIndex] || null;
  const youtubeId = getYouTubeId(activeVideo?.url);

  useEffect(() => {
    activeIndexRef.current = activeIndex;

    if (!activeVideo || !youtubeId) return;

    let cancelled = false;

    async function setupPlayer() {
      setVideoReady(false);
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      const savedSeconds = Number(progressByIndex.get(activeIndex)?.watched_seconds || 0);
      maxWatchedRef.current = savedSeconds;
      setMaxWatched(savedSeconds);

      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (playerRef.current?.destroy) playerRef.current.destroy();

      const YT = await loadYouTubeApi();

      if (cancelled || !playerContainerRef.current) return;

      playerRef.current = new YT.Player(playerContainerRef.current, {
        videoId: youtubeId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;

            const player = event.target;
            const videoDuration = Number(player.getDuration() || 0);

            setDuration(videoDuration);
            setVideoReady(true);

            if (savedSeconds > 0 && savedSeconds < videoDuration) {
              player.seekTo(savedSeconds, true);
              setCurrentTime(savedSeconds);
            }
          },
          onStateChange: (event) => {
            if (!window.YT) return;

            if (event.data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
            }

            if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              setPlaying(false);
            }

            if (event.data === window.YT.PlayerState.ENDED) {
              completeVideo(activeIndexRef.current);
            }
          }
        }
      });

      progressTimerRef.current = setInterval(() => {
        const player = playerRef.current;
        if (!player?.getCurrentTime) return;

        const time = Number(player.getCurrentTime() || 0);
        const videoDuration = Number(player.getDuration() || 0);

        setCurrentTime(time);
        if (videoDuration) setDuration(videoDuration);

        const completed = completedIndexes.has(activeIndexRef.current);

        if (!completed && time > maxWatchedRef.current) {
          maxWatchedRef.current = time;
          setMaxWatched(time);
          queueSaveProgress(activeIndexRef.current, time);
        }
      }, 500);
    }

    setupPlayer();

    return () => {
      cancelled = true;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [activeIndex, youtubeId, sessionUserId]);

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;

    if (playing) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }

  function handleSeek(value) {
    const requested = Number(value || 0);
    const allowedMax = completedIndexes.has(activeIndex) ? duration : maxWatchedRef.current;
    const safeTime = Math.min(requested, allowedMax);

    playerRef.current?.seekTo?.(safeTime, true);
    setCurrentTime(safeTime);
  }

  async function startRecording() {
    setMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
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

  return (
    <div className="page" style={{ height: '100%', minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
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
            Your final submission is waiting for admin approval.
          </p>
        </div>
      ) : null}

      {isApproved ? (
        <div className="glass top-gap" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Course Approved</h3>
          <p style={{ marginBottom: 0 }}>
            Your course is complete. You can still come back anytime to rewatch the training.
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

              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  background: 'rgba(0,0,0,0.35)'
                }}
              >
                <div ref={playerContainerRef} style={{ width: '100%', height: '100%' }} />
              </div>

              <div className="top-gap" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={togglePlay}
                  disabled={!videoReady}
                >
                  {playing ? 'Pause' : 'Play'}
                </button>

                <div style={{ fontSize: 13, opacity: 0.8, minWidth: 92 }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <input
                  type="range"
                  min="0"
                  max={Math.max(1, Math.floor(duration || 1))}
                  value={Math.min(Math.floor(currentTime || 0), Math.floor(duration || 1))}
                  onChange={(e) => handleSeek(e.target.value)}
                  style={{ width: '100%' }}
                  disabled={!videoReady}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.7 }}>
                  <span>Watched: {formatTime(maxWatched)}</span>
                  <span>
                    {completedIndexes.has(activeIndex)
                      ? 'Completed'
                      : `Forward locked at ${formatTime(maxWatched)}`}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
                You can go back anytime. You can only go forward up to the farthest point you have watched.
                This video completes automatically when it ends.
              </div>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>Final Voice Recording</h2>
              <p style={{ opacity: 0.75 }}>
                Record your final voice assignment. After you submit, an admin must approve it before your full access unlocks.
              </p>

              <div className="glass" style={{ padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 style={{ marginTop: 0 }}>What to include</h3>
                <ul style={{ marginBottom: 0 }}>
                  <li>Who you are and why you joined Momentum X.</li>
                  <li>What you learned from the course.</li>
                  <li>How you are going to approach leads, calls, Zoom, and follow-up.</li>
                  <li>That you understand chargebacks and expectations.</li>
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
                  placeholder="If you sent the voice recording to Logan instead, write that here..."
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
