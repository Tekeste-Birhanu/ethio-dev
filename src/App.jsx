import { useEffect, useState } from "react";
import AuthPage from "./features/auth/AuthPage.jsx";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient.js";

const navigation = [
  { label: "Discover", href: "/", icon: "compass", current: true },
  { label: "Developers", href: "/developers", icon: "users" },
  { label: "Showcases", href: "/showcases", icon: "grid" },
  { label: "Messages", href: "/messages", icon: "message" },
  { label: "Workspace", href: "/workspace", icon: "briefcase" },
];

function Icon({ name, size = 20 }) {
  const paths = {
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </>
    ),
    message: (
      <>
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2" />
      </>
    ),
    arrow: (
      <>
        <path d="M7 17 17 7M7 7h10v10" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    code: (
      <>
        <path d="m8 17-5-5 5-5m8 10 5-5-5-5m-3-7-2 24" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="EthioDev home">
      <span className="brand-mark">
        <Icon name="code" size={21} />
      </span>
      <span>
        Ethio<span className="brand-accent">Dev</span>
      </span>
    </a>
  );
}

function NavItems({ mobile = false }) {
  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
      className={mobile ? "mobile-nav-list" : "sidebar-nav-list"}
    >
      {navigation.map(({ label, href, icon, current }) => (
        <a
          key={label}
          className={`nav-link${current ? " is-current" : ""}`}
          href={href}
          aria-current={current ? "page" : undefined}
        >
          <Icon name={icon} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (window.location.pathname.startsWith("/auth/")) {
    return <AuthPage user={user} />;
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="EthioDev sidebar">
        <Brand />
        <NavItems />
        <div className="sidebar-bottom">
          {user ? (
            <div className="profile-link">
              <span className="avatar-placeholder" aria-hidden="true">
                {(user.email?.[0] ?? "D").toUpperCase()}
              </span>
              <span className="profile-copy">
                <strong>{user.email}</strong>
                <button
                  className="sign-out-button"
                  type="button"
                  onClick={() => supabase.auth.signOut()}
                >
                  Sign out
                </button>
              </span>
            </div>
          ) : (
            <a className="profile-link" href="/auth/sign-in">
              <span className="avatar-placeholder">G</span>
              <span className="profile-copy">
                <strong>Guest</strong>
                <small>Sign in</small>
              </span>
              <Icon name="arrow" size={16} />
            </a>
          )}
        </div>
      </aside>

      <div className="app-main-column">
        <main className="main-content" id="main-content">
          <div className="page-heading">
            <div>
              <h1>Discover</h1>
              <p className="page-description">
                Find a project or developer to work with.
              </p>
            </div>
            <a
              className="button button-secondary heading-action"
              href="/developers"
            >
              <Icon name="users" size={18} /> Developers
            </a>
          </div>
          <section className="welcome-panel" aria-labelledby="welcome-title">
            <div className="welcome-copy">
              <span className="welcome-kicker">ETHIODEV</span>
              <h2 id="welcome-title">Build with developers across Ethiopia.</h2>
              <p>
                Find projects, meet collaborators, and share what you build.
              </p>
              <a className="button button-light" href="/auth/sign-in">
                Get started <Icon name="arrow" size={17} />
              </a>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <div className="art-orbit orbit-one" />
              <div className="art-orbit orbit-two" />
              <div className="art-code-card">
                <span className="code-dot" />
                <span className="code-dot" />
                <span className="code-dot" />
                <div className="code-lines">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="code-center">
                  <Icon name="code" size={42} />
                </div>
              </div>
              <span className="art-spark spark-one">✳</span>
              <span className="art-spark spark-two">✦</span>
            </div>
          </section>
          <section
            className="discovery-section"
            aria-labelledby="opportunities-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="opportunities-title">Opportunities</h2>
                <p>Find a project to join.</p>
              </div>
              <a className="text-link" href="/opportunities">
                Browse all <Icon name="arrow" size={15} />
              </a>
            </div>
            <div className="empty-card" role="status">
              <div className="empty-icon">
                <Icon name="search" size={23} />
              </div>
              <div className="empty-copy">
                <h3>No opportunities yet</h3>
                <p>New projects will appear here.</p>
                <a className="text-link" href="/developers">
                  Browse developers <Icon name="arrow" size={15} />
                </a>
              </div>
              <div className="empty-decoration" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          </section>
        </main>
      </div>
      <nav className="mobile-tabbar" aria-label="Mobile navigation">
        <NavItems mobile />
      </nav>
    </div>
  );
}

export default App;
