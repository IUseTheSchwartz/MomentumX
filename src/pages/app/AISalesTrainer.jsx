const SIGNUP_CODE = 'M1GH6790AI';
const TRAINER_URL = 'https://momentumaibot.lovable.app/';

export default function AISalesTrainer() {
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(SIGNUP_CODE);
      alert('Signup code copied.');
    } catch {
      alert(`Signup code: ${SIGNUP_CODE}`);
    }
  }

  return (
    <div
      className="page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1>AI Sales Trainer</h1>
          <p>Practice sales conversations with the Momentum Financial AI trainer.</p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto'
        }}
      >
        <div
          className="panel glass"
          style={{
            maxWidth: 760,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18
          }}
        >
          <div>
            <h2 style={{ marginBottom: 8 }}>Momentum Financial Agents Only</h2>
            <p style={{ opacity: 0.85, lineHeight: 1.6 }}>
              This AI Sales Trainer is private for Momentum Financial agents. Do not share this
              link or signup code with anyone outside the team.
            </p>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 16,
              border: '1px solid rgba(251,191,36,0.28)',
              background: 'rgba(251,191,36,0.1)',
              color: '#fbbf24',
              fontWeight: 800,
              lineHeight: 1.5
            }}
          >
            DO NOT SHARE. This signup code is for Momentum Financial agents only.
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)'
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>Signup Code</div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: 1.5
                }}
              >
                {SIGNUP_CODE}
              </div>

              <button className="btn btn-ghost" type="button" onClick={copyCode}>
                Copy Code
              </button>
            </div>
          </div>

          <a
            className="btn btn-primary"
            href={TRAINER_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              textAlign: 'center',
              textDecoration: 'none',
              justifyContent: 'center',
              padding: '14px 18px',
              fontWeight: 900
            }}
          >
            Open AI Sales Trainer
          </a>
        </div>
      </div>
    </div>
  );
}
