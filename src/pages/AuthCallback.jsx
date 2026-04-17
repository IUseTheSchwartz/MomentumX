// src/pages/AuthCallback.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOAuthErrorDetails() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));

  const error = search.get('error') || hash.get('error') || null;
  const errorCode = search.get('error_code') || hash.get('error_code') || null;
  const errorDescription =
    search.get('error_description') || hash.get('error_description') || null;

  return { error, errorCode, errorDescription };
}

function getFriendlyOAuthMessage(errorCode, errorDescription) {
  const text = `${errorCode || ''} ${errorDescription || ''}`.toLowerCase();

  if (text.includes('bad_oauth_state')) {
    return 'Login expired before it finished. Please try Discord login again.';
  }

  if (text.includes('oauth state not found or expired')) {
    return 'Login expired before it finished. Please try Discord login again.';
  }

  if (text.includes('pkce')) {
    return 'Login could not be completed on this browser. Please try Discord login again.';
  }

  if (text.includes('over_email_send_rate_limit')) {
    return 'Too many login attempts right now. Please wait a minute and try again.';
  }

  if (text.includes('error getting user email from external provider')) {
    return 'Discord login could not return account email. Please try again.';
  }

  if (text.includes('unexpected_failure')) {
    return 'Discord login failed unexpectedly. Please try again.';
  }

  return 'Login failed. Please try again.';
}

function hasFreshOAuthReturn() {
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';

  return (
    search.has('code') ||
    search.has('error') ||
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    hash.includes('error=')
  );
}

async function waitForStableSession({ timeoutMs = 6000, intervalMs = 250 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) return session;

    await delay(intervalMs);
  }

  return null;
}

async function waitForProviderToken({ timeoutMs = 3500, intervalMs = 200 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session?.provider_token) return session;

    await delay(intervalMs);
  }

  return null;
}

async function getExistingProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_admin, lead_access_banned')
    .eq('id', userId)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verifying access...');

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const freshOAuthReturn = hasFreshOAuthReturn();
        const { error, errorCode, errorDescription } = getOAuthErrorDetails();

        if (error) {
          console.error('[AuthCallback] OAuth redirect error', {
            error,
            errorCode,
            errorDescription,
            href: window.location.href
          });

          setMessage(getFriendlyOAuthMessage(errorCode, errorDescription));

          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 1800);

          return;
        }

        setMessage('Completing login...');

        const session = await waitForStableSession();

        if (!active) return;

        if (!session) {
          setMessage('Session not found. Sending you back...');
          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 1000);
          return;
        }

        if (!freshOAuthReturn) {
          navigate('/app/dashboard', { replace: true });
          return;
        }

        let tokenSession = session;

        if (!tokenSession.provider_token) {
          setMessage('Finalizing Discord access...');
          const tokenReadySession = await waitForProviderToken();
          if (tokenReadySession) {
            tokenSession = tokenReadySession;
          }
        }

        if (!active) return;

        const providerToken = tokenSession.provider_token;

        // Fallback for browsers/devices where provider_token does not come through.
        // If the user already has an approved profile, let them in.
        if (!providerToken) {
          setMessage('Finishing login...');

          const existingProfile = await getExistingProfile(tokenSession.user.id);

          if (!active) return;

          if (existingProfile) {
            if (existingProfile.lead_access_banned) {
              navigate('/ineligible', { replace: true });
              return;
            }

            if (existingProfile.is_admin) {
              navigate('/admin/overview', { replace: true });
              return;
            }

            navigate('/app/dashboard', { replace: true });
            return;
          }

          // No provider token AND no existing approved profile:
          // this is likely a true first-login browser issue, so send back home.
          setMessage('Discord login did not finish correctly. Please try again.');
          await supabase.auth.signOut();

          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 1200);
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
              userId: tokenSession.user.id,
              email: tokenSession.user.email,
              fullName:
                tokenSession.user.user_metadata?.full_name ||
                tokenSession.user.user_metadata?.name ||
                tokenSession.user.email ||
                'Momentum Agent',
              avatarUrl: tokenSession.user.user_metadata?.avatar_url || null,
              discordId: tokenSession.user.user_metadata?.provider_id || null,
              discordUsername:
                tokenSession.user.user_metadata?.preferred_username ||
                tokenSession.user.user_metadata?.full_name ||
                tokenSession.user.email
            })
          });

          data = await response.json();
        } catch (fetchError) {
          console.error('[AuthCallback] membership check failed', fetchError);
          data = null;
        }

        if (!active) return;

        if (!response?.ok || !data?.ok) {
          if (response?.status === 403) {
            await supabase.auth.signOut();
            navigate('/denied', { replace: true });
            return;
          }

          setMessage('Login check failed. Sending you back...');
          await supabase.auth.signOut();

          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 1200);
          return;
        }

        if (data.banned) {
          navigate('/ineligible', { replace: true });
          return;
        }

        const {
          data: { session: refreshedSession }
        } = await supabase.auth.getSession();

        if (!active) return;

        if (!refreshedSession) {
          setMessage('Session not found. Sending you back...');
          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 1000);
          return;
        }

        if (data.isAdmin) {
          navigate('/admin/overview', { replace: true });
          return;
        }

        navigate('/app/dashboard', { replace: true });
      } catch (error) {
        console.error('[AuthCallback] unhandled error', error);

        setMessage('Login failed. Sending you back...');
        setTimeout(() => {
          if (active) navigate('/', { replace: true });
        }, 1000);
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [navigate]);

  return <div className="page-center">{message}</div>;
}
