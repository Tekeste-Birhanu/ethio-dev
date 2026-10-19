import { Fragment, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";
import {
  formatChatDate,
  formatChatTime,
  localChatDateKey,
} from "../../lib/chatDateTime.js";

const PAGE_SIZE = 30;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const ACCEPTED_FILES = ".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.docx";

function signInHref() {
  return `/auth/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

function getConversationId() {
  return new URLSearchParams(window.location.search).get("conversation");
}

function isAcceptedAttachment(file) {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase();
  return (
    file.size > 0 &&
    file.size <= MAX_ATTACHMENT_SIZE &&
    ATTACHMENT_TYPES[extension] === file.type
  );
}

function sortMessages(rows) {
  return [...rows].sort((left, right) => {
    const byDate = left.created_at.localeCompare(right.created_at);
    return byDate || left.id.localeCompare(right.id);
  });
}

function upsertMessage(current, next) {
  const rows = new Map(current.map((message) => [message.id, message]));
  rows.set(next.id, { ...rows.get(next.id), ...next });
  return sortMessages([...rows.values()]);
}

async function hydrateMessages(rows) {
  const messages = rows ?? [];
  const paths = messages.flatMap((message) =>
    (message.private_attachments ?? []).map(
      (attachment) => attachment.storage_path,
    ),
  );
  if (!paths.length) return messages;
  const { data } = await supabase.storage
    .from("private-attachments")
    .createSignedUrls(paths, 3600);
  const signedUrls = Object.fromEntries(
    (data ?? [])
      .filter((item) => item.signedUrl)
      .map((item) => [item.path, item.signedUrl]),
  );
  return messages.map((message) => ({
    ...message,
    private_attachments: (message.private_attachments ?? []).map((file) => ({
      ...file,
      signed_url: signedUrls[file.storage_path] ?? "",
    })),
  }));
}

async function loadMessage(messageId) {
  const { data, error } = await supabase
    .from("private_messages")
    .select(
      "id, conversation_id, sender_id, body, message_type, workspace_id, created_at, private_attachments(id, storage_path, original_name, media_type, size_bytes, uploaded_by)",
    )
    .eq("id", messageId)
    .maybeSingle();
  if (error || !data) return null;
  return (await hydrateMessages([data]))[0];
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

export function PrivateMessagesPage({ user }) {
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [listActionError, setListActionError] = useState("");
  const [listActionBusyId, setListActionBusyId] = useState("");
  const [listRetry, setListRetry] = useState(0);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [messages, setMessages] = useState([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("Connecting…");
  const [sendRetry, setSendRetry] = useState(0);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const conversationId = getConversationId();

  useEffect(() => {
    const input = messageInputRef.current;
    if (!input) return;
    const maxHeight = 180;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [body]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return undefined;
    let active = true;
    async function loadConversations() {
      setListLoading(true);
      setListError("");
      const { data, error: queryError } = await supabase
        .from("private_conversations")
        .select("id, request_id, participant_a, participant_b, created_at")
        .eq("status", "active")
        .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      if (queryError) {
        setListError("Your conversations could not be loaded. Try again.");
        setListLoading(false);
        return;
      }
      const rows = data ?? [];
      if (!rows.length) {
        setConversations([]);
        setListLoading(false);
        return;
      }
      const requestIds = [...new Set(rows.map((row) => row.request_id))];
      const profileIds = [
        ...new Set(
          rows.map((row) =>
            row.participant_a === user.id
              ? row.participant_b
              : row.participant_a,
          ),
        ),
      ];
      const [requestResult, profileResult] = await Promise.all([
        supabase
          .from("collaboration_requests")
          .select("id, opportunity:opportunities(title)")
          .in("id", requestIds),
        supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_path")
          .in("user_id", profileIds),
      ]);
      if (!active) return;
      const requests = new Map(
        (requestResult.data ?? []).map((request) => [request.id, request]),
      );
      const profiles = new Map(
        (profileResult.data ?? []).map((profile) => [profile.user_id, profile]),
      );
      const avatarPaths = [
        ...new Set(
          [...profiles.values()]
            .map((profile) => profile.avatar_path)
            .filter(Boolean),
        ),
      ];
      let avatarUrls = {};
      if (avatarPaths.length) {
        const { data: signed } = await supabase.storage
          .from("profile-media")
          .createSignedUrls(avatarPaths, 3600);
        if (!active) return;
        avatarUrls = Object.fromEntries(
          (signed ?? [])
            .filter((image) => image.signedUrl)
            .map((image) => [image.path, image.signedUrl]),
        );
      }
      setConversations(
        rows.map((row) => {
          const otherId =
            row.participant_a === user.id
              ? row.participant_b
              : row.participant_a;
          const profile = profiles.get(otherId);
          return {
            ...row,
            opportunityTitle:
              requests.get(row.request_id)?.opportunity?.title ??
              "Private collaboration",
            profile,
            avatarUrl: profile?.avatar_path
              ? avatarUrls[profile.avatar_path]
              : "",
          };
        }),
      );
      setListLoading(false);
    }
    loadConversations();
    return () => {
      active = false;
    };
  }, [listRetry, user]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return undefined;
    void processStorageCleanup();
    return undefined;
  }, [user]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured || !conversationId) return undefined;
    let active = true;
    async function loadConversation() {
      setDetailLoading(true);
      setDetailError("");
      setError("");
      setNotice("");
      const { data: conversation, error: conversationError } = await supabase
        .from("private_conversations")
        .select(
          "id, request_id, participant_a, participant_b, status, created_at",
        )
        .eq("id", conversationId)
        .maybeSingle();
      if (!active) return;
      if (
        conversationError ||
        !conversation ||
        conversation.status !== "active"
      ) {
        setDetail(null);
        setMessages([]);
        setDetailError("This conversation is unavailable or has ended.");
        setDetailLoading(false);
        return;
      }
      const otherId =
        conversation.participant_a === user.id
          ? conversation.participant_b
          : conversation.participant_a;
      const [requestResult, profileResult, messageResult] = await Promise.all([
        supabase
          .from("collaboration_requests")
          .select("opportunity:opportunities(title)")
          .eq("id", conversation.request_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_path")
          .eq("user_id", otherId)
          .maybeSingle(),
        supabase
          .from("private_messages")
          .select(
            "id, conversation_id, sender_id, body, message_type, workspace_id, created_at, private_attachments(id, storage_path, original_name, media_type, size_bytes, uploaded_by)",
          )
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE),
      ]);
      if (!active) return;
      if (messageResult.error) {
        setDetailError("Messages could not be loaded. Try again.");
        setDetailLoading(false);
        return;
      }
      const initialMessages = await hydrateMessages(messageResult.data ?? []);
      if (!active) return;
      setDetail({
        ...conversation,
        otherProfile: profileResult.data,
        opportunityTitle:
          requestResult.data?.opportunity?.title ?? "Private collaboration",
      });
      setMessages(sortMessages(initialMessages));
      setHasOlder((messageResult.data ?? []).length === PAGE_SIZE);
      setDetailLoading(false);
    }
    loadConversation();
    return () => {
      active = false;
    };
  }, [conversationId, sendRetry, user]);

  useEffect(() => {
    if (!detail || detail.status !== "active" || !user) return undefined;
    let active = true;
    const channel = supabase
      .channel(`private-messages-${detail.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `conversation_id=eq.${detail.id}`,
        },
        async (payload) => {
          const message = await loadMessage(payload.new.id);
          if (active && message) {
            setMessages((current) => upsertMessage(current, message));
          }
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("Live");
          void supabase
            .from("private_messages")
            .select(
              "id, conversation_id, sender_id, body, message_type, workspace_id, created_at, private_attachments(id, storage_path, original_name, media_type, size_bytes, uploaded_by)",
            )
            .eq("conversation_id", detail.id)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(PAGE_SIZE)
            .then(async ({ data, error: queryError }) => {
              if (!active || queryError) return;
              const latest = await hydrateMessages(data ?? []);
              if (!active) return;
              setMessages((current) =>
                sortMessages(
                  [...current, ...latest].filter(
                    (message, index, all) =>
                      all.findIndex((item) => item.id === message.id) === index,
                  ),
                ),
              );
              setHasOlder((data ?? []).length === PAGE_SIZE);
            });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setRealtimeStatus("Reconnecting…");
        else if (status === "CLOSED") setRealtimeStatus("Offline");
      });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [detail, user]);

  async function loadOlderMessages() {
    if (!detail || !messages.length || loadingOlder) return;
    setLoadingOlder(true);
    setError("");
    const oldest = messages[0];
    const { data, error: queryError } = await supabase
      .from("private_messages")
      .select(
        "id, conversation_id, sender_id, body, message_type, workspace_id, created_at, private_attachments(id, storage_path, original_name, media_type, size_bytes, uploaded_by)",
      )
      .eq("conversation_id", detail.id)
      .or(
        `created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    if (queryError) {
      setError("Older messages could not be loaded. Try again.");
    } else {
      const older = sortMessages(await hydrateMessages(data ?? []));
      setMessages((current) => sortMessages([...older, ...current]));
      setHasOlder((data ?? []).length === PAGE_SIZE);
    }
    setLoadingOlder(false);
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!detail || detail.status !== "active" || busy) return;
    const trimmedBody = body.trim();
    if (!trimmedBody || trimmedBody.length > 10000) {
      setError("Write a message (up to 10,000 characters) before sending.");
      return;
    }
    if (attachment && !isAcceptedAttachment(attachment)) {
      setError("Choose an allowed file type under 10 MB.");
      return;
    }
    setBusy(true);
    setError("");
    let attachmentPath = null;
    try {
      if (attachment) {
        setBusyLabel("Uploading file…");
        const extension = attachment.name.split(".").pop().toLocaleLowerCase();
        attachmentPath = `${detail.id}/${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("private-attachments")
          .upload(attachmentPath, attachment, {
            cacheControl: "3600",
            contentType: attachment.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;
      }
      setBusyLabel("Sending…");
      const { data: messageId, error: sendError } = await supabase.rpc(
        "send_private_message",
        {
          p_conversation_id: detail.id,
          p_body: trimmedBody,
          p_client_key: crypto.randomUUID(),
          p_attachment_path: attachmentPath,
          p_original_name: attachment?.name ?? null,
          p_media_type: attachment?.type ?? null,
          p_size_bytes: attachment?.size ?? null,
        },
      );
      if (sendError) {
        if (attachmentPath) {
          await supabase.storage
            .from("private-attachments")
            .remove([attachmentPath]);
        }
        throw sendError;
      }
      const sent = await loadMessage(messageId);
      if (sent) setMessages((current) => upsertMessage(current, sent));
      setBody("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice("");
    } catch (sendError) {
      setError(
        sendError?.message?.includes("unavailable")
          ? "This conversation has ended. Refresh your messages."
          : "Your message could not be sent. Your draft is still here; try again.",
      );
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function endConversation() {
    if (!detail || busy) return;
    if (
      !window.confirm(
        "End this private collaboration? Both participants will lose access to the chat and its messages and attachments will be deleted.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    const { error: endError } = await supabase.rpc("end_private_conversation", {
      p_conversation_id: detail.id,
    });
    if (endError) {
      setError("The collaboration could not be ended. Refresh and try again.");
    } else {
      setDetail((current) => ({ ...current, status: "ended" }));
      setMessages([]);
      setBody("");
      setAttachment(null);
      setNotice("Private collaboration ended. Chat access has been revoked.");
      setListRetry((value) => value + 1);
      void processStorageCleanup();
    }
    setBusy(false);
  }

  async function addCollaboratorToWorkspace() {
    if (!detail || user?.id !== detail.participant_a || workspaceBusy) return;
    setWorkspaceBusy(true);
    setError("");
    const { data: workspaceId, error: workspaceError } = await supabase.rpc(
      "add_private_collaborator_to_workspace",
      { p_request_id: detail.request_id },
    );
    if (workspaceError || !workspaceId) {
      const rpcIsMissing =
        workspaceError?.code === "PGRST202" ||
        /could not find the function|schema cache/i.test(
          workspaceError?.message ?? "",
        );
      const collaborationIsUnavailable =
        /accepted private collaboration not found/i.test(
          workspaceError?.message ?? "",
        );
      setError(
        rpcIsMissing
          ? "Workspace setup is not applied to Supabase yet. Run npm run supabase:push, confirm the migrations with npm run supabase:migrations, then try again."
          : collaborationIsUnavailable
            ? "This accepted private collaboration could not be found. Refresh the chat and try again."
            : `The collaborator could not be added to a workspace. Try again. (Error code: ${workspaceError?.code ?? "unknown"})`,
      );
      setWorkspaceBusy(false);
      return;
    }
    window.location.assign(`/workspaces/${encodeURIComponent(workspaceId)}`);
  }

  async function addConversationToWorkspace(conversation) {
    if (user?.id !== conversation.participant_a || listActionBusyId) return;
    setListActionBusyId(conversation.id);
    setListActionError("");
    const { data: workspaceId, error: workspaceError } = await supabase.rpc(
      "add_private_collaborator_to_workspace",
      { p_request_id: conversation.request_id },
    );
    if (workspaceError || !workspaceId) {
      setListActionError(
        `The collaborator could not be added to a workspace. Try again. (Error code: ${workspaceError?.code ?? "unknown"})`,
      );
      setListActionBusyId("");
      return;
    }
    window.location.assign(`/workspaces/${encodeURIComponent(workspaceId)}`);
  }

  async function endConversationFromList(conversation) {
    if (listActionBusyId) return;
    if (
      !window.confirm(
        "End this private collaboration? Both participants will lose access to the chat and its messages and attachments will be deleted.",
      )
    ) {
      return;
    }
    setListActionBusyId(conversation.id);
    setListActionError("");
    const { error: endError } = await supabase.rpc("end_private_conversation", {
      p_conversation_id: conversation.id,
    });
    if (endError) {
      setListActionError(
        `The collaboration could not be ended. Try again. (Error code: ${endError.code ?? "unknown"})`,
      );
    } else {
      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );
      if (detail?.id === conversation.id) {
        setDetail((current) => ({ ...current, status: "ended" }));
        setMessages([]);
        setBody("");
        setAttachment(null);
      }
      setListRetry((value) => value + 1);
      void processStorageCleanup();
    }
    setListActionBusyId("");
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="discovery-status">
        <h1>Connect Supabase</h1>
        <p>Add Supabase settings to use private messages.</p>
      </section>
    );
  }
  if (!user) {
    return (
      <section className="discovery-status">
        <h1>Sign in to view messages</h1>
        <p>Private collaboration chats are only available to participants.</p>
        <a className="button button-primary" href={signInHref()}>
          Sign in
        </a>
      </section>
    );
  }

  return (
    <section
      className={`private-messages-page${conversationId ? " is-chat-open" : ""}`}
    >
      <div className="page-heading">
        <div>
          <h1>Messages</h1>
        </div>
      </div>
      <div
        className={`private-messages-layout${conversationId ? " has-selected-conversation" : ""}`}
      >
        <aside className="conversation-list" aria-label="Conversations">
          {listLoading ? (
            <p className="muted-small" role="status">
              Loading conversations…
            </p>
          ) : listError ? (
            <div>
              <p className="feedback feedback-error" role="alert">
                {listError}
              </p>
              <button
                className="text-button"
                type="button"
                onClick={() => setListRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : conversations.length ? (
            <ul>
              {conversations.map((conversation) => (
                <li className="conversation-list-item" key={conversation.id}>
                  <a
                    className={
                      conversationId === conversation.id
                        ? "conversation-link is-selected"
                        : "conversation-link"
                    }
                    href={`/messages?conversation=${encodeURIComponent(conversation.id)}`}
                    aria-current={
                      conversationId === conversation.id ? "page" : undefined
                    }
                  >
                    <span className="request-avatar">
                      {conversation.avatarUrl ? (
                        <img src={conversation.avatarUrl} alt="" />
                      ) : (
                        (conversation.profile?.display_name?.[0]?.toLocaleUpperCase() ??
                        "D")
                      )}
                    </span>
                    <span className="conversation-link-copy">
                      <strong>
                        {conversation.profile?.display_name ?? "Developer"}
                      </strong>
                      <small>{conversation.opportunityTitle}</small>
                    </span>
                  </a>
                  <details className="three-dot-menu">
                    <summary
                      aria-label={`Actions for ${conversation.profile?.display_name ?? "this conversation"}`}
                      title="Conversation actions"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </summary>
                    <div className="three-dot-menu-items">
                      {user.id === conversation.participant_a && (
                        <button
                          type="button"
                          disabled={Boolean(listActionBusyId)}
                          onClick={(event) => {
                            event.currentTarget.closest("details").open = false;
                            void addConversationToWorkspace(conversation);
                          }}
                        >
                          {listActionBusyId === conversation.id
                            ? "Adding…"
                            : "Add to workspace"}
                        </button>
                      )}
                      <button
                        className="end-collaboration"
                        type="button"
                        disabled={Boolean(listActionBusyId)}
                        onClick={(event) => {
                          event.currentTarget.closest("details").open = false;
                          void endConversationFromList(conversation);
                        }}
                      >
                        End collaboration
                      </button>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-small">
              Accepted private chats will appear here.
            </p>
          )}
          {listActionError && (
            <p className="feedback feedback-error" role="alert">
              {listActionError}
            </p>
          )}
        </aside>
        <section
          className="private-conversation"
          aria-label="Private conversation"
        >
          {!conversationId ? (
            <div className="private-chat-placeholder">
              <h2>Select a conversation</h2>
              <p>Choose a private collaboration chat to view its messages.</p>
            </div>
          ) : detailLoading ? (
            <div className="private-chat-placeholder">
              <a className="private-chat-back" href="/messages">
                <span aria-hidden="true">←</span> Back to conversations
              </a>
              <p className="muted-small" role="status">
                Loading conversation…
              </p>
            </div>
          ) : detailError ? (
            <div className="private-chat-placeholder">
              <h2>Conversation unavailable</h2>
              <p role="alert">{detailError}</p>
              <button
                className="text-button"
                type="button"
                onClick={() => setSendRetry((value) => value + 1)}
              >
                Try again
              </button>
              <a className="text-link" href="/messages">
                Back to messages
              </a>
            </div>
          ) : detail ? (
            <>
              <header className="private-chat-header">
                <a className="private-chat-back" href="/messages">
                  <span aria-hidden="true">←</span> Back to conversations
                </a>
                <div className="private-chat-identity">
                  <a
                    className="text-link"
                    href={
                      detail.otherProfile?.username
                        ? `/u/${encodeURIComponent(detail.otherProfile.username)}`
                        : undefined
                    }
                  >
                    {detail.otherProfile?.display_name ?? "Developer"}
                  </a>
                  <p>{detail.opportunityTitle}</p>
                </div>
                <div className="private-chat-header-actions">
                  {detail.status === "active" && (
                    <details className="three-dot-menu">
                      <summary
                        aria-label="Conversation actions"
                        title="Conversation actions"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1" />
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="12" cy="19" r="1" />
                        </svg>
                      </summary>
                      <div className="three-dot-menu-items">
                        {user?.id === detail.participant_a && (
                          <button
                            type="button"
                            disabled={busy || workspaceBusy}
                            onClick={(event) => {
                              event.currentTarget.closest("details").open =
                                false;
                              void addCollaboratorToWorkspace();
                            }}
                          >
                            {workspaceBusy ? "Adding?" : "Add to workspace"}
                          </button>
                        )}
                        <button
                          className="end-collaboration"
                          type="button"
                          disabled={busy || workspaceBusy}
                          onClick={(event) => {
                            event.currentTarget.closest("details").open = false;
                            void endConversation();
                          }}
                        >
                          End collaboration
                        </button>
                      </div>
                    </details>
                  )}
                </div>
              </header>
              {notice && (
                <p className="feedback request-feedback" role="status">
                  {notice}
                </p>
              )}
              {error && (
                <p className="feedback feedback-error" role="alert">
                  {error}
                </p>
              )}
              {detail.status === "ended" ? (
                <div className="private-chat-placeholder">
                  <h2>Chat ended</h2>
                  <p>Access to this conversation has been revoked.</p>
                  <a className="text-link" href="/messages">
                    Back to messages
                  </a>
                </div>
              ) : (
                <>
                  <div className="private-message-toolbar">
                    {hasOlder && (
                      <button
                        className="text-button"
                        type="button"
                        disabled={loadingOlder}
                        onClick={loadOlderMessages}
                      >
                        {loadingOlder ? "Loading…" : "Load older messages"}
                      </button>
                    )}
                    <span className="muted-small" role="status">
                      {realtimeStatus}
                    </span>
                  </div>
                  <div
                    className="private-message-list"
                    aria-live="polite"
                    aria-relevant="additions text"
                  >
                    {detailLoading ? (
                      <p className="muted-small" role="status">
                        Loading messages…
                      </p>
                    ) : messages.length ? (
                      messages.map((message, index) => {
                        const dateKey = localChatDateKey(message.created_at);
                        const previousDateKey =
                          index > 0
                            ? localChatDateKey(messages[index - 1].created_at)
                            : null;
                        return (
                          <Fragment key={message.id}>
                            {dateKey !== previousDateKey && (
                              <div className="chat-date-divider">
                                <span>
                                  {formatChatDate(message.created_at)}
                                </span>
                              </div>
                            )}
                            <article
                              className={
                                message.message_type === "system"
                                  ? "private-message-system-notice"
                                  : message.sender_id === user.id
                                    ? "private-message is-own-message"
                                    : "private-message"
                              }
                            >
                              <p
                                className={
                                  message.message_type === "system"
                                    ? "private-message-system-copy"
                                    : "private-message-body"
                                }
                              >
                                {message.body}
                              </p>
                              {message.message_type === "system" &&
                                message.workspace_id && (
                                  <a
                                    className="private-message-workspace-link"
                                    href={`/workspaces/${encodeURIComponent(message.workspace_id)}`}
                                  >
                                    Open workspace
                                  </a>
                                )}
                              {(message.private_attachments ?? []).map(
                                (file) => (
                                  <a
                                    className="private-attachment-link"
                                    href={file.signed_url || undefined}
                                    key={file.id}
                                    download={file.original_name}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <span aria-hidden="true">↧</span>
                                    <span>{file.original_name}</span>
                                    <small>
                                      {Math.ceil(file.size_bytes / 1024)} KB
                                    </small>
                                  </a>
                                ),
                              )}
                              <time dateTime={message.created_at}>
                                {formatChatTime(message.created_at)}
                              </time>
                            </article>
                          </Fragment>
                        );
                      })
                    ) : (
                      <p className="muted-small">
                        No messages yet. Start the conversation.
                      </p>
                    )}
                  </div>
                  <form
                    className="private-message-composer"
                    onSubmit={sendMessage}
                  >
                    <div className="private-message-input-shell">
                      <textarea
                        id="private-message-body"
                        ref={messageInputRef}
                        aria-label="Message"
                        className="field-control"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        maxLength={10000}
                        rows={1}
                        placeholder="Write a message…"
                        required
                      />
                      <div className="private-message-input-tools">
                        {attachment ? (
                          <div className="private-attachment-chip">
                            <span title={attachment.name}>
                              {attachment.name}
                            </span>
                            <button
                              className="private-attachment-remove"
                              type="button"
                              aria-label="Remove attachment"
                              disabled={busy}
                              onClick={() => {
                                setAttachment(null);
                                if (fileInputRef.current)
                                  fileInputRef.current.value = "";
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <label
                            className="private-attachment-picker"
                            title="Attach a file"
                            aria-label="Attach a file"
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24">
                              <path d="m21.4 11.1-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
                            </svg>
                            <input
                              ref={fileInputRef}
                              type="file"
                              aria-label="Attach a file"
                              accept={ACCEPTED_FILES}
                              disabled={busy}
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                if (file && !isAcceptedAttachment(file)) {
                                  setAttachment(null);
                                  setError(
                                    "Choose a supported file under 10 MB.",
                                  );
                                  event.target.value = "";
                                  return;
                                }
                                setError("");
                                setAttachment(file);
                              }}
                            />
                          </label>
                        )}
                        <span className="muted-small">{body.length}/10000</span>
                      </div>
                    </div>
                    <div className="private-message-composer-footer">
                      <button
                        className="button button-primary"
                        type="submit"
                        disabled={busy || !body.trim()}
                      >
                        {busy ? busyLabel : "Send"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          ) : (
            <div className="private-chat-placeholder">
              <p className="muted-small">Conversation not loaded.</p>
              <button
                className="text-button"
                type="button"
                onClick={() => setSendRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
