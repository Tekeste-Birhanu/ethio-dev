import { useEffect, useRef, useState } from "react";
import { Button } from "./ui.jsx";

const navigationItems = [
  { id: "discover", label: "Discover", icon: "discover", requiresAuth: false },
  { id: "chat", label: "Messages", icon: "chat", requiresAuth: true },
  {
    id: "collabspaces",
    label: "Collabspaces",
    icon: "collabspaces",
    requiresAuth: true,
  },
  { id: "profile", label: "Profile", icon: "profile", requiresAuth: true },
  {
    id: "notifications",
    label: "Notifications",
    icon: "notifications",
    requiresAuth: true,
  },
];

function NavigationIcon({ name }) {
  const commonProps = {
    className: "size-[21px] shrink-0",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
  };

  if (name === "discover") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.8 8.2-2.4 5.2-5.2 2.4 2.4-5.2 5.2-2.4Z" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg {...commonProps}>
        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-2.5 2v-6A7.5 7.5 0 1 1 20 11.5Z" />
        <path d="M8 11h8M8 14h5" />
      </svg>
    );
  }
  if (name === "collabspaces") {
    return (
      <svg {...commonProps}>
        <rect x="3.5" y="4" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="4" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (name === "profile") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    );
  }
  return (
    <svg {...commonProps}>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="size-3.5 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

function AppSidebar({
  user,
  activePage,
  onNavigate,
  onSignIn,
  onRegister,
  onSignOut,
}) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!accountMenuRef.current?.contains(event.target))
        setIsAccountMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAccountMenuOpen]);

  return (
    <aside
      className="app-sidebar sticky top-0 flex h-dvh flex-col items-stretch border-r border-border bg-sidebar px-[18px] py-6 max-[1024px]:items-center max-[1024px]:px-2 max-[760px]:static max-[760px]:grid max-[760px]:h-auto max-[760px]:w-full max-[760px]:min-w-0 max-[760px]:grid-cols-[minmax(0,1fr)] max-[760px]:items-center max-[760px]:gap-x-3 max-[760px]:gap-y-2 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:border-border max-[760px]:px-4 max-[760px]:py-2 max-[760px]:has-[.app-account-menu]:border-b-0 max-[760px]:has-[.app-account-menu]:p-0 max-[420px]:px-[10px]"
      aria-label="Main navigation"
    >
      <a
        className="app-wordmark mb-[38px] ml-[10px] mt-0.5 text-[22px] font-extrabold tracking-[-0.04em] text-ink no-underline max-[1024px]:hidden"
        href="/"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("discover");
        }}
      >
        Ethio<span className="text-[#68D996]">Dev</span>
      </a>
      <nav className="app-nav grid w-full gap-[7px] min-[761px]:max-[1024px]:w-14 max-[760px]:fixed max-[760px]:inset-x-0 max-[760px]:bottom-0 max-[760px]:z-[30] max-[760px]:flex max-[760px]:w-full max-[760px]:min-w-0 max-[760px]:justify-stretch max-[760px]:gap-1 max-[760px]:border-t max-[760px]:border-[#303a3e] max-[760px]:bg-[rgb(16_22_25_/_96%)] max-[760px]:px-2 max-[760px]:pb-[calc(8px+env(safe-area-inset-bottom))] max-[760px]:pt-2 max-[760px]:backdrop-blur-xl">
        {navigationItems.map((item) => {
          const isLocked = item.requiresAuth && !user;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              className={`app-nav-link relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-[13px] text-left font-semibold text-[#c0cece] transition-colors hover:bg-selected hover:text-navigation-active max-[1024px]:justify-center max-[1024px]:gap-0 max-[1024px]:px-0 max-[760px]:min-w-0 max-[760px]:flex-1 max-[760px]:flex-col max-[760px]:justify-center max-[760px]:gap-0.5 max-[760px]:px-1 max-[760px]:py-1 max-[760px]:text-[10px] max-[420px]:min-h-12${isActive ? " is-active bg-selected text-navigation-active" : ""}${isLocked ? " cursor-pointer text-[#8b999b] opacity-60 hover:bg-transparent hover:text-[#8b999b]" : ""}`}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={isLocked ? `${item.label}, sign in required` : item.label}
              title={isLocked ? `${item.label} — sign in required` : item.label}
            >
              <NavigationIcon name={item.icon} />
              <span className="min-[761px]:max-[1024px]:sr-only">{item.label}</span>
              {isLocked && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[#7f8d90] max-[1024px]:absolute max-[1024px]:right-1 max-[1024px]:top-1 max-[1024px]:ml-0 max-[760px]:right-[calc(50%-18px)] max-[760px]:top-1.5">
                  <LockIcon />
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {!user && (
        <div className="app-auth-actions mt-6 grid gap-2.5 min-[761px]:max-[1024px]:mt-auto min-[761px]:max-[1024px]:w-full min-[761px]:max-[1024px]:[flex-direction:column] max-[760px]:m-0 max-[760px]:flex max-[760px]:items-center max-[760px]:gap-2 max-[760px]:[grid-area:account] max-[420px]:gap-[6px] [display:flex] [grid-area:account] [align-items:center] [gap:8px] [margin:0] [gap:6px]">
          <Button
            variant="secondary"
            className="min-[761px]:max-[1024px]:[width:40px] min-[761px]:max-[1024px]:[min-height:40px] min-[761px]:max-[1024px]:[padding:0] min-[761px]:max-[1024px]:[justify-content:center] max-[760px]:[flex:0_0_auto] max-[420px]:[min-height:38px] max-[420px]:[padding-inline:9px] max-[420px]:[font-size:12px]"
            type="button"
            onClick={onSignIn}
            aria-label="Sign in"
            title="Sign in"
          >
            <svg className="hidden size-5 min-[761px]:max-[1024px]:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 17l5-5-5-5M15 12H3" />
              <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
            </svg>
            <span className="min-[761px]:max-[1024px]:sr-only">Sign in</span>
          </Button>
          <button
            className="app-post-button m-0 min-h-[46px] cursor-pointer rounded-xl border-0 bg-button px-[15px] font-bold text-[#f4fff7] hover:bg-button-hover min-[761px]:max-[1024px]:size-10 min-[761px]:max-[1024px]:min-h-10 min-[761px]:max-[1024px]:p-0 min-[761px]:max-[1024px]:grid min-[761px]:max-[1024px]:place-items-center max-[760px]:min-h-10 max-[760px]:px-[11px] max-[760px]:text-[13px] max-[420px]:min-h-[38px] max-[420px]:px-[10px] max-[420px]:text-xs"
            type="button"
            onClick={onRegister}
            aria-label="Create account"
            title="Create account"
          >
            <svg className="hidden size-5 min-[761px]:max-[1024px]:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="8" r="4" />
              <path d="M3 21a6 6 0 0 1 12 0M19 8v6M16 11h6" />
            </svg>
            <span className="min-[761px]:max-[1024px]:sr-only">Create account</span>
          </button>
        </div>
      )}
      {user && (
        <div
          className="app-account-menu relative mt-auto w-full max-[1024px]:w-14 max-[760px]:hidden"
          ref={accountMenuRef}
        >
          <button
            className={`app-sidebar-user flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-transparent bg-transparent px-2.5 py-3 text-left text-sm font-semibold text-ink hover:border-[#303a3e] hover:bg-[#171f23] max-[1024px]:justify-center max-[1024px]:px-0${isAccountMenuOpen ? " border-[#303a3e] bg-[#171f23]" : ""}`}
            type="button"
            aria-label={`${user.name} account menu`}
            aria-expanded={isAccountMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsAccountMenuOpen((open) => !open)}
          >
            <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-[#1c5937] font-bold text-[#55d188] max-[1024px]:grid" aria-hidden="true">
              {user.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
            </span>
            <span className="app-account-identity grid min-w-0 gap-[3px] overflow-hidden text-ellipsis whitespace-nowrap min-[761px]:max-[1024px]:sr-only">
              {user.name}
              <span className="text-[13px] font-normal text-muted">
                @{user.username}
              </span>
            </span>
            <span
              className="app-account-menu-icon shrink-0 text-[22px] leading-none text-muted min-[761px]:max-[1024px]:hidden"
              aria-hidden="true"
            >
              ···
            </span>
          </button>
          {isAccountMenuOpen && (
            <div
              className="app-account-popover absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 rounded-xl border border-[#303a3e] bg-[#171f23] p-1.5 shadow-[0_14px_32px_rgb(0_0_0_/_32%)] max-[1024px]:bottom-0 max-[1024px]:left-[calc(100%+8px)] max-[1024px]:right-auto max-[1024px]:w-40"
              role="menu"
            >
              <button
                className="min-h-10 w-full cursor-pointer rounded-lg border-0 bg-transparent px-2.5 text-left text-ink hover:bg-[#222d31]"
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  onSignOut();
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function ProfileOverflowMenu({ onSignOut, isSubmitting }) {
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsidePointer = (event) => {
      if (!menuRef.current?.contains(event.target))
        menuRef.current.open = false;
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        menuRef.current.open = false;
        menuRef.current.querySelector("summary")?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <details
      ref={menuRef}
      className="profile-overflow-menu group [&_summary::-webkit-details-marker]:hidden [&>summary:hover]:border-transparent [&>summary:hover]:bg-[#222b2f] [&>summary:hover]:text-ink [&[open]>summary]:border-transparent [&[open]>summary]:bg-[#222b2f] [&[open]>summary]:text-ink [position:relative] [z-index:2]"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary
        className="[display:grid] [width:34px] [height:34px] [place-items:center] [border:1px_solid_transparent] [border-radius:50%] [color:#aebabb] [font-size:20px] [font-weight:700] [letter-spacing:1px] [line-height:1] [list-style:none] [cursor:pointer]"
        aria-label="More profile actions"
      >
        ···
      </summary>
      <div
        className="profile-overflow-menu-items [&>button:hover:not(:disabled)]:bg-[#222d31] [position:absolute] [top:calc(100%_+_6px)] [right:0] [display:grid] [min-width:150px] [padding:5px] [border:1px_solid_#303a3e] [border-radius:10px] [background:#171f23] [box-shadow:0_12px_28px_rgb(0_0_0_/_35%)]"
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            menuRef.current.open = false;
            onSignOut();
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </details>
  );
}

export { AppSidebar, ProfileOverflowMenu };
