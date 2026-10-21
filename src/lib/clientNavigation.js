const navigationEvent = "ethiodev:navigate";

export function navigateTo(destination, { replace = false } = {}) {
  const next = new URL(destination, window.location.href);
  if (next.origin !== window.location.origin) {
    window.location.assign(next.href);
    return;
  }

  if (next.href === window.location.href) return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method](
    null,
    "",
    `${next.pathname}${next.search}${next.hash}`,
  );
  window.dispatchEvent(new Event(navigationEvent));
}

export function handleInternalLinkClick(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const anchor = event.target.closest?.("a[href]");
  if (!anchor || anchor.hasAttribute("download")) return;
  if (anchor.target && anchor.target !== "_self") return;
  if (anchor.relList.contains("external")) return;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return;

  const current = new URL(window.location.href);
  const isHashOnlyNavigation =
    destination.pathname === current.pathname &&
    destination.search === current.search &&
    destination.hash;
  if (isHashOnlyNavigation) return;

  event.preventDefault();
  navigateTo(`${destination.pathname}${destination.search}${destination.hash}`);
}

export function subscribeToNavigation(callback) {
  window.addEventListener("popstate", callback);
  window.addEventListener(navigationEvent, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(navigationEvent, callback);
  };
}
