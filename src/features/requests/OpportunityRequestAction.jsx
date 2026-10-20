import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";

function signInHref(path) {
  return `/auth/sign-in?next=${encodeURIComponent(path)}`;
}

function errorMessage(error, fallback) {
  const message = error?.message ?? "";
  if (/verify your email/i.test(message))
    return "Verify your email before requesting to join.";
  if (/unavailable for requests/i.test(message))
    return "This opportunity is no longer accepting requests.";
  if (/duplicate key|unique constraint/i.test(message))
    return "You already have a request for this opportunity.";
  return fallback;
}

export function OpportunityRequestAction({ opportunity, user }) {
  const [requestLookup, setRequestLookup] = useState({
    userId: null,
    opportunityStatus: null,
    data: null,
    error: "",
  });
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [conversationEnded, setConversationEnded] = useState(false);
  const isOwner = user?.id === opportunity.creator?.user_id;
  const lookupIsCurrent = Boolean(
    user?.id &&
    requestLookup.userId === user.id &&
    requestLookup.opportunityStatus === opportunity.status,
  );
  const request = lookupIsCurrent ? requestLookup.data : null;
  const loading = Boolean(user && !isOwner && !lookupIsCurrent);
  const requestError = lookupIsCurrent ? requestLookup.error : "";

  useEffect(() => {
    if (!user || isOwner) return undefined;
    let active = true;
    supabase
      .from("collaboration_requests")
      .select("id, message, status, acceptance_path")
      .eq("opportunity_id", opportunity.id)
      .eq("applicant_id", user.id)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setRequestLookup({
          userId: user.id,
          opportunityStatus: opportunity.status,
          data,
          error: queryError ? "Couldn’t load your request status." : "",
        });
      });
    return () => {
      active = false;
    };
  }, [isOwner, opportunity.id, opportunity.status, user]);

  useEffect(() => {
    if (!request || request.status !== "accepted") return undefined;
    let active = true;
    const destinationQuery =
      request.acceptance_path === "private_chat"
        ? supabase.rpc("get_private_conversation_state", {
            p_request_id: request.id,
          })
        : supabase
            .from("workspaces")
            .select("id")
            .eq("opportunity_id", opportunity.id)
            .maybeSingle();
    destinationQuery.then(({ data }) => {
      if (!active) return;
      if (request.acceptance_path === "private_chat") {
        const conversation = Array.isArray(data) ? data[0] : data;
        setConversationEnded(conversation?.status === "ended");
        if (conversation?.status === "active")
          setDestinationId(conversation.conversation_id);
      } else {
        setDestinationId(data?.id ?? "");
      }
    });
    return () => {
      active = false;
    };
  }, [opportunity.id, request]);

  async function submitRequest(event) {
    event.preventDefault();
    if (!user) {
      window.location.assign(
        signInHref(`${window.location.pathname}${window.location.search}`),
      );
      return;
    }
    if (!user.email_confirmed_at) {
      setError("Verify your email before requesting to join.");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: submitError } = await supabase.rpc("request_to_join", {
      p_opportunity_id: opportunity.id,
      p_message: message.trim() || null,
    });
    if (submitError) {
      setError(
        errorMessage(submitError, "Your request couldn’t be sent. Try again."),
      );
    } else {
      setRequestLookup({
        userId: user.id,
        opportunityStatus: opportunity.status,
        data: { id: data, message: message.trim() || null, status: "pending" },
        error: "",
      });
      setOpen(false);
      setMessage("");
    }
    setBusy(false);
  }

  async function withdrawRequest() {
    if (!request) return;
    setBusy(true);
    setError("");
    const { error: withdrawError } = await supabase.rpc("withdraw_request", {
      p_request_id: request.id,
    });
    if (withdrawError) {
      setError("Your request couldn’t be withdrawn. Refresh and try again.");
    } else {
      setRequestLookup({
        userId: user.id,
        opportunityStatus: opportunity.status,
        data: { ...request, status: "withdrawn" },
        error: "",
      });
    }
    setBusy(false);
  }

  if (isOwner || (opportunity.status !== "open" && (loading || !request))) {
    return null;
  }

  let action;
  if (loading) {
    action = <span className="muted-small">Checking request status…</span>;
  } else if (request?.status === "pending") {
    action = (
      <>
        <span className="request-status">Request pending</span>
        <button
          className="text-button request-withdraw"
          type="button"
          disabled={busy}
          onClick={withdrawRequest}
        >
          {busy ? "Withdrawing…" : "Withdraw request"}
        </button>
      </>
    );
  } else if (request?.status === "accepted") {
    const isChat = request.acceptance_path === "private_chat";
    action = (
      <>
        <span className="request-status">
          {conversationEnded
            ? "Collaboration ended"
            : `Accepted · ${isChat ? "Private chat" : "Project"}`}
        </span>
        {destinationId && !conversationEnded && (
          <a
            className="button button-secondary request-destination"
            href={
              isChat
                ? `/messages?conversation=${encodeURIComponent(destinationId)}`
                : `/projects/${encodeURIComponent(destinationId)}`
            }
          >
            {isChat ? "Open private chat" : "Open project"}
          </a>
        )}
      </>
    );
  } else if (request) {
    action = (
      <span className="request-status">
        {request.status === "rejected"
          ? "Request declined"
          : "Request withdrawn"}
      </span>
    );
  } else if (open) {
    action = (
      <form className="request-form" onSubmit={submitRequest}>
        <label className="field-label">
          Message to the creator <span className="muted-small">(optional)</span>
          <textarea
            className="field-control request-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={2000}
            rows={3}
          />
        </label>
        <div className="request-form-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? "Sending…" : "Send request"}
          </button>
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  } else {
    action = (
      <button
        className="button button-secondary"
        type="button"
        onClick={() => {
          if (!user) {
            window.location.assign(
              signInHref(
                `${window.location.pathname}${window.location.search}`,
              ),
            );
            return;
          }
          setOpen(true);
        }}
      >
        Request to join
      </button>
    );
  }

  return (
    <div className="join-request-area">
      <div className="join-request-action">{action}</div>
      {(error || requestError) && (
        <p className="feedback feedback-error request-feedback" role="alert">
          {error || requestError}
        </p>
      )}
    </div>
  );
}
