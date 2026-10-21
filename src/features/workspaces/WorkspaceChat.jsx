import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
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
const MESSAGE_SELECT =
  "id, workspace_id, sender_id, body, created_at, workspace_attachments(id, storage_path, original_name, media_type, size_bytes, uploaded_by)";

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
  return rows ?? [];
}

async function loadMessage(messageId) {
  const { data, error } = await supabase
    .from("workspace_messages")
    .select(MESSAGE_SELECT)
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

export default function WorkspaceChat({ workspaceId, user }) {
  const [messages, setMessages] = useState([]);
  const [senderNames, setSenderNames] = useState({});
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [downloadingPath, setDownloadingPath] = useState("");
  const [membershipEnded, setMembershipEnded] = useState(false);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }, [body]);

  useEffect(() => {
    const missingIds = [
      ...new Set(messages.map((message) => message.sender_id)),
    ].filter(
      (senderId) =>
        !Object.prototype.hasOwnProperty.call(senderNames, senderId),
    );
    if (!missingIds.length) return;

    let active = true;
    async function loadSenderNames() {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", missingIds);
      if (!active) return;
      const loadedNames = new Map(
        (data ?? []).map((profile) => [profile.user_id, profile.display_name]),
      );
      setSenderNames((current) => ({
        ...current,
        ...Object.fromEntries(
          missingIds.map((senderId) => [
            senderId,
            loadedNames.get(senderId) ||
              (senderId === user.id
                ? user.user_metadata?.display_name || "You"
                : "Developer"),
          ]),
        ),
      }));
    }
    void loadSenderNames();
    return () => {
      active = false;
    };
  }, [messages, senderNames, user.id, user.user_metadata?.display_name]);

  const refreshLatest = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("workspace_messages")
      .select(MESSAGE_SELECT)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    if (queryError) return;
    const hydrated = sortMessages(await hydrateMessages(data ?? []));
    setMessages((current) => {
      const byId = new Map(current.map((message) => [message.id, message]));
      for (const message of hydrated) byId.set(message.id, message);
      return sortMessages([...byId.values()]);
    });
    setHasOlder((data ?? []).length === PAGE_SIZE);
  }, [workspaceId]);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase
        .from("workspace_messages")
        .select(MESSAGE_SELECT)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (!active) return;
      if (queryError) {
        setError("Collabspace messages could not be loaded. Try again.");
      } else {
        setMessages(sortMessages(await hydrateMessages(data ?? [])));
        setHasOlder((data ?? []).length === PAGE_SIZE);
      }
      if (active) setLoading(false);
    }
    void loadInitial();
    void processStorageCleanup();
    return () => {
      active = false;
    };
  }, [workspaceId, retry]);

  useEffect(() => {
    let active = true;
    const checkMembership = async () => {
      const { data, error: membershipError } = await supabase
        .from("workspace_memberships")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .maybeSingle();
      if (active && !membershipError && !data) {
        setMembershipEnded(true);
        setMessages([]);
        setBody("");
        setAttachment(null);
      }
    };
    const timer = window.setInterval(() => void checkMembership(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user.id, workspaceId]);

  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel(`workspace-messages-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workspace_messages",
          filter: `workspace_id=eq.${workspaceId}`,
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
        if (status === "SUBSCRIBED") void refreshLatest();
      });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [refreshLatest, workspaceId]);

  useEffect(() => {
    if (!loading && messages.length) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [loading, messages]);

  async function loadOlderMessages() {
    if (!messages.length || loadingOlder || !hasOlder) return;
    setLoadingOlder(true);
    setError("");
    const oldest = messages[0];
    const { data, error: queryError } = await supabase
      .from("workspace_messages")
      .select(MESSAGE_SELECT)
      .eq("workspace_id", workspaceId)
      .or(
        `created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    if (queryError) {
      setError("Older messages could not be loaded. Try again.");
    } else {
      const older = await hydrateMessages(data ?? []);
      setMessages((current) => sortMessages([...older, ...current]));
      setHasOlder((data ?? []).length === PAGE_SIZE);
    }
    setLoadingOlder(false);
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (busy || membershipEnded) return;
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
        const extension = attachment.name.split(".").pop().toLowerCase();
        attachmentPath = `${workspaceId}/${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("workspace-attachments")
          .upload(attachmentPath, attachment, {
            cacheControl: "3600",
            contentType: attachment.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;
      }
      const { data: messageId, error: sendError } = await supabase.rpc(
        "send_workspace_message",
        {
          p_workspace_id: workspaceId,
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
            .from("workspace-attachments")
            .remove([attachmentPath]);
        }
        throw sendError;
      }
      const sent = await loadMessage(messageId);
      if (sent) setMessages((current) => upsertMessage(current, sent));
      setBody("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError(
        "Your message could not be sent. Your draft is still here; try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadAttachment(file) {
    if (downloadingPath) return;
    setDownloadingPath(file.storage_path);
    setError("");
    const { data, error: downloadError } = await supabase.storage
      .from("workspace-attachments")
      .download(file.storage_path);
    if (downloadError || !data) {
      setError(
        "This attachment is unavailable. You may no longer be a member.",
      );
      setDownloadingPath("");
      return;
    }
    const objectUrl = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = file.original_name;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    setDownloadingPath("");
  }

  return (
    <section className="workspace-chat-panel" aria-label="Collabspace chat">
      {error && (
        <div>
          <p className="feedback feedback-error" role="alert">
            {error}
          </p>
          <button
            className="text-button"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      <div
        className={`workspace-chat-messages${messages.length ? "" : " is-empty"}`}
        aria-live="polite"
      >
        {loading ? (
          <p className="muted-small" role="status">
            Loading messages…
          </p>
        ) : (
          <>
            {membershipEnded && (
              <p className="feedback feedback-error" role="alert">
                Your Collabspace membership ended. Chat access has been revoked.
              </p>
            )}
            {hasOlder && (
              <button
                type="button"
                className="text-button"
                disabled={loadingOlder}
                onClick={loadOlderMessages}
              >
                {loadingOlder ? "Loading…" : "Load older messages"}
              </button>
            )}
            {!messages.length && (
              <p className="muted-small">
                No messages yet. Start the conversation.
              </p>
            )}
            {messages.map((message, index) => {
              const dateKey = localChatDateKey(message.created_at);
              const previousDateKey =
                index > 0
                  ? localChatDateKey(messages[index - 1].created_at)
                  : null;
              return (
                <Fragment key={message.id}>
                  {dateKey !== previousDateKey && (
                    <div className="chat-date-divider">
                      <span>{formatChatDate(message.created_at)}</span>
                    </div>
                  )}
                  <article
                    className={`workspace-chat-message${message.sender_id === user.id ? " is-own-message" : ""}`}
                  >
                    <strong className="workspace-chat-sender">
                      {senderNames[message.sender_id] ??
                        (message.sender_id === user.id
                          ? user.user_metadata?.display_name || "You"
                          : "Developer")}
                    </strong>
                    <p>{message.body}</p>
                    {message.workspace_attachments?.map((file) => (
                      <button
                        className="workspace-chat-attachment"
                        type="button"
                        disabled={Boolean(downloadingPath)}
                        onClick={() => void downloadAttachment(file)}
                        key={file.id}
                      >
                        {downloadingPath === file.storage_path
                          ? "Downloading…"
                          : `${file.original_name} (${Math.ceil(file.size_bytes / 1024)} KB)`}
                      </button>
                    ))}
                    <time dateTime={message.created_at}>
                      {formatChatTime(message.created_at)}
                    </time>
                  </article>
                </Fragment>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>
      <form className="workspace-chat-composer" onSubmit={sendMessage}>
        <div className="workspace-chat-compose-row">
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept={ACCEPTED_FILES}
            aria-label="Attach a file"
            onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            disabled={busy || loading || membershipEnded}
          />
          <button
            type="button"
            className="workspace-chat-attach"
            aria-label="Attach file"
            title="Attach file"
            disabled={busy || loading}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m21.4 11.1-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
            </svg>
          </button>
          <textarea
            ref={messageInputRef}
            className="field-control"
            value={body}
            maxLength={10000}
            rows={1}
            placeholder="Write a message…"
            aria-label="Write a message"
            onChange={(event) => setBody(event.target.value)}
            disabled={busy || loading || membershipEnded}
          />
          <button
            aria-label="Send message"
            className="button button-primary"
            type="submit"
            disabled={busy || loading || membershipEnded || !body.trim()}
          >
            {busy ? (
              "…"
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
          </button>
        </div>
        {attachment && (
          <span className="workspace-chat-attachment-selection muted-small">
            {attachment.name} · {Math.ceil(attachment.size / 1024)} KB
            <button
              type="button"
              className="text-button"
              aria-label="Remove attachment"
              onClick={() => {
                setAttachment(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Remove
            </button>
          </span>
        )}
      </form>
    </section>
  );
}
