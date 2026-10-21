import { lazy, Suspense, useEffect, useRef, useState } from "react";
import AuthPage from "./features/auth/AuthPage.jsx";
import DiscoveryPage from "./features/discovery/DiscoveryPage.jsx";
import ProfilePage from "./features/profiles/ProfilePage.jsx";
import LoadingSkeleton from "./components/LoadingSkeleton.jsx";
import {
  handleInternalLinkClick,
  subscribeToNavigation,
} from "./lib/clientNavigation.js";
import { clearRequestCache } from "./lib/requestCache.js";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient.js";

const MyOpportunities = lazy(() =>
  import("./features/opportunities/OpportunityManagement.jsx").then(
    (module) => ({ default: module.MyOpportunities }),
  ),
);
const OpportunityForm = lazy(() =>
  import("./features/opportunities/OpportunityManagement.jsx").then(
    (module) => ({ default: module.OpportunityForm }),
  ),
);
const OpportunityRequestsPage = lazy(() =>
  import("./features/requests/OpportunityRequestsPage.jsx").then((module) => ({
    default: module.OpportunityRequestsPage,
  })),
);
const PrivateMessagesPage = lazy(() =>
  import("./features/messages/PrivateMessagesPage.jsx").then((module) => ({
    default: module.PrivateMessagesPage,
  })),
);
const WorkspacePage = lazy(
  () => import("./features/workspaces/WorkspacePage.jsx"),
);
const ShowcasesPage = lazy(
  () => import("./features/showcases/ShowcasesPage.jsx"),
);
const NotificationsPage = lazy(
  () => import("./features/notifications/NotificationsPage.jsx"),
);

const navigation = [
  { label: "Discover", href: "/", icon: "compass", current: true },
  { label: "Developers", href: "/developers", icon: "users" },
  { label: "Collabspaces", href: "/projects", icon: "briefcase" },
  { label: "Messages", href: "/messages", icon: "message" },
  { label: "Showcases", href: "/showcases", icon: "grid" },
  { label: "Profile", href: "/settings/profile", icon: "users" },
  { label: "Notifications", href: "/notifications", icon: "bell" },
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
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
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

function NavItems({ mobile = false, profileHref, unreadCount = 0 }) {
  const pathname = window.location.pathname;
  const items = mobile
    ? [
        {
          label: "Explore",
          href: pathname === "/developers" ? "/developers" : "/opportunities",
          icon: "compass",
        },
        ...navigation.filter(
          ({ label }) =>
            label !== "Discover" &&
            label !== "Developers" &&
            label !== "Notifications",
        ),
      ]
    : navigation;
  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
      className={mobile ? "mobile-nav-list" : "sidebar-nav-list"}
    >
      {items.map(({ label, href, icon }) => {
        const current =
          (label === "Explore" &&
            (pathname === "/" ||
              pathname === "/developers" ||
              pathname.startsWith("/opportunities") ||
              pathname.startsWith("/u/"))) ||
          (label === "Discover" &&
            (pathname === "/" || pathname.startsWith("/opportunities"))) ||
          (label === "Developers" &&
            (pathname === "/developers" || pathname.startsWith("/u/"))) ||
          (label === "Profile" &&
            (pathname === "/my-profile" || pathname === "/settings/profile")) ||
          (label === "Messages" && pathname === "/messages");
        const notificationCurrent =
          label === "Notifications" && pathname.startsWith("/notifications");
        const showcaseCurrent =
          label === "Showcases" && pathname.startsWith("/showcases");
        const workspaceCurrent =
          label === "Collabspaces" &&
          (pathname.startsWith("/workspaces") ||
            pathname.startsWith("/projects"));
        return (
          <a
            key={label}
            className={`nav-link${current || showcaseCurrent || workspaceCurrent || notificationCurrent ? " is-current" : ""}`}
            href={label === "Profile" ? profileHref : href}
            aria-current={
              current ||
              showcaseCurrent ||
              workspaceCurrent ||
              notificationCurrent
                ? "page"
                : undefined
            }
          >
            <Icon name={icon} />
            <span>{label}</span>
            {label === "Notifications" && unreadCount > 0 && (
              <span
                className="nav-unread-count"
                aria-label={`${unreadCount} unread`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [routeKey, setRouteKey] = useState(
    () =>
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
  const previousRouteKey = useRef(routeKey);
  const lastUserId = useRef(null);

  useEffect(() => {
    const updateRoute = () =>
      setRouteKey(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
    const closeOutsideThreeDotMenus = (event) => {
      const clickedMenu = event.target.closest?.(".three-dot-menu");
      document.querySelectorAll(".three-dot-menu[open]").forEach((menu) => {
        if (menu !== clickedMenu) menu.open = false;
      });
    };
    const unsubscribeNavigation = subscribeToNavigation(updateRoute);
    document.addEventListener("click", handleInternalLinkClick);
    document.addEventListener("click", closeOutsideThreeDotMenus);
    return () => {
      unsubscribeNavigation();
      document.removeEventListener("click", handleInternalLinkClick);
      document.removeEventListener("click", closeOutsideThreeDotMenus);
    };
  }, []);

  useEffect(() => {
    const url = new URL(routeKey, window.location.origin);
    const previousUrl = new URL(
      previousRouteKey.current,
      window.location.origin,
    );
    previousRouteKey.current = routeKey;
    if (url.hash) {
      let targetId = url.hash.slice(1);
      try {
        targetId = decodeURIComponent(targetId);
      } catch {
        // Ignore malformed escapes and try the raw fragment as an element id.
      }
      window.requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView?.();
      });
    } else if (!(
      /^\/(?:projects|workspaces)(?:\/|$)/.test(url.pathname) &&
      /^\/(?:projects|workspaces)(?:\/|$)/.test(previousUrl.pathname)
    )) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [routeKey]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let active = true;
    const updateUser = (nextUser) => {
      const nextUserId = nextUser?.id ?? null;
      if (lastUserId.current !== nextUserId) {
        clearRequestCache();
        lastUserId.current = nextUserId;
      }
      setUser(nextUser);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (active) updateUser(data.session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      return undefined;
    }
    let active = true;
    const refreshUnreadCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (active) {
        setUnreadCounts((current) => ({ ...current, [user.id]: count ?? 0 }));
      }
    };
    refreshUnreadCount();
    const channel = supabase
      .channel(`notification-count-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        refreshUnreadCount,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const profileHref = user ? "/my-profile" : "/auth/sign-in";
  const unreadCount = user ? (unreadCounts[user.id] ?? 0) : 0;

  if (window.location.pathname.startsWith("/auth/")) {
    return <AuthPage key={routeKey} user={user} />;
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="EthioDev sidebar">
        <Brand />
        <NavItems profileHref={profileHref} unreadCount={unreadCount} />
        <div className="sidebar-bottom">
          {user ? (
            <div className="account-menu">
              <a className="profile-link" href={profileHref}>
                <span className="avatar-placeholder" aria-hidden="true">
                  {(user.email?.[0] ?? "D").toUpperCase()}
                </span>
                <span className="profile-copy">
                  <strong>{user.email}</strong>
                  <small>View profile</small>
                </span>
                <Icon name="arrow" size={16} />
              </a>
              <button
                className="sign-out-button"
                type="button"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
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

      <header className="mobile-header">
        <Brand />
        <div className="mobile-header-actions">
          <a
            className="mobile-notification-link"
            href="/notifications"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
            aria-current={
              window.location.pathname.startsWith("/notifications")
                ? "page"
                : undefined
            }
          >
            <Icon name="bell" />
            {unreadCount > 0 && (
              <span className="nav-unread-count" aria-hidden="true">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </a>
          {user && (
            <button
              className="button button-secondary mobile-sign-out"
              type="button"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <div className="app-main-column">
        <main className="main-content" id="main-content">
          {window.location.pathname.match(
            /^\/opportunities\/[^/]+\/requests$/,
          ) ? (
            <Suspense
              fallback={
                <LoadingSkeleton variant="rows" label="Loading requests" />
              }
            >
              <OpportunityRequestsPage
                user={user}
                opportunityId={window.location.pathname.split("/")[2]}
              />
            </Suspense>
          ) : window.location.pathname === "/notifications" ? (
            <Suspense
              fallback={
                <LoadingSkeleton
                  variant="notifications"
                  label="Loading notifications"
                />
              }
            >
              <NotificationsPage user={user} />
            </Suspense>
          ) : window.location.pathname === "/messages" ? (
            <Suspense
              fallback={
                <LoadingSkeleton
                  variant="conversations"
                  label="Loading messages"
                />
              }
            >
              <PrivateMessagesPage user={user} />
            </Suspense>
          ) : window.location.pathname === "/showcases" ||
            window.location.pathname.match(/^\/showcases\/[^/]+$/) ? (
            <Suspense
              fallback={
                <LoadingSkeleton variant="cards" label="Loading showcases" />
              }
            >
              <ShowcasesPage
                user={user}
                showcaseId={window.location.pathname.split("/")[2] ?? null}
              />
            </Suspense>
          ) : window.location.pathname === "/projects" ||
            window.location.pathname.match(/^\/projects\/[^/]+$/) ||
            window.location.pathname === "/workspaces" ||
            window.location.pathname.match(/^\/workspaces\/[^/]+$/) ? (
            <Suspense
              fallback={
                <LoadingSkeleton
                  variant="project"
                  label="Loading Collabspace"
                />
              }
            >
              <WorkspacePage
                user={user}
                workspaceId={window.location.pathname.split("/")[2] ?? null}
              />
            </Suspense>
          ) : window.location.pathname === "/my-opportunities" ? (
            <Suspense
              fallback={
                <LoadingSkeleton
                  variant="cards"
                  label="Loading opportunities"
                />
              }
            >
              <MyOpportunities user={user} />
            </Suspense>
          ) : window.location.pathname === "/opportunities/new" ? (
            <Suspense
              fallback={
                <LoadingSkeleton
                  variant="form"
                  label="Loading opportunity form"
                />
              }
            >
              <DiscoveryPage mode="opportunities" user={user} showComposer />
            </Suspense>
          ) : window.location.pathname.match(
              /^\/opportunities\/[^/]+\/edit$/,
            ) ? (
            <Suspense
              fallback={
                <LoadingSkeleton
                  variant="form"
                  label="Loading opportunity form"
                />
              }
            >
              <OpportunityForm
                user={user}
                opportunityId={window.location.pathname.split("/")[2]}
              />
            </Suspense>
          ) : window.location.pathname === "/developers" ? (
            <DiscoveryPage mode="developers" user={user} />
          ) : window.location.pathname === "/" ||
            window.location.pathname === "/opportunities" ? (
            <DiscoveryPage mode="opportunities" user={user} />
          ) : window.location.pathname.match(/^\/opportunities\/[^/]+$/) ? (
            <DiscoveryPage mode="opportunities" user={user} />
          ) : window.location.pathname === "/settings/profile" ? (
            <ProfilePage user={user} />
          ) : window.location.pathname === "/my-profile" ? (
            <ProfilePage user={user} viewOwn />
          ) : window.location.pathname.startsWith("/u/") ? (
            <ProfilePage
              user={user}
              username={window.location.pathname.slice(3)}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>Discover</h1>
                  <p className="page-description">
                    Find a collaboration opportunity or developer to work with.
                  </p>
                </div>
                <a
                  className="button button-secondary heading-action"
                  href="/developers"
                >
                  <Icon name="users" size={18} /> Developers
                </a>
              </div>
              <section
                className="welcome-panel"
                aria-labelledby="welcome-title"
              >
                <div className="welcome-copy">
                  <span className="welcome-kicker">ETHIODEV</span>
                  <h2 id="welcome-title">
                    Build with developers across Ethiopia.
                  </h2>
                  <p>
                    Find collaborators, create Collabspaces, and share what you
                    build.
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
                    <p>Find an opportunity to collaborate.</p>
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
                    <p>New opportunities will appear here.</p>
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
            </>
          )}
        </main>
      </div>
      <nav className="mobile-tabbar" aria-label="Mobile navigation">
        <NavItems mobile profileHref={profileHref} unreadCount={unreadCount} />
      </nav>
    </div>
  );
}

export default App;
