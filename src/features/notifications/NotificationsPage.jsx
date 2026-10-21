import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";

const eventLabels = {
  request_received: "sent you a request to join an opportunity",
  workspace_invite: "added you to a project",
  member_joined: "joined a project",
  member_left: "left a project",
  member_removed: "removed you from a project",
  member_role_changed: "changed your project role",
  task_assigned: "assigned you a task",
  project_status_changed: "changed a project’s status",
  opportunity_liked: "liked your opportunity",
  comment_added: "commented on your opportunity",
  comment_replied: "replied to a comment",
};

function timeLabel(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function signInHref() {
  return `/auth/sign-in?next=${encodeURIComponent("/notifications")}`;
}

export default function NotificationsPage({ user }) {
  const [rows, setRows] = useState([]);
  const [requests, setRequests] = useState({});
  const [actors, setActors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("notifications")
      .select(
        "id, actor_id, event_type, entity_type, entity_id, created_at, read_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (queryError) {
      setError("Notifications could not be loaded. Try again.");
      setLoading(false);
      return;
    }
    const notificationRows = data ?? [];
    const actorIds = [
      ...new Set(notificationRows.map((row) => row.actor_id).filter(Boolean)),
    ];
    const requestIds = notificationRows
      .filter((row) => row.entity_type === "collaboration_request")
      .map((row) => row.entity_id);
    const [profileResult, requestResult] = await Promise.all([
      actorIds.length
        ? supabase
            .from("profiles")
            .select("user_id, display_name, username")
            .in("user_id", actorIds)
        : Promise.resolve({ data: [], error: null }),
      requestIds.length
        ? supabase
            .from("collaboration_requests")
            .select("id, opportunity_id, status, acceptance_path")
            .in("id", requestIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setActors(
      Object.fromEntries(
        (profileResult.data ?? []).map((profile) => [profile.user_id, profile]),
      ),
    );
    setRequests(
      Object.fromEntries(
        (requestResult.data ?? []).map((request) => [request.id, request]),
      ),
    );
    setRows(notificationRows);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void Promise.resolve().then(load);
    if (!user || !isSupabaseConfigured) return undefined;
    const channel = supabase
      .channel(`notification-list-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, user]);

  async function destinationFor(notification) {
    if (notification.event_type === "request_received") {
      const request = requests[notification.entity_id];
      return request
        ? `/opportunities/${request.opportunity_id}/requests`
        : "/opportunities";
    }
    if (notification.event_type === "request_decided") {
      const request = requests[notification.entity_id];
      if (!request) return "/opportunities";
      if (
        request.status === "accepted" &&
        request.acceptance_path === "private_chat"
      ) {
        const { data } = await supabase
          .from("private_conversations")
          .select("id")
          .eq("request_id", request.id)
          .maybeSingle();
        return data
          ? `/messages?conversation=${encodeURIComponent(data.id)}`
          : "/messages";
      }
      if (request.status === "accepted") {
        const { data } = await supabase
          .from("workspaces")
          .select("id")
          .eq("opportunity_id", request.opportunity_id)
          .maybeSingle();
        return data ? `/projects/${data.id}` : "/projects";
      }
      return `/opportunities?focus=${encodeURIComponent(request.opportunity_id)}`;
    }
    if (notification.entity_type === "comment") {
      const { data } = await supabase
        .from("comments")
        .select("opportunity_id")
        .eq("id", notification.entity_id)
        .maybeSingle();
      return data
        ? `/opportunities?focus=${encodeURIComponent(data.opportunity_id)}&comment=${encodeURIComponent(notification.entity_id)}`
        : "/opportunities";
    }
    if (notification.event_type === "opportunity_liked") {
      return `/opportunities?focus=${encodeURIComponent(notification.entity_id)}`;
    }
    if (notification.event_type === "task_assigned") {
      const { data } = await supabase
        .from("tasks")
        .select("workspace_id")
        .eq("id", notification.entity_id)
        .maybeSingle();
      return data ? `/projects/${data.workspace_id}?view=work` : "/projects";
    }
    if (notification.entity_type === "workspace") {
      const view =
        notification.event_type === "member_joined" ||
        notification.event_type === "member_left"
          ? "view=members"
          : "";
      return `/projects/${notification.entity_id}${view ? `?${view}` : ""}`;
    }
    return "/notifications";
  }

  async function markRead(notification) {
    const { error: markError } = await supabase.rpc("mark_notification_read", {
      p_notification_id: notification.id,
    });
    if (markError) {
      setError("This notification could not be marked as read. Try again.");
      return false;
    }
    setRows((current) =>
      current.map((row) =>
        row.id === notification.id
          ? { ...row, read_at: row.read_at ?? new Date().toISOString() }
          : row,
      ),
    );
    return true;
  }

  async function openNotification(notification) {
    setBusyId(notification.id);
    if (!(await markRead(notification))) {
      setBusyId("");
      return;
    }
    const href = await destinationFor(notification);
    window.location.assign(href);
  }

  if (!user) {
    return (
      <section className="notification-page">
        <div className="page-heading">
          <h1>Notifications</h1>
        </div>
        <section className="empty-card">
          <div className="empty-copy">
            <h2>Sign in to view notifications</h2>
            <p>
              Notifications about your projects and opportunities will appear
              here.
            </p>
            <a className="button button-primary" href={signInHref()}>
              Sign in
            </a>
          </div>
        </section>
      </section>
    );
  }

  const unreadCount = rows.filter((row) => !row.read_at).length;
  return (
    <section className="notification-page">
      <div className="page-heading">
        <div>
          <h1>Notifications</h1>
          <p className="page-description">
            {unreadCount ? `${unreadCount} unread` : "You’re all caught up"}
          </p>
        </div>
      </div>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading notifications…</p>
      ) : rows.length === 0 ? (
        <section className="empty-card">
          <div className="empty-copy">
            <h2>No notifications yet</h2>
            <p>
              Updates about requests, comments, and project activity will show
              up here.
            </p>
          </div>
        </section>
      ) : (
        <ol className="notification-list">
          {rows.map((notification) => {
            const actor = actors[notification.actor_id];
            const actorName =
              actor?.display_name ?? actor?.username ?? "Someone";
            const request = requests[notification.entity_id];
            const description =
              notification.event_type === "request_decided"
                ? request?.status === "accepted"
                  ? "accepted your request to join an opportunity"
                  : request?.status === "rejected"
                    ? "declined your request to join an opportunity"
                    : "updated your collaboration request"
                : (eventLabels[notification.event_type] ??
                  "updated something you’re connected to");
            return (
              <li
                className={`notification-item${notification.read_at ? " is-read" : " is-unread"}`}
                key={notification.id}
              >
                <button
                  className="notification-open"
                  type="button"
                  disabled={busyId === notification.id}
                  onClick={() => void openNotification(notification)}
                >
                  <span className="notification-dot" aria-hidden="true" />
                  <span className="notification-copy">
                    <strong>{actorName}</strong> {description}
                    <time dateTime={notification.created_at}>
                      {timeLabel(notification.created_at)}
                    </time>
                  </span>
                </button>
                {!notification.read_at && (
                  <button
                    className="notification-mark-read"
                    type="button"
                    onClick={() => void markRead(notification)}
                  >
                    Mark read
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
