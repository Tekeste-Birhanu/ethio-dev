function App() {
  return (
    <div className="page-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="EthioDev home">
          EthioDev
        </a>
        <span className="header-note">For developers across Ethiopia</span>
      </header>

      <main className="hero" id="main-content">
        <p className="eyebrow">Ideas grow better together</p>
        <h1>Find your people. Build something real.</h1>
        <p className="hero-copy">
          EthioDev is a community for beginner and junior developers to discover
          project opportunities, find collaborators, and share what they build.
        </p>
        <p className="status-note">
          A new place to build together is taking shape.
        </p>
      </main>

      <footer className="site-footer">
        <p>Made for the next generation of Ethiopian developers.</p>
      </footer>
    </div>
  );
}

export default App;
