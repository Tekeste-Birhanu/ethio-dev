import { useEffect, useState } from "react";

function formatRequestDate(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsPage({ handleAppNavigation }) {
  const [requests, setRequests] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [actionRequestId, setActionRequestId] = useState("");
  const [actionError, setActionError] = useState({ requestId: "", message: "" });
  const [activeRequestId, setActiveRequestId] = useState("");
  const [routingRequestId, setRoutingRequestId] = useState("");
  const [spaces, setSpaces] = useState([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [createSpace, setCreateSpace] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceCreationError, setSpaceCreationError] = useState("");
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);

  async function resolveRequest(requestId, status, destination) {
    if (actionRequestId) return;
    setActionRequestId(requestId);
    setActionError({ requestId: "", message: "" });
    try {
      const response = await fetch(`/api/opportunities/requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(destination ? { destination } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not update this request.");
      setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status } : request));
      setActiveRequestId("");
      setRoutingRequestId("");
      if (status === "ACCEPTED" && destination?.type === "PRIVATE_CHAT") {
        handleAppNavigation?.("chat", result.request?.conversationId ?? "");
      } else if (status === "ACCEPTED" && ["COLLABSPACE", "CREATE_COLLABSPACE"].includes(destination?.type)) {
        const workspaceId = result.request?.workspaceId ?? destination.workspaceId;
        if (workspaceId) handleAppNavigation?.(`collabspace:${workspaceId}`);
      }
    } catch (resolveError) {
      setActionError({ requestId, message: resolveError.message || "Could not reach the server. Try again." });
    } finally {
      setActionRequestId("");
    }
  }

  async function openSpacePicker(requestId) {
    setRoutingRequestId(requestId);
    setSpacesLoading(true);
    setSpacesError("");
    setSpaceCreationError("");
    setCreateSpace(false);
    setSpaceName("");
    try {
      const response = await fetch("/api/collabspaces");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not load your Collabspaces.");
      const manageable = (result.collabspaces ?? []).filter((space) => ["OWNER", "ADMIN"].includes(space.role));
      setSpaces(manageable);
      setSelectedSpaceId(manageable[0]?.id ?? "");
    } catch (loadError) {
      setSpacesError(loadError.message || "Could not load your Collabspaces.");
    } finally {
      setSpacesLoading(false);
    }
  }

  async function createCollabspace() {
    const name = spaceName.trim();
    if (!name || isCreatingSpace) return;
    setIsCreatingSpace(true);
    setSpaceCreationError("");
    try {
      const response = await fetch("/api/collabspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not create the Collabspace.");
      const createdSpace = { ...result.collabspace, role: "OWNER" };
      setSpaces((current) => [createdSpace, ...current]);
      setSelectedSpaceId(createdSpace.id);
      setSpaceName("");
      setCreateSpace(false);
    } catch (createError) {
      setSpaceCreationError(createError.message || "Could not create the Collabspace.");
    } finally {
      setIsCreatingSpace(false);
    }
  }

  async function resolveInvitation(invitation, status) {
    if (actionRequestId) return;
    setActionRequestId(invitation.id);
    setActionError({ requestId: "", message: "" });
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(invitation.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not update this invitation.");
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      if (status === "ACCEPTED" && invitation.type === "CHAT_INVITATION") {
        handleAppNavigation?.("chat", result.invitation?.conversationId ?? "");
      } else if (status === "ACCEPTED" && invitation.workspace?.id) {
        handleAppNavigation?.(`collabspace:${invitation.workspace.id}`);
      }
    } catch (resolveError) {
      setActionError({ requestId: invitation.id, message: resolveError.message || "Could not reach the server. Try again." });
    } finally {
      setActionRequestId("");
    }
  }

  async function openAlert(alert) {
    if (!alert.readAt) {
      const response = await fetch(`/api/chat/notifications/${encodeURIComponent(alert.id)}/read`, { method: "PATCH" });
      if (!response.ok) {
        setActionError({ requestId: alert.id, message: "Could not mark this notification as read." });
        return;
      }
      setAlerts((current) => current.map((item) => item.id === alert.id ? { ...item, readAt: new Date().toISOString() } : item));
    }
    if (alert.request?.workspace?.id) {
      handleAppNavigation?.(`collabspace:${alert.request.workspace.id}`);
    } else {
      handleAppNavigation?.("chat", alert.conversationId ?? "");
    }
  }

  useEffect(() => {
    let isCurrent = true;
    Promise.all([fetch("/api/opportunities/requests/incoming"), fetch("/api/invitations/incoming"), fetch("/api/chat/notifications")])
      .then(async ([requestResponse, invitationResponse, alertResponse]) => {
        const [requestResult, invitationResult, alertResult] = await Promise.all([requestResponse.json(), invitationResponse.json(), alertResponse.json()]);
        if (!requestResponse.ok) throw new Error(requestResult.error?.message ?? "Could not load incoming requests.");
        if (!invitationResponse.ok) throw new Error(invitationResult.error?.message ?? "Could not load incoming invitations.");
        if (!alertResponse.ok) throw new Error(alertResult.error?.message ?? "Could not load notifications.");
        if (isCurrent) {
          setRequests(requestResult.requests ?? []);
          setInvitations(invitationResult.invitations ?? []);
          setAlerts(alertResult.notifications ?? []);
          setError("");
        }
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message || "Could not reach the server. Try again.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (!activeRequestId) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setActiveRequestId("");
        setRoutingRequestId("");
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [activeRequestId]);

  const incomingItems = [
    ...requests.map((request) => ({ ...request, itemType: "COLLABORATION_REQUEST" })),
    ...invitations.map((invitation) => ({ ...invitation, itemType: "INVITATION" })),
    ...alerts.map((alert) => ({ ...alert, itemType: "ALERT" })),
  ].sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  const activeRequest = requests.find((request) => request.id === activeRequestId);

  return (
    <main className="app-page app-main-content min-w-0">
      <div className="mx-auto w-full max-w-[1120px] min-w-0">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 text-[clamp(26px,_4vw,_36px)] font-extrabold tracking-[-0.04em] text-ink">
            Notifications
          </h1>
          <button
            className="min-h-10 cursor-pointer rounded-lg border border-[#303a3e] bg-[#141a1e] px-3 text-sm font-semibold text-ink hover:bg-[#222d31]"
            type="button"
            onClick={() => {
              setIsLoading(true);
              setReloadKey((key) => key + 1);
            }}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        <section className="grid gap-3" aria-label="Notifications">
          {isLoading ? (
            <p className="rounded-2xl border border-[#252d31] bg-[#111719] p-7 text-center text-muted" role="status">
              Loading notifications…
            </p>
          ) : error ? (
            <div className="grid justify-items-center gap-3 rounded-2xl border border-[#252d31] bg-[#111719] p-7 text-center">
              <p className="m-0 text-[#ffaaaa]" role="alert">{error}</p>
              <button
                className="min-h-10 cursor-pointer rounded-lg border border-[#303a3e] bg-[#141a1e] px-3 text-sm font-semibold text-ink hover:bg-[#222d31]"
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setReloadKey((key) => key + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : incomingItems.length === 0 ? (
            <p className="rounded-2xl border border-[#252d31] bg-[#111719] p-7 text-center text-muted">
              You’re all caught up.
            </p>
          ) : (
            incomingItems.map((request) => request.itemType === "ALERT" ? (
              <article className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${request.readAt ? "border-[#252d31] bg-[#111719]" : "border-[#28634f] bg-[#14211d]"}`} key={`alert-${request.id}`}>
                <header className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 text-lg font-bold text-ink">
                      {request.request?.recipient?.name ?? "A developer"} accepted your collaboration request
                    </h2>
                    <time className="mt-1 block text-xs text-muted" dateTime={request.createdAt}>{formatRequestDate(request.createdAt)}</time>
                  </div>
                  {!request.readAt && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-[#06251a]">New</span>}
                </header>
                {actionError.requestId === request.id && <p className="m-0 text-sm text-[#ffaaaa]" role="alert">{actionError.message}</p>}
                <button className="min-h-10 shrink-0 cursor-pointer rounded-lg border border-[#28634f] bg-[#1b3029] px-4 text-sm font-semibold text-accent-light hover:bg-[#223b32]" type="button" onClick={() => openAlert(request)}>
                  {request.request?.workspace?.id ? "Open Collabspace" : "Open chat"}
                </button>
              </article>
            ) : request.itemType === "INVITATION" ? (
              <article className="grid gap-3 rounded-2xl border border-[#252d31] bg-[#111719] p-4" key={request.id}>
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="m-0 text-lg font-bold text-ink">{request.sender.name}<span className="ml-2 text-sm font-normal text-muted">@{request.sender.username}</span></h2>
                    <time className="mt-1 block text-xs text-muted" dateTime={request.createdAt}>{formatRequestDate(request.createdAt)}</time>
                  </div>
                  <a className="inline-flex min-h-9 items-center rounded-lg border border-[#28634f] bg-[#1b3029] px-3 text-sm font-semibold text-accent-light no-underline hover:bg-[#223b32]" href={`/profile/${encodeURIComponent(request.sender.username)}`}>View profile</a>
                </header>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#252d31] pt-3">
                  <div className="grid min-w-0 flex-1 gap-2">
                    <h3 className="m-0 text-sm font-semibold text-accent-light">{request.type === "CHAT_INVITATION" ? "Private chat invitation" : "Collabspace invitation"}</h3>
                    <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[#d5dfe0]">
                      {request.type === "CHAT_INVITATION" ? request.opportunity?.description ?? "The inviter would like to start a private chat." : request.workspace?.name ?? "This Collabspace is no longer available."}
                    </p>
                    {request.message && <p className="m-0 border-l-2 border-accent/60 pl-3 text-sm italic text-[#c0cece]">“{request.message}”</p>}
                    {actionError.requestId === request.id && <p className="m-0 text-sm text-[#ffaaaa]" role="alert">{actionError.message}</p>}
                  </div>
                  <footer className="flex shrink-0 flex-wrap justify-end gap-2">
                    <button className="min-h-10 cursor-pointer rounded-lg border border-[#923e48] bg-transparent px-4 text-sm font-semibold text-[#ffaaaa] hover:bg-[#301b20] disabled:opacity-60" type="button" disabled={Boolean(actionRequestId)} onClick={() => resolveInvitation(request, "DECLINED")}>Decline</button>
                    <button className="min-h-10 cursor-pointer rounded-lg border-0 bg-accent px-4 text-sm font-bold text-[#06251a] hover:enabled:bg-[#28dfa5] disabled:opacity-60" type="button" disabled={Boolean(actionRequestId)} onClick={() => resolveInvitation(request, "ACCEPTED")}>{actionRequestId === request.id ? "Updating..." : "Accept"}</button>
                  </footer>
                </div>
              </article>
            ) : (
              <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#252d31] bg-[#111719] px-4 py-3" key={`request-${request.id}`}>
                <div className="min-w-0">
                  <h2 className="m-0 text-base font-semibold text-ink">
                    {request.sender.name}<span className="ml-2 text-sm font-normal text-muted">@{request.sender.username}</span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <time className="text-xs text-muted" dateTime={request.createdAt}>{formatRequestDate(request.createdAt)}</time>
                    {request.status !== "PENDING" && <span className={`rounded-full border px-2 py-0.5 text-xs ${request.status === "ACCEPTED" ? "border-[#28634f] text-accent-light" : "border-[#923e48] text-[#ffaaaa]"}`}>{request.status === "ACCEPTED" ? "Accepted" : "Declined"}</span>}
                  </div>
                </div>
                <button
                  className="min-h-9 shrink-0 cursor-pointer rounded-lg border border-[#28634f] bg-[#1b3029] px-3 text-sm font-semibold text-accent-light hover:bg-[#223b32]"
                  type="button"
                  onClick={() => { setActiveRequestId(request.id); setActionError({ requestId: "", message: "" }); }}
                >
                  View request
                </button>
              </article>
            ))
          )}
        </section>
        {activeRequest && (
          <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4 max-[520px]:items-end max-[520px]:p-0" onMouseDown={(event) => { if (event.target === event.currentTarget) { setActiveRequestId(""); setRoutingRequestId(""); } }}>
            <section className="grid max-h-[calc(100dvh-2rem)] w-full max-w-2xl gap-4 overflow-y-auto rounded-2xl border border-[#354044] bg-[#111719] p-5 shadow-2xl max-[520px]:max-h-[90dvh] max-[520px]:gap-3 max-[520px]:rounded-b-none max-[520px]:p-4" role="dialog" aria-modal="true" aria-labelledby="collaboration-request-title">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="m-0 text-xl font-bold text-ink" id="collaboration-request-title">Collaboration request</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                    <span className="font-semibold text-ink">{activeRequest.sender.name}</span>
                    <span>@{activeRequest.sender.username}</span>
                    <span aria-hidden="true">·</span>
                    <time className="text-xs" dateTime={activeRequest.createdAt}>{formatRequestDate(activeRequest.createdAt)}</time>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a className="inline-flex min-h-9 items-center rounded-lg border border-[#28634f] bg-[#1b3029] px-3 text-sm font-semibold text-accent-light no-underline hover:bg-[#223b32]" href={`/profile/${encodeURIComponent(activeRequest.sender.username)}`}>View profile</a>
                  <button className="min-h-9 cursor-pointer rounded-md px-2 text-lg text-muted hover:bg-[#222d31] hover:text-ink" type="button" onClick={() => { setActiveRequestId(""); setRoutingRequestId(""); }} aria-label="Close request">×</button>
                </div>
              </header>
              <div className="grid gap-2 rounded-xl border border-[#252d31] bg-[#0d1315] p-4 max-[520px]:p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="m-0 text-sm font-semibold text-accent-light">Opportunity</h3>
                  <span className="rounded-full border border-[#354044] px-2.5 py-1 text-xs text-muted">{activeRequest.opportunity.status === "PAUSED" ? "Paused · pending requests remain open" : "Open"}</span>
                </div>
                <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[#d5dfe0]">{activeRequest.opportunity.description}</p>
              </div>
              {(activeRequest.sender.city || activeRequest.sender.experience || activeRequest.sender.skills.length > 0 || activeRequest.sender.description) && (
                <div className="grid gap-2 border-t border-[#252d31] pt-3">
                  <h3 className="m-0 text-sm font-semibold text-ink">About {activeRequest.sender.name}</h3>
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    {activeRequest.sender.city && <span className="rounded-full border border-[#303a3e] px-2.5 py-1">{activeRequest.sender.city}</span>}
                    {activeRequest.sender.experience && <span className="rounded-full border border-[#303a3e] px-2.5 py-1">{activeRequest.sender.experience.toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</span>}
                    {activeRequest.sender.skills.map((skill) => <span className="rounded-full border border-[#303a3e] px-2.5 py-1" key={skill}>{skill}</span>)}
                  </div>
                  {activeRequest.sender.description && <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[#c0cece]">{activeRequest.sender.description}</p>}
                </div>
              )}
              {activeRequest.message && <p className="m-0 border-l-2 border-accent/60 pl-3 text-sm italic text-[#c0cece]">“{activeRequest.message}”</p>}
              {actionError.requestId === activeRequest.id && <p className="m-0 text-sm text-[#ffaaaa]" role="alert">{actionError.message}</p>}
              {activeRequest.status === "PENDING" ? <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#252d31] pt-4 max-[520px]:grid max-[520px]:grid-cols-1">
                <button className="min-h-10 cursor-pointer rounded-lg border border-[#923e48] bg-transparent px-4 text-sm font-semibold text-[#ffaaaa] hover:bg-[#301b20] disabled:cursor-wait disabled:opacity-60 max-[520px]:w-full" type="button" disabled={Boolean(actionRequestId)} onClick={() => resolveRequest(activeRequest.id, "DECLINED")}>{actionRequestId === activeRequest.id ? "Updating…" : "Decline"}</button>
                <div className="flex flex-wrap justify-end gap-2 max-[520px]:grid max-[520px]:grid-cols-1">
                  <button className="min-h-10 cursor-pointer rounded-lg border-0 bg-accent px-4 text-sm font-bold text-[#06251a] hover:enabled:bg-[#28dfa5] disabled:cursor-wait disabled:opacity-60 max-[520px]:w-full" type="button" disabled={Boolean(actionRequestId)} onClick={() => resolveRequest(activeRequest.id, "ACCEPTED", { type: "PRIVATE_CHAT" })}>{actionRequestId === activeRequest.id ? "Updating…" : "Accept into private chat"}</button>
                  <button className="min-h-10 cursor-pointer rounded-lg border border-[#28634f] bg-[#1b3029] px-4 text-sm font-semibold text-accent-light hover:enabled:bg-[#223b32] disabled:cursor-wait disabled:opacity-60 max-[520px]:w-full" type="button" disabled={Boolean(actionRequestId)} onClick={() => openSpacePicker(activeRequest.id)}>Add to Collabspace</button>
                </div>
              </footer> : <p className="m-0 border-t border-[#252d31] pt-3 text-sm text-muted">Request {activeRequest.status === "ACCEPTED" ? "accepted" : "declined"}.</p>}
              {routingRequestId === activeRequest.id && (
                <section className="grid gap-3 rounded-xl border border-[#354044] bg-[#111719] p-4" aria-label="Choose a Collabspace" aria-busy={spacesLoading}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="m-0 text-base font-semibold text-ink">Add {activeRequest.sender.name} to a Collabspace</h3>
                    <button className="min-h-8 cursor-pointer rounded-md px-2 text-muted hover:bg-[#222d31] hover:text-ink" type="button" onClick={() => setRoutingRequestId("")} aria-label="Cancel Collabspace selection">×</button>
                  </div>
                  {spacesLoading ? <p className="m-0 text-sm text-muted" role="status">Loading Collabspaces…</p> : spacesError ? <p className="m-0 text-sm text-[#ffaaaa]" role="alert">{spacesError}</p> : (
                    <>
                      {createSpace ? (
                        <>
                          <label className="grid gap-1 text-sm text-muted"><span>Collabspace name</span><input className="min-h-11 rounded-lg border border-[#354044] bg-[#0d1315] px-3 text-ink" value={spaceName} onChange={(event) => setSpaceName(event.target.value)} maxLength={100} autoFocus /></label>
                          {spaceCreationError && <p className="m-0 text-sm text-[#ffaaaa]" role="alert">{spaceCreationError}</p>}
                        </>
                      ) : spaces.length === 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="m-0 text-sm text-muted">Create a Collabspace first to add someone here.</p>
                          <button className="min-h-10 cursor-pointer rounded-lg border border-[#28634f] bg-[#1b3029] px-4 text-sm font-semibold text-accent-light hover:bg-[#223b32]" type="button" onClick={() => { setSpaceCreationError(""); setCreateSpace(true); }}>Create Collabspace</button>
                        </div>
                      ) : (
                        <label className="grid gap-1 text-sm text-muted">
                          <span>Choose a space you own or administer</span>
                          <select className="min-h-11 rounded-lg border border-[#354044] bg-[#0d1315] px-3 text-ink" value={createSpace ? "create" : selectedSpaceId} onChange={(event) => {
                            if (event.target.value === "create") { setSpaceCreationError(""); setCreateSpace(true); }
                            else { setCreateSpace(false); setSelectedSpaceId(event.target.value); }
                          }}>
                            {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
                            <option value="create">Create a new Collabspace…</option>
                          </select>
                        </label>
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                        <button className="min-h-10 cursor-pointer rounded-lg border border-[#303a3e] px-4 text-sm text-ink hover:bg-[#222d31]" type="button" disabled={isCreatingSpace} onClick={() => createSpace ? setCreateSpace(false) : setRoutingRequestId("")}>{createSpace ? "Cancel" : "Close"}</button>
                        {createSpace ? (
                          <button className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 text-sm font-bold text-[#06251a] hover:enabled:bg-[#28dfa5] disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={isCreatingSpace || !spaceName.trim()} onClick={createCollabspace}>{isCreatingSpace ? "Creating…" : "Create"}</button>
                        ) : spaces.length > 0 ? (
                          <button className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 text-sm font-bold text-[#06251a] hover:enabled:bg-[#28dfa5] disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={Boolean(actionRequestId) || spacesLoading || !selectedSpaceId} onClick={() => resolveRequest(activeRequest.id, "ACCEPTED", { type: "COLLABSPACE", workspaceId: selectedSpaceId })}>{actionRequestId === activeRequest.id ? "Accepting…" : "Add and accept"}</button>
                        ) : null}
                      </div>
                    </>
                  )}
                </section>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
