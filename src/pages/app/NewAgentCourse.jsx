import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const COURSE_VIDEOS = [
  { title: 'Intro', url: 'https://youtu.be/Ed-3HnJ7sXE' },
  { title: 'Why People Fail', url: 'https://youtu.be/qD9nHMHi_6g' },
  { title: 'Anyone Can Do It', url: 'https://youtu.be/KmL0w2wWgPw' },
  { title: 'What Is an IUL', url: 'https://youtu.be/PcnmOvwMBJ8' },
  { title: 'How to Get Paid', url: 'https://youtu.be/eMqrmrULL58' },
  { title: 'Paid Leads', url: 'https://youtu.be/L-soCdg_DHM' },
  { title: 'Cameras', url: 'https://youtu.be/5CptFiykupY' },
  { title: 'Chargebacks', url: 'https://youtu.be/3Oxzuc-qRgQ' },
  { title: 'Final Instructions', url: 'https://youtu.be/CIhV9yg63gA' }
];

function getYouTubeId(url) {
  if (!url) return '';

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '').trim();
    }

    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v') || '';
    }

    return '';
  } catch {
    return '';
  }
}

function loadYouTubeApi() {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');

    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady();
      resolve(window.YT);
    };

    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => reject(new Error('YouTube API failed to load'));
      document.body.appendChild(tag);
    }

    setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT);
    }, 1500);
  });
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function NewAgentCourse() {
  const mountRef = useRef(null);
  const playerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const maxWatchedRef = useRef(0);
  const saveTimerRef = useRef(null);
  const sessionUserIdRef = useRef('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sessionUserId, setSessionUserId] = useState('');
  const [progressRows, setProgressRows] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [maxWatched, setMaxWatched] = useState(0);

  const activeVideo = COURSE_VIDEOS[activeIndex];
  const youtubeId = getYouTubeId(activeVideo?.url);

  const progressMap = useMemo(() => {
    const map = new Map();
    progressRows.forEach((row) => {
      map.set(Number(row.video_index), row);
    });
    return map;
  }, [progressRows]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setLoadError('');

        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session?.user?.id) {
          if (!cancelled) {
            setSessionUserId('');
            sessionUserIdRef.current = '';
            setProgressRows([]);
            setLoading(false);
          }
          return;
        }

        const userId = session.user.id;

        if (!cancelled) {
          setSessionUserId(userId);
          sessionUserIdRef.current = userId;
        }

        const { data, error } = await supabase
          .from('agent_course_video_progress')
          .select('*')
          .eq('agent_id', userId);

        if (error) throw error;

        if (!cancelled) {
          setProgressRows(data || []);
          setLoading(false);
        }
      } catch (error) {
        console.error('Course load error:', error);
        if (!cancelled) {
          setLoadError(error?.message || 'Could not load course progress.');
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProgress(seconds, completed = false) {
    const userId = sessionUserIdRef.current || sessionUserId;
    if (!userId) return;

    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const existing = progressMap.get(activeIndex);
    const watchedSeconds = Math.max(Number(existing?.watched_seconds || 0), safeSeconds);

    const row = {
      agent_id: userId,
      video_index: activeIndex,
      watched_seconds: watchedSeconds,
      completed: Boolean(existing?.completed || completed)
    };

    const { error } = await supabase
      .from('agent_course_video_progress')
      .upsert(row, { onConflict: 'agent_id,video_index' });

    if (error) {
      console.error('Course progress save error:', error);
      return;
    }

    setProgressRows((prev) => {
      const withoutCurrent = prev.filter((r) => Number(r.video_index) !== activeIndex);
      return [...withoutCurrent, row];
    });
  }

  function queueSave(seconds, completed = false) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      saveProgress(seconds, completed);
    }, 400);
  }

  useEffect(() => {
    if (!youtubeId || loading) return;

    let cancelled = false;

    async function setupPlayer() {
      try {
        setLoadError('');

        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }

        if (playerRef.current?.destroy) {
          try {
            playerRef.current.destroy();
          } catch {
            // ignore YouTube destroy errors
          }
        }

        playerRef.current = null;
        setCurrentTime(0);
        setDuration(0);

        const saved = Number(progressMap.get(activeIndex)?.watched_seconds || 0);
        maxWatchedRef.current = saved;
        setMaxWatched(saved);

        if (mountRef.current) {
          mountRef.current.innerHTML = '';
        }

        const YT = await loadYouTubeApi();
        if (cancelled || !mountRef.current) return;

        const playerDiv = document.createElement('div');
        mountRef.current.appendChild(playerDiv);

        playerRef.current = new YT.Player(playerDiv, {
          videoId: youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            disablekb: 1
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;

              const player = event.target;
              const videoDuration = Number(player.getDuration() || 0);

              setDuration(videoDuration);

              if (saved > 0 && saved < videoDuration) {
                player.seekTo(saved, true);
                setCurrentTime(saved);
              }
            },
            onStateChange: (event) => {
              if (cancelled) return;

              if (event.data === window.YT?.PlayerState?.ENDED) {
                const finalDuration = Number(playerRef.current?.getDuration?.() || duration || 0);
                maxWatchedRef.current = finalDuration;
                setMaxWatched(finalDuration);
                setCurrentTime(finalDuration);
                saveProgress(finalDuration, true);
              }
            },
            onError: (event) => {
              console.error('YouTube player error:', event?.data);
              setLoadError('This video could not be loaded from YouTube.');
            }
          }
        });

        progressTimerRef.current = setInterval(() => {
          const player = playerRef.current;
          if (!player?.getCurrentTime) return;

          let t = 0;
          let d = 0;

          try {
            t = Number(player.getCurrentTime() || 0);
            d = Number(player.getDuration() || 0);
          } catch {
            return;
          }

          setCurrentTime(t);

          if (d > 0) setDuration(d);

          if (t > maxWatchedRef.current) {
            maxWatchedRef.current = t;
            setMaxWatched(t);
            queueSave(t, false);
          }
        }, 500);
      } catch (error) {
        console.error('YouTube setup error:', error);
        if (!cancelled) {
          setLoadError(error?.message || 'Could not load the video player.');
        }
      }
    }

    setupPlayer();

    return () => {
      cancelled = true;

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore YouTube destroy errors
        }
      }

      playerRef.current = null;

      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, [activeIndex, youtubeId, loading]);

  function handleSeek(event) {
    const wantedTime = Number(event.target.value || 0);
    const safeTime = Math.min(wantedTime, maxWatchedRef.current);

    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(safeTime, true);
    }

    setCurrentTime(safeTime);
  }

  function goToVideo(index) {
    setActiveIndex(index);
  }

  const completedCount = progressRows.filter((row) => row.completed).length;
  const totalCount = COURSE_VIDEOS.length;
  const coursePercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Course</h1>
        <p>Loading course...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Course</h1>

      {loadError ? (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: '#fee2e2',
            color: '#991b1b',
            marginBottom: 16
          }}
        >
          {loadError}
        </div>
      ) : null}

      {!sessionUserId ? (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: '#fef3c7',
            color: '#92400e',
            marginBottom: 16
          }}
        >
          You need to be logged in to save course progress.
        </div>
      ) : null}

      <div style={{ marginBottom: 14 }}>
        Progress: {completedCount}/{totalCount} completed ({coursePercent}%)
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 20
        }}
      >
        {COURSE_VIDEOS.map((video, index) => {
          const row = progressMap.get(index);
          const isActive = index === activeIndex;

          return (
            <button
              key={video.url}
              type="button"
              onClick={() => goToVideo(index)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: isActive ? '2px solid #111827' : '1px solid #d1d5db',
                background: isActive ? '#111827' : '#ffffff',
                color: isActive ? '#ffffff' : '#111827',
                cursor: 'pointer'
              }}
            >
              {row?.completed ? '✓ ' : ''}
              {video.title}
            </button>
          );
        })}
      </div>

      <h2 style={{ marginBottom: 10 }}>{activeVideo?.title}</h2>

      <div
        ref={mountRef}
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#000',
          borderRadius: 12,
          overflow: 'hidden'
        }}
      />

      <input
        type="range"
        min="0"
        max={duration || 1}
        value={Math.min(currentTime, duration || 1)}
        onChange={handleSeek}
        style={{ width: '100%', marginTop: 14 }}
      />

      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>
          Current: {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <span>
          Max watched: {formatTime(maxWatched)}
        </span>
      </div>

      <p style={{ marginTop: 10, color: '#6b7280' }}>
        Agents can go backward anytime, but can only go forward up to the furthest point they have watched.
        The video auto-completes when it ends.
      </p>
    </div>
  );
}
