import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, ConfirmDialog } from "../components/ui.jsx";

const MESSAGE_MENU_WIDTH = 144;
const MESSAGE_MENU_HEIGHT = 88;

function formatMessageTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMessageDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDate(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  );

  if (getMessageDateKey(date) === getMessageDateKey(today)) return "Today";
  if (getMessageDateKey(date) === getMessageDateKey(yesterday))
    return "Yesterday";

  const options = { month: "short", day: "numeric" };
  if (date.getFullYear() !== today.getFullYear()) options.year = "numeric";
  return date.toLocaleDateString([], options);
}

function formatMessageClockTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatConversationListTime(value) {
  const date = new Date(value);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const dateDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = Math.floor((todayDay - dateDay) / 86_400_000);

  if (daysAgo > 0 && daysAgo <= 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getMessageMenuPosition(trigger) {
  const bounds = trigger.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const opensUp = viewportHeight - bounds.bottom < MESSAGE_MENU_HEIGHT + 8;
  const top = opensUp
    ? Math.max(8, bounds.top - MESSAGE_MENU_HEIGHT - 4)
    : Math.min(bounds.bottom + 4, viewportHeight - MESSAGE_MENU_HEIGHT - 8);
  const maxLeft = Math.max(8, window.innerWidth - MESSAGE_MENU_WIDTH - 8);
  const left = Math.min(
    Math.max(8, bounds.right - MESSAGE_MENU_WIDTH),
    maxLeft,
  );

  return { top, left };
}

function renderMessageContent(content) {
  return content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    try {
      const url = new URL(part);
      if (!["http:", "https:"].includes(url.protocol)) return part;
      return (
        <a
          className="break-all text-accent-light underline"
          href={url.href}
          target="_blank"
          rel="noreferrer noopener"
          key={`${url.href}-${index}`}
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
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort(
    (first, second) => new Date(first.createdAt) - new Date(second.createdAt),
  );
}

export default function ChatPage({
  user,
  requestedConversationId,
  onConversationUrlChange,
}) {
  const [requests, setRequests] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagesHaveMore, setMessagesHaveMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isConversationDetailsOpen, setIsConversationDetailsOpen] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [olderMessagesError, setOlderMessagesError] = useState("");
  const [actionId, setActionId] = useState("");
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [isUpdatingMute, setIsUpdatingMute] = useState(false);
  const [collabspaceInviteOpen, setCollabspaceInviteOpen] = useState(false);
  const [collabspaceInviteConversation, setCollabspaceInviteConversation] =
    useState(null);
  const [collabspaceInviteOptions, setCollabspaceInviteOptions] = useState([]);
  const [collabspaceInviteLoading, setCollabspaceInviteLoading] =
    useState(false);
  const [collabspaceInviteSubmitting, setCollabspaceInviteSubmitting] =
    useState(false);
  const [collabspaceInviteId, setCollabspaceInviteId] = useState("");
  const [collabspaceInviteSearch, setCollabspaceInviteSearch] = useState("");
  const [collabspaceInviteError, setCollabspaceInviteError] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingDraft, setEditingDraft] = useState("");
  const [messageActionId, setMessageActionId] = useState("");
  const [openMessageMenu, setOpenMessageMenu] = useState(null);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const closeConfirmation = useCallback(() => setConfirmation(null), []);
  const [draft, setDraft] = useState("");
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [socketError, setSocketError] = useState("");
  const [pendingMessages, setPendingMessages] = useState([]);
  const messageLoadId = useRef(0);
  const invitationNoticeRef = useRef(null);
  const messageMenuRef = useRef(null);
  const messageMenuTriggerRef = useRef(null);
  const previousRequestedConversationId = useRef(requestedConversationId);
  const socketRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const pendingMessagesRef = useRef([]);
  selectedConversationRef.current = selectedConversation;
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    if (message === "Invitation sent.") {
      invitationNoticeRef.current?.scrollIntoView({
        block: "end",
        behavior: "smooth",
      });
    }
  }, [message]);

  useEffect(() => {
    if (!collabspaceInviteOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !collabspaceInviteSubmitting)
        setCollabspaceInviteOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [collabspaceInviteOpen, collabspaceInviteSubmitting]);

  useEffect(() => {
    if (!isConversationDetailsOpen || collabspaceInviteOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsConversationDetailsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [collabspaceInviteOpen, isConversationDetailsOpen]);

  const openMessageMenuId = openMessageMenu?.message.id ?? null;
  useEffect(() => {
    if (!openMessageMenuId) return undefined;

    const closeOnOutsidePointer = (event) => {
      if (
        messageMenuRef.current?.contains(event.target) ||
        messageMenuTriggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpenMessageMenu(null);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpenMessageMenu(null);
      messageMenuTriggerRef.current?.focus();
    };
    const updateMenuPosition = () => {
      const trigger = messageMenuTriggerRef.current;
      if (!trigger?.isConnected) {
        setOpenMessageMenu(null);
        return;
      }
      const position = getMessageMenuPosition(trigger);
      setOpenMessageMenu((current) =>
        current?.message.id === openMessageMenuId
          ? { ...current, ...position }
          : current,
      );
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [openMessageMenuId]);

  function updatePendingMessages(updater) {
    const nextMessages = updater(pendingMessagesRef.current);
    pendingMessagesRef.current = nextMessages;
    setPendingMessages(nextMessages);
  }

  function toggleMessageMenu(chatMessage, event) {
    if (openMessageMenu?.message.id === chatMessage.id) {
      setOpenMessageMenu(null);
      return;
    }
    const trigger = event.currentTarget;
    messageMenuTriggerRef.current = trigger;
    setOpenMessageMenu({
      message: chatMessage,
      ...getMessageMenuPosition(trigger),
    });
  }

  const loadChatData = useCallback(async () => {
    try {
      const [requestsResponse, conversationsResponse] = await Promise.all([
        fetch("/api/chat/requests/incoming"),
        fetch("/api/chat/conversations"),
      ]);
      const [requestsResult, conversationsResult] = await Promise.all([
        requestsResponse.json(),
        conversationsResponse.json(),
      ]);
      setLoadError("");
      if (!requestsResponse.ok)
        throw new Error(
          requestsResult.error?.message ?? "Could not load chat requests.",
        );
      if (!conversationsResponse.ok)
        throw new Error(
          conversationsResult.error?.message ?? "Could not load conversations.",
        );
      setRequests(requestsResult.requests ?? []);
      setConversations(conversationsResult.conversations ?? []);
    } catch (error) {
      setLoadError(error.message || "Could not reach the server. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadChatData, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadChatData]);

  const markReadThrough = useCallback(
    async (conversationId, throughMessageId) => {
      if (!throughMessageId) return false;
      try {
        const response = await fetch(
          `/api/chat/conversations/${encodeURIComponent(conversationId)}/read`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ throughMessageId }),
          },
        );
        if (!response.ok) return false;
        const result = await response.json();
        setConversations((current) =>
          current.map((item) =>
            item.id === conversationId
              ? { ...item, unreadCount: result.unreadCount ?? 0 }
              : item,
          ),
        );
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const openConversation = useCallback(
    async (conversation) => {
      onConversationUrlChange?.(conversation.id);
      setOpenMessageMenu(null);
      setIsConversationDetailsOpen(false);
      const loadId = ++messageLoadId.current;
      setSelectedConversation(conversation);
      setSelectedRequest(null);
      setMessages([]);
      setMessagesHaveMore(false);
      setMessagesError("");
      setOlderMessagesError("");
      setMessage("");
      setIsLoadingMessages(true);
      try {
        const response = await fetch(
          `/api/chat/conversations/${encodeURIComponent(conversation.id)}/messages`,
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error?.message ?? "Could not load conversation messages.",
          );
        if (messageLoadId.current !== loadId) return;
        setMessages(result.messages ?? []);
        setMessagesHaveMore(Boolean(result.hasMore));
        await markReadThrough(conversation.id, result.messages?.at(-1)?.id);
      } catch (error) {
        if (messageLoadId.current === loadId)
          setMessagesError(
            error.message || "Could not reach the server. Try again.",
          );
      } finally {
        if (messageLoadId.current === loadId) setIsLoadingMessages(false);
      }
    },
    [markReadThrough, onConversationUrlChange],
  );

  useEffect(() => {
    if (!requestedConversationId) {
      if (previousRequestedConversationId.current) {
        const timeoutId = window.setTimeout(() => {
          messageLoadId.current += 1;
          setSelectedConversation(null);
          setSelectedRequest(null);
          setMessages([]);
          setMessagesHaveMore(false);
          setMessagesError("");
        }, 0);
        previousRequestedConversationId.current = "";
        return () => window.clearTimeout(timeoutId);
      }
      previousRequestedConversationId.current = "";
      return undefined;
    }
    previousRequestedConversationId.current = requestedConversationId;
    if (isLoading || loadError) return undefined;
    const conversation = conversations.find(
      (item) => item.id === requestedConversationId,
    );
    if (!conversation) {
      const timeoutId = window.setTimeout(() => {
        setMessage(
          "This private conversation is not available for your account.",
        );
        onConversationUrlChange?.("", "replaceState");
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    if (selectedConversationRef.current?.id === conversation.id)
      return undefined;
    const timeoutId = window.setTimeout(() => {
      openConversation(conversation);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [
    conversations,
    isLoading,
    loadError,
    onConversationUrlChange,
    openConversation,
    requestedConversationId,
  ]);

  async function loadOlderMessages() {
    if (
      !selectedConversation ||
      !messagesHaveMore ||
      isLoadingOlder ||
      !messages.length
    )
      return;
    setIsLoadingOlder(true);
    setOlderMessagesError("");
    try {
      const cursor = messages[0].id;
      const response = await fetch(
        `/api/chat/conversations/${encodeURIComponent(selectedConversation.id)}/messages?before=${encodeURIComponent(cursor)}`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not load older messages.",
        );
      setMessages((current) => [...(result.messages ?? []), ...current]);
      setMessagesHaveMore(Boolean(result.hasMore));
    } catch (error) {
      setOlderMessagesError(error.message || "Could not load older messages.");
    } finally {
      setIsLoadingOlder(false);
    }
  }

  useEffect(() => {
    if (!user?.id) return undefined;
    let disposed = false;
    let retryTimer;
    let retryDelay = 500;
    let socket;
    const reconciledMessageIds = new Set();

    const appendMessage = (chatMessage) => {
      const active = selectedConversationRef.current;
      const hasConversation = conversationsRef.current.some(
        (item) => item.id === chatMessage.conversationId,
      );
      setConversations((current) => {
        const existing = current.find(
          (item) => item.id === chatMessage.conversationId,
        );
        if (!existing) return current;
        const isOpenAndVisible =
          active?.id === chatMessage.conversationId &&
          document.visibilityState === "visible";
        const updated = {
          ...existing,
          lastMessage: chatMessage,
          unreadCount:
            chatMessage.senderId === user.id || isOpenAndVisible
              ? existing.unreadCount
              : existing.unreadCount + 1,
        };
        return [
          updated,
          ...current.filter((item) => item.id !== chatMessage.conversationId),
        ].sort(
          (first, second) =>
            new Date(second.lastMessage?.createdAt ?? second.createdAt) -
            new Date(first.lastMessage?.createdAt ?? first.createdAt),
        );
      });
      if (!hasConversation) {
        fetch("/api/chat/conversations")
          .then((response) => response.json())
          .then((result) => {
            if (!disposed) setConversations(result.conversations ?? []);
          })
          .catch(() => {});
      }
      if (active?.id === chatMessage.conversationId) {
        setMessages((current) =>
          current.some((item) => item.id === chatMessage.id)
            ? current
            : [...current, chatMessage],
        );
        if (chatMessage.senderId === user.id) {
          updatePendingMessages((current) =>
            current.filter(
              (item) => item.clientMessageId !== chatMessage.clientMessageId,
            ),
          );
        } else if (document.visibilityState === "visible") {
          markReadThrough(chatMessage.conversationId, chatMessage.id).catch(
            () => {},
          );
        }
      }
    };

    const refreshSelectedConversation = async () => {
      const active = selectedConversationRef.current;
      const historyByConversation = new Map();
      if (active) {
        try {
          const response = await fetch(
            `/api/chat/conversations/${encodeURIComponent(active.id)}/messages`,
          );
          const result = await response.json();
          if (
            !response.ok ||
            disposed ||
            selectedConversationRef.current?.id !== active.id
          )
            return;
          const history = result.messages ?? [];
          historyByConversation.set(active.id, history);
          setMessages((current) => mergeMessages(current, history));
          setMessagesHaveMore(Boolean(result.hasMore));
          await markReadThrough(active.id, history.at(-1)?.id);
        } catch {
          setSocketError("Could not refresh chat history after reconnecting.");
        }
      } else {
        await loadChatData();
      }

      const pendingGroups = new Map();
      for (const pending of pendingMessagesRef.current) {
        const group = pendingGroups.get(pending.conversationId) ?? [];
        group.push(pending);
        pendingGroups.set(pending.conversationId, group);
      }
      for (const [conversationId, pendingGroup] of pendingGroups) {
        if (!historyByConversation.has(conversationId)) {
          try {
            const response = await fetch(
              `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
            );
            if (!response.ok) continue;
            const result = await response.json();
            historyByConversation.set(conversationId, result.messages ?? []);
          } catch {
            continue;
          }
        }
        const knownMessageIds = new Set(
          historyByConversation
            .get(conversationId)
            .map((item) => item.clientMessageId)
            .filter(Boolean),
        );
        const confirmedIds = new Set(
          pendingGroup
            .filter((item) => knownMessageIds.has(item.clientMessageId))
            .map((item) => item.clientMessageId),
        );
        if (confirmedIds.size) {
          updatePendingMessages((current) =>
            current.filter((item) => !confirmedIds.has(item.clientMessageId)),
          );
        }
        for (const pending of pendingGroup) {
          if (
            !knownMessageIds.has(pending.clientMessageId) &&
            socket?.readyState === WebSocket.OPEN
          ) {
            socket.send(
              JSON.stringify({
                type: "message.send",
                conversationId: pending.conversationId,
                clientMessageId: pending.clientMessageId,
                content: pending.content,
              }),
            );
          }
        }
      }
    };

    const connect = () => {
      if (disposed) return;
      setSocketStatus("connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${window.location.host}/api/chat/socket`,
      );
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        retryDelay = 500;
        setSocketStatus("connected");
        setSocketError("");
        refreshSelectedConversation();
      });
      socket.addEventListener("message", (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.type === "conversation.ended") {
          setConversations((current) =>
            current.filter((item) => item.id !== payload.conversationId),
          );
          updatePendingMessages((current) =>
            current.filter(
              (item) => item.conversationId !== payload.conversationId,
            ),
          );
          if (selectedConversationRef.current?.id === payload.conversationId) {
            messageLoadId.current += 1;
            setSelectedConversation(null);
            onConversationUrlChange?.("");
            setMessages([]);
            setMessagesHaveMore(false);
            setMessagesError("");
            setMessage(
              "This conversation was ended by a participant, and its messages were deleted.",
            );
          }
        } else if (
          payload.type === "message.created" ||
          payload.type === "message.ack"
        ) {
          appendMessage(payload.message);
          if (payload.type === "message.ack") {
            updatePendingMessages((current) =>
              current.filter(
                (item) => item.clientMessageId !== payload.clientMessageId,
              ),
            );
          }
        } else if (payload.type === "message.updated") {
          setMessages((current) =>
            current.map((item) =>
              item.id === payload.message.id ? payload.message : item,
            ),
          );
          setConversations((current) =>
            current.map((item) =>
              item.id === payload.message.conversationId &&
              item.lastMessage?.id === payload.message.id
                ? { ...item, lastMessage: payload.message }
                : item,
            ),
          );
        } else if (payload.type === "message.deleted") {
          setMessages((current) =>
            current.filter((item) => item.id !== payload.messageId),
          );
          fetch("/api/chat/conversations")
            .then((response) =>
              response.json().then((result) => ({ response, result })),
            )
            .then(({ response, result }) => {
              if (response.ok && !disposed)
                setConversations(result.conversations ?? []);
            })
            .catch(() => {});
        } else if (payload.type === "error") {
          setSocketError(payload.message ?? "The message could not be sent.");
          if (
            ["MESSAGE_SEND_FAILED", "MESSAGE_RETRY"].includes(payload.code) &&
            payload.clientMessageId &&
            !reconciledMessageIds.has(payload.clientMessageId)
          ) {
            reconciledMessageIds.add(payload.clientMessageId);
            window.setTimeout(refreshSelectedConversation, 250);
          }
          if (
            payload.clientMessageId &&
            !["MESSAGE_SEND_FAILED", "MESSAGE_RETRY"].includes(payload.code)
          ) {
            const failedMessage = pendingMessagesRef.current.find(
              (item) => item.clientMessageId === payload.clientMessageId,
            );
            if (failedMessage)
              setDraft((current) => current || failedMessage.content);
            updatePendingMessages((current) =>
              current.filter(
                (item) => item.clientMessageId !== payload.clientMessageId,
              ),
            );
          }
        }
      });
      socket.addEventListener("close", (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed) return;
        if (event.code === 4401) {
          setSocketStatus("offline");
          setSocketError(
            "Your session expired. Sign in again to send messages.",
          );
          return;
        }
        setSocketStatus("reconnecting");
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10000);
      });
      socket.addEventListener("error", () => {
        setSocketError("Chat connection interrupted. Reconnecting...");
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSelectedConversation();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const initialTimer = window.setTimeout(connect, 0);
    return () => {
      disposed = true;
      window.clearTimeout(initialTimer);
      window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (socketRef.current === socket) socketRef.current = null;
      socket?.close(1000, "Chat view closed");
    };
  }, [loadChatData, markReadThrough, onConversationUrlChange, user?.id]);

  async function handleDecision(requestId, status) {
    setActionId(requestId);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat/requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not update the chat request.",
        );
      const acceptedRequest = requests.find(
        (request) => request.id === requestId,
      );
      setRequests((current) =>
        current.filter((request) => request.id !== requestId),
      );
      if (status === "ACCEPTED") {
        setSelectedRequest(null);
        const refreshed = await fetch("/api/chat/conversations");
        const refreshedResult = await refreshed.json();
        if (!refreshed.ok)
          throw new Error(
            refreshedResult.error?.message ??
              "Conversation created, but the list could not refresh.",
          );
        const updatedConversations = refreshedResult.conversations ?? [];
        setConversations(updatedConversations);
        const conversation = updatedConversations.find(
          (item) => item.id === result.conversation.id,
        );
        if (conversation) {
          await openConversation(conversation);
        } else {
          const fallbackConversation = {
            ...result.conversation,
            participant: acceptedRequest?.sender ?? {
              name: "Developer",
              username: "",
            },
            lastMessage: null,
            unreadCount: 0,
          };
          setSelectedConversation(fallbackConversation);
          setMessages([]);
        }
      } else {
        if (selectedRequest?.id === requestId) setSelectedRequest(null);
        setMessage("Request declined.");
      }
    } catch (error) {
      setMessage(error.message || "Could not reach the server. Try again.");
    } finally {
      setActionId("");
    }
  }

  function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    const socket = socketRef.current;
    if (!content || !selectedConversation) return;
    if (socket?.readyState !== WebSocket.OPEN) {
      setSocketError(
        "Chat is reconnecting. Your draft is still here; try again when connected.",
      );
      return;
    }

    const clientMessageId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const pending = {
      conversationId: selectedConversation.id,
      clientMessageId,
      content,
      createdAt: new Date().toISOString(),
    };
    updatePendingMessages((current) => [...current, pending]);
    try {
      socket.send(JSON.stringify({ type: "message.send", ...pending }));
      setDraft("");
      setSocketError("");
    } catch {
      updatePendingMessages((current) =>
        current.filter((item) => item.clientMessageId !== clientMessageId),
      );
      setSocketError(
        "Could not send the message. Your draft is still here; try again.",
      );
    }
  }

  async function saveMessageEdit(chatMessage) {
    const content = editingDraft.trim();
    if (!content || content.length > 5000 || messageActionId) return;
    setMessageActionId(chatMessage.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat/conversations/${encodeURIComponent(selectedConversation.id)}/messages/${encodeURIComponent(chatMessage.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not edit this message.",
        );
      setMessages((current) =>
        current.map((item) =>
          item.id === chatMessage.id ? result.message : item,
        ),
      );
      setEditingMessageId("");
      setEditingDraft("");
    } catch (error) {
      setMessage(error.message || "Could not reach the server. Try again.");
    } finally {
      setMessageActionId("");
    }
  }

  async function deleteMessage(chatMessage) {
    if (!selectedConversation || messageActionId) return;
    setMessageActionId(chatMessage.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat/conversations/${encodeURIComponent(selectedConversation.id)}/messages/${encodeURIComponent(chatMessage.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.error?.message ?? "Could not delete this message.",
        );
      }
      setMessages((current) =>
        current.filter((item) => item.id !== chatMessage.id),
      );
      setEditingMessageId("");
      setEditingDraft("");
      const conversationsResponse = await fetch("/api/chat/conversations");
      const conversationsResult = await conversationsResponse.json();
      if (conversationsResponse.ok)
        setConversations(conversationsResult.conversations ?? []);
    } catch (error) {
      setMessage(error.message || "Could not reach the server. Try again.");
    } finally {
      setMessageActionId("");
    }
  }

  function requestDeleteMessage(chatMessage) {
    if (!selectedConversation || messageActionId) return;
    setConfirmation({
      title: "Delete message?",
      description: "This message will be deleted for both participants.",
      confirmLabel: "Delete message",
      onConfirm: () => deleteMessage(chatMessage),
    });
  }

  function retryPendingMessage(pending) {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      setSocketError(
        "Chat is reconnecting. The message will be checked when you reconnect.",
      );
      return;
    }
    socket.send(
      JSON.stringify({
        type: "message.send",
        conversationId: pending.conversationId,
        clientMessageId: pending.clientMessageId,
        content: pending.content,
      }),
    );
    setSocketError("");
  }

  function closeConversation() {
    messageLoadId.current += 1;
    setSelectedConversation(null);
    setSelectedRequest(null);
    setIsConversationDetailsOpen(false);
    setMessages([]);
    setMessagesHaveMore(false);
    setMessagesError("");
    onConversationUrlChange?.("");
  }

  async function toggleConversationMute(conversation = selectedConversation) {
    if (!conversation || isUpdatingMute) return;
    const muted = !conversation.isMuted;
    setIsUpdatingMute(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat/conversations/${encodeURIComponent(conversation.id)}/mute`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ muted }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not update mute settings.",
        );
      setSelectedConversation((current) =>
        current?.id === conversation.id
          ? { ...current, isMuted: result.muted }
          : current,
      );
      setConversations((current) =>
        current.map((item) =>
          item.id === conversation.id
            ? { ...item, isMuted: result.muted }
            : item,
        ),
      );
    } catch (error) {
      setMessage(error.message || "Could not reach the server. Try again.");
    } finally {
      setIsUpdatingMute(false);
    }
  }

  async function openCollabspaceInvite(conversation = selectedConversation) {
    if (!conversation) return;
    if (selectedConversation?.id !== conversation.id)
      void openConversation(conversation);
    setCollabspaceInviteConversation(conversation);
    setCollabspaceInviteOpen(true);
    setCollabspaceInviteLoading(true);
    setCollabspaceInviteError("");
    setCollabspaceInviteSearch("");
    try {
      const response = await fetch("/api/invitations/options");
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not load your Collabspaces.",
        );
      const spaces = result.collabspaces ?? [];
      setCollabspaceInviteOptions(spaces);
      setCollabspaceInviteId((current) =>
        spaces.some((space) => space.id === current)
          ? current
          : (spaces[0]?.id ?? ""),
      );
    } catch (error) {
      setCollabspaceInviteError(
        error.message || "Could not load your Collabspaces.",
      );
    } finally {
      setCollabspaceInviteLoading(false);
    }
  }

  async function sendCollabspaceInvitation(event) {
    event.preventDefault();
    if (
      !collabspaceInviteConversation ||
      !collabspaceInviteId ||
      collabspaceInviteSubmitting
    )
      return;
    setCollabspaceInviteSubmitting(true);
    setCollabspaceInviteError("");
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: collabspaceInviteConversation.participant.id,
          type: "COLLABSPACE_INVITATION",
          workspaceId: collabspaceInviteId,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not send the Collabspace invitation.",
        );
      setCollabspaceInviteOpen(false);
      setMessage("Invitation sent.");
    } catch (error) {
      setCollabspaceInviteError(
        error.message || "Could not reach the server. Try again.",
      );
    } finally {
      setCollabspaceInviteSubmitting(false);
    }
  }

  async function deleteConversation(conversation = selectedConversation) {
    if (!conversation || isDeletingConversation) return;
    setIsDeletingConversation(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat/conversations/${encodeURIComponent(conversation.id)}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.error?.message ?? "Could not delete this conversation.",
        );
      }
      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );
      updatePendingMessages((current) =>
        current.filter((item) => item.conversationId !== conversation.id),
      );
      if (selectedConversationRef.current?.id === conversation.id) {
        messageLoadId.current += 1;
        setSelectedConversation(null);
        setIsConversationDetailsOpen(false);
        onConversationUrlChange?.("");
        setMessages([]);
        setMessagesHaveMore(false);
        setMessagesError("");
        setMessage("Conversation deleted for both participants.");
      }
    } catch (error) {
      setMessage(error.message || "Could not reach the server. Try again.");
    } finally {
      setIsDeletingConversation(false);
    }
  }

  function requestDeleteConversation(conversation = selectedConversation) {
    if (!conversation || isDeletingConversation) return;
    setConfirmation({
      title: `Delete chat with ${conversation.participant.name}?`,
      description:
        "This removes the conversation and all its messages for both participants, and ends the chat. This cannot be undone.",
      confirmLabel: "Delete chat",
      onConfirm: () => deleteConversation(conversation),
    });
  }

  function openRequest(request) {
    messageLoadId.current += 1;
    setOpenMessageMenu(null);
    setSelectedConversation(null);
    setIsConversationDetailsOpen(false);
    onConversationUrlChange?.("");
    setSelectedRequest(request);
    setMessages([]);
    setMessagesHaveMore(false);
    setMessagesError("");
    setOlderMessagesError("");
    setMessage("");
  }

  const panelClass = "h-full min-h-0";
  const hasSelectedChatItem = Boolean(selectedConversation || selectedRequest);
  const showConversationDetails = Boolean(
    isConversationDetailsOpen && selectedConversation,
  );
  const normalizedConversationSearch = conversationSearch
    .trim()
    .toLocaleLowerCase();
  const visibleConversations = conversations.filter((conversation) =>
    [conversation.participant.name, conversation.participant.username].some(
      (value) =>
        value?.toLocaleLowerCase().includes(normalizedConversationSearch),
    ),
  );
  const filteredCollabspaceInviteOptions = collabspaceInviteOptions.filter(
    (space) =>
      space.name
        .toLocaleLowerCase()
        .includes(collabspaceInviteSearch.trim().toLocaleLowerCase()),
  );

  return (
    <section
      className="mx-0 h-[100dvh] min-h-0 w-full max-w-none min-w-0 p-0 max-[760px]:h-[calc(100dvh-68px-env(safe-area-inset-bottom))]"
      aria-label="Chat"
    >
      <ConfirmDialog confirmation={confirmation} onClose={closeConfirmation} />
      {openMessageMenu &&
        createPortal(
          <div
            ref={messageMenuRef}
            className="fixed z-[100] w-36 overflow-y-auto rounded-xl border border-[#303a3e] bg-[#171f23] p-1 shadow-[0_14px_32px_rgb(0_0_0_/_32%)]"
            id="chat-message-actions-menu"
            style={{
              top: openMessageMenu.top,
              left: openMessageMenu.left,
              maxHeight: "calc(100vh - 16px)",
            }}
            role="group"
            aria-label="Message actions"
          >
            <button
              className="min-h-9 w-full rounded-lg bg-transparent px-3 text-left font-semibold text-ink hover:bg-[#222d31] disabled:opacity-50"
              type="button"
              disabled={Boolean(messageActionId)}
              onClick={() => {
                const chatMessage = openMessageMenu.message;
                setOpenMessageMenu(null);
                setEditingMessageId(chatMessage.id);
                setEditingDraft(chatMessage.content);
              }}
            >
              Edit
            </button>
            <button
              className="min-h-9 w-full rounded-lg bg-transparent px-3 text-left font-semibold text-[#ff9ba3] hover:bg-[#222d31] disabled:opacity-50"
              type="button"
              disabled={Boolean(messageActionId)}
              onClick={() => {
                const chatMessage = openMessageMenu.message;
                setOpenMessageMenu(null);
                requestDeleteMessage(chatMessage);
              }}
            >
              {messageActionId === openMessageMenu.message.id
                ? "Deleting..."
                : "Delete"}
            </button>
          </div>,
          document.body,
        )}
      <div className="h-full w-full">
        {loadError ? (
          <div
            className={`${panelClass} grid place-items-center rounded-2xl border border-[#252d31] bg-surface p-6 text-center max-[760px]:rounded-none max-[760px]:border-x-0`}
            role="alert"
          >
            <div>
              <p className="text-[#aebabb]">{loadError}</p>
              <Button
                className="mt-4"
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  loadChatData();
                }}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid h-full grid-cols-[310px_minmax(0,_1fr)] overflow-hidden border-y border-[#252d31] bg-surface max-[900px]:grid-cols-1 max-[760px]:h-full max-[760px]:border-x-0 max-[760px]:border-t-0">
            <aside
              className={`${panelClass} overflow-y-auto border-r border-[#252d31] bg-surface max-[900px]:border-r-0 ${hasSelectedChatItem ? "max-[900px]:hidden" : "max-[900px]:bg-transparent"}`}
              aria-label="Chats and incoming requests"
            >
              <div className="px-4 py-4">
                <label className="sr-only" htmlFor="conversation-search">
                  Search conversations
                </label>
                <div className="relative">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[#748486]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                  </svg>
                  <input
                    id="conversation-search"
                    name="conversation-search"
                    className="h-12 rounded-xl border-[#29332f] bg-composer pl-10 pr-3.5 text-sm text-ink placeholder:text-[#788588] focus:border-[#48C97B]"
                    type="search"
                    autoComplete="off"
                    value={conversationSearch}
                    onChange={(event) =>
                      setConversationSearch(event.target.value)
                    }
                    placeholder="Search conversations"
                  />
                </div>
              </div>
              {isLoading ? (
                <p className="p-5 text-sm text-[#aebabb]" role="status">
                  Loading conversations...
                </p>
              ) : visibleConversations.length > 0 ? (
                <ul className="m-3 grid list-none gap-2 p-0">
                  {visibleConversations.map((conversation) => (
                    <li
                      className={`relative rounded-xl border transition-colors ${selectedConversation?.id === conversation.id ? "border-[#29332f] bg-selected" : "border-[#252d31] hover:border-[#3a4944]"}`}
                      key={conversation.id}
                    >
                      {selectedConversation?.id === conversation.id && (
                        <span
                          className="pointer-events-none absolute bottom-3 left-px top-3 w-[3px] rounded-r bg-selection"
                          aria-hidden="true"
                        />
                      )}
                      <button
                        type="button"
                        className="flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#182023] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#48C97B]"
                        onClick={() => openConversation(conversation)}
                        aria-current={
                          selectedConversation?.id === conversation.id
                            ? "true"
                            : undefined
                        }
                      >
                        <span
                          className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#24322f] font-semibold text-[#68D996]"
                          aria-hidden="true"
                        >
                          {conversation.participant.name
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate font-medium text-ink">
                              {conversation.participant.name}
                            </span>
                            {conversation.lastMessage && (
                              <time
                                className="shrink-0 text-xs text-[#aebabb]"
                                dateTime={conversation.lastMessage.createdAt}
                              >
                                {formatConversationListTime(
                                  conversation.lastMessage.createdAt,
                                )}
                              </time>
                            )}
                          </span>
                          <span className="mt-1 block truncate text-xs text-[#aebabb]">
                            {conversation.lastMessage
                              ? `${conversation.lastMessage.senderId === user?.id ? "You: " : ""}${conversation.lastMessage.content}`
                              : `@${conversation.participant.username}`}
                          </span>
                        </span>
                        {conversation.unreadCount > 0 && (
                          <span
                            className="grid min-w-6 place-items-center rounded-full bg-[#68D996] px-2 py-1 text-xs font-bold text-[#0b1113]"
                            aria-label={`${conversation.unreadCount} unread messages`}
                          >
                            {conversation.unreadCount}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p
                  className="m-0 px-5 py-4 text-sm text-[#aebabb]"
                  role="status"
                >
                  {conversations.length > 0
                    ? "No conversations match your search."
                    : "No conversations yet."}
                </p>
              )}

              {requests.length > 0 && (
                <section
                  className={`${conversations.length > 0 ? "border-t border-[#252d31]" : ""} px-5 py-4`}
                  aria-labelledby="incoming-chat-requests-heading"
                >
                  <h2
                    className="m-0 text-sm font-semibold text-ink"
                    id="incoming-chat-requests-heading"
                  >
                    Incoming requests
                  </h2>
                  <ul className="mt-3 grid list-none gap-3 p-0">
                    {requests.map((request) => (
                      <li key={request.id}>
                        <button
                          className={`flex w-full items-center gap-3 rounded-xl border border-[#252d31] px-3 py-3 text-left hover:bg-[#182023] ${selectedRequest?.id === request.id ? "bg-[#182023]" : "bg-transparent"}`}
                          type="button"
                          onClick={() => openRequest(request)}
                          aria-current={
                            selectedRequest?.id === request.id
                              ? "true"
                              : undefined
                          }
                        >
                          <span
                            className="grid size-10 shrink-0 place-items-center rounded-full bg-[#24322f] font-semibold text-[#68D996]"
                            aria-hidden="true"
                          >
                            {request.sender.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">
                              {request.sender.name}
                            </span>
                            <span className="mt-1 block truncate text-xs text-[#aebabb]">
                              @{request.sender.username}
                            </span>
                          </span>
                          <time
                            className="shrink-0 text-xs text-[#aebabb]"
                            dateTime={request.createdAt}
                          >
                            {formatMessageTime(request.createdAt)}
                          </time>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>

            <div
              className={`relative h-full min-w-0 overflow-hidden ${!hasSelectedChatItem ? "max-[900px]:hidden" : ""}`}
            >
              <section
                className={`${panelClass} flex min-w-0 flex-col overflow-hidden bg-chat`}
                aria-label="Private conversation"
              >
                {selectedRequest ? (
                  <>
                    <header className="flex items-center gap-3 border-b border-[#252d31] bg-chat-header px-5 py-4">
                      <button
                        className="hidden size-10 shrink-0 place-items-center rounded-full text-[#68D996] hover:bg-[#20292d] max-[900px]:inline-grid"
                        type="button"
                        onClick={closeConversation}
                        aria-label="Back to chats"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="size-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
                        </svg>
                      </button>
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-[#24322f] font-semibold text-[#68D996]"
                        aria-hidden="true"
                      >
                        {selectedRequest.sender.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h2 className="m-0 truncate text-base font-semibold text-ink">
                          {selectedRequest.sender.name}
                        </h2>
                        <a
                          className="text-sm text-[#aebabb] hover:text-[#68D996]"
                          href={`/profile/${encodeURIComponent(selectedRequest.sender.username)}`}
                        >
                          @{selectedRequest.sender.username}
                        </a>
                      </div>
                    </header>
                    <div className="grid flex-1 place-items-center p-6 text-center">
                      <div>
                        <p className="m-0 text-sm text-[#aebabb]">
                          This developer wants to start a private chat.
                        </p>
                        {message && (
                          <p
                            className="mt-3 text-sm text-[#aebabb]"
                            role="status"
                          >
                            {message}
                          </p>
                        )}
                        <div className="mt-5 flex justify-center gap-3">
                          <Button
                            className="[width:auto]"
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() =>
                              handleDecision(selectedRequest.id, "ACCEPTED")
                            }
                          >
                            {actionId === selectedRequest.id
                              ? "Opening chat..."
                              : "Accept"}
                          </Button>
                          <Button
                            variant="secondary"
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() =>
                              handleDecision(selectedRequest.id, "DECLINED")
                            }
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : selectedConversation ? (
                  <>
                    <header className="relative border-b border-[#252d31] bg-chat-header">
                      <div className="relative ml-4 flex w-[calc(100%-16px)] max-w-[720px] items-center gap-3 py-4 pr-3 min-[761px]:mx-auto min-[761px]:w-[calc(100%-64px)]">
                        <button
                          className="hidden size-10 shrink-0 place-items-center rounded-full text-[#68D996] hover:bg-[#20292d] max-[900px]:inline-grid"
                          type="button"
                          onClick={closeConversation}
                          aria-label="Back to chats"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="size-6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
                          </svg>
                        </button>
                        <span
                          className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#24322f] font-semibold text-[#68D996] min-[1025px]:absolute min-[1025px]:-left-[56px]"
                          aria-hidden="true"
                        >
                          {selectedConversation.participant.name
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <h2 className="m-0 truncate text-base font-semibold text-ink">
                            {selectedConversation.participant.name}
                          </h2>
                          <a
                            className="text-sm text-[#aebabb] hover:text-[#68D996]"
                            href={`/profile/${encodeURIComponent(selectedConversation.participant.username)}`}
                          >
                            @{selectedConversation.participant.username}
                          </a>
                        </div>
                      </div>
                      <button
                        className={`absolute right-7 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-[#aebabb] hover:bg-[#20292d] hover:text-ink focus-visible:outline-2 focus-visible:outline-[#48C97B] max-[760px]:right-4 ${showConversationDetails ? "bg-[#20292d] text-ink" : ""}`}
                        type="button"
                        aria-label="Conversation details"
                        aria-expanded={showConversationDetails}
                        aria-controls="conversation-details-panel"
                        onClick={() =>
                          setIsConversationDetailsOpen((current) => !current)
                        }
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="size-5"
                          fill="currentColor"
                        >
                          <circle cx="5" cy="12" r="1.7" />
                          <circle cx="12" cy="12" r="1.7" />
                          <circle cx="19" cy="12" r="1.7" />
                        </svg>
                      </button>
                    </header>
                    <div className="ml-4 flex w-[calc(100%-16px)] max-w-[720px] min-h-0 flex-1 flex-col overflow-hidden py-5 pl-0 pr-3 min-[761px]:mx-auto min-[761px]:w-[calc(100%-64px)]">
                      {message && message !== "Invitation sent." && (
                        <p
                          className="self-center text-sm text-[#aebabb]"
                          role="status"
                        >
                          {message}
                        </p>
                      )}
                      {olderMessagesError && (
                        <p
                          className="self-center text-sm text-[#f2bd79]"
                          role="alert"
                        >
                          {olderMessagesError}
                        </p>
                      )}
                      <div
                        key={selectedConversation.id}
                        className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex min-h-0 flex-1 flex-col-reverse gap-3 overflow-y-auto"
                        aria-live="polite"
                        aria-label="Conversation messages"
                      >
                        {isLoadingMessages ? (
                          <p
                            className="m-auto text-sm text-[#aebabb]"
                            role="status"
                          >
                            Loading messages...
                          </p>
                        ) : messagesError ? (
                          <div className="m-auto text-center" role="alert">
                            <p className="text-sm text-[#aebabb]">
                              {messagesError}
                            </p>
                            <Button
                              className="mt-3"
                              type="button"
                              onClick={() =>
                                openConversation(selectedConversation)
                              }
                            >
                              Try again
                            </Button>
                          </div>
                        ) : messages.length === 0 &&
                          !pendingMessages.some(
                            (item) =>
                              item.conversationId === selectedConversation.id,
                          ) ? (
                          <p className="m-auto max-w-sm text-center text-sm text-[#aebabb]">
                            This is the start of your private conversation.
                            Messages will be available here next.
                          </p>
                        ) : (
                          [
                            ...messages,
                            ...pendingMessages.filter(
                              (item) =>
                                item.conversationId === selectedConversation.id,
                            ),
                          ]
                            .sort(
                              (first, second) =>
                                new Date(first.createdAt) -
                                new Date(second.createdAt),
                            )
                            .reverse()
                            .map(
                              (
                                chatMessage,
                                messageIndex,
                                conversationMessages,
                              ) => {
                                const olderMessage =
                                  conversationMessages[messageIndex + 1];
                                const startsNewDay =
                                  !olderMessage ||
                                  getMessageDateKey(olderMessage.createdAt) !==
                                    getMessageDateKey(chatMessage.createdAt);
                                const isOwnMessage =
                                  chatMessage.senderId !==
                                  selectedConversation.participant.id;
                                const isEditing =
                                  editingMessageId === chatMessage.id;
                                return (
                                  <div
                                    className="flex w-full flex-col"
                                    key={
                                      chatMessage.id ??
                                      chatMessage.clientMessageId
                                    }
                                  >
                                    {startsNewDay && (
                                      <div
                                        className="my-2 flex w-full justify-center"
                                        role="separator"
                                        aria-label={formatMessageDate(
                                          chatMessage.createdAt,
                                        )}
                                      >
                                        <span className="rounded-full border border-[#29332f] bg-surface px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                                          {formatMessageDate(
                                            chatMessage.createdAt,
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    <div
                                      className={`flex ${isEditing ? "w-full max-w-[600px]" : "max-w-[80%]"} flex-col ${isOwnMessage ? "self-end items-end" : "self-start items-start"}`}
                                    >
                                      <article
                                        className={`relative w-full rounded-2xl ${isEditing ? "border border-[#354044] bg-composer p-4 text-ink" : `px-4 py-3 ${isOwnMessage ? "bg-sent-message text-ink" : "bg-message text-ink"}`}`}
                                      >
                                        {isEditing ? (
                                          <div className="w-full">
                                            <textarea
                                              className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-h-20 w-full resize-none overflow-y-auto rounded-lg border-0 bg-transparent p-0 text-sm leading-6 text-ink outline-none focus-visible:shadow-none"
                                              maxLength={5000}
                                              value={editingDraft}
                                              onChange={(event) =>
                                                setEditingDraft(
                                                  event.target.value,
                                                )
                                              }
                                              aria-label="Edit message"
                                            />
                                            <div className="mt-4 flex justify-end gap-2">
                                              <button
                                                className="min-h-9 rounded-lg border border-[#354044] bg-transparent px-3 text-sm font-medium text-[#aebabb] hover:bg-[#20292d] hover:text-ink focus-visible:outline-2 focus-visible:outline-[#48C97B] disabled:opacity-50"
                                                type="button"
                                                disabled={
                                                  messageActionId ===
                                                  chatMessage.id
                                                }
                                                onClick={() => {
                                                  setEditingMessageId("");
                                                  setEditingDraft("");
                                                }}
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                className="min-h-9 rounded-lg border-0 bg-button px-4 text-sm font-semibold text-[#f4fff7] hover:bg-button-hover focus-visible:outline-2 focus-visible:outline-[#48C97B] disabled:cursor-not-allowed disabled:opacity-50"
                                                type="button"
                                                disabled={
                                                  !editingDraft.trim() ||
                                                  messageActionId ===
                                                    chatMessage.id
                                                }
                                                onClick={() =>
                                                  saveMessageEdit(chatMessage)
                                                }
                                              >
                                                {messageActionId ===
                                                chatMessage.id
                                                  ? "Saving…"
                                                  : "Save"}
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <p
                                            className={`m-0 whitespace-pre-wrap break-words text-sm ${isOwnMessage && chatMessage.id ? "pr-7" : ""}`}
                                          >
                                            {renderMessageContent(
                                              chatMessage.content,
                                            )}
                                          </p>
                                        )}
                                        {isOwnMessage &&
                                          chatMessage.id &&
                                          !isEditing && (
                                            <button
                                              className="absolute right-2 top-1 z-20 grid size-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[#b6c5c6] hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-[#48C97B]"
                                              type="button"
                                              aria-label="Message actions"
                                              aria-haspopup="true"
                                              aria-expanded={
                                                openMessageMenu?.message.id ===
                                                chatMessage.id
                                              }
                                              onClick={(event) =>
                                                toggleMessageMenu(
                                                  chatMessage,
                                                  event,
                                                )
                                              }
                                            >
                                              <svg
                                                aria-hidden="true"
                                                viewBox="0 0 24 24"
                                                className="size-4"
                                                fill="currentColor"
                                              >
                                                <circle
                                                  cx="5"
                                                  cy="12"
                                                  r="1.7"
                                                />
                                                <circle
                                                  cx="12"
                                                  cy="12"
                                                  r="1.7"
                                                />
                                                <circle
                                                  cx="19"
                                                  cy="12"
                                                  r="1.7"
                                                />
                                              </svg>
                                            </button>
                                          )}
                                        {chatMessage.clientMessageId &&
                                          !chatMessage.id &&
                                          socketStatus === "connected" && (
                                            <button
                                              className="mt-2 text-xs text-accent-light underline"
                                              type="button"
                                              onClick={() =>
                                                retryPendingMessage(chatMessage)
                                              }
                                            >
                                              Retry safely
                                            </button>
                                          )}
                                      </article>
                                      <time
                                        className={`mt-1 text-[11px] text-[#91a2a5] ${isOwnMessage ? "self-end text-right" : "self-start text-left"}`}
                                        dateTime={chatMessage.createdAt}
                                      >
                                        {chatMessage.clientMessageId &&
                                        !chatMessage.id
                                          ? socketStatus === "connected"
                                            ? "Sending…"
                                            : "Waiting for connection…"
                                          : `${formatMessageClockTime(chatMessage.createdAt)}${chatMessage.editedAt ? " · edited" : ""}`}
                                      </time>
                                    </div>
                                  </div>
                                );
                              },
                            )
                        )}
                        {messagesHaveMore && (
                          <Button
                            className="self-center"
                            variant="secondary"
                            type="button"
                            disabled={isLoadingOlder}
                            onClick={loadOlderMessages}
                          >
                            {isLoadingOlder
                              ? "Loading older messages..."
                              : "Load older messages"}
                          </Button>
                        )}
                        {message === "Invitation sent." &&
                          selectedConversation?.id ===
                            collabspaceInviteConversation?.id && (
                            <p
                              ref={invitationNoticeRef}
                              className="m-0 max-w-[80%] self-end rounded-2xl bg-sent-message px-4 py-3 text-sm text-ink"
                              role="status"
                            >
                              {message}
                            </p>
                          )}
                        {!isLoadingMessages && !messagesError && (
                          <section
                            className="flex shrink-0 flex-col items-center px-4 py-5 text-center"
                            aria-label={`About ${selectedConversation.participant.name}`}
                          >
                            <span
                              className="grid size-16 place-items-center rounded-2xl bg-[#24322f] text-lg font-semibold text-[#68D996]"
                              aria-hidden="true"
                            >
                              {selectedConversation.participant.name
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                            <h3 className="mb-0 mt-3 text-base font-semibold text-ink">
                              {selectedConversation.participant.name}
                            </h3>
                            <p className="mb-0 mt-1 text-xs text-muted">
                              @{selectedConversation.participant.username}
                            </p>
                            <a
                              className="mt-3 text-xs font-semibold text-accent-light hover:underline focus-visible:outline-2 focus-visible:outline-[#48C97B]"
                              href={`/profile/${encodeURIComponent(selectedConversation.participant.username)}`}
                            >
                              View profile
                            </a>
                          </section>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 w-[calc(100%-16px)] max-w-[720px] py-4 pl-0 pr-3 min-[761px]:mx-auto min-[761px]:w-[calc(100%-64px)]">
                      {socketError && (
                        <p
                          className="mb-3 text-sm text-[#f2bd79]"
                          role="status"
                        >
                          {socketError}
                        </p>
                      )}
                      <form
                        className="flex w-full items-center rounded-xl border border-[#354044] bg-composer pl-4 pr-2 transition-colors focus-within:border-[#48C97B]"
                        autoComplete="off"
                        onSubmit={sendMessage}
                      >
                        <label
                          className="sr-only"
                          htmlFor="private-chat-message"
                        >
                          Message {selectedConversation.participant.name}
                        </label>
                        <input
                          id="private-chat-message"
                          className="h-12 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-sm text-ink outline-none focus:border-0 focus-visible:border-0 focus-visible:shadow-none"
                          type="text"
                          autoComplete="off"
                          maxLength={5000}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          placeholder={`Message ${selectedConversation.participant.name}`}
                        />
                        <Button
                          className="!size-10 !min-h-10 !p-0 shrink-0 justify-center rounded-lg border-0 bg-button text-[#f4fff7] enabled:hover:bg-button-hover disabled:cursor-not-allowed disabled:bg-[#1b2529] disabled:text-[#718080] focus-visible:outline-2 focus-visible:outline-[#48C97B]"
                          type="submit"
                          aria-label="Send message"
                          title="Send message"
                          disabled={!draft.trim()}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="size-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m22 2-7 20-4-9-9-4Z" />
                            <path d="M22 2 11 13" />
                          </svg>
                        </Button>
                      </form>
                    </div>
                    {collabspaceInviteOpen && (
                      <div
                        className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 p-4"
                        onMouseDown={(event) => {
                          if (
                            event.target === event.currentTarget &&
                            !collabspaceInviteSubmitting
                          )
                            setCollabspaceInviteOpen(false);
                        }}
                      >
                        <section
                          className="grid w-full max-w-lg gap-4 rounded-2xl border border-[#303a3e] bg-[#101512] p-5 shadow-2xl sm:p-6"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="invite-collabspace-heading"
                        >
                          <header className="flex items-start justify-between gap-4">
                            <div>
                              <h2
                                className="m-0 text-xl font-bold text-ink"
                                id="invite-collabspace-heading"
                              >
                                Invite{" "}
                                {
                                  collabspaceInviteConversation?.participant
                                    .name
                                }{" "}
                                to a Collabspace
                              </h2>
                            </div>
                            <button
                              type="button"
                              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-xl text-[#aebabb] hover:bg-[#222d31] hover:text-ink"
                              aria-label="Close invitation dialog"
                              disabled={collabspaceInviteSubmitting}
                              onClick={() => setCollabspaceInviteOpen(false)}
                            >
                              ×
                            </button>
                          </header>
                          {collabspaceInviteLoading ? (
                            <p
                              className="m-0 text-sm text-[#aebabb]"
                              role="status"
                            >
                              Loading Collabspaces…
                            </p>
                          ) : (
                            <form
                              className="grid gap-4"
                              onSubmit={sendCollabspaceInvitation}
                            >
                              {collabspaceInviteOptions.length > 0 ? (
                                <div className="grid gap-2">
                                  <label
                                    className="grid gap-2 text-sm font-semibold text-ink"
                                    htmlFor="collabspace-invite-search"
                                  >
                                    Search Collabspaces
                                  </label>
                                  <input
                                    id="collabspace-invite-search"
                                    className="min-h-11 rounded-lg border border-[#354044] bg-[#141A16] px-3 text-ink outline-none focus:border-[#48C97B]"
                                    type="search"
                                    value={collabspaceInviteSearch}
                                    onChange={(event) => {
                                      const search = event.target.value;
                                      setCollabspaceInviteSearch(search);
                                      const matches =
                                        collabspaceInviteOptions.filter(
                                          (space) =>
                                            space.name
                                              .toLocaleLowerCase()
                                              .includes(
                                                search
                                                  .trim()
                                                  .toLocaleLowerCase(),
                                              ),
                                        );
                                      setCollabspaceInviteId((current) =>
                                        matches.some(
                                          (space) => space.id === current,
                                        )
                                          ? current
                                          : (matches[0]?.id ?? ""),
                                      );
                                    }}
                                    placeholder="Search by space name"
                                  />
                                  <div
                                    className="grid max-h-56 gap-1 overflow-y-auto"
                                    role="group"
                                    aria-label="Collabspaces"
                                  >
                                    {filteredCollabspaceInviteOptions.length >
                                    0 ? (
                                      filteredCollabspaceInviteOptions.map(
                                        (space) => (
                                          <button
                                            className={`min-h-11 cursor-pointer rounded-lg border px-3 text-left font-medium ${collabspaceInviteId === space.id ? "border-[#45BD76] bg-selected text-accent-light" : "border-[#303a3e] bg-transparent text-ink hover:bg-[#20292d]"}`}
                                            key={space.id}
                                            type="button"
                                            aria-pressed={
                                              collabspaceInviteId === space.id
                                            }
                                            onClick={() =>
                                              setCollabspaceInviteId(space.id)
                                            }
                                          >
                                            {space.name}
                                          </button>
                                        ),
                                      )
                                    ) : (
                                      <p
                                        className="m-0 py-2 text-sm text-[#aebabb]"
                                        role="status"
                                      >
                                        No Collabspaces match your search.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : !collabspaceInviteError ? (
                                <p className="m-0 text-sm text-[#aebabb]">
                                  You need to own or administer a Collabspace
                                  before you can invite someone.
                                </p>
                              ) : null}
                              {collabspaceInviteError && (
                                <p
                                  className="m-0 text-sm text-[#ffaaaa]"
                                  role="alert"
                                >
                                  {collabspaceInviteError}
                                </p>
                              )}
                              <footer className="flex justify-end gap-2">
                                <button
                                  className="min-h-10 cursor-pointer rounded-lg border border-[#303a3e] bg-transparent px-4 text-sm font-semibold text-ink hover:bg-[#222d31]"
                                  type="button"
                                  disabled={collabspaceInviteSubmitting}
                                  onClick={() =>
                                    setCollabspaceInviteOpen(false)
                                  }
                                >
                                  Cancel
                                </button>
                                {collabspaceInviteOptions.length > 0 && (
                                  <button
                                    className="min-h-10 cursor-pointer rounded-lg border-0 bg-button px-4 text-sm font-bold text-[#f4fff7] hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-50"
                                    type="submit"
                                    disabled={
                                      collabspaceInviteSubmitting ||
                                      !collabspaceInviteId
                                    }
                                  >
                                    {collabspaceInviteSubmitting
                                      ? "Sending…"
                                      : "Send invitation"}
                                  </button>
                                )}
                              </footer>
                            </form>
                          )}
                        </section>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid flex-1 -translate-y-6 place-items-center p-8 text-center">
                    <div className="animate-chat-empty-state-in motion-reduce:animate-none">
                      <div
                        className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-[#26342d] bg-[#141d17] text-accent"
                        aria-hidden="true"
                      >
                        <svg
                          className="size-6"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
                        </svg>
                      </div>
                      <h2 className="m-0 text-lg font-semibold text-ink">
                        Your private chats
                      </h2>
                      <p className="mt-2 max-w-sm text-sm text-[#aebabb]">
                        Choose a conversation to view your messages.
                      </p>
                      {message && (
                        <p
                          className="mt-3 text-sm text-[#aebabb]"
                          role="status"
                        >
                          {message}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>
              {selectedConversation && (
                <div
                  className={`absolute inset-0 z-30 ${showConversationDetails ? "flex" : "hidden"} justify-end`}
                >
                  <button
                    className="absolute inset-0 cursor-default border-0 bg-black/25"
                    type="button"
                    aria-label="Dismiss conversation details"
                    onClick={() => setIsConversationDetailsOpen(false)}
                  />
                  <aside
                    id="conversation-details-panel"
                    className={`${panelClass} relative z-10 flex w-[360px] max-w-full shrink-0 flex-col overflow-y-auto border-l border-[#252d31] bg-surface shadow-2xl`}
                    aria-label={`Details for ${selectedConversation.participant.name}`}
                  >
                    <header className="flex items-center justify-end px-4 py-3">
                      <button
                        className="grid size-9 place-items-center rounded-full text-[#aebabb] hover:bg-[#222d31] hover:text-ink focus-visible:outline-2 focus-visible:outline-[#48C97B]"
                        type="button"
                        aria-label="Close conversation details"
                        onClick={() => setIsConversationDetailsOpen(false)}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="size-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="m18 6-12 12M6 6l12 12" />
                        </svg>
                      </button>
                    </header>
                    <div className="grid justify-items-center gap-3 px-5 pb-6 text-center">
                      <span
                        className="grid size-16 place-items-center rounded-2xl bg-[#24322f] text-xl font-semibold text-[#68D996]"
                        aria-hidden="true"
                      >
                        {selectedConversation.participant.name
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h2 className="m-0 truncate text-lg font-semibold text-ink">
                          {selectedConversation.participant.name}
                        </h2>
                        <a
                          className="text-sm text-[#aebabb] hover:text-[#68D996]"
                          href={`/profile/${encodeURIComponent(selectedConversation.participant.username)}`}
                        >
                          @{selectedConversation.participant.username}
                        </a>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 px-4">
                      <a
                        className="grid min-h-[72px] place-items-center content-center gap-1 rounded-xl border border-[#303a3e] text-sm font-medium text-ink hover:bg-[#20292d] focus-visible:outline-2 focus-visible:outline-[#48C97B]"
                        href={`/profile/${encodeURIComponent(selectedConversation.participant.username)}`}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="size-5 text-[#aebabb]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="8" r="4" />
                          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                        </svg>
                        Profile
                      </a>
                      <button
                        className="grid min-h-[64px] place-items-center content-center gap-1 rounded-xl border border-[#303a3e] bg-transparent text-sm font-medium text-ink hover:bg-[#20292d] focus-visible:outline-2 focus-visible:outline-[#48C97B] disabled:cursor-wait disabled:opacity-60"
                        type="button"
                        disabled={isUpdatingMute || isDeletingConversation}
                        onClick={() => toggleConversationMute()}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="size-5 text-[#aebabb]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                          <path d="M10 21h4" />
                        </svg>
                        {isUpdatingMute
                          ? "Updating..."
                          : selectedConversation.isMuted
                            ? "Unmute"
                            : "Mute"}
                      </button>
                      <button
                        className="col-span-2 grid min-h-[72px] place-items-center content-center gap-1 rounded-xl border border-[#303a3e] bg-transparent text-sm font-medium text-ink hover:bg-[#20292d] focus-visible:outline-2 focus-visible:outline-[#48C97B] disabled:cursor-wait disabled:opacity-60"
                        type="button"
                        disabled={
                          collabspaceInviteLoading ||
                          collabspaceInviteSubmitting ||
                          isDeletingConversation
                        }
                        onClick={() =>
                          openCollabspaceInvite(selectedConversation)
                        }
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="size-5 text-[#aebabb]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M19 8v6m-3-3h6" />
                        </svg>
                        Invite to Collabspace
                      </button>
                    </div>
                    <div className="mt-6 border-t border-[#252d31] px-4 py-4">
                      <button
                        className="min-h-11 w-full rounded-lg bg-transparent px-2 text-left text-sm font-medium text-[#ff9ba3] hover:bg-[#222d31] focus-visible:outline-2 focus-visible:outline-[#48C97B] disabled:cursor-wait disabled:opacity-60"
                        type="button"
                        disabled={isDeletingConversation}
                        onClick={() => requestDeleteConversation()}
                      >
                        {isDeletingConversation ? "Deleting..." : "Delete chat"}
                      </button>
                    </div>
                  </aside>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
