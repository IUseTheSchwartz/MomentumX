import { supabase } from '../lib/supabaseClient';
import Starfield from '../components/Starfield';

export default function Landing() {
  async function loginWithDiscord() {
    const redirectTo = `${window.location.origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo,
        scopes: 'identify guilds'
      }
    });
  }

  return (
    <div className="landing">
      <Starfield />

      <div className="landing-inner">
        <div className="hero glass">
          <div className="eyebrow">Momentum Financial</div>
          <h1>Momentum X</h1>
          <p className="hero-copy">
            Lead distribution. KPI pressure. Tier control. Agent ops with a futuristic command-center feel.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary" onClick={loginWithDiscord}>
              Login with Discord
            </button>
          </div>

          <div className="hero-foot">
            Must be a member of the Momentum Financial Discord server.
          </div>
        </div>
      </div>
    </div>
  );
}
