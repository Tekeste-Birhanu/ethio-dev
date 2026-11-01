import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ui.jsx";
import CollabspaceGroupChat from "./CollabspaceGroupChat.jsx";

function getErrorMessage(result, fallback) {
  return result.error?.message ?? fallback;
}

function CollabspaceItem({ collabspace, isSelected, onOpen }) {
  return (
    <div className={`flex min-h-[82px] items-center gap-3 border-b border-[#293236] px-4 py-3 transition-colors last:border-0 sm:px-5 ${isSelected ? "bg-[#192125]" : "bg-transparent hover:bg-[#192125]"}`}>
      <button
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-1 text-left text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        type="button"
        onClick={() => onOpen(collabspace.id)}
        aria-current={isSelected ? "page" : undefined}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#20332f] font-bold text-accent">
          {collabspace.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="grid min-w-0 gap-1">
          <span className="truncate font-bold">{collabspace.name}</span>
          <span className="text-sm text-muted">{collabspace.role === "OWNER" ? "Owner" : collabspace.role === "ADMIN" ? "Admin" : "Member"}</span>
        </span>
      </button>
      <div className="grid shrink-0 justify-items-end gap-2">
        {collabspace.unreadCount > 0 && (
          <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-[#38e6b0] px-2 text-xs font-bold text-[#0b1113]" aria-label={`${collabspace.unreadCount} unread group messages`}>
            {collabspace.unreadCount}
          </span>
        )}
      </div>
    </div>
  );
}

function OverviewEntry({ title, description }) {
  return (
    <section className="grid gap-2 rounded-2xl border border-[#293236] bg-[#111719] p-5 sm:p-6">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="m-0 text-sm leading-6 text-muted">{description}</p>
      <span className="mt-1 w-fit rounded-full border border-[#354044] px-3 py-1 text-xs text-muted">
        Coming soon
      </span>
    </section>
  );
}

function MembersPanel({ selected, user, memberActionError, memberActionPending, handleMemberAction }) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [developerSearch, setDeveloperSearch] = useState("");
  const [developers, setDevelopers] = useState([]);
  const [isSearchingDevelopers, setIsSearchingDevelopers] = useState(false);
  const [developerSearchError, setDeveloperSearchError] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [invitePendingUserId, setInvitePendingUserId] = useState("");
  const [invitedUserIds, setInvitedUserIds] = useState(() => new Set());
  const ownMembership = selected.memberships.find((membership) => membership.user.id === user?.id);
  const canInvite = ownMembership?.status === "ACTIVE" && ["OWNER", "ADMIN"].includes(ownMembership.role);
  const query = developerSearch.trim();

  useEffect(() => {
    if (!isInviteOpen || query.length < 2) return undefined;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingDevelopers(true);
      setDeveloperSearchError("");
      try {
        const response = await fetch(`/api/profiles?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(result, "Could not search developers."));
        const activeMemberIds = new Set(selected.memberships.filter((membership) => membership.status === "ACTIVE").map((membership) => membership.user.id));
        setDevelopers((result.profiles ?? []).filter((developer) => developer.id !== user?.id && !activeMemberIds.has(developer.id)));
      } catch (searchError) {
        if (searchError.name !== "AbortError") setDeveloperSearchError(searchError.message || "Could not search developers.");
      } finally {
        if (!controller.signal.aborted) setIsSearchingDevelopers(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isInviteOpen, query, selected.memberships, user?.id]);

  useEffect(() => {
    if (!isInviteOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !invitePendingUserId) setIsInviteOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [invitePendingUserId, isInviteOpen]);

  async function inviteDeveloper(developer) {
    if (invitePendingUserId) return;
    setInvitePendingUserId(developer.id);
    setInviteError("");
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: developer.id, type: "COLLABSPACE_INVITATION", workspaceId: selected.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not send the invitation."));
      setInvitedUserIds((current) => new Set(current).add(developer.id));
    } catch (sendError) {
      setInviteError(sendError.message || "Could not reach the server. Try again.");
    } finally {
      setInvitePendingUserId("");
    }
  }

  return (
    <section className="overflow-visible rounded-2xl border border-[#293236] bg-[#111719]" aria-label="Collabspace members">
      {memberActionError && <p className="m-3 rounded-xl border border-[#85434b] p-3 text-sm text-[#ffb6be]" role="alert">{memberActionError}</p>}
      {canInvite && (
        <div className="flex justify-end border-b border-[#293236] px-4 py-3">
          <button className="min-h-10 cursor-pointer rounded-lg border-0 bg-accent px-4 text-sm font-bold text-[#06251a] hover:bg-[#28dfa5]" type="button" onClick={() => { setDeveloperSearch(""); setDeveloperSearchError(""); setInviteError(""); setIsInviteOpen(true); }}>Add members</button>
        </div>
      )}
      <div>
        {selected.memberships.map((membership) => (
          <div className="flex min-h-[68px] items-center gap-3 border-b border-[#293236] px-4 py-3 last:border-0" key={membership.id}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#20332f] font-bold text-accent">{(membership.user.name || membership.user.username).slice(0, 1).toUpperCase()}</span>
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="truncate font-semibold">{membership.user.name}</span>
              <span className="truncate text-sm text-muted">@{membership.user.username}</span>
            </span>
            {membership.role !== "MEMBER" && <span className="text-xs text-accent">{membership.role === "OWNER" ? "Owner" : "Admin"}</span>}
            {membership.status === "ACTIVE" && (() => {
              const ownMembership = selected.memberships.find((item) => item.user.id === user?.id);
              const isOwner = ownMembership?.role === "OWNER";
              const isAdmin = ownMembership?.role === "ADMIN";
              const isSelf = membership.user.id === user?.id;
              const canManageRole = isOwner && membership.role !== "OWNER";
              const canRemove = !isSelf && membership.role !== "OWNER" && (isOwner || (isAdmin && membership.role === "MEMBER"));
              const canLeave = isSelf && membership.role !== "OWNER";
              if (!canManageRole && !canRemove && !canLeave) return null;
              return (
                <details className="relative shrink-0">
                  <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full text-xl text-muted hover:bg-[#20292d] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" aria-label={`Actions for ${membership.user.name}`}><span aria-hidden="true">•••</span></summary>
                  <div className="absolute right-0 top-full z-40 mt-1 grid min-w-48 overflow-hidden rounded-xl border border-[#354044] bg-[#111719] p-1 shadow-xl">
                    {canManageRole && membership.role === "MEMBER" && <button type="button" disabled={memberActionPending} className="rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm text-ink hover:bg-[#20292d] disabled:opacity-50" onClick={() => handleMemberAction(membership.user.id, "role", "ADMIN")}>Make admin</button>}
                    {canManageRole && membership.role === "ADMIN" && <button type="button" disabled={memberActionPending} className="rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm text-ink hover:bg-[#20292d] disabled:opacity-50" onClick={() => handleMemberAction(membership.user.id, "role", "MEMBER")}>Remove admin role</button>}
                    {(canRemove || canLeave) && <button type="button" disabled={memberActionPending} className="rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm text-[#ffb6be] hover:bg-[#382125] disabled:opacity-50" onClick={() => handleMemberAction(membership.user.id, "access")}>{canLeave ? "Leave Collabspace" : "Remove member"}</button>}
                  </div>
                </details>
              );
            })()}
          </div>
        ))}
      </div>
      {isInviteOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !invitePendingUserId) setIsInviteOpen(false); }}>
          <section className="grid max-h-[min(80dvh,38rem)] w-full max-w-lg gap-4 overflow-y-auto rounded-2xl border border-[#354044] bg-[#111719] p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="add-collabspace-members-title">
            <header className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-bold text-ink" id="add-collabspace-members-title">Add members</h2>
              <button className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-xl text-muted hover:bg-[#222d31] hover:text-ink" type="button" disabled={Boolean(invitePendingUserId)} onClick={() => setIsInviteOpen(false)} aria-label="Close developer search">×</button>
            </header>
            <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="collabspace-developer-search">Search developers</label>
            <input id="collabspace-developer-search" className="min-h-11 rounded-lg border border-[#354044] bg-[#0d1315] px-3 text-ink" type="search" autoFocus value={developerSearch} onChange={(event) => { setDeveloperSearch(event.target.value); setInviteError(""); }} placeholder="Name or username" />
            {inviteError && <p className="m-0 text-sm text-[#ffaaaa]" role="alert">{inviteError}</p>}
            {query.length < 2 ? <p className="m-0 text-sm text-muted">Enter at least 2 characters to search.</p> : isSearchingDevelopers ? <p className="m-0 text-sm text-muted" role="status">Searching developers…</p> : developerSearchError ? <p className="m-0 text-sm text-[#ffaaaa]" role="alert">{developerSearchError}</p> : developers.length === 0 ? <p className="m-0 text-sm text-muted" role="status">No developers found.</p> : (
              <ul className="m-0 grid list-none gap-2 p-0" aria-label="Developer search results">
                {developers.map((developer) => (
                  <li className="flex min-w-0 items-center gap-3 rounded-xl border border-[#293236] bg-[#0d1315] px-3 py-2" key={developer.id}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#20332f] font-bold text-accent" aria-hidden="true">{developer.name.slice(0, 1).toUpperCase()}</span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate text-sm font-semibold text-ink">{developer.name}</span>
                      <span className="truncate text-xs text-muted">@{developer.username}</span>
                    </span>
                    <button className="min-h-9 shrink-0 cursor-pointer rounded-lg border border-[#28634f] bg-[#1b3029] px-3 text-sm font-semibold text-accent-light hover:bg-[#223b32] disabled:cursor-wait disabled:opacity-60" type="button" disabled={Boolean(invitePendingUserId) || invitedUserIds.has(developer.id)} onClick={() => inviteDeveloper(developer)}>{invitePendingUserId === developer.id ? "Sending…" : invitedUserIds.has(developer.id) ? "Sent" : "Invite"}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function SettingsPanel({ selected, user, spaceName, onSpaceNameChange, onRename, isSavingName, settingsError, settingsSuccess, isDeletingCollabspace, deleteCollabspaceError, onDeleteCollabspace }) {
  const isOwner = selected.memberships.some((membership) => membership.user.id === user?.id && membership.role === "OWNER");

  return (
    <section className="grid max-w-3xl gap-4" aria-label="Collabspace settings">
      <form className="grid gap-4 rounded-2xl border border-[#293236] bg-[#111719] p-5 sm:p-6" onSubmit={onRename}>
        <div className="grid gap-1 border-b border-[#293236] pb-3">
          <h3 className="m-0 text-base font-bold">Space name</h3>
        </div>
        {isOwner ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <input
                  className="min-h-11 w-full rounded-lg border border-[#354044] bg-[#0d1315] px-3 text-base text-ink outline-none focus:border-[#38e6b0]"
                  id="collabspace-settings-name"
                  aria-label="Space name"
                  maxLength={100}
                  onChange={(event) => onSpaceNameChange(event.target.value)}
                  required
                  value={spaceName}
                />
              </div>
              <div className="flex gap-2">
                {spaceName.trim() !== selected.name && (
                  <button className="min-h-11 cursor-pointer rounded-lg border border-[#354044] px-3 text-sm font-semibold text-ink hover:bg-[#20292d]" type="button" onClick={() => onSpaceNameChange(selected.name)}>Discard</button>
                )}
                <button className="min-h-11 cursor-pointer rounded-lg border-0 bg-[#1b9b76] px-4 text-sm font-bold text-[#061d16] hover:bg-[#24bd91] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isSavingName || !spaceName.trim() || spaceName.trim() === selected.name}>{isSavingName ? "Saving…" : "Save changes"}</button>
              </div>
            </div>
            {settingsError && <p className="m-0 text-sm text-[#ffb6be]" role="alert">{settingsError}</p>}
            {settingsSuccess && <p className="m-0 text-sm text-accent" role="status">{settingsSuccess}</p>}
          </>
        ) : (
          <p className="m-0 text-sm text-muted">Only the Owner can rename this Collabspace.</p>
        )}
      </form>
      {isOwner && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#713b42] bg-[#171315] p-5 sm:p-6" aria-labelledby="delete-collabspace-heading">
          <div className="grid max-w-xl gap-1">
            <h3 className="m-0 text-base font-bold text-ink" id="delete-collabspace-heading">Delete Collabspace</h3>
            <p className="m-0 text-sm leading-6 text-muted">Permanently remove this space, its members, and all group chat and task history.</p>
          </div>
          {deleteCollabspaceError && <p className="m-0 text-sm text-[#ffb6be]" role="alert">{deleteCollabspaceError}</p>}
          <button className="min-h-10 shrink-0 rounded-lg border border-[#85434b] bg-transparent px-4 text-sm font-semibold text-[#ffb6be] hover:bg-[#382125] disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={isDeletingCollabspace} onClick={onDeleteCollabspace}>
            {isDeletingCollabspace ? "Deleting…" : "Delete space"}
          </button>
        </section>
      )}
    </section>
  );
}

export default function CollabspacesPage({ selectedId = "", user, onOpen, onBack }) {
  const [collabspaces, setCollabspaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [spaceName, setSpaceName] = useState("");
  const [tabSelection, setTabSelection] = useState({ collabspaceId: "", tab: "chat" });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCollabspaceName, setNewCollabspaceName] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorState, setErrorState] = useState({ key: "", message: "" });
  const [memberActionError, setMemberActionError] = useState("");
  const [memberActionPending, setMemberActionPending] = useState(false);
  const [deleteCollabspaceError, setDeleteCollabspaceError] = useState("");
  const [isDeletingCollabspace, setIsDeletingCollabspace] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const closeConfirmation = useCallback(() => setConfirmation(null), []);

  const selectedTab = tabSelection.collabspaceId === selectedId ? tabSelection.tab : "chat";

  useEffect(() => {
    let active = true;
    let isLoadingList = false;

    const refreshList = async () => {
      if (isLoadingList) return;
      isLoadingList = true;
      try {
        const response = await fetch("/api/collabspaces");
        const result = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(result, "Could not load Collabspaces."));
        if (active) {
          setCollabspaces(result.collabspaces ?? []);
          setErrorState((current) => current.key === "list" ? { key: "", message: "" } : current);
        }
      } catch (loadError) {
        if (active) setErrorState({ key: "list", message: loadError.message || "Could not load Collabspaces." });
      } finally {
        isLoadingList = false;
        if (active) setIsLoading(false);
      }
    };

    if (!selectedId) refreshList();
    const intervalId = selectedId ? null : window.setInterval(refreshList, 15000);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return undefined;

    let active = true;
    fetch(`/api/collabspaces/${encodeURIComponent(selectedId)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(result, "Could not load this Collabspace."));
        if (active) {
          setSelected(result.collabspace);
          setSpaceName(result.collabspace.name);
        }
      })
      .catch((loadError) => {
        if (active) setErrorState({ key: selectedId, message: loadError.message || "Could not load this Collabspace." });
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleUnreadCountChange = useCallback((count) => {
    setCollabspaces((current) => current.map((collabspace) => (
      collabspace.id === selectedId ? { ...collabspace, unreadCount: count } : collabspace
    )));
  }, [selectedId]);

  const performMemberAction = useCallback(async (targetUserId, action, role) => {
    if (!selected || memberActionPending) return;
    const isSelf = targetUserId === user?.id;
    setMemberActionPending(true);
    setMemberActionError("");
    try {
      const response = await fetch(
        action === "role"
          ? `/api/collabspaces/${encodeURIComponent(selected.id)}/members/${encodeURIComponent(targetUserId)}/role`
          : `/api/collabspaces/${encodeURIComponent(selected.id)}/members/${encodeURIComponent(targetUserId)}`,
        {
          method: action === "role" ? "PATCH" : "DELETE",
          headers: { "Content-Type": "application/json" },
          ...(action === "role" ? { body: JSON.stringify({ role }) } : {}),
        },
      );
      const result = response.status === 204 ? {} : await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not update Collabspace members."));
      if (isSelf) {
        onBack();
        return;
      }
      const refreshedResponse = await fetch(`/api/collabspaces/${encodeURIComponent(selected.id)}`);
      const refreshedResult = await refreshedResponse.json();
      if (!refreshedResponse.ok) throw new Error(getErrorMessage(refreshedResult, "The change was saved, but the member list could not be refreshed."));
      setSelected(refreshedResult.collabspace);
    } catch (actionError) {
      setMemberActionError(actionError.message || "Could not update Collabspace members.");
    } finally {
      setMemberActionPending(false);
    }
  }, [memberActionPending, onBack, selected, user?.id]);

  const handleMemberAction = useCallback((targetUserId, action, role) => {
    if (!selected || memberActionPending) return;
    const isSelf = targetUserId === user?.id;
    const actionLabel = action === "role" ? (role === "ADMIN" ? "Make admin" : "Remove admin role") : (isSelf ? "Leave Collabspace" : "Remove member");
    const description = action === "role"
      ? `Are you sure you want to ${actionLabel.toLocaleLowerCase()}?`
      : `Are you sure you want to ${actionLabel.toLocaleLowerCase()}? Their access ends immediately. Any open tasks become unassigned, and the rest of the team keeps chat and task history.`;
    setConfirmation({
      title: action === "role" ? "Change member role?" : isSelf ? "Leave Collabspace?" : "Remove member?",
      description,
      confirmLabel: actionLabel,
      onConfirm: () => performMemberAction(targetUserId, action, role),
    });
  }, [memberActionPending, performMemberAction, selected, user?.id]);

  const handleRenameCollabspace = useCallback(async (event) => {
    event.preventDefault();
    if (!selected || isSavingName) return;
    const name = spaceName.trim();
    if (!name || name.length > 100) {
      setSettingsError("Enter a Collabspace name up to 100 characters.");
      return;
    }
    if (name === selected.name) return;

    setIsSavingName(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      const response = await fetch(`/api/collabspaces/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not rename this Collabspace."));
      setSelected((current) => current?.id === selected.id ? { ...current, name: result.collabspace.name } : current);
      setCollabspaces((current) => current.map((collabspace) => collabspace.id === selected.id ? { ...collabspace, name: result.collabspace.name } : collabspace));
      setSpaceName(result.collabspace.name);
      setSettingsSuccess("Name updated.");
    } catch (renameError) {
      setSettingsError(renameError.message || "Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSavingName(false);
    }
  }, [isSavingName, selected, spaceName]);

  const performDeleteCollabspace = useCallback(async () => {
    if (!selected || isDeletingCollabspace) return;
    setIsDeletingCollabspace(true);
    setDeleteCollabspaceError("");
    try {
      const response = await fetch(`/api/collabspaces/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(getErrorMessage(result, "Could not delete this Collabspace."));
      }
      onBack();
    } catch (deleteError) {
      setDeleteCollabspaceError(deleteError.message || "Could not reach the server. Check your connection and try again.");
    } finally {
      setIsDeletingCollabspace(false);
    }
  }, [isDeletingCollabspace, onBack, selected]);

  const handleDeleteCollabspace = useCallback(() => {
    if (!selected || isDeletingCollabspace) return;
    setConfirmation({
      title: `Delete “${selected.name}”?`,
      description: "Every member will lose access, and the group chat and task history will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete space",
      onConfirm: performDeleteCollabspace,
    });
  }, [isDeletingCollabspace, performDeleteCollabspace, selected]);

  const handleCreateCollabspace = async (event) => {
    event.preventDefault();
    const name = newCollabspaceName.trim();
    if (!name || name.length > 100) {
      setCreateError("Enter a Collabspace name up to 100 characters.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/collabspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not create the Collabspace."));
      setNewCollabspaceName("");
      setIsCreateOpen(false);
      onOpen(result.collabspace.id);
    } catch (createRequestError) {
      setCreateError(createRequestError.message || "Could not reach the server. Check your connection and try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="app-page bg-page text-ink">
      <ConfirmDialog confirmation={confirmation} onClose={closeConfirmation} />
      {selectedId ? (
        <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1440px] content-start gap-4">
          {errorState.key === selectedId ? (
            <p className="rounded-xl border border-[#303a3e] p-6 text-center text-muted" role="alert">{errorState.message}</p>
          ) : selected?.id !== selectedId ? (
            <p className="rounded-xl border border-[#303a3e] p-6 text-center text-muted" role="status">Loading Collabspace...</p>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-3 border-b border-[#293236] pb-4">
                <button className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-transparent text-muted hover:bg-[#20292d] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" type="button" onClick={onBack} aria-label="Back to Collabspaces">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /><path d="M20 12H9" /></svg>
                </button>
                <div className="min-w-0 flex-1">
                  <h1 className="m-0 break-words text-2xl font-extrabold sm:text-3xl">{selected.name}</h1>
                </div>
              </header>

              <div className="grid gap-5">
                <div className="flex flex-wrap gap-2 border-b border-[#293236]" role="tablist" aria-label="Collabspace sections">
                  <button className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${selectedTab === "chat" ? "border-[#38e6b0] text-accent" : "border-transparent text-muted hover:text-ink"}`} id="collabspace-chat-tab" type="button" role="tab" aria-selected={selectedTab === "chat"} aria-controls="collabspace-chat-panel" onClick={() => setTabSelection({ collabspaceId: selected.id, tab: "chat" })}>Group chat</button>
                  <button className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${selectedTab === "taskboard" ? "border-[#38e6b0] text-accent" : "border-transparent text-muted hover:text-ink"}`} id="collabspace-taskboard-tab" type="button" role="tab" aria-selected={selectedTab === "taskboard"} aria-controls="collabspace-taskboard-panel" onClick={() => setTabSelection({ collabspaceId: selected.id, tab: "taskboard" })}>Taskboard</button>
                  <button className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${selectedTab === "members" ? "border-[#38e6b0] text-accent" : "border-transparent text-muted hover:text-ink"}`} id="collabspace-members-tab" type="button" role="tab" aria-selected={selectedTab === "members"} aria-controls="collabspace-members-panel" onClick={() => setTabSelection({ collabspaceId: selected.id, tab: "members" })}>Members <span className="ml-1 text-xs">{selected.memberships.length}</span></button>
                  <button className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${selectedTab === "settings" ? "border-[#38e6b0] text-accent" : "border-transparent text-muted hover:text-ink"}`} id="collabspace-settings-tab" type="button" role="tab" aria-selected={selectedTab === "settings"} aria-controls="collabspace-settings-panel" onClick={() => setTabSelection({ collabspaceId: selected.id, tab: "settings" })}>Settings</button>
                </div>
                {selectedTab === "chat" ? (
                  <section id="collabspace-chat-panel" role="tabpanel" aria-labelledby="collabspace-chat-tab">
                    <CollabspaceGroupChat key={selected.id} collabspaceId={selected.id} userId={user?.id} onUnreadCountChange={handleUnreadCountChange} />
                  </section>
                ) : selectedTab === "taskboard" ? (
                  <section id="collabspace-taskboard-panel" role="tabpanel" aria-labelledby="collabspace-taskboard-tab">
                    <OverviewEntry title="Taskboard" description="Plan work together with milestones and tasks. The shared board will appear here." />
                  </section>
                ) : selectedTab === "members" ? (
                  <section id="collabspace-members-panel" role="tabpanel" aria-labelledby="collabspace-members-tab">
                    <MembersPanel selected={selected} user={user} memberActionError={memberActionError} memberActionPending={memberActionPending} handleMemberAction={handleMemberAction} />
                  </section>
                ) : (
                  <section id="collabspace-settings-panel" role="tabpanel" aria-labelledby="collabspace-settings-tab">
                    <SettingsPanel selected={selected} user={user} spaceName={spaceName} onSpaceNameChange={setSpaceName} onRename={handleRenameCollabspace} isSavingName={isSavingName} settingsError={settingsError} settingsSuccess={settingsSuccess} isDeletingCollabspace={isDeletingCollabspace} deleteCollabspaceError={deleteCollabspaceError} onDeleteCollabspace={handleDeleteCollabspace} />
                  </section>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mx-auto min-h-[calc(100dvh-4rem)] max-w-[1440px]">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h1 className="m-0 text-3xl font-extrabold">Collabspaces</h1>
            <button
              className="min-h-11 rounded-xl border-0 bg-[#1b9b76] px-5 font-bold text-[#061d16] hover:bg-[#24bd91] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              type="button"
              onClick={() => { setCreateError(""); setIsCreateOpen(true); }}
            >
              Create Collabspace
            </button>
          </header>
          {isCreateOpen && (
            <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !isCreating) { setIsCreateOpen(false); setCreateError(""); } }} onKeyDown={(event) => { if (event.key === "Escape" && !isCreating) { setIsCreateOpen(false); setCreateError(""); } }}>
              <form className="grid w-full max-w-xl gap-4 rounded-2xl border border-[#293236] bg-[#111719] p-5 shadow-2xl sm:p-6" onSubmit={handleCreateCollabspace} role="dialog" aria-modal="true" aria-labelledby="create-collabspace-title">
                <div>
                  <h2 className="m-0 text-lg font-bold" id="create-collabspace-title">Create a Collabspace</h2>
                  <p className="mb-0 mt-1 text-sm text-muted">You will be the Owner and the first member.</p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid min-w-[220px] flex-1 gap-2 text-sm font-semibold" htmlFor="new-collabspace-name">
                    Name
                    <input
                      autoFocus
                      className="min-h-12 w-full rounded-xl border border-[#354044] bg-[#0d1315] px-4 text-base text-ink outline-none placeholder:text-[#87979c] focus:border-[#38e6b0]"
                      id="new-collabspace-name"
                      maxLength={100}
                      name="name"
                      onChange={(event) => setNewCollabspaceName(event.target.value)}
                      placeholder="For example, Study Planner team"
                      required
                      value={newCollabspaceName}
                    />
                  </label>
                  <div className="flex shrink-0 gap-3">
                    <button className="min-h-11 rounded-xl border border-[#354044] bg-transparent px-4 font-semibold text-ink hover:bg-[#20292d]" type="button" disabled={isCreating} onClick={() => { setIsCreateOpen(false); setCreateError(""); }}>
                      Cancel
                    </button>
                    <button className="min-h-11 rounded-xl border-0 bg-[#1b9b76] px-5 font-bold text-[#061d16] hover:bg-[#24bd91] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isCreating || !newCollabspaceName.trim()}>
                      {isCreating ? "Creating…" : "Create"}
                    </button>
                  </div>
                </div>
                {createError && <p className="m-0 text-sm text-[#ffb6be]" role="alert">{createError}</p>}
              </form>
            </div>
          )}
          {errorState.key === "list" ? (
            <p className="rounded-xl border border-[#303a3e] p-6 text-center text-muted" role="alert">{errorState.message}</p>
          ) : isLoading ? (
            <p className="rounded-xl border border-[#303a3e] p-6 text-center text-muted" role="status">Loading Collabspaces...</p>
          ) : collabspaces.length ? (
            <div className="overflow-hidden rounded-2xl border border-[#293236] bg-[#111719]">
              {collabspaces.map((collabspace) => (
                <CollabspaceItem key={collabspace.id} collabspace={collabspace} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-[#293236] bg-[#111719] p-8 text-center text-muted">
              You are not a member of any Collabspaces yet. Create a Collabspace to get started.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
