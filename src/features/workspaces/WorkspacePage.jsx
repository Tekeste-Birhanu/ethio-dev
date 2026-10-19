import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";

function WorkspaceStatus({ title, children }) {
  return (
    <section className="discovery-status">
      <h1>{title}</h1>
      {children}
    </section>
  );
}

export default function WorkspacePage({ user, workspaceId = null }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [eligibleOpportunities, setEligibleOpportunities] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState(null);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviteBusyUserId, setInviteBusyUserId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    if (workspaceId) {
      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id, opportunity_id, owner_id, project_status")
        .eq("id", workspaceId)
        .maybeSingle();
      if (workspaceError || !workspaceData) {
        setWorkspace(null);
        setError(
          "This workspace is unavailable or you are no longer a member.",
        );
        setLoading(false);
        return;
      }
      const [
        { data: opportunity },
        { data: membershipData, error: memberError },
      ] = await Promise.all([
        supabase
          .from("opportunities")
          .select("title")
          .eq("id", workspaceData.opportunity_id)
          .maybeSingle(),
        supabase
          .from("workspace_memberships")
          .select(
            "user_id, role, joined_at, profiles!workspace_memberships_user_id_fkey(username, display_name)",
          )
          .eq("workspace_id", workspaceId)
          .is("ended_at", null)
          .order("joined_at"),
      ]);
      if (memberError) {
        setError("Workspace members could not be loaded. Try again.");
        setLoading(false);
        return;
      }
      const currentMembership = (membershipData ?? []).find(
        (member) => member.user_id === user.id,
      );
      if (!currentMembership) {
        setWorkspace(null);
        setError("You are no longer a member of this workspace.");
      } else {
        setWorkspace({
          ...workspaceData,
          title: opportunity?.title ?? "Workspace",
        });
        setMembers(membershipData ?? []);
        setRole(currentMembership.role);
      }
    } else {
      const { data: memberships, error: membershipError } = await supabase
        .from("workspace_memberships")
        .select("workspace_id")
        .eq("user_id", user.id)
        .is("ended_at", null);
      if (membershipError) {
        setError("Your workspaces could not be loaded. Try again.");
        setLoading(false);
        return;
      }
      const ids = [
        ...new Set((memberships ?? []).map((row) => row.workspace_id)),
      ];
      const { data: workspaceRows, error: workspaceError } = ids.length
        ? await supabase
            .from("workspaces")
            .select("id, opportunity_id, project_status")
            .in("id", ids)
            .order("created_at", { ascending: false })
        : { data: [], error: null };
      if (workspaceError) {
        setError("Your workspaces could not be loaded. Try again.");
        setLoading(false);
        return;
      }
      const opportunityIds = [
        ...new Set((workspaceRows ?? []).map((row) => row.opportunity_id)),
      ];
      const { data: opportunities } = opportunityIds.length
        ? await supabase
            .from("opportunities")
            .select("id, title")
            .in("id", opportunityIds)
        : { data: [] };
      const titles = new Map(
        (opportunities ?? []).map((item) => [item.id, item.title]),
      );
      setWorkspaces(
        (workspaceRows ?? []).map((row) => ({
          ...row,
          title: titles.get(row.opportunity_id) ?? "Workspace",
        })),
      );

      const { data: owned, error: ownedError } = await supabase
        .from("opportunities")
        .select("id, title")
        .eq("creator_id", user.id);
      if (ownedError) {
        setError("Eligible opportunities could not be loaded. Try again.");
        setLoading(false);
        return;
      }
      const ownedIds = (owned ?? []).map((item) => item.id);
      const { data: accepted } = ownedIds.length
        ? await supabase
            .from("collaboration_requests")
            .select("opportunity_id")
            .in("opportunity_id", ownedIds)
            .eq("status", "accepted")
        : { data: [] };
      const hasAccepted = new Set(
        (accepted ?? []).map((request) => request.opportunity_id),
      );
      const hasWorkspace = new Set(
        (workspaceRows ?? []).map((row) => row.opportunity_id),
      );
      setEligibleOpportunities(
        (owned ?? []).filter(
          (item) => hasAccepted.has(item.id) && !hasWorkspace.has(item.id),
        ),
      );
    }
    setLoading(false);
  }, [user, workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createWorkspace(opportunityId) {
    setBusy(true);
    setError("");
    const { data, error: createError } = await supabase.rpc(
      "create_workspace",
      {
        p_opportunity_id: opportunityId,
      },
    );
    if (createError) {
      setError(
        createError.message?.includes("already exists")
          ? "A workspace already exists for this opportunity. Refresh the list."
          : "The workspace could not be created. Try again.",
      );
    } else {
      window.location.assign(`/workspaces/${encodeURIComponent(data)}`);
    }
    setBusy(false);
  }

  async function findDevelopers(event) {
    event.preventDefault();
    setError("");
    const query = search.trim().replace(/^@/, "");
    if (!query) {
      setMatches([]);
      return;
    }
    const { data, error: searchError } = await supabase
      .from("profiles")
      .select("user_id, username, display_name")
      .ilike("username", `%${query}%`)
      .neq("user_id", user.id)
      .limit(8);
    if (searchError) setError("Developers could not be searched. Try again.");
    else setMatches(data ?? []);
  }

  async function mutateMembership(
    operation,
    targetUserId = user.id,
    value = null,
  ) {
    if (operation === "end_workspace_membership") {
      const leaving = targetUserId === user.id;
      const confirmed = window.confirm(
        leaving
          ? "Leave this workspace? You will lose access to its chat and files, and unfinished tasks assigned to you will be unassigned."
          : "Remove this member? They will lose access to workspace chat and files, and unfinished tasks assigned to them will be unassigned.",
      );
      if (!confirmed) return;
    }
    setBusy(true);
    if (operation === "invite_workspace_member") {
      setInviteBusyUserId(targetUserId);
    }
    setError("");
    setNotice("");
    const args = { p_workspace_id: workspaceId };
    if (operation === "invite_workspace_member") args.p_user_id = targetUserId;
    if (operation === "end_workspace_membership") args.p_user_id = targetUserId;
    if (operation === "set_workspace_admin") {
      args.p_user_id = targetUserId;
      args.p_make_admin = value;
    }
    try {
      const { error: mutationError } = await supabase.rpc(operation, args);
      if (mutationError) {
        setError(
          operation === "invite_workspace_member" &&
            (mutationError.code === "23505" ||
              mutationError.message?.includes("duplicate"))
            ? "That developer is already a member."
            : `The membership change could not be saved. Try again. (Error code: ${mutationError.code ?? "unknown"})`,
        );
      } else {
        setNotice(
          operation === "invite_workspace_member"
            ? "Developer added to the workspace."
            : "Workspace membership updated.",
        );
        setMatches([]);
        setSearch("");
        await load();
      }
    } catch {
      setError(
        "The membership change could not be saved. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
      setInviteBusyUserId("");
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <WorkspaceStatus title="Connect Supabase">
        Add Supabase settings to use workspaces.
      </WorkspaceStatus>
    );
  }
  if (!user) {
    return (
      <WorkspaceStatus title="Sign in to view workspaces">
        Workspace access is limited to members.
      </WorkspaceStatus>
    );
  }
  if (loading)
    return (
      <WorkspaceStatus title="Loading workspace">Please wait…</WorkspaceStatus>
    );
  if (error && !workspace && workspaceId) {
    return (
      <WorkspaceStatus title="Workspace unavailable">
        <p>{error}</p>
        <a className="button button-secondary" href="/workspaces">
          Your workspaces
        </a>
      </WorkspaceStatus>
    );
  }

  if (!workspaceId) {
    return (
      <section className="workspace-page">
        <div className="page-heading">
          <div>
            <h1>Workspaces</h1>
          </div>
        </div>
        {error && (
          <p className="feedback feedback-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="feedback feedback-success" role="status">
            {notice}
          </p>
        )}
        {workspaces.length > 0 ? (
          <div className="workspace-list">
            {workspaces.map((item) => (
              <a
                className="workspace-list-item"
                href={`/workspaces/${item.id}`}
                key={item.id}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.project_status}</small>
                </span>
                <span aria-hidden="true">›</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="empty-card">
            You are not a member of any workspaces yet.
          </p>
        )}
        {eligibleOpportunities.length > 0 && (
          <section className="workspace-create-section">
            <h2>Create a workspace</h2>
            <p>Create one for an opportunity with an accepted collaboration.</p>
            {eligibleOpportunities.map((item) => (
              <div className="workspace-list-item" key={item.id}>
                <strong>{item.title}</strong>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={busy}
                  onClick={() => createWorkspace(item.id)}
                >
                  {busy ? "Creating…" : "Create workspace"}
                </button>
              </div>
            ))}
          </section>
        )}
      </section>
    );
  }

  const canManage = role === "owner" || role === "admin";
  return (
    <section className="workspace-page">
      <div className="page-heading">
        <div>
          <h1>{workspace?.title ?? "Workspace"}</h1>
          <p className="page-description">Project workspace</p>
        </div>
        <a className="button button-secondary" href="/workspaces">
          All workspaces
        </a>
      </div>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      )}
      <section className="workspace-members-panel">
        <div className="section-heading">
          <h2>Members</h2>
          <span className="status-chip status-closed">
            {workspace?.project_status}
          </span>
        </div>
        <ul className="workspace-member-list">
          {members.map((member) => {
            const canChangeRole = role === "owner" && member.role !== "owner";
            const canRemove =
              canManage &&
              member.role !== "owner" &&
              member.user_id !== user.id;
            return (
              <li key={member.user_id}>
                <a
                  href={`/u/${encodeURIComponent(member.profiles?.username ?? "")}`}
                >
                  <strong>
                    {member.profiles?.display_name ?? "Developer"}
                  </strong>
                  <small>@{member.profiles?.username ?? "developer"}</small>
                </a>
                <span className="workspace-member-role">{member.role}</span>
                {(canChangeRole || canRemove) && (
                  <details className="three-dot-menu workspace-member-actions">
                    <summary
                      aria-label={`Actions for ${member.profiles?.display_name ?? "this member"}`}
                      title="Member actions"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </summary>
                    <div className="three-dot-menu-items">
                      {canChangeRole && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(event) => {
                            event.currentTarget.closest("details").open = false;
                            void mutateMembership(
                              "set_workspace_admin",
                              member.user_id,
                              member.role !== "admin",
                            );
                          }}
                        >
                          {member.role === "admin"
                            ? "Make member"
                            : "Make admin"}
                        </button>
                      )}
                      {canRemove && (
                        <button
                          className="workspace-member-remove"
                          type="button"
                          disabled={busy}
                          onClick={(event) => {
                            event.currentTarget.closest("details").open = false;
                            void mutateMembership(
                              "end_workspace_membership",
                              member.user_id,
                            );
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
        {role !== "owner" && (
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={() => mutateMembership("end_workspace_membership")}
          >
            Leave workspace
          </button>
        )}
        {canManage && (
          <form className="workspace-invite-form" onSubmit={findDevelopers}>
            <label className="field-label" htmlFor="workspace-invite-search">
              Invite a developer
            </label>
            <div className="workspace-invite-search">
              <input
                id="workspace-invite-search"
                className="field-control"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by username"
              />
              <button className="button button-secondary" type="submit">
                Search
              </button>
            </div>
            {matches.map((person) => (
              <div className="workspace-list-item" key={person.user_id}>
                <span>
                  <strong>{person.display_name}</strong>
                  <small>@{person.username}</small>
                </span>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    mutateMembership("invite_workspace_member", person.user_id)
                  }
                >
                  {inviteBusyUserId === person.user_id ? "Adding…" : "Add"}
                </button>
              </div>
            ))}
          </form>
        )}
      </section>
    </section>
  );
}
