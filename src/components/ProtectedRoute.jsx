import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, waitForSessionSafe } from '../lib/supabaseClient';

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
  const [courseStatus, setCourseStatus] = useState(null);

  const mountedRef = useRef(false);
  const bootedRef = useRef(false);
  const lastProfileRef = useRef(null);
  const profileLoadIdRef = useRef(0);

  const isAuthCallback = window.location.pathname.includes('auth');

  async function loadCourseStatus(userId) {
    const { data, error } = await supabase
      .from('agent_course_status')
      .select('*')
      .eq('agent_id', userId)
      .maybeSingle();

    if (error) {
      setCourseStatus(null);
      return;
    }

    setCourseStatus(data || null);
  }

  async function loadProfileForSession(nextSession, { keepPreviousOnFailure = true } = {}) {
    const loadId = ++profileLoadIdRef.current;

    if (!mountedRef.current) return;

    if (!nextSession) {
      lastProfileRef.current = null;
      setProfile(null);
      setCourseStatus(null);
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
      await loadCourseStatus(nextSession.user.id);
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

    await loadCourseStatus(nextSession.user.id);
    setProfileLoading(false);
  }

  useEffect(() => {
    mountedRef.current = true;

    if (bootedRef.current || isAuthCallback) {
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
        setCourseStatus(null);
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
          setCourseStatus(null);
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
  }, [isAuthCallback]);

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

  const path = window.location.pathname;
  const isAdmin = Boolean(profile?.is_admin);
  const isCourseApproved = courseStatus?.status === 'approved';
  const isCoursePage = path === '/app/course';

  if (!isAdmin && path.startsWith('/app') && !isCoursePage && !isCourseApproved) {
    return <Navigate to="/app/course" replace />;
  }

  return children;
}
