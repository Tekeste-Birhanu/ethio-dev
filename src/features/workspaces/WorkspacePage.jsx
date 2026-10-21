import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";
import WorkspaceChat from "./WorkspaceChat.jsx";
import WorkspaceWork from "./WorkspaceWork.jsx";
import { ShowcaseEditor } from "../showcases/ShowcasesPage.jsx";

function WorkspaceStatus({ title, children }) {
  return (
    <section className="discovery-status">
      <h1>{title}</h1>
      {children}
    </section>
  );
}

function displayProjectStatus(status) {
  return status ? status[0].toUpperCase() + status.slice(1) : "Active";
}

async function processStorageCleanup() {
  const { data: jobs } = await supabase.rpc("claim_storage_cleanup_jobs");
  for (const job of jobs ?? []) {
    const { error } = await supabase.storage
      .from(job.bucket_id)
      .remove([job.object_path]);
    if (!error) {
      await supabase.rpc("acknowledge_storage_cleanup_job", {
        p_job_id: job.job_id,
      });
    }
  }
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
  const [activeView, setActiveView] = useState(() => {
    const requestedView = new URLSearchParams(window.location.search).get(
      "view",
    );
    return ["showcase", "work", "members"].includes(requestedView)
      ? requestedView
      : "chat";
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteDialogError, setDeleteDialogError] = useState("");
  const deleteDialogRef = useRef(null);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (deleteDialogOpen && dialog && !dialog.open) dialog.showModal();
    else if (!deleteDialogOpen && dialog?.open) dialog.close();
  }, [deleteDialogOpen]);

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
        setError("This project is unavailable or you are no longer a member.");
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
        setError("Project members could not be loaded. Try again.");
        setLoading(false);
        return;
      }
      const currentMembership = (membershipData ?? []).find(
        (member) => member.user_id === user.id,
      );
      if (!currentMembership) {
        setWorkspace(null);
        setError("You are no longer a member of this project.");
      } else {
        setWorkspace({
          ...workspaceData,
          title: opportunity?.title ?? "Project",
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
        setError("Your projects could not be loaded. Try again.");
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
        setError("Your projects could not be loaded. Try again.");
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
          title: titles.get(row.opportunity_id) ?? "Project",
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
          ? "A project already exists for this opportunity. Refresh the list."
          : "The project could not be created. Try again.",
      );
    } else {
      window.location.assign(`/projects/${encodeURIComponent(data)}`);
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
          ? "Leave this project? You will lose access to its chat and files, and unfinished tasks assigned to you will be unassigned."
          : "Remove this member? They will lose access to project chat and files, and unfinished tasks assigned to them will be unassigned.",
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
            ? "Developer added to the project."
            : "Project membership updated.",
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

  async function deleteWorkspace() {
    if (
      role !== "owner" ||
      busy ||
      deleteConfirmName.trim() !== workspace?.title
    )
      return;

    setBusy(true);
    setDeleteDialogError("");
    const { error: deleteError } = await supabase.rpc("delete_workspace", {
      p_workspace_id: workspaceId,
    });
    if (deleteError) {
      const functionMissing =
        deleteError.code === "PGRST202" ||
        /could not find the function|schema cache/i.test(
          deleteError.message ?? "",
        );
      setDeleteDialogError(
        functionMissing
          ? "Project deletion setup is not applied to Supabase yet. Apply the latest migration, then try again."
          : `The project could not be deleted. Try again. (Error code: ${deleteError.code ?? "unknown"})`,
      );
      setBusy(false);
      return;
    }

    try {
      await processStorageCleanup();
    } catch {
      // The storage cleanup job remains queued for another authorized attempt.
    }
    window.location.assign("/projects");
  }

  async function changeProjectStatus(status) {
    if (role !== "owner" || status === workspace?.project_status) return;
    if (status === "completed") {
      const accepted = window.confirm(
        `Mark “${workspace?.title ?? "this project"}” as Completed? Completed projects cannot be reactivated. This project will be ready for a showcase.`,
      );
      if (!accepted) return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const { error: statusError } = await supabase.rpc("set_project_status", {
      p_workspace_id: workspaceId,
      p_status: status,
    });
    setBusy(false);
    if (statusError) {
      setError(
        `Project status could not be changed. ${statusError.code === "P0001" ? statusError.message.replace(/workspace/gi, "project") : "Try again."} (Error code: ${statusError.code ?? "unknown"})`,
      );
      return;
    }
    setNotice("Project status updated.");
    await load();
  }

  if (!isSupabaseConfigured) {
    return (
      <WorkspaceStatus title="Connect Supabase">
        Add Supabase settings to use projects.
      </WorkspaceStatus>
    );
  }
  if (!user) {
    return (
      <WorkspaceStatus title="Sign in to view projects">
        Project access is limited to members.
      </WorkspaceStatus>
    );
  }
  if (loading)
    return (
      <WorkspaceStatus title="Loading project">Please wait…</WorkspaceStatus>
    );
  if (error && !workspace && workspaceId) {
    return (
      <WorkspaceStatus title="Project unavailable">
        <p>{error}</p>
        <a className="button button-secondary" href="/projects">
          Your projects
        </a>
      </WorkspaceStatus>
    );
  }

  if (!workspaceId) {
    return (
      <section className="workspace-page">
        <div className="page-heading">
          <div>
            <h1>Projects</h1>
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
                href={`/projects/${item.id}`}
                key={item.id}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{displayProjectStatus(item.project_status)}</small>
                </span>
                <span aria-hidden="true">›</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="empty-card">
            You are not a member of any projects yet.
          </p>
        )}
        {eligibleOpportunities.length > 0 && (
          <section className="workspace-create-section">
            <h2>Create a project</h2>
            <p>
              Create one from an opportunity with an accepted collaboration.
            </p>
            {eligibleOpportunities.map((item) => (
              <div className="workspace-list-item" key={item.id}>
                <strong>{item.title}</strong>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={busy}
                  onClick={() => createWorkspace(item.id)}
                >
                  {busy ? "Creating…" : "Create project"}
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
    <section
      className={`workspace-page${activeView === "work" ? " workspace-page-work" : ""}`}
    >
      <div className="page-heading">
        <div>
          <h1>{workspace?.title ?? "Project"}</h1>
          <p className="page-description">
            Project · {displayProjectStatus(workspace?.project_status)}
          </p>
        </div>
        <div className="workspace-page-actions">
          <a className="button button-secondary" href="/projects">
            All projects
          </a>
          <details className="three-dot-menu">
            <summary aria-label="Project settings" title="Project settings">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </summary>
            <div className="three-dot-menu-items">
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest("details").open = false;
                  setActiveView("settings");
                }}
              >
                Project settings
              </button>
              {canManage && workspace?.project_status === "completed" && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest("details").open = false;
                    setActiveView("showcase");
                  }}
                >
                  Project showcase
                </button>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest("details").open = false;
                  setActiveView("members");
                }}
              >
                Members ({members.length})
              </button>
              {role === "owner" && (
                <button
                  className="workspace-delete-action"
                  type="button"
                  disabled={busy}
                  onClick={(event) => {
                    event.currentTarget.closest("details").open = false;
                    setDeleteConfirmName("");
                    setDeleteDialogError("");
                    setDeleteDialogOpen(true);
                  }}
                >
                  Delete project
                </button>
              )}
            </div>
          </details>
        </div>
      </div>
      <nav className="workspace-view-nav" aria-label="Project views">
        <button
          type="button"
          aria-current={activeView === "chat" ? "page" : undefined}
          onClick={() => setActiveView("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          aria-current={activeView === "work" ? "page" : undefined}
          onClick={() => setActiveView("work")}
        >
          Task board
        </button>
      </nav>
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
      {activeView === "members" ? (
        <>
          <button
            className="button button-secondary workspace-back-to-chat"
            type="button"
            onClick={() => setActiveView("chat")}
          >
            <span aria-hidden="true">←</span> Back to chat
          </button>
          <section className="workspace-members-panel">
            <div className="section-heading">
              <h2>Members</h2>
              <span className="status-chip status-closed">
                {displayProjectStatus(workspace?.project_status)}
              </span>
            </div>
            <ul className="workspace-member-list">
              {members.map((member) => {
                const canChangeRole =
                  role === "owner" && member.role !== "owner";
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
                                event.currentTarget.closest("details").open =
                                  false;
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
                                event.currentTarget.closest("details").open =
                                  false;
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
                Leave project
              </button>
            )}
            {canManage && (
              <form className="workspace-invite-form" onSubmit={findDevelopers}>
                <label
                  className="field-label"
                  htmlFor="workspace-invite-search"
                >
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
                        mutateMembership(
                          "invite_workspace_member",
                          person.user_id,
                        )
                      }
                    >
                      {inviteBusyUserId === person.user_id ? "Adding…" : "Add"}
                    </button>
                  </div>
                ))}
              </form>
            )}
          </section>
        </>
      ) : activeView === "settings" ? (
        <>
          <button
            className="button button-secondary workspace-back-to-chat"
            type="button"
            onClick={() => setActiveView("chat")}
          >
            <span aria-hidden="true">{"\u2190"}</span> Back to project
          </button>
          <section className="workspace-project-settings">
            <h2>Project settings</h2>
            <p className="page-description">
              Pause this project while work is on hold. Completed projects are
              final and eligible for a showcase.
            </p>
            <label className="field-label" htmlFor="workspace-project-status">
              Project status
            </label>
            <select
              id="workspace-project-status"
              className="field-control"
              value={workspace?.project_status ?? "active"}
              disabled={
                busy ||
                role !== "owner" ||
                workspace?.project_status === "completed"
              }
              onChange={(event) => void changeProjectStatus(event.target.value)}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            {role !== "owner" && (
              <p className="workspace-setting-help">
                Only the project owner can change its status.
              </p>
            )}
            {workspace?.project_status === "completed" && (
              <p className="workspace-setting-help">
                Completed is final. This project cannot be reactivated.
              </p>
            )}
            <div className="workspace-setting-divider" />
            <p className="workspace-setting-help">
              Tasks and milestones can be changed while the project is Active.
              Paused projects become editable again when the owner reactivates
              them; Completed projects stay read-only.
            </p>
            {workspace?.project_status === "paused" && (
              <p className="workspace-setting-help">
                Reactivate this project to make its tasks and milestones
                editable again.
              </p>
            )}
          </section>
        </>
      ) : activeView === "showcase" ? (
        <ShowcaseEditor
          workspaceId={workspaceId}
          projectTitle={workspace?.title}
          projectStatus={workspace?.project_status}
          onBack={() => setActiveView("chat")}
        />
      ) : activeView === "work" ? (
        <WorkspaceWork
          workspaceId={workspaceId}
          user={user}
          role={role}
          members={members}
          projectStatus={workspace?.project_status}
        />
      ) : (
        <WorkspaceChat workspaceId={workspaceId} user={user} />
      )}
      <dialog
        className="workspace-delete-dialog"
        ref={deleteDialogRef}
        aria-labelledby="workspace-delete-title"
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteConfirmName("");
          setDeleteDialogError("");
        }}
      >
        <form
          className="workspace-delete-content"
          onSubmit={(event) => {
            event.preventDefault();
            void deleteWorkspace();
          }}
        >
          <h2 id="workspace-delete-title">Delete project?</h2>
          <p>
            This permanently deletes the project, its members, chat history and
            attachments, tasks, milestones, showcase, and related notifications.
            The opportunity and accepted collaboration history remain. The owner
            can create another project later if eligible. This action cannot be
            undone.
          </p>
          <label className="field-label" htmlFor="workspace-delete-name">
            Type <strong>{workspace?.title}</strong> to confirm
          </label>
          <input
            id="workspace-delete-name"
            className="field-control"
            value={deleteConfirmName}
            autoComplete="off"
            autoFocus
            onChange={(event) => setDeleteConfirmName(event.target.value)}
            disabled={busy}
          />
          {deleteDialogError && (
            <p className="feedback feedback-error" role="alert">
              {deleteDialogError}
            </p>
          )}
          <div className="workspace-delete-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              className="button button-primary workspace-delete-confirm"
              type="submit"
              disabled={busy || deleteConfirmName.trim() !== workspace?.title}
            >
              {busy ? "Deleting…" : "Delete project"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
