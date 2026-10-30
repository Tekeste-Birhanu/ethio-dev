import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/ui.jsx";

function formatMessageTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderMessageContent(content) {
  return content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    try {
      const url = new URL(part);
      if (!['http:', 'https:'].includes(url.protocol)) return part;
      return (
        <a className="break-all text-[#6be9c1] underline" href={url.href} target="_blank" rel="noreferrer noopener" key={`${url.href}-${index}`}>
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
  return [...byId.values()].sort((first, second) => (
    new Date(first.createdAt) - new Date(second.createdAt)
  ));
}

export default function ChatPage({ user, requestedConversationId, onConversationUrlChange }) {
  const [requests, setRequests] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messagesHaveMore, setMessagesHaveMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [olderMessagesError, setOlderMessagesError] = useState("");
  const [actionId, setActionId] = useState("");
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [isUpdatingMute, setIsUpdatingMute] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingDraft, setEditingDraft] = useState("");
  const [messageActionId, setMessageActionId] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [socketError, setSocketError] = useState("");
  const [pendingMessages, setPendingMessages] = useState([]);
  const messageLoadId = useRef(0);
  const previousRequestedConversationId = useRef(requestedConversationId);
  const socketRef = useRef(null);
  const conversationMenuRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const pendingMessagesRef = useRef([]);
  selectedConversationRef.current = selectedConversation;
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  function updatePendingMessages(updater) {
    const nextMessages = updater(pendingMessagesRef.current);
    pendingMessagesRef.current = nextMessages;
    setPendingMessages(nextMessages);
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
        throw new Error(requestsResult.error?.message ?? "Could not load chat requests.");
      if (!conversationsResponse.ok)
        throw new Error(conversationsResult.error?.message ?? "Could not load conversations.");
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

  const markReadThrough = useCallback(async (conversationId, throughMessageId) => {
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
      setConversations((current) => current.map((item) => (
        item.id === conversationId ? { ...item, unreadCount: result.unreadCount ?? 0 } : item
      )));
      return true;
    } catch {
      return false;
    }
  }, []);

  const openConversation = useCallback(async (conversation) => {
    onConversationUrlChange?.(conversation.id);
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
        throw new Error(result.error?.message ?? "Could not load conversation messages.");
      if (messageLoadId.current !== loadId) return;
      setMessages(result.messages ?? []);
      setMessagesHaveMore(Boolean(result.hasMore));
      await markReadThrough(conversation.id, result.messages?.at(-1)?.id);
    } catch (error) {
      if (messageLoadId.current === loadId)
        setMessagesError(error.message || "Could not reach the server. Try again.");
    } finally {
      if (messageLoadId.current === loadId) setIsLoadingMessages(false);
    }
  }, [markReadThrough, onConversationUrlChange]);

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
    const conversation = conversations.find((item) => item.id === requestedConversationId);
    if (!conversation) {
      const timeoutId = window.setTimeout(() => {
        setMessage("This private conversation is not available for your account.");
        onConversationUrlChange?.("", "replaceState");
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    if (selectedConversationRef.current?.id === conversation.id) return undefined;
    const timeoutId = window.setTimeout(() => {
      openConversation(conversation);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [conversations, isLoading, loadError, onConversationUrlChange, openConversation, requestedConversationId]);

  async function loadOlderMessages() {
    if (!selectedConversation || !messagesHaveMore || isLoadingOlder || !messages.length) return;
    setIsLoadingOlder(true);
    setOlderMessagesError("");
    try {
      const cursor = messages[0].id;
      const response = await fetch(
        `/api/chat/conversations/${encodeURIComponent(selectedConversation.id)}/messages?before=${encodeURIComponent(cursor)}`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "Could not load older messages.");
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
        const existing = current.find((item) => item.id === chatMessage.conversationId);
        if (!existing) return current;
        const isOpenAndVisible = active?.id === chatMessage.conversationId
          && document.visibilityState === "visible";
        const updated = {
          ...existing,
          lastMessage: chatMessage,
          unreadCount: chatMessage.senderId === user.id || isOpenAndVisible
            ? existing.unreadCount
            : existing.unreadCount + 1,
        };
        return [updated, ...current.filter((item) => item.id !== chatMessage.conversationId)]
          .sort((first, second) => new Date(second.lastMessage?.createdAt ?? second.createdAt)
            - new Date(first.lastMessage?.createdAt ?? first.createdAt));
      });
      if (!hasConversation) {
        fetch("/api/chat/conversations")
          .then((response) => response.json())
          .then((result) => { if (!disposed) setConversations(result.conversations ?? []); })
          .catch(() => {});
      }
      if (active?.id === chatMessage.conversationId) {
        setMessages((current) => current.some((item) => item.id === chatMessage.id)
          ? current
          : [...current, chatMessage]);
        if (chatMessage.senderId === user.id) {
          updatePendingMessages((current) => current.filter((item) => item.clientMessageId !== chatMessage.clientMessageId));
        } else if (document.visibilityState === "visible") {
          markReadThrough(chatMessage.conversationId, chatMessage.id).catch(() => {});
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
          if (!response.ok || disposed || selectedConversationRef.current?.id !== active.id) return;
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
          historyByConversation.get(conversationId).map((item) => item.clientMessageId).filter(Boolean),
        );
        const confirmedIds = new Set(pendingGroup
          .filter((item) => knownMessageIds.has(item.clientMessageId))
          .map((item) => item.clientMessageId));
        if (confirmedIds.size) {
          updatePendingMessages((current) => current.filter((item) => !confirmedIds.has(item.clientMessageId)));
        }
        for (const pending of pendingGroup) {
          if (!knownMessageIds.has(pending.clientMessageId) && socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "message.send",
              conversationId: pending.conversationId,
              clientMessageId: pending.clientMessageId,
              content: pending.content,
            }));
          }
        }
      }
    };

    const connect = () => {
      if (disposed) return;
      setSocketStatus("connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/chat/socket`);
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
          setConversations((current) => current.filter((item) => item.id !== payload.conversationId));
          updatePendingMessages((current) => current.filter((item) => item.conversationId !== payload.conversationId));
          if (selectedConversationRef.current?.id === payload.conversationId) {
            messageLoadId.current += 1;
            setSelectedConversation(null);
            onConversationUrlChange?.("");
            setMessages([]);
            setMessagesHaveMore(false);
            setMessagesError("");
            setMessage("This conversation was ended by a participant, and its messages were deleted.");
          }
        } else if (payload.type === "message.created" || payload.type === "message.ack") {
          appendMessage(payload.message);
          if (payload.type === "message.ack") {
            updatePendingMessages((current) => current.filter(
              (item) => item.clientMessageId !== payload.clientMessageId,
            ));
          }
        } else if (payload.type === "message.updated") {
          setMessages((current) => current.map((item) => (
            item.id === payload.message.id ? payload.message : item
          )));
          setConversations((current) => current.map((item) => (
            item.id === payload.message.conversationId && item.lastMessage?.id === payload.message.id
              ? { ...item, lastMessage: payload.message }
              : item
          )));
        } else if (payload.type === "message.deleted") {
          setMessages((current) => current.filter((item) => item.id !== payload.messageId));
          fetch("/api/chat/conversations")
            .then((response) => response.json().then((result) => ({ response, result })))
            .then(({ response, result }) => {
              if (response.ok && !disposed) setConversations(result.conversations ?? []);
            })
            .catch(() => {});
        } else if (payload.type === "error") {
          setSocketError(payload.message ?? "The message could not be sent.");
          if (["MESSAGE_SEND_FAILED", "MESSAGE_RETRY"].includes(payload.code)
            && payload.clientMessageId
            && !reconciledMessageIds.has(payload.clientMessageId)) {
            reconciledMessageIds.add(payload.clientMessageId);
            window.setTimeout(refreshSelectedConversation, 250);
          }
          if (payload.clientMessageId && !["MESSAGE_SEND_FAILED", "MESSAGE_RETRY"].includes(payload.code)) {
            const failedMessage = pendingMessagesRef.current.find(
              (item) => item.clientMessageId === payload.clientMessageId,
            );
            if (failedMessage) setDraft((current) => current || failedMessage.content);
            updatePendingMessages((current) => current.filter(
              (item) => item.clientMessageId !== payload.clientMessageId,
            ));
          }
        }
      });
      socket.addEventListener("close", (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed) return;
        if (event.code === 4401) {
          setSocketStatus("offline");
          setSocketError("Your session expired. Sign in again to send messages.");
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
      const response = await fetch(`/api/chat/requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "Could not update the chat request.");
      const acceptedRequest = requests.find((request) => request.id === requestId);
      setRequests((current) => current.filter((request) => request.id !== requestId));
      if (status === "ACCEPTED") {
        setSelectedRequest(null);
        const refreshed = await fetch("/api/chat/conversations");
        const refreshedResult = await refreshed.json();
        if (!refreshed.ok)
          throw new Error(refreshedResult.error?.message ?? "Conversation created, but the list could not refresh.");
        const updatedConversations = refreshedResult.conversations ?? [];
        setConversations(updatedConversations);
        const conversation = updatedConversations.find((item) => item.id === result.conversation.id);
        if (conversation) {
          await openConversation(conversation);
        } else {
          const fallbackConversation = {
            ...result.conversation,
            participant: acceptedRequest?.sender ?? { name: "Developer", username: "" },
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
      setSocketError("Chat is reconnecting. Your draft is still here; try again when connected.");
      return;
    }

    const clientMessageId = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
      updatePendingMessages((current) => current.filter((item) => item.clientMessageId !== clientMessageId));
      setSocketError("Could not send the message. Your draft is still here; try again.");
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
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message ?? "Could not edit this message.");
      setMessages((current) => current.map((item) => item.id === chatMessage.id ? result.message : item));
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
    if (!window.confirm("Delete this message for both participants?")) return;
    setMessageActionId(chatMessage.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat/conversations/${encodeURIComponent(selectedConversation.id)}/messages/${encodeURIComponent(chatMessage.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error?.message ?? "Could not delete this message.");
      }
      setMessages((current) => current.filter((item) => item.id !== chatMessage.id));
      setEditingMessageId("");
      setEditingDraft("");
      const conversationsResponse = await fetch("/api/chat/conversations");
      const conversationsResult = await conversationsResponse.json();
      if (conversationsResponse.ok) setConversations(conversationsResult.conversations ?? []);
    } catch (error) {
      setMessage(error.message || "Could not reach the server. Try again.");
    } finally {
      setMessageActionId("");
    }
  }

  function retryPendingMessage(pending) {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      setSocketError("Chat is reconnecting. The message will be checked when you reconnect.");
      return;
    }
    socket.send(JSON.stringify({
      type: "message.send",
      conversationId: pending.conversationId,
      clientMessageId: pending.clientMessageId,
      content: pending.content,
    }));
    setSocketError("");
  }

  function closeConversation() {
    messageLoadId.current += 1;
    setSelectedConversation(null);
    setSelectedRequest(null);
    setMessages([]);
    setMessagesHaveMore(false);
    setMessagesError("");
    onConversationUrlChange?.("");
  }

  async function toggleConversationMute() {
    if (!selectedConversation || isUpdatingMute) return;
    const conversation = selectedConversation;
    const muted = !conversation.isMuted;
    setIsUpdatingMute(true);
    setMessage("");
    try {
      const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conversation.id)}/mute`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message ?? "Could not update mute settings.");
      setSelectedConversation((current) => current?.id === conversation.id ? { ...current, isMuted: result.muted } : current);
      setConversations((current) => current.map((item) => (
        item.id === conversation.id ? { ...item, isMuted: result.muted } : item
      )));
    } catch (error) {
      setMessage(error.message || "Could not reach the server. Try again.");
    } finally {
      setIsUpdatingMute(false);
    }
  }

  async function deleteConversation() {
    if (!selectedConversation || isDeletingConversation) return;
    const conversation = selectedConversation;
    if (conversationMenuRef.current) conversationMenuRef.current.open = false;
    const confirmed = window.confirm(
      `Delete your chat with ${conversation.participant.name}? This removes the conversation and all its messages for both participants, and ends the chat. This cannot be undone.`,
    );
    if (!confirmed) return;

    setIsDeletingConversation(true);
    setMessage("");
    try {
      const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conversation.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error?.message ?? "Could not delete this conversation.");
      }
      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      updatePendingMessages((current) => current.filter((item) => item.conversationId !== conversation.id));
      messageLoadId.current += 1;
      setSelectedConversation(null);
      onConversationUrlChange?.("");
      setMessages([]);
      setMessagesHaveMore(false);
      setMessagesError("");
      setMessage("Conversation deleted for both participants.");
    } catch (error) {
      setMessage(error.message || "Could not reach the server. Try again.");
    } finally {
      setIsDeletingConversation(false);
    }
  }

  function openRequest(request) {
    messageLoadId.current += 1;
    setSelectedConversation(null);
    onConversationUrlChange?.("");
    setSelectedRequest(request);
    setMessages([]);
    setMessagesHaveMore(false);
    setMessagesError("");
    setOlderMessagesError("");
    setMessage("");
  }

  const panelClass = "h-full min-h-0 bg-[#111719]";
  const hasSidebarContent = isLoading || conversations.length > 0 || requests.length > 0;
  const hasSelectedChatItem = Boolean(selectedConversation || selectedRequest);

  return (
    <section className={`app-main-content min-w-0 px-8 pb-0 pt-[42px] max-[760px]:h-[calc(100dvh-68px-env(safe-area-inset-bottom))] max-[760px]:px-0 max-[760px]:pt-2`} aria-label="Chat">
      <div className="mx-auto h-full w-full max-w-[1120px] max-[760px]:max-w-none">
        {loadError ? (
          <div className={`${panelClass} grid place-items-center rounded-2xl border border-[#252d31] p-6 text-center max-[760px]:rounded-none max-[760px]:border-x-0`} role="alert">
            <div>
              <p className="text-[#aebabb]">{loadError}</p>
              <Button className="mt-4" type="button" onClick={() => { setIsLoading(true); loadChatData(); }}>Try again</Button>
            </div>
          </div>
        ) : (
          <div className={`grid h-[calc(100dvh-84px)] overflow-hidden rounded-2xl border border-[#252d31] bg-[#111719] ${hasSidebarContent ? "grid-cols-[minmax(240px,_320px)_minmax(0,_1fr)]" : "grid-cols-1"} max-[1100px]:grid-cols-1 max-[760px]:h-full max-[760px]:rounded-none max-[760px]:border-x-0`}>
            <aside className={`${panelClass} overflow-hidden border-r border-[#252d31] max-[1100px]:border-r-0 ${hasSelectedChatItem ? "max-[1100px]:hidden" : "max-[1100px]:bg-transparent"} ${hasSidebarContent ? "" : "hidden"}`} aria-label="Chats and incoming requests">
              {message && <p className="m-0 border-b border-[#252d31] px-5 py-3 text-sm text-[#aebabb]" role="status">{message}</p>}
              {isLoading ? (
                <p className="p-5 text-sm text-[#aebabb]" role="status">Loading conversations...</p>
              ) : conversations.length > 0 && (
                <ul className="m-0 list-none p-0">
                  {conversations.map((conversation) => (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-3 border-b border-[#252d31] px-5 py-4 text-left hover:bg-[#182023] ${selectedConversation?.id === conversation.id ? "bg-[#182023]" : ""}`}
                        onClick={() => openConversation(conversation)}
                        aria-current={selectedConversation?.id === conversation.id ? "true" : undefined}
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#24322f] font-semibold text-[#38e6b0]" aria-hidden="true">
                          {conversation.participant.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate font-medium text-ink">{conversation.participant.name}</span>
                            {conversation.lastMessage && (
                              <time className="shrink-0 text-xs text-[#aebabb]" dateTime={conversation.lastMessage.createdAt}>
                                {formatMessageTime(conversation.lastMessage.createdAt)}
                              </time>
                            )}
                          </span>
                        </span>
                        {conversation.unreadCount > 0 && (
                          <span className="grid min-w-6 place-items-center rounded-full bg-[#38e6b0] px-2 py-1 text-xs font-bold text-[#0b1113]" aria-label={`${conversation.unreadCount} unread messages`}>
                            {conversation.unreadCount}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {requests.length > 0 && (
                <section className={`${conversations.length > 0 ? "border-t border-[#252d31]" : ""} px-5 py-4`} aria-labelledby="incoming-chat-requests-heading">
                  <h2 className="m-0 text-sm font-semibold text-ink" id="incoming-chat-requests-heading">Incoming requests</h2>
                  <ul className="mt-3 grid list-none gap-3 p-0">
                    {requests.map((request) => (
                      <li key={request.id}>
                        <button
                          className={`flex w-full items-center gap-3 rounded-xl border border-[#252d31] px-3 py-3 text-left hover:bg-[#182023] ${selectedRequest?.id === request.id ? "bg-[#182023]" : "bg-transparent"}`}
                          type="button"
                          onClick={() => openRequest(request)}
                          aria-current={selectedRequest?.id === request.id ? "true" : undefined}
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#24322f] font-semibold text-[#38e6b0]" aria-hidden="true">
                            {request.sender.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">{request.sender.name}</span>
                            <span className="mt-1 block truncate text-xs text-[#aebabb]">@{request.sender.username}</span>
                          </span>
                          <time className="shrink-0 text-xs text-[#aebabb]" dateTime={request.createdAt}>{formatMessageTime(request.createdAt)}</time>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>

            <section className={`${panelClass} flex min-w-0 flex-col overflow-hidden ${!hasSelectedChatItem && hasSidebarContent ? "max-[1100px]:hidden" : ""}`} aria-label="Private conversation">
              {selectedRequest ? (
                <>
                  <header className="flex items-center gap-3 border-b border-[#252d31] px-5 py-4">
                    <button className="hidden size-10 shrink-0 place-items-center rounded-full text-[#38e6b0] hover:bg-[#20292d] max-[1100px]:inline-grid" type="button" onClick={closeConversation} aria-label="Back to chats">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#24322f] font-semibold text-[#38e6b0]" aria-hidden="true">
                      {selectedRequest.sender.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="m-0 truncate text-base font-semibold text-ink">{selectedRequest.sender.name}</h2>
                      <a className="text-sm text-[#aebabb] hover:text-[#38e6b0]" href={`/profile/${encodeURIComponent(selectedRequest.sender.username)}`}>
                        @{selectedRequest.sender.username}
                      </a>
                    </div>
                  </header>
                  <div className="grid flex-1 place-items-center p-6 text-center">
                    <div>
                      <p className="m-0 text-sm text-[#aebabb]">This developer wants to start a private chat.</p>
                      {message && <p className="mt-3 text-sm text-[#aebabb]" role="status">{message}</p>}
                      <div className="mt-5 flex justify-center gap-3">
                        <Button className="[width:auto]" type="button" disabled={Boolean(actionId)} onClick={() => handleDecision(selectedRequest.id, "ACCEPTED")}>
                          {actionId === selectedRequest.id ? "Opening chat..." : "Accept"}
                        </Button>
                        <Button variant="secondary" type="button" disabled={Boolean(actionId)} onClick={() => handleDecision(selectedRequest.id, "DECLINED")}>Decline</Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : selectedConversation ? (
                <>
                  <header className="flex items-center gap-3 border-b border-[#252d31] px-5 py-4">
                    <button className="hidden size-10 shrink-0 place-items-center rounded-full text-[#38e6b0] hover:bg-[#20292d] max-[1100px]:inline-grid" type="button" onClick={closeConversation} aria-label="Back to chats">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#24322f] font-semibold text-[#38e6b0]" aria-hidden="true">
                      {selectedConversation.participant.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="m-0 truncate text-base font-semibold text-ink">{selectedConversation.participant.name}</h2>
                      <a className="text-sm text-[#aebabb] hover:text-[#38e6b0]" href={`/profile/${encodeURIComponent(selectedConversation.participant.username)}`}>
                        @{selectedConversation.participant.username}
                      </a>
                    </div>
                    <details className="relative ml-auto shrink-0" ref={conversationMenuRef}>
                      <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-full text-[26px] leading-none text-[#aebabb] hover:bg-[#20292d] hover:text-ink focus-visible:outline-2 focus-visible:outline-[#38e6b0]" aria-label="Conversation settings">
                        <span aria-hidden="true">⋯</span>
                      </summary>
                      <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-[#303a3e] bg-[#171f23] p-1.5 shadow-[0_14px_32px_rgb(0_0_0_/_32%)]">
                        <button className="min-h-10 w-full cursor-pointer rounded-lg border-0 bg-transparent px-3 text-left font-semibold text-ink hover:bg-[#222d31] disabled:cursor-wait disabled:opacity-60" type="button" disabled={isUpdatingMute || isDeletingConversation} onClick={toggleConversationMute}>
                          {isUpdatingMute ? "Updating…" : selectedConversation.isMuted ? "Unmute notifications" : "Mute notifications"}
                        </button>
                        <button className="min-h-10 w-full cursor-pointer rounded-lg border-0 bg-transparent px-3 text-left font-semibold text-[#ff9ba3] hover:bg-[#222d31] disabled:cursor-wait disabled:opacity-60" type="button" disabled={isDeletingConversation} onClick={deleteConversation}>
                          {isDeletingConversation ? "Deleting…" : "Delete chat"}
                        </button>
                      </div>
                    </details>
                  </header>
                  <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5" aria-live="polite" aria-label="Conversation messages">
                    {message && <p className="self-center text-sm text-[#aebabb]" role="status">{message}</p>}
                    {olderMessagesError && <p className="self-center text-sm text-[#f2bd79]" role="alert">{olderMessagesError}</p>}
                    {messagesHaveMore && (
                      <Button className="self-center" variant="secondary" type="button" disabled={isLoadingOlder} onClick={loadOlderMessages}>
                        {isLoadingOlder ? "Loading older messages..." : "Load older messages"}
                      </Button>
                    )}
                    {isLoadingMessages ? (
                      <p className="m-auto text-sm text-[#aebabb]" role="status">Loading messages...</p>
                    ) : messagesError ? (
                      <div className="m-auto text-center" role="alert">
                        <p className="text-sm text-[#aebabb]">{messagesError}</p>
                        <Button className="mt-3" type="button" onClick={() => openConversation(selectedConversation)}>Try again</Button>
                      </div>
                      ) : messages.length === 0 && !pendingMessages.some((item) => item.conversationId === selectedConversation.id) ? (
                      <p className="m-auto max-w-sm text-center text-sm text-[#aebabb]">
                        This is the start of your private conversation. Messages will be available here next.
                      </p>
                    ) : (
                        [...messages, ...pendingMessages.filter((item) => item.conversationId === selectedConversation.id)].map((chatMessage) => {
                        const isOwnMessage = chatMessage.senderId !== selectedConversation.participant.id;
                        const isEditing = editingMessageId === chatMessage.id;
                        return (
                          <article className={`relative max-w-[80%] rounded-2xl px-4 py-3 ${isOwnMessage ? "self-end bg-[#17483c] text-ink" : "self-start bg-[#20292d] text-ink"}`} key={chatMessage.id ?? chatMessage.clientMessageId}>
                            {isEditing ? (
                              <div className="min-w-56">
                                <textarea className="min-h-20 w-full resize-y rounded-lg border border-[#354044] bg-[#0d1315] p-2 text-sm text-ink outline-none focus:border-[#38e6b0]" maxLength={5000} value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} aria-label="Edit message" />
                                <div className="mt-2 flex justify-end gap-3 text-xs">
                                  <button className="text-[#aebabb] underline" type="button" onClick={() => { setEditingMessageId(""); setEditingDraft(""); }}>Cancel</button>
                                  <button className="text-[#6be9c1] underline disabled:opacity-50" type="button" disabled={!editingDraft.trim() || messageActionId === chatMessage.id} onClick={() => saveMessageEdit(chatMessage)}>{messageActionId === chatMessage.id ? "Saving…" : "Save"}</button>
                                </div>
                              </div>
                            ) : (
                              <p className={`m-0 whitespace-pre-wrap break-words text-sm ${isOwnMessage && chatMessage.id ? "pr-7 pt-4" : ""}`}>{renderMessageContent(chatMessage.content)}</p>
                            )}
                            <time className="mt-2 block text-right text-[11px] text-[#b6c5c6]" dateTime={chatMessage.createdAt}>{chatMessage.clientMessageId && !chatMessage.id ? (socketStatus === "connected" ? "Sending…" : "Waiting for connection…") : `${formatMessageTime(chatMessage.createdAt)}${chatMessage.editedAt ? " · edited" : ""}`}</time>
                            {isOwnMessage && chatMessage.id && !isEditing && (
                              <details className="absolute right-2 top-1 z-20 text-xs">
                                <summary className="grid size-7 cursor-pointer list-none place-items-center rounded-full text-[#b6c5c6] hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-[#38e6b0]" aria-label="Message actions">
                                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
                                    <circle cx="5" cy="12" r="1.7" />
                                    <circle cx="12" cy="12" r="1.7" />
                                    <circle cx="19" cy="12" r="1.7" />
                                  </svg>
                                </summary>
                                <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-[#303a3e] bg-[#171f23] p-1 shadow-[0_14px_32px_rgb(0_0_0_/_32%)]">
                                  <button className="min-h-9 w-full rounded-lg bg-transparent px-3 text-left font-semibold text-ink hover:bg-[#222d31] disabled:opacity-50" type="button" disabled={Boolean(messageActionId)} onClick={(event) => { event.currentTarget.closest("details").open = false; setEditingMessageId(chatMessage.id); setEditingDraft(chatMessage.content); }}>Edit</button>
                                  <button className="min-h-9 w-full rounded-lg bg-transparent px-3 text-left font-semibold text-[#ff9ba3] hover:bg-[#222d31] disabled:opacity-50" type="button" disabled={Boolean(messageActionId)} onClick={(event) => { event.currentTarget.closest("details").open = false; deleteMessage(chatMessage); }}>{messageActionId === chatMessage.id ? "Deleting…" : "Delete"}</button>
                                </div>
                              </details>
                            )}
                            {chatMessage.clientMessageId && !chatMessage.id && socketStatus === "connected" && (
                              <button className="mt-2 text-xs text-[#6be9c1] underline" type="button" onClick={() => retryPendingMessage(chatMessage)}>
                                Retry safely
                              </button>
                            )}
                          </article>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-[#252d31] px-5 py-4">
                    {socketError && <p className="mb-3 text-sm text-[#f2bd79]" role="status">{socketError}</p>}
                    <form className="flex items-center gap-3" onSubmit={sendMessage}>
                      <label className="sr-only" htmlFor="private-chat-message">Write a message</label>
                      <input
                        id="private-chat-message"
                        className="h-12 min-w-0 flex-1 rounded-xl border border-[#354044] bg-[#0d1315] px-4 text-sm text-ink outline-none focus:border-[#38e6b0]"
                        type="text"
                        maxLength={5000}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Write a message or paste a link"
                      />
                      <Button type="submit" disabled={!draft.trim() || socketStatus !== "connected"}>
                        Send
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="grid flex-1 place-items-center p-8 text-center">
                  <div>
                    <h2 className="m-0 text-lg font-semibold text-ink">Your private chats</h2>
                    <p className="mt-2 max-w-sm text-sm text-[#aebabb]">Choose a conversation to view its messages, or accept an incoming request to start one.</p>
                    {message && <p className="mt-3 text-sm text-[#aebabb]" role="status">{message}</p>}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
