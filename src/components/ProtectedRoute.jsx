import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, getSessionSafe, waitForSessionSafe } from '../lib/supabaseClient';

const PROFILE_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), ms);
    })
  ]);
}

export default function ProtectedRoute({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);

  const mountedRef = useRef(false);
  const bootedRef = useRef(false);
  const lastProfileRef = useRef(null);
  const profileLoadIdRef = useRef(0);

  async function loadProfileForSession(nextSession, { keepPreviousOnFailure = true } = {}) {
    const loadId = ++profileLoadIdRef.current;

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

    if (!mountedRef.current || loadId !== profileLoadIdRef.current) return;

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

  useEffect(() => {
    mountedRef.current = true;

    if (bootedRef.current) {
      return () => {
        mountedRef.current = false;
      };
    }

    bootedRef.current = true;

    let authSubscription = null;

    async function boot() {
      try {
        const initialSession = await waitForSessionSafe({
          timeoutMs: 5000,
          intervalMs: 250
        });

        if (!mountedRef.current) return;

        setSession(initialSession ?? null);
        setAuthLoading(false);

        await loadProfileForSession(initialSession ?? null, {
          keepPreviousOnFailure: false
        });
      } catch (error) {
        console.error('[ProtectedRoute] boot failed', error);

        if (!mountedRef.current) return;

        setSession(null);
        setProfile(null);
        setAuthLoading(false);
        setProfileLoading(false);
      }

      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!mountedRef.current) return;

        if (event === 'SIGNED_OUT') {
          lastProfileRef.current = null;
          setSession(null);
          setProfile(null);
          setAuthLoading(false);
          setProfileLoading(false);
          return;
        }

        const resolvedSession = nextSession ?? null;

        setSession(resolvedSession);
        setAuthLoading(false);

        void loadProfileForSession(resolvedSession, {
          keepPreviousOnFailure: true
        });
      });

      authSubscription = subscription;
    }

    void boot();

    return () => {
      mountedRef.current = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  if (authLoading || session === undefined) {
    return <div className="page-center">Loading Momentum X...</div>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (profileLoading && !profile) {
    return <div className="page-center">Loading Momentum X...</div>;
  }

  if (profile?.lead_access_banned) {
    return <Navigate to="/ineligible" replace />;
  }

  return children;
}
