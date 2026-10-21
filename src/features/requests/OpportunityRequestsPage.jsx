import { useEffect, useState } from "react";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";

function signInHref(path) {
  return `/auth/sign-in?next=${encodeURIComponent(path)}`;
}

export function OpportunityRequestsPage({ user, opportunityId }) {
  const [opportunity, setOpportunity] = useState(null);
  const [requests, setRequests] = useState([]);
  const [avatarUrls, setAvatarUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return undefined;
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const { data: opportunityData, error: opportunityError } = await supabase
        .from("opportunities")
        .select("id, title, creator_id, status")
        .eq("id", opportunityId)
        .maybeSingle();
      if (!active) return;
      if (opportunityError || !opportunityData) {
        setError("This opportunity could not be loaded.");
        setLoading(false);
        return;
      }
      if (opportunityData.creator_id !== user.id) {
        setError("Only the opportunity creator can review requests.");
        setLoading(false);
        return;
      }
      setOpportunity(opportunityData);
      const { data, error: requestsError } = await supabase
        .from("collaboration_requests")
        .select(
          "id, opportunity_id, applicant_id, message, status, acceptance_path, created_at, applicant:profiles!collaboration_requests_applicant_id_fkey(user_id, username, display_name, bio, avatar_path, profile_skills(skills(name)))",
        )
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (requestsError) {
        setError("Requests could not be loaded. Try again.");
      } else {
        const rows = await Promise.all(
          (data ?? []).map(async (row) => {
            if (
              row.status !== "accepted" ||
              row.acceptance_path !== "private_chat"
            ) {
              return row;
            }
            const { data: conversationData } = await supabase.rpc(
              "get_private_conversation_state",
              { p_request_id: row.id },
            );
            const conversation = Array.isArray(conversationData)
              ? conversationData[0]
              : conversationData;
            return {
              ...row,
              conversation_status: conversation?.status ?? null,
              destination_id:
                conversation?.status === "active"
                  ? conversation.conversation_id
                  : null,
            };
          }),
        );
        if (!active) return;
        setRequests(rows);
        const paths = [
          ...new Set(
            rows.map((row) => row.applicant?.avatar_path).filter(Boolean),
          ),
        ];
        if (paths.length) {
          const { data: signed } = await supabase.storage
            .from("profile-media")
            .createSignedUrls(paths, 3600);
          if (!active) return;
          setAvatarUrls(
            Object.fromEntries(
              (signed ?? [])
                .filter((image) => image.signedUrl)
                .map((image) => [image.path, image.signedUrl]),
            ),
          );
        }
      }
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [opportunityId, retry, user]);

  async function decide(row, accept, path = null) {
    setBusyId(row.id);
    setError("");
    const { data, error: decisionError } = await supabase.rpc(
      "decide_request",
      {
        p_request_id: row.id,
        p_accept: accept,
        p_path: path,
      },
    );
    if (decisionError) {
      setError("That decision couldn’t be saved. Refresh and try again.");
      setBusyId("");
      return;
    }
    setRequests((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              status: accept ? "accepted" : "rejected",
              acceptance_path: accept ? path : null,
              destination_id: accept ? data : null,
              conversation_status:
                accept && path === "private_chat" ? "active" : null,
            }
          : item,
      ),
    );
    setBusyId("");
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="discovery-status">
        <h1>Connect Supabase</h1>
        <p>Add Supabase settings to review collab requests.</p>
      </section>
    );
  }
  if (!user) {
    return (
      <section className="discovery-status">
        <h1>Sign in to review requests</h1>
        <p>Only the opportunity creator can review applicants.</p>
        <a
          className="button button-primary"
          href={signInHref(window.location.pathname)}
        >
          Sign in
        </a>
      </section>
    );
  }

  return (
    <section className="request-inbox">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COLLABORATION</p>
          <h1>{opportunity?.title ?? "Collab requests"}</h1>
          <p className="page-description">
            Review developers’ collab requests.
          </p>
        </div>
        <a className="button button-secondary" href="/my-profile#opportunities">
          Back to profile
        </a>
      </div>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {loading && requests.length === 0 ? (
        <LoadingSkeleton variant="rows" label="Loading requests" />
      ) : error && requests.length === 0 ? (
        <section className="discovery-status">
          <h2>Couldn’t load requests</h2>
          <p>{error}</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Try again
          </button>
        </section>
      ) : requests.length === 0 ? (
        <section className="discovery-status">
          <h2>No collab requests yet</h2>
          <p>New requests for this opportunity will appear here.</p>
        </section>
      ) : (
        <div className="request-list">
          {requests.map((row) => {
            const collaborationEnded =
              row.status === "accepted" &&
              row.acceptance_path === "private_chat" &&
              row.conversation_status === "ended";
            const applicant = row.applicant;
            const skills = (applicant?.profile_skills ?? [])
              .map((item) => item.skills?.name)
              .filter(Boolean);
            return (
              <article className="request-card" key={row.id}>
                <div className="request-card-content">
                  <a
                    className="request-applicant"
                    href={`/u/${encodeURIComponent(applicant?.username ?? "")}`}
                  >
                    <span className="request-avatar">
                      {avatarUrls[applicant?.avatar_path] ? (
                        <img src={avatarUrls[applicant.avatar_path]} alt="" />
                      ) : (
                        (applicant?.display_name?.[0]?.toLocaleUpperCase() ??
                        "D")
                      )}
                    </span>
                    <span>
                      <strong>{applicant?.display_name ?? "Developer"}</strong>
                      <small>@{applicant?.username ?? "developer"}</small>
                    </span>
                  </a>
                  {applicant?.bio && <p>{applicant.bio}</p>}
                  {skills.length > 0 && (
                    <ul className="skill-list">
                      {skills.slice(0, 8).map((skill) => (
                        <li className="skill-chip" key={skill}>
                          {skill}
                        </li>
                      ))}
                    </ul>
                  )}
                  {row.message && (
                    <blockquote className="request-message-quote">
                      {row.message}
                    </blockquote>
                  )}
                  <span
                    className={`status-chip ${collaborationEnded ? "status-closed" : `request-${row.status}`}`}
                  >
                    {collaborationEnded ? "Collaboration ended" : row.status}
                  </span>
                  {row.status === "accepted" &&
                    row.destination_id &&
                    !collaborationEnded && (
                      <a
                        className="button button-secondary request-destination"
                        href={
                          row.acceptance_path === "private_chat"
                            ? `/messages?conversation=${encodeURIComponent(row.destination_id)}`
                            : `/projects/${encodeURIComponent(row.destination_id)}`
                        }
                      >
                        {row.acceptance_path === "private_chat"
                          ? "Open private chat"
                          : "Open Collabspace"}
                      </a>
                    )}
                </div>
                {row.status === "pending" && (
                  <div className="request-decision-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => decide(row, true, "private_chat")}
                    >
                      Accept to private chat
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => decide(row, true, "workspace")}
                    >
                      Accept to Collabspace
                    </button>
                    <button
                      className="button button-danger"
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => decide(row, false)}
                    >
                      {busyId === row.id ? "Saving…" : "Reject"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
