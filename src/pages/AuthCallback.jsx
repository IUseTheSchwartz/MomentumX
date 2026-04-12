// src/pages/AuthCallback.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debugLog(step, payload = {}) {
  console.log(`[AuthCallback] ${step}`, payload);
}

async function exchangeSessionFromUrlIfNeeded() {
  const search = new URLSearchParams(window.location.search);
  const code = search.get('code');

  debugLog('exchangeSessionFromUrlIfNeeded:start', {
    href: window.location.href,
    search: window.location.search,
    hash: window.location.hash,
    hasCode: Boolean(code)
  });

  if (!code) return null;

  const result = await supabase.auth.exchangeCodeForSession(code);

  debugLog('exchangeSessionFromUrlIfNeeded:result', {
    hasSession: Boolean(result?.data?.session),
    hasUser: Boolean(result?.data?.user),
    error: result?.error
      ? {
          message: result.error.message,
          status: result.error.status,
          name: result.error.name
        }
      : null
  });

  if (result.error) {
    return null;
  }

  return result.data.session || null;
}

async function waitForStableSession({ timeoutMs = 5000, intervalMs = 250 } = {}) {
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;

    const result = await supabase.auth.getSession();
    const session = result?.data?.session || null;

    debugLog('waitForStableSession:poll', {
      attempt,
      hasSession: Boolean(session),
      userId: session?.user?.id || null,
      hasProviderToken: Boolean(session?.provider_token),
      expiresAt: session?.expires_at || null,
      error: result?.error
        ? {
            message: result.error.message,
            status: result.error.status,
            name: result.error.name
          }
        : null
    });

    if (session) return session;

    await delay(intervalMs);
  }

  debugLog('waitForStableSession:timeout');
  return null;
}

async function waitForProviderToken({ timeoutMs = 3000, intervalMs = 200 } = {}) {
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;

    const result = await supabase.auth.getSession();
    const session = result?.data?.session || null;

    debugLog('waitForProviderToken:poll', {
      attempt,
      hasSession: Boolean(session),
      userId: session?.user?.id || null,
      hasProviderToken: Boolean(session?.provider_token)
    });

    if (session?.provider_token) return session;

    await delay(intervalMs);
  }

  debugLog('waitForProviderToken:timeout');
  return null;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verifying access...');

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        debugLog('run:start', {
          href: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
          userAgent: navigator.userAgent
        });

        setMessage('Completing login...');

        const storageKeys = Object.keys(window.localStorage || {}).filter((key) =>
          key.toLowerCase().includes('supabase')
        );

        debugLog('localStorage:beforeExchange', {
          storageKeys
        });

        await exchangeSessionFromUrlIfNeeded();

        if (!active) return;

        let session = await waitForStableSession();

        if (!active) return;

        if (!session) {
          debugLog('run:noSessionAfterStableWait', {
            href: window.location.href,
            search: window.location.search,
            hash: window.location.hash
          });

          setMessage('Session not found. Sending you back...');
          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 800);
          return;
        }

        debugLog('run:stableSessionFound', {
          userId: session.user?.id || null,
          email: session.user?.email || null,
          hasProviderToken: Boolean(session.provider_token),
          provider: session.user?.app_metadata?.provider || null
        });

        if (!session.provider_token) {
          setMessage('Finalizing Discord access...');
          const tokenReadySession = await waitForProviderToken();
          if (tokenReadySession) {
            session = tokenReadySession;
          }
        }

        if (!active) return;

        const providerToken = session.provider_token;

        debugLog('run:providerTokenCheck', {
          hasProviderToken: Boolean(providerToken),
          userId: session.user?.id || null
        });

        if (!providerToken) {
          debugLog('run:noProviderTokenSigningOut', {
            userId: session.user?.id || null
          });

          await supabase.auth.signOut();
          if (active) navigate('/denied', { replace: true });
          return;
        }

        setMessage('Checking membership...');

        let response;
        let data;

        try {
          response = await fetch('/.netlify/functions/discord-membership-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              providerToken,
              userId: session.user.id,
              email: session.user.email,
              fullName:
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.name ||
                session.user.email ||
                'Momentum Agent',
              avatarUrl: session.user.user_metadata?.avatar_url || null,
              discordId: session.user.user_metadata?.provider_id || null,
              discordUsername:
                session.user.user_metadata?.preferred_username ||
                session.user.user_metadata?.full_name ||
                session.user.email
            })
          });

          data = await response.json();

          debugLog('membershipCheck:result', {
            status: response.status,
            ok: response.ok,
            data
          });
        } catch (error) {
          data = null;

          debugLog('membershipCheck:error', {
            message: error?.message || 'Unknown fetch error'
          });
        }

        if (!active) return;

        if (!response?.ok || !data?.ok) {
          debugLog('run:membershipDenied', {
            responseOk: response?.ok || false,
            status: response?.status || null,
            data
          });

          await supabase.auth.signOut();
          navigate('/denied', { replace: true });
          return;
        }

        if (data.banned) {
          debugLog('run:userBanned', { userId: session.user?.id || null });
          navigate('/ineligible', { replace: true });
          return;
        }

        const refreshed = await supabase.auth.getSession();
        const refreshedSession = refreshed?.data?.session || null;

        debugLog('run:refreshedSession', {
          hasSession: Boolean(refreshedSession),
          userId: refreshedSession?.user?.id || null,
          hasProviderToken: Boolean(refreshedSession?.provider_token),
          error: refreshed?.error
            ? {
                message: refreshed.error.message,
                status: refreshed.error.status,
                name: refreshed.error.name
              }
            : null
        });

        if (!active) return;

        if (!refreshedSession) {
          debugLog('run:sessionLostAfterMembershipCheck');

          setMessage('Session not found. Sending you back...');
          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 800);
          return;
        }

        debugLog('run:successNavigate', {
          isAdmin: Boolean(data.isAdmin),
          destination: data.isAdmin ? '/admin/overview' : '/app/dashboard'
        });

        if (data.isAdmin) {
          navigate('/admin/overview', { replace: true });
          return;
        }

        navigate('/app/dashboard', { replace: true });
      } catch (error) {
        debugLog('run:unhandledError', {
          message: error?.message || 'Unknown error',
          stack: error?.stack || null
        });

        setMessage('Login failed. Sending you back...');
        setTimeout(() => {
          if (active) navigate('/', { replace: true });
        }, 800);
      }
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      debugLog('onAuthStateChange', {
        event,
        hasSession: Boolean(session),
        userId: session?.user?.id || null,
        hasProviderToken: Boolean(session?.provider_token)
      });
    });

    run();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return <div className="page-center">{message}</div>;
}
