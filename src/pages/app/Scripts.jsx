export default function Scripts() {
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
          <h1>Scripts</h1>
          <p>Agent scripts will live here.</p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto'
        }}
      >
        <div className="panel glass">
          <h2>Coming Soon</h2>
          <p>
            This page is ready. Once you send the scripts you want in here, we’ll build the full
            layout and organization.
          </p>
        </div>
      </div>
    </div>
  );
}
