export default function Denied() {
  return (
    <div className="status-screen denied-screen">
      <div className="status-card glass">
        <div className="status-badge denied">ACCESS DENIED</div>
        <h1>You are not a member.</h1>
        <p>
          You must be inside the Momentum Financial Discord server to access Momentum X.
        </p>
        <p className="hard-line">Leave this page now.</p>
      </div>
    </div>
  );
}
