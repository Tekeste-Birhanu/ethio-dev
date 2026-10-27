import { useEffect, useRef, useState } from "react";
import { Button } from "./ui.jsx";

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
      className="app-sidebar sticky top-0 flex h-screen flex-col border-r border-border bg-[#101619] px-[18px] py-6 max-[760px]:static max-[760px]:grid max-[760px]:h-auto max-[760px]:w-full max-[760px]:min-w-0 max-[760px]:grid-cols-[minmax(0,1fr)] max-[760px]:items-center max-[760px]:gap-x-3 max-[760px]:gap-y-2 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:border-border max-[760px]:px-4 max-[760px]:py-2 max-[760px]:has-[.app-account-menu]:border-b-0 max-[760px]:has-[.app-account-menu]:p-0 max-[420px]:px-[10px]"
      aria-label="Main navigation"
    >
      <a
        className="app-wordmark mb-[38px] ml-[10px] mt-0.5 text-[22px] font-extrabold tracking-[-0.04em] text-ink no-underline max-[760px]:hidden"
        href="/"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("discover");
        }}
      >
        EthioDev
      </a>
      <nav className="app-nav grid gap-[7px] max-[760px]:fixed max-[760px]:inset-x-0 max-[760px]:bottom-0 max-[760px]:z-[30] max-[760px]:flex max-[760px]:min-w-0 max-[760px]:justify-stretch max-[760px]:gap-2 max-[760px]:border-t max-[760px]:border-[#303a3e] max-[760px]:bg-[rgb(16_22_25_/_96%)] max-[760px]:px-4 max-[760px]:pb-[calc(8px+env(safe-area-inset-bottom))] max-[760px]:pt-2 max-[760px]:backdrop-blur-xl">
        <button
          className={`app-nav-link min-h-12 cursor-pointer rounded-xl border-0 bg-transparent px-[13px] text-left font-semibold text-[#c0cece] hover:bg-accent-dark hover:text-accent-light max-[760px]:min-w-0 max-[760px]:flex-1 max-[760px]:px-3 max-[760px]:text-center max-[760px]:text-sm max-[420px]:min-h-12 max-[420px]:px-2 max-[420px]:text-[13px]${activePage === "discover" ? " is-active bg-accent-dark text-accent-light" : ""}`}
          type="button"
          onClick={() => onNavigate("discover")}
          aria-current={activePage === "discover" ? "page" : undefined}
        >
          Discover
        </button>
        {user && (
          <button
            className={`app-nav-link min-h-12 cursor-pointer rounded-xl border-0 bg-transparent px-[13px] text-left font-semibold text-[#c0cece] hover:bg-accent-dark hover:text-accent-light max-[760px]:min-w-0 max-[760px]:flex-1 max-[760px]:px-3 max-[760px]:text-center max-[760px]:text-sm max-[420px]:min-h-12 max-[420px]:px-2 max-[420px]:text-[13px]${activePage === "profile" ? " is-active bg-accent-dark text-accent-light" : ""}`}
            type="button"
            onClick={() => onNavigate("profile")}
            aria-current={activePage === "profile" ? "page" : undefined}
          >
            Profile
          </button>
        )}
      </nav>
      {!user && (
        <div className="app-auth-actions mt-6 grid gap-2.5 max-[760px]:m-0 max-[760px]:flex max-[760px]:items-center max-[760px]:gap-2 max-[760px]:[grid-area:account] max-[420px]:gap-[6px] [display:flex] [grid-area:account] [align-items:center] [gap:8px] [margin:0] [gap:6px]">
          <Button
            variant="secondary"
            className="max-[760px]:[flex:0_0_auto] max-[420px]:[min-height:38px] max-[420px]:[padding-inline:9px] max-[420px]:[font-size:12px]"
            type="button"
            onClick={onSignIn}
          >
            Sign in
          </Button>
          <button
            className="app-post-button m-0 min-h-[46px] cursor-pointer rounded-xl border-0 bg-accent px-[15px] font-bold text-[#06251a] hover:bg-[#28dfa5] max-[760px]:min-h-10 max-[760px]:px-[11px] max-[760px]:text-[13px] max-[420px]:min-h-[38px] max-[420px]:px-[10px] max-[420px]:text-xs"
            type="button"
            onClick={onRegister}
          >
            Create account
          </button>
        </div>
      )}
      {user && (
        <div
          className="app-account-menu relative mt-auto max-[760px]:hidden"
          ref={accountMenuRef}
        >
          <button
            className={`app-sidebar-user flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-transparent bg-transparent px-2.5 py-3 text-left text-sm font-semibold text-ink hover:border-[#303a3e] hover:bg-[#171f23]${isAccountMenuOpen ? " border-[#303a3e] bg-[#171f23]" : ""}`}
            type="button"
            aria-label={`${user.name} account menu`}
            aria-expanded={isAccountMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsAccountMenuOpen((open) => !open)}
          >
            <span className="app-account-identity grid min-w-0 gap-[3px] overflow-hidden text-ellipsis whitespace-nowrap">
              {user.name}
              <span className="text-[13px] font-normal text-muted">
                @{user.username}
              </span>
            </span>
            <span
              className="app-account-menu-icon shrink-0 text-[22px] leading-none text-muted"
              aria-hidden="true"
            >
              ···
            </span>
          </button>
          {isAccountMenuOpen && (
            <div
              className="app-account-popover absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 rounded-xl border border-[#303a3e] bg-[#171f23] p-1.5 shadow-[0_14px_32px_rgb(0_0_0_/_32%)]"
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
