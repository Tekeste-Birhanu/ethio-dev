import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ui.jsx";

function formatTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderMessage(content) {
  return content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    try {
      const url = new URL(part);
      if (!["http:", "https:"].includes(url.protocol)) return part;
      return (
        <a
          className="break-all text-accent-light underline"
          href={url.href}
          key={`${url.href}-${index}`}
          rel="noreferrer noopener"
          target="_blank"
        >
          {part}
        </a>
      );
    } catch {
      return part;
    }
  });
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort(
    (first, second) => new Date(first.createdAt) - new Date(second.createdAt),
  );
}

function makeClientMessageId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function CollabspaceGroupChat({
  collabspaceId,
  userId,
  onUnreadCountChange,
}) {
  const [messages, setMessages] = useState([]);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [conversationId, setConversationId] = useState("");
  const [messagesHaveMore, setMessagesHaveMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [canDeleteForOthers, setCanDeleteForOthers] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingDraft, setEditingDraft] = useState("");
  const [actionId, setActionId] = useState("");
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const closeConfirmation = useCallback(() => setConfirmation(null), []);
  const socketRef = useRef(null);
  const conversationIdRef = useRef("");
  const messagesRef = useRef([]);
  const pendingRef = useRef([]);
  const historyRequest = useRef(0);
  const unreadCountRef = useRef(0);
  const reconciledMessageIds = useRef(new Set());
  const scrollRef = useRef(null);
  const preserveScrollRef = useRef(null);
  const shouldStickToBottom = useRef(true);

  messagesRef.current = messages;
  pendingRef.current = pendingMessages;

  const setConversation = useCallback((value) => {
    conversationIdRef.current = value;
    setConversationId(value);
  }, []);

  const updateUnreadCount = useCallback((count) => {
    unreadCountRef.current = count;
    onUnreadCountChange?.(count);
  }, [onUnreadCountChange]);

  const markReadThrough = useCallback(async (throughMessageId) => {
    if (!throughMessageId) return;
    try {
      const response = await fetch(
        `/api/collabspaces/${encodeURIComponent(collabspaceId)}/read`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ throughMessageId }),
        },
      );
      const result = await response.json();
      if (!response.ok) return;
      updateUnreadCount(result.unreadCount ?? 0);
    } catch {
      // The next history refresh will retry updating the read marker.
    }
  }, [collabspaceId, updateUnreadCount]);

  const loadHistory = useCallback(async ({ older = false } = {}) => {
    const requestId = ++historyRequest.current;
    const before = older ? messagesRef.current[0]?.id : "";
    const query = before ? `?before=${encodeURIComponent(before)}` : "";
    const response = await fetch(
      `/api/collabspaces/${encodeURIComponent(collabspaceId)}/messages${query}`,
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message ?? "Could not load group chat messages.");
    }
    if (requestId !== historyRequest.current) return result;

    setConversation(result.conversationId ?? "");
    setCanWrite(Boolean(result.canWrite));
    setCanDeleteForOthers(Boolean(result.canDeleteForOthers));
    setMessages((current) => older
      ? mergeMessages(result.messages ?? [], current)
      : mergeMessages(current, result.messages ?? []));
    setMessagesHaveMore(Boolean(result.hasMore));
    updateUnreadCount(result.unreadCount ?? 0);
    return result;
  }, [collabspaceId, setConversation, updateUnreadCount]);

  useEffect(() => {
    let active = true;
    loadHistory()
      .then(async (result) => {
        if (!active) return;
        const latestMessageId = result.messages?.at(-1)?.id;
        if (document.visibilityState === "visible") await markReadThrough(latestMessageId);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Could not load group chat messages.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      historyRequest.current += 1;
    };
  }, [loadHistory, markReadThrough]);

  useEffect(() => {
    if (!conversationId) return undefined;
    let disposed = false;
    let retryTimer;
    let retryDelay = 500;
    let socket;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/chat/socket`);
      socketRef.current = socket;

      socket.addEventListener("open", async () => {
        retryDelay = 500;
        setSocketStatus("connected");
        setError("");
        try {
          const result = await loadHistory();
          if (disposed) return;
          const confirmedClientIds = new Set(
            (result.messages ?? []).map((message) => message.clientMessageId).filter(Boolean),
          );
          setPendingMessages((current) => current.filter(
            (pending) => !confirmedClientIds.has(pending.clientMessageId),
          ));
          for (const pending of pendingRef.current) {
            if (!confirmedClientIds.has(pending.clientMessageId) && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "message.send", ...pending }));
            }
          }
          const latestMessageId = result.messages?.at(-1)?.id;
          if (document.visibilityState === "visible") await markReadThrough(latestMessageId);
        } catch (loadError) {
          if (!disposed) setError(loadError.message || "Could not refresh group chat history.");
        }
      });

      socket.addEventListener("message", (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.type === "group.message.created" || payload.type === "group.message.ack") {
          if (payload.message?.conversationId !== conversationIdRef.current) return;
          setMessages((current) => current.some((message) => message.id === payload.message.id)
            ? current
            : mergeMessages(current, [payload.message]));
          if (payload.type === "group.message.ack") {
            setError("");
            setPendingMessages((current) => current.filter(
              (pending) => pending.clientMessageId !== payload.clientMessageId,
            ));
          } else if (payload.message.senderId === userId && payload.message.clientMessageId) {
            setPendingMessages((current) => current.filter(
              (pending) => pending.clientMessageId !== payload.message.clientMessageId,
            ));
          }
          if (payload.message.senderId !== userId) {
            if (document.visibilityState === "visible") {
              markReadThrough(payload.message.id);
            } else {
              updateUnreadCount(unreadCountRef.current + 1);
            }
          }
        } else if (payload.type === "group.message.updated") {
          if (payload.message?.conversationId !== conversationIdRef.current) return;
          setMessages((current) => current.map((message) => (
            message.id === payload.message.id ? payload.message : message
          )));
        } else if (payload.type === "group.message.deleted") {
          if (payload.conversationId !== conversationIdRef.current) return;
          setMessages((current) => current.filter((message) => message.id !== payload.messageId));
        } else if (payload.type === "error" && payload.clientMessageId) {
          setError(payload.message ?? "The group message could not be sent.");
          if (payload.code === "CONVERSATION_NOT_FOUND") setCanWrite(false);
          const failed = pendingRef.current.find((message) => message.clientMessageId === payload.clientMessageId);
          if (["MESSAGE_SEND_FAILED", "MESSAGE_RETRY"].includes(payload.code) && failed) {
            if (!reconciledMessageIds.current.has(failed.clientMessageId)) {
              reconciledMessageIds.current.add(failed.clientMessageId);
              window.setTimeout(async () => {
                if (disposed) return;
                try {
                  const result = await loadHistory();
                  const persisted = result.messages?.some(
                    (message) => message.clientMessageId === failed.clientMessageId,
                  );
                  if (persisted) {
                    setPendingMessages((current) => current.filter(
                      (message) => message.clientMessageId !== failed.clientMessageId,
                    ));
                  } else if (socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({ type: "message.send", ...failed }));
                  }
                } catch {
                  // Keep the message pending so reconnect can safely retry its ID.
                }
              }, 250);
            }
            return;
          }
          if (failed) setDraft((current) => current || failed.content);
          setPendingMessages((current) => current.filter(
            (message) => message.clientMessageId !== payload.clientMessageId,
          ));
        }
      });

      socket.addEventListener("close", (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed) return;
        if (event.code === 4401) {
          setSocketStatus("offline");
          setError("Your session expired. Sign in again to send messages.");
          return;
        }
        setSocketStatus("reconnecting");
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10000);
      });
      socket.addEventListener("error", () => setError("Group chat connection interrupted. Reconnecting..."));
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      socket?.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [conversationId, loadHistory, markReadThrough, updateUnreadCount, userId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (preserveScrollRef.current) {
      const previous = preserveScrollRef.current;
      container.scrollTop = previous.top + container.scrollHeight - previous.height;
      preserveScrollRef.current = null;
    } else if (shouldStickToBottom.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, pendingMessages]);

  async function loadOlderMessages() {
    if (!messagesHaveMore || isLoadingOlder || !messages.length) return;
    const container = scrollRef.current;
    if (container) {
      preserveScrollRef.current = {
        height: container.scrollHeight,
        top: container.scrollTop,
      };
    }
    setIsLoadingOlder(true);
    setError("");
    try {
      await loadHistory({ older: true });
    } catch (loadError) {
      preserveScrollRef.current = null;
      setError(loadError.message || "Could not load older messages.");
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function retryHistory() {
    setError("");
    try {
      const result = await loadHistory();
      if (document.visibilityState === "visible") {
        await markReadThrough(result.messages?.at(-1)?.id);
      }
    } catch (loadError) {
      setError(loadError.message || "Could not load group chat messages.");
    }
  }

  function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    const socket = socketRef.current;
    if (!content || !canWrite) return;
    if (socket?.readyState !== WebSocket.OPEN || !conversationId) {
      setError("Group chat is reconnecting. Your draft is still here; try again when connected.");
      return;
    }

    const pending = {
      conversationId,
      clientMessageId: makeClientMessageId(),
      content,
      createdAt: new Date().toISOString(),
    };
    setPendingMessages((current) => [...current, pending]);
    setError("");
    try {
      socket.send(JSON.stringify({ type: "message.send", ...pending }));
      setDraft("");
    } catch {
      setPendingMessages((current) => current.filter(
        (message) => message.clientMessageId !== pending.clientMessageId,
      ));
      setError("Could not send the message. Your draft is still here; try again.");
    }
  }

  async function editMessage(message) {
    const content = editingDraft.trim();
    if (!content || content.length > 5000 || actionId) return;
    setActionId(message.id);
    setError("");
    try {
      const response = await fetch(
        `/api/collabspaces/${encodeURIComponent(collabspaceId)}/messages/${encodeURIComponent(message.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not edit the message.");
      setMessages((current) => current.map((item) => item.id === message.id ? result.message : item));
      setEditingMessageId("");
      setEditingDraft("");
    } catch (editError) {
      setError(editError.message || "Could not edit the message.");
    } finally {
      setActionId("");
    }
  }

  async function deleteMessage(message) {
    if (actionId) return;
    setActionId(message.id);
    setError("");
    try {
      const response = await fetch(
        `/api/collabspaces/${encodeURIComponent(collabspaceId)}/messages/${encodeURIComponent(message.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message ?? "Could not delete the message.");
      }
      setMessages((current) => current.filter((item) => item.id !== message.id));
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete the message.");
    } finally {
      setActionId("");
    }
  }

  function requestDeleteMessage(message) {
    if (actionId) return;
    setConfirmation({
      title: "Delete group message?",
      description: "This message will be removed from the Collabspace conversation.",
      confirmLabel: "Delete message",
      onConfirm: () => deleteMessage(message),
    });
  }

  const visibleMessages = [
    ...messages,
    ...pendingMessages.filter((message) => message.conversationId === conversationId),
  ];

  return (
    <>
    <ConfirmDialog confirmation={confirmation} onClose={closeConfirmation} />
    <section className="grid h-[min(68dvh,780px)] min-h-[480px] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-[#293236] bg-surface" aria-label="Collabspace group chat">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-col gap-3 overflow-y-auto bg-chat p-4 sm:p-5"
        onScroll={(event) => {
          const element = event.currentTarget;
          shouldStickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
        aria-label="Group messages"
        aria-live="polite"
      >
        {messagesHaveMore && (
          <button className="mx-auto rounded-lg border border-[#354044] bg-transparent px-3 py-2 text-sm text-muted hover:text-ink" type="button" disabled={isLoadingOlder} onClick={loadOlderMessages}>
            {isLoadingOlder ? "Loading older messages…" : "Load older messages"}
          </button>
        )}
        {isLoading ? (
          <p className="m-auto text-sm text-muted" role="status">Loading messages…</p>
        ) : visibleMessages.length === 0 ? (
          <p className="m-auto max-w-sm text-center text-sm text-muted">This is the start of the group conversation. Send the first message.</p>
        ) : visibleMessages.map((message) => {
          const ownMessage = message.senderId === userId;
          const isEditing = editingMessageId === message.id;
          const mayDelete = ownMessage || canDeleteForOthers;
            const senderName = message.sender?.name ?? "Member";
          return (
            <article className={`relative grid max-w-[88%] gap-1 rounded-2xl px-4 py-3 sm:max-w-[75%] ${ownMessage ? "self-end bg-sent-message" : "self-start bg-message"}`} key={message.id ?? message.clientMessageId}>
              <span className="block pr-8 text-xs font-semibold text-accent-light">
                {ownMessage ? "You" : senderName}
              </span>
              {isEditing ? (
                <div className="grid gap-2">
                  <textarea className="min-h-20 w-full resize-y rounded-lg border border-[#354044] bg-[#141A16] p-2 text-sm text-ink outline-none focus:border-[#48C97B]" maxLength={5000} value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} aria-label="Edit group message" />
                  <div className="flex justify-end gap-3 text-xs">
                    <button className="text-muted underline" type="button" onClick={() => { setEditingMessageId(""); setEditingDraft(""); }}>Cancel</button>
                    <button className="text-accent-light underline disabled:opacity-50" type="button" disabled={!editingDraft.trim() || actionId === message.id} onClick={() => editMessage(message)}>{actionId === message.id ? "Saving…" : "Save"}</button>
                  </div>
                </div>
              ) : (
                <p className={`m-0 whitespace-pre-wrap break-words text-sm ${ownMessage ? "pr-7 pt-4" : ""}`}>{renderMessage(message.content)}</p>
              )}
              <time className="text-right text-[11px] text-[#b6c5c6]" dateTime={message.createdAt}>
                {message.clientMessageId && !message.id ? (socketStatus === "connected" ? "Sending…" : "Waiting for connection…") : `${formatTime(message.createdAt)}${message.editedAt ? " · edited" : ""}`}
              </time>
              {canWrite && message.id && !isEditing && (ownMessage || canDeleteForOthers) && (
                <details className="absolute right-2 top-1 z-20 text-xs">
                  <summary className="grid size-7 cursor-pointer list-none place-items-center rounded-full text-[#b6c5c6] hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-[#48C97B]" aria-label="Group message actions">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
                  </summary>
                  <div className="absolute right-0 top-full z-20 mt-1 w-28 rounded-xl border border-[#303a3e] bg-[#171f23] p-1 shadow-[0_14px_32px_rgb(0_0_0_/_32%)]">
                    {ownMessage && <button className="min-h-9 w-full rounded-lg bg-transparent px-3 text-left font-semibold text-ink hover:bg-[#222d31] disabled:opacity-50" type="button" disabled={Boolean(actionId)} onClick={(event) => { event.currentTarget.closest("details").open = false; setEditingMessageId(message.id); setEditingDraft(message.content); }}>Edit</button>}
                    {mayDelete && <button className="min-h-9 w-full rounded-lg bg-transparent px-3 text-left font-semibold text-[#ff9ba3] hover:bg-[#222d31] disabled:opacity-50" type="button" disabled={Boolean(actionId)} onClick={(event) => { event.currentTarget.closest("details").open = false; requestDeleteMessage(message); }}>{actionId === message.id ? "Deleting…" : "Delete"}</button>}
                  </div>
                </details>
              )}
            </article>
          );
        })}
      </div>
      <div className="border-t border-[#293236] p-3 sm:p-4">
        {error && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2" role="alert">
            <p className="m-0 text-sm text-[#f2bd79]">{error}</p>
            <button className="text-sm font-semibold text-accent underline" type="button" onClick={retryHistory}>Try again</button>
          </div>
        )}
        {!canWrite ? (
          <p className="m-0 text-center text-sm text-muted">This group chat is read only.</p>
        ) : (
          <form className="flex items-end gap-2" onSubmit={sendMessage}>
            <input className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#354044] bg-composer px-4 text-sm text-ink outline-none placeholder:text-[#87979c] focus:border-[#48C97B]" type="text" maxLength={5000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message or paste a link" aria-label="Group chat message" />
            <button className="min-h-12 shrink-0 rounded-xl border-0 bg-button px-4 font-bold text-[#f4fff7] hover:enabled:bg-button-hover disabled:cursor-not-allowed disabled:bg-[#1b2529] disabled:text-[#718080]" type="submit" disabled={!draft.trim()}>Send</button>
          </form>
        )}
      </div>
    </section>
    </>
  );
}
