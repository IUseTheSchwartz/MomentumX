import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AdminRoute({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function loadProfile(nextSession) {
      if (!mountedRef.current) return;

      if (!nextSession) {
        setProfile(null);
        setProfileLoading(false);
        setProfileResolved(true);
        return;
      }

      setProfileLoading(true);
      setProfileResolved(false);

      const timeout = new Promise((resolve) => {
        setTimeout(() => resolve({ timedOut: true }), 6000);
      });

      const profileRequest = supabase
        .from('profiles')
        .select('*')
        .eq('id', nextSession.user.id)
        .maybeSingle();

      const result = await Promise.race([profileRequest, timeout]);

      if (!mountedRef.current) return;

      if (result?.timedOut) {
        setProfile(null);
        setProfileLoading(false);
        setProfileResolved(true);
        return;
      }

      const { data, error } = result;

      setProfile(error ? null : (data || null));
      setProfileLoading(false);
      setProfileResolved(true);
    }

    async function refreshAuthState() {
      const {
        data: { session: nextSession }
      } = await supabase.auth.getSession();

      if (!mountedRef.current) return;

      setSession(nextSession ?? null);
      setAuthLoading(false);
      await loadProfile(nextSession ?? null);
    }

    refreshAuthState();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mountedRef.current) return;

      setSession(nextSession ?? null);
      setAuthLoading(false);
      await loadProfile(nextSession ?? null);
    });

    const handleFocus = () => {
      refreshAuthState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAuthState();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (authLoading || session === undefined) {
    return <div className="page-center">Loading Admin...</div>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (profileLoading || !profileResolved) {
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
