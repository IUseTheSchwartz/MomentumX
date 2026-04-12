import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const PROFILE_TIMEOUT_MS = 8000;
const SESSION_BOOT_TIMEOUT_MS = 5000;
const SESSION_BOOT_INTERVAL_MS = 250;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), ms);
    })
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getStableSession() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SESSION_BOOT_TIMEOUT_MS) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) return session;
    await sleep(SESSION_BOOT_INTERVAL_MS);
  }

  return null;
}

export default function AdminRoute({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);

  const mountedRef = useRef(true);
  const lastProfileRef = useRef(null);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    async function loadProfileForSession(nextSession, { keepPreviousOnFailure = true } = {}) {
      if (!mountedRef.current) return;

      if (!nextSession) {
        lastProfileRef.current = null;
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      const result = await withTimeout(
        supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle(),
        PROFILE_TIMEOUT_MS
      );

      if (!mountedRef.current) return;

      if (result?.timedOut) {
        if (keepPreviousOnFailure && lastProfileRef.current) {
          setProfile(lastProfileRef.current);
        }
        setProfileLoading(false);
        return;
      }

      const { data, error } = result;

      if (error) {
        if (keepPreviousOnFailure && lastProfileRef.current) {
          setProfile(lastProfileRef.current);
        } else {
          setProfile(null);
        }
      } else {
        const safeProfile = data || null;
        lastProfileRef.current = safeProfile;
        setProfile(safeProfile);
      }

      setProfileLoading(false);
    }

    async function refreshFromSession({ keepPreviousOnFailure = true, stable = false } = {}) {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;

      try {
        let currentSession = null;

        if (stable) {
          currentSession = await getStableSession();
        } else {
          const {
            data: { session: fetchedSession }
          } = await supabase.auth.getSession();
          currentSession = fetchedSession ?? null;
        }

        if (!mountedRef.current) return;

        setSession(currentSession ?? null);
        setAuthLoading(false);
        await loadProfileForSession(currentSession ?? null, { keepPreviousOnFailure });
      } finally {
        refreshInFlightRef.current = false;
      }
    }

    refreshFromSession({ keepPreviousOnFailure: false, stable: true });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        lastProfileRef.current = null;
        setSession(null);
        setProfile(null);
        setAuthLoading(false);
        setProfileLoading(false);
        return;
      }

      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED'
      ) {
        const stableSession = nextSession ?? (await getStableSession());

        if (!mountedRef.current) return;

        setSession(stableSession ?? null);
        setAuthLoading(false);
        await loadProfileForSession(stableSession ?? null, {
          keepPreviousOnFailure: true
        });
        return;
      }

      setSession(nextSession ?? null);
      setAuthLoading(false);
      await loadProfileForSession(nextSession ?? null, {
        keepPreviousOnFailure: true
      });
    });

    const handleVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      await refreshFromSession({ keepPreviousOnFailure: true, stable: false });
    };

    const handleFocus = async () => {
      await refreshFromSession({ keepPreviousOnFailure: true, stable: false });
    };

    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleFocus);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (authLoading || session === undefined) {
    return <div className="page-center">Loading Admin...</div>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (profileLoading && !profile) {
    return <div className="page-center">Loading Admin...</div>;
  }

  if (!profile?.is_admin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (profile?.lead_access_banned) {
    return <Navigate to="/ineligible" replace />;
  }

  return children;
}
