import { useEffect, useRef, useState } from "react";
import { Button, ModalCloseButton, ModalFooter, ModalHeader } from "./ui.jsx";
import { experienceOptions, opportunityCategoryOptions } from "../constants.js";

function formatPostTime(dateString) {
  const postDate = new Date(dateString);
  const secondsAgo = Math.max(
    0,
    Math.floor((Date.now() - postDate.getTime()) / 1000),
  );
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    if (secondsAgo >= seconds)
      return formatter.format(-Math.floor(secondsAgo / seconds), unit);
  }

  return "just now";
}

function OpportunityCard({
  opportunity,
  isOwner,
  isSaved,
  isLinkCopied,
  onEdit,
  onDelete,
  onStatusChange,
  onComments,
  onToggleComments,
  onSave,
  onShare,
}) {
  const descriptionRef = useRef(null);
  const ownerMenuRef = useRef(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [hasLongDescription, setHasLongDescription] = useState(false);
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = useState(false);
  const categories = opportunity.categories.map(
    (category) =>
      opportunityCategoryOptions.find(([value]) => value === category)?.[1] ??
      category,
  );
  const experience = opportunity.experienceSought
    ? opportunity.experienceSought[0] +
      opportunity.experienceSought.slice(1).toLowerCase()
    : null;
  const city = opportunity.city;
  const statusActions = {
    OPEN: [["PAUSED", "Pause"], ["COMPLETED", "Mark as completed"]],
    PAUSED: [["OPEN", "Resume"], ["COMPLETED", "Mark as completed"]],
    COMPLETED: [],
  }[opportunity.status] ?? [];

  useEffect(() => {
    const descriptionElement = descriptionRef.current;
    if (!descriptionElement || isDescriptionExpanded) return undefined;

    const updateDescriptionOverflow = () => {
      setHasLongDescription(
        descriptionElement.scrollHeight > descriptionElement.clientHeight + 1,
      );
    };

    updateDescriptionOverflow();
    const resizeObserver = new ResizeObserver(updateDescriptionOverflow);
    resizeObserver.observe(descriptionElement);

    return () => resizeObserver.disconnect();
  }, [isDescriptionExpanded, opportunity.description]);

  useEffect(() => {
    if (!isOwnerMenuOpen) return undefined;

    function closeOnOutsidePointer(event) {
      if (!ownerMenuRef.current?.contains(event.target)) {
        ownerMenuRef.current.open = false;
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        ownerMenuRef.current.open = false;
        ownerMenuRef.current.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOwnerMenuOpen]);

  return (
    <article className="opportunity-card min-w-0 rounded-2xl border border-border bg-surface p-5 max-[420px]:p-4">
      <header className="opportunity-card-author flex min-w-0 items-center gap-3">
        <a
          className="opportunity-card-avatar grid size-11 shrink-0 place-items-center rounded-full border border-[#28634f] bg-accent-dark font-bold text-accent-light no-underline"
          href={`/profile/${encodeURIComponent(opportunity.owner.username)}`}
          aria-label={`${opportunity.owner.name}'s profile`}
        >
          {opportunity.owner.name.slice(0, 1).toUpperCase()}
        </a>
        <div className="opportunity-card-identity grid min-w-0 gap-[3px]">
          <a
            className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-ink no-underline hover:text-accent-light"
            href={`/profile/${encodeURIComponent(opportunity.owner.username)}`}
          >
            {opportunity.owner.name}
          </a>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted">
            @{opportunity.owner.username} ·{" "}
            {formatPostTime(opportunity.createdAt)}
          </span>
        </div>
        {opportunity.status !== "OPEN" && (
          <span
            className={`opportunity-status opportunity-status-${opportunity.status.toLowerCase()} [margin-left:auto] [padding:5px_9px] [border-radius:999px] [background:#1b3029] [color:#65e7b7] [font-size:11px] [font-weight:700]`}
          >
            {opportunity.status[0] + opportunity.status.slice(1).toLowerCase()}
          </span>
        )}
        {isOwner && (
          <details
            ref={ownerMenuRef}
            className="opportunity-owner-menu group [&_summary::-webkit-details-marker]:hidden [&>summary:hover]:bg-[#222b2f] [&>summary:hover]:text-ink [&[open]>summary]:bg-[#222b2f] [&[open]>summary]:text-ink relative z-[1] ml-auto [position:relative] [z-index:1] [margin-left:auto]"
            onToggle={(event) => setIsOwnerMenuOpen(event.currentTarget.open)}
          >
            <summary
              className="[display:grid] [width:34px] [height:34px] [place-items:center] [border-radius:50%] [color:#aebabb] [font-size:18px] [font-weight:700] [letter-spacing:1px] [line-height:1] [list-style:none] [cursor:pointer]"
              aria-label="Opportunity actions"
            >
              •••
            </summary>
            <div className="opportunity-owner-menu-items absolute right-0 top-[calc(100%+6px)] grid min-w-44 rounded-[10px] border border-[#303a3d] bg-[#171e22] p-[5px] shadow-[0_12px_28px_rgb(0_0_0_/_35%)]">
              <button
                className="cursor-pointer whitespace-nowrap rounded-md border-0 bg-transparent px-2.5 py-[9px] text-left text-[#e1e8e8] hover:bg-[#222b2f]"
                type="button"
                onClick={() => {
                  ownerMenuRef.current.open = false;
                  onEdit(opportunity);
                }}
              >
                Edit
              </button>
              {statusActions.map(([status, label]) => (
                <button
                  className="cursor-pointer whitespace-nowrap rounded-md border-0 bg-transparent px-2.5 py-[9px] text-left text-[#e1e8e8] hover:bg-[#222b2f]"
                  type="button"
                  key={status}
                  onClick={() => {
                    ownerMenuRef.current.open = false;
                    onStatusChange(opportunity, status);
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                className="cursor-pointer whitespace-nowrap rounded-md border-0 bg-transparent px-2.5 py-[9px] text-left text-[#e1e8e8] hover:bg-[#222b2f]"
                type="button"
                onClick={() => {
                  ownerMenuRef.current.open = false;
                  onToggleComments(opportunity);
                }}
              >
                Turn comments {opportunity.commentsEnabled ? "off" : "on"}
              </button>
              <button
                className="cursor-pointer whitespace-nowrap rounded-md border-0 bg-transparent px-2.5 py-[9px] text-left text-[#ff9a9a] hover:bg-[#222b2f]"
                type="button"
                onClick={() => {
                  ownerMenuRef.current.open = false;
                  onDelete(opportunity);
                }}
              >
                Delete
              </button>
            </div>
          </details>
        )}
      </header>
      <p
        ref={descriptionRef}
        className={`opportunity-card-description mt-[17px] wrap-anywhere whitespace-pre-wrap text-base leading-[1.65] text-[#e1e8e8]${isDescriptionExpanded ? "" : " line-clamp-5"}`}
        id={`opportunity-description-${opportunity.id}`}
      >
        {opportunity.description}
      </p>
      {hasLongDescription && (
        <div className="opportunity-card-expand-row mt-2 flex justify-end">
          <button
            className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-accent-light hover:text-[#a0f1d2]"
            type="button"
            aria-expanded={isDescriptionExpanded}
            aria-controls={`opportunity-description-${opportunity.id}`}
            onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
          >
            {isDescriptionExpanded ? "Show less" : "Show more"}
          </button>
        </div>
      )}
      {(categories.length > 0 ||
        opportunity.skillsSought.length > 0 ||
        experience ||
        city) && (
        <div
          className="opportunity-card-metadata mt-[15px] flex min-w-0 flex-wrap items-center gap-y-2 [&>*+*]:ml-3 [&>*+*]:border-l [&>*+*]:border-[#394447] [&>*+*]:pl-3 max-[420px]:items-start max-[420px]:gap-x-2 max-[420px]:gap-y-[10px] max-[420px]:[&>*+*]:ml-0 max-[420px]:[&>*+*]:border-l-0 max-[420px]:[&>*+*]:pl-0"
          aria-label="Opportunity details"
        >
          {categories.length > 0 && (
            <div className="flex min-w-0 max-w-full items-center">
              <ul className="flex flex-wrap gap-[7px]">
                {categories.map((category) => (
                  <li
                    className="rounded-full border border-[#303c3f] bg-[#20292c] px-[9px] py-[5px] text-xs text-[#d0dbdc]"
                    key={category}
                  >
                    {category}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {opportunity.skillsSought.length > 0 && (
            <div className="flex min-w-0 max-w-full items-center">
              <ul className="flex flex-wrap gap-[7px]">
                {opportunity.skillsSought.map((skill) => (
                  <li
                    className="rounded-full border border-[#303c3f] bg-[#20292c] px-[9px] py-[5px] text-xs text-[#d0dbdc]"
                    key={skill}
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(experience || city) && (
            <div className="flex flex-wrap items-center gap-[7px] max-w-full">
              {experience && (
                <span className="rounded-full border border-[#303a3d] bg-[#20292c] px-[9px] py-[5px] text-xs text-[#d0dbdc]">
                  {experience}
                </span>
              )}
              {city && (
                <span className="rounded-full border border-[#303a3d] bg-[#20292c] px-[9px] py-[5px] text-xs text-[#d0dbdc]">
                  City: {city}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      <footer className="opportunity-card-actions mt-4 flex flex-wrap items-center gap-2">
        <button
          className={`inline-flex cursor-pointer items-center gap-[7px] rounded-lg border-0 bg-transparent px-2 py-1.5 text-[13px] text-[#91a4aa] hover:bg-[#1b2529] hover:text-accent-light [&>svg]:size-[18px] [&>svg]:shrink-0${isSaved ? " text-accent-light" : ""}`}
          type="button"
          onClick={() => onSave(opportunity)}
          aria-pressed={Boolean(isSaved)}
          aria-label={
            isSaved ? "Remove from saved opportunities" : "Save opportunity"
          }
          title={isSaved ? "Remove from saved" : "Save opportunity"}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill={isSaved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4V4.75Z" />
          </svg>
          <span>{isSaved ? "Saved" : "Save"}</span>
        </button>
        <button
          className="inline-flex cursor-pointer items-center gap-[7px] rounded-lg border-0 bg-transparent px-2 py-1.5 text-[13px] text-[#91a4aa] hover:bg-[#1b2529] hover:text-accent-light [&>svg]:size-[18px] [&>svg]:shrink-0"
          type="button"
          onClick={() => onComments(opportunity)}
          aria-label={`Open ${opportunity.commentCount ?? 0} comments`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
          </svg>
          <span>{opportunity.commentCount ?? 0}</span>
        </button>
        <button
          className="inline-flex cursor-pointer items-center gap-[7px] rounded-lg border-0 bg-transparent px-2 py-1.5 text-[13px] text-[#91a4aa] hover:bg-[#1b2529] hover:text-accent-light [&>svg]:size-[18px] [&>svg]:shrink-0"
          type="button"
          onClick={() => onShare(opportunity)}
          aria-label={isLinkCopied ? "Link copied" : "Share opportunity"}
          title={isLinkCopied ? "Link copied" : "Share opportunity"}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
          </svg>
          <span>{isLinkCopied ? "Copied" : "Share"}</span>
        </button>
      </footer>
    </article>
  );
}

function CommentsDialog({
  opportunity,
  user,
  isOwner,
  onClose,
  onCommentCountChange,
}) {
  const [comments, setComments] = useState([]);
  const [commentsEnabled, setCommentsEnabled] = useState(
    opportunity.commentsEnabled,
  );
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingCommentId, setSavingCommentId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    fetch(`/api/opportunities/${encodeURIComponent(opportunity.id)}/comments`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error?.message ?? "Could not load comments.");
        if (isCurrent) {
          setComments(result.comments);
          setCommentsEnabled(result.commentsEnabled);
        }
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [opportunity.id]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      const openMenu = document.querySelector(".comment-menu[open]");
      if (openMenu) {
        openMenu.open = false;
        event.stopPropagation();
      } else if (!isSubmitting) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isSubmitting, onClose]);

  useEffect(() => {
    const closeMenusOutside = (event) => {
      document.querySelectorAll(".comment-menu[open]").forEach((menu) => {
        if (!menu.contains(event.target)) menu.open = false;
      });
    };
    document.addEventListener("pointerdown", closeMenusOutside);
    return () => document.removeEventListener("pointerdown", closeMenusOutside);
  }, []);

  async function submitComment(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.id)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not post your comment.",
        );
      setComments((current) => [...current, result.comment]);
      setDraft("");
      onCommentCountChange(opportunity.id, comments.length + 1);
    } catch (submitError) {
      setError(
        submitError.message ||
          "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteComment(comment) {
    setDeletingCommentId(comment.id);
    setError("");
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.id)}/comments/${encodeURIComponent(comment.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error?.message ?? "Could not delete the comment.",
        );
      }
      const nextComments = comments.filter((item) => item.id !== comment.id);
      setComments(nextComments);
      onCommentCountChange(opportunity.id, nextComments.length);
    } catch (deleteError) {
      setError(
        deleteError.message ||
          "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function saveComment(comment) {
    const text = editDraft.trim();
    if (!text || savingCommentId) return;
    setSavingCommentId(comment.id);
    setError("");
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.id)}/comments/${encodeURIComponent(comment.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not update the comment.",
        );
      setComments((current) =>
        current.map((item) => (item.id === comment.id ? result.comment : item)),
      );
      setEditingCommentId(null);
      setEditDraft("");
    } catch (saveError) {
      setError(
        saveError.message ||
          "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setSavingCommentId(null);
    }
  }

  return (
    <div
      className="profile-modal-backdrop [&::-webkit-scrollbar]:hidden [position:fixed] [z-index:50] [inset:0] [display:grid] [place-items:center] [overflow:hidden] [padding:24px] [background:rgb(3_8_10_/_78%)] [scrollbar-width:none] [padding:0]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        className="profile-edit-modal [&::-webkit-scrollbar]:hidden max-[600px]:[&:not(.confirmation-modal)]:w-full max-[600px]:[&:not(.confirmation-modal)]:max-w-none max-[600px]:[&:not(.confirmation-modal)]:h-dvh max-[600px]:[&:not(.confirmation-modal)]:max-h-dvh max-[600px]:[&:not(.confirmation-modal)]:rounded-none max-[600px]:[&:not(.confirmation-modal)]:border-0 max-[600px]:[&:not(.confirmation-modal)]:p-0 comments-modal [width:min(100%,_760px)] [max-height:min(88vh,_820px)] [max-height:min(88dvh,_820px)] [display:flex] [flex-direction:column] [overflow:hidden] [padding:0] [border:1px_solid_#303a3e] [border-radius:18px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_45%)] [scrollbar-width:none] [width:min(100%,_560px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-heading"
      >
        <ModalHeader>
          <div className="comments-modal-title">
            <h2
              className="max-[600px]:[font-size:21px] [margin:0] [font-size:24px] [letter-spacing:-0.03em]"
              id="comments-heading"
            >
              Comments
            </h2>
            <p className="[margin:4px_0_0] [color:#91a4aa] [font-size:13px]">
              On {opportunity.owner.name}’s opportunity
            </p>
          </div>
          <ModalCloseButton
            type="button"
            label="Close comments"
            onClick={onClose}
          >
            &times;
          </ModalCloseButton>
        </ModalHeader>
        <div className="profile-modal-scroll [&::-webkit-scrollbar]:hidden comments-modal-scroll [min-height:0] [flex:1_1_auto] [overflow-y:auto] [padding:20px_24px] [overscroll-behavior:contain] [scrollbar-width:none] [padding:16px] [display:flex] [flex-direction:column] [gap:16px]">
          {isLoading ? (
            <p
              className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
              role="status"
            >
              Loading comments...
            </p>
          ) : comments.length > 0 ? (
            <ol className="comment-list [display:flex] [flex-direction:column] [gap:18px] [margin:0] [padding:0] [list-style:none]">
              {comments.map((comment) => (
                <li key={comment.id}>
                  <article className="comment-item [position:relative] [display:flex] [align-items:flex-start] [gap:11px]">
                    <div
                      className="comment-avatar [display:grid] [width:36px] [height:36px] [flex:0_0_auto] [place-items:center] [border:1px_solid_#28634f] [border-radius:50%] [background:#1b3029] [color:#65e7b7] [font-weight:700]"
                      aria-hidden="true"
                    >
                      {comment.author.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="comment-content [min-width:0] [flex:1_1_auto] [&>header_a]:text-[#eef4f4] [&>header_a]:font-bold [&>header_a]:no-underline [&>header_span]:text-[#91a4aa] [&>header_span]:text-xs">
                      <header className="[display:flex] [flex-wrap:wrap] [align-items:baseline] [gap:4px_8px]">
                        <a
                          className="hover:[text-decoration:underline]"
                          href={`/profile/${encodeURIComponent(comment.author.username)}`}
                        >
                          {comment.author.name}
                        </a>
                        <span className="[color:#91a4aa] [font-size:12px]">
                          @{comment.author.username} ·{" "}
                          {formatPostTime(comment.createdAt)}
                        </span>
                      </header>
                      {editingCommentId === comment.id ? (
                        <div className="comment-edit-form [&>button:last-child]:border-[#19c990] [&>button:last-child]:bg-[#19c990] [&>button:last-child]:text-[#07120f] [&>button:last-child]:font-bold [display:grid] [gap:8px] [margin-top:8px]">
                          <label
                            className="visually-hidden [position:absolute] [width:1px] [height:1px] [overflow:hidden] [clip:rect(0,_0,_0,_0)] [white-space:nowrap] [clip-path:inset(50%)]"
                            htmlFor={`edit-comment-${comment.id}`}
                          >
                            Edit your comment
                          </label>
                          <textarea
                            className="[width:100%] [min-height:72px] [resize:vertical] [padding:10px_12px] [border:1px_solid_#303a3e] [border-radius:10px] [background:#0d1215] [color:#edf3f4] [font:inherit]"
                            id={`edit-comment-${comment.id}`}
                            value={editDraft}
                            onChange={(event) =>
                              setEditDraft(event.target.value)
                            }
                            maxLength={1000}
                            rows={3}
                            disabled={savingCommentId === comment.id}
                          />
                          <div className="[display:flex] [justify-content:flex-end] [gap:8px]">
                            <button
                              className="disabled:[cursor:wait] disabled:[opacity:0.6] [padding:6px_10px] [border:1px_solid_#303a3e] [border-radius:8px] [background:#1b2529] [color:#dce5e6] [cursor:pointer] [font:inherit] [font-size:12px]"
                              type="button"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditDraft("");
                              }}
                              disabled={savingCommentId === comment.id}
                            >
                              Cancel
                            </button>
                            <button
                              className="disabled:[cursor:wait] disabled:[opacity:0.6] [padding:6px_10px] [border:1px_solid_#303a3e] [border-radius:8px] [background:#1b2529] [color:#dce5e6] [cursor:pointer] [font:inherit] [font-size:12px]"
                              type="button"
                              onClick={() => saveComment(comment)}
                              disabled={
                                !editDraft.trim() ||
                                savingCommentId === comment.id
                              }
                            >
                              {savingCommentId === comment.id
                                ? "Saving..."
                                : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="[margin:5px_0_0] [color:#dce5e6] [line-height:1.5] [overflow-wrap:anywhere] [white-space:pre-wrap]">
                          {comment.text}
                        </p>
                      )}
                    </div>
                    {user && (user.id === comment.author.id || isOwner) && (
                      <details
                        className="comment-menu group [&_summary::-webkit-details-marker]:hidden [position:relative] [flex:0_0_auto] [margin-left:auto]"
                        onToggle={(event) => {
                          if (!event.currentTarget.open) return;
                          const rect = event.currentTarget
                            .querySelector("summary")
                            .getBoundingClientRect();
                          const menuWidth = 126;
                          const left = Math.max(
                            8,
                            Math.min(
                              rect.right - menuWidth,
                              window.innerWidth - menuWidth - 8,
                            ),
                          );
                          const top = Math.max(
                            8,
                            Math.min(rect.bottom + 4, window.innerHeight - 96),
                          );
                          event.currentTarget.style.setProperty(
                            "--comment-menu-left",
                            `${left}px`,
                          );
                          event.currentTarget.style.setProperty(
                            "--comment-menu-top",
                            `${top}px`,
                          );
                        }}
                      >
                        <summary
                          className="[display:grid] [width:32px] [height:32px] [place-items:center] [border-radius:50%] [color:#aebbbd] [cursor:pointer] [font-weight:700] [letter-spacing:1px] [list-style:none] [&::-webkit-details-marker]:hidden hover:[background:#222d31] hover:[color:#edf3f4] group-open:[background:#222d31] group-open:[color:#edf3f4]"
                          aria-label="Comment actions"
                        >
                          •••
                        </summary>
                        <div className="comment-menu-items [&>button]:[padding:8px_10px] [&>button]:[border:0] [&>button]:[border-radius:7px] [&>button]:[background:transparent] [&>button]:[color:#dce5e6] [&>button]:[cursor:pointer] [&>button]:[font:inherit] [&>button]:[text-align:left] [&>button:hover]:bg-[#222d31] [&>button:disabled]:cursor-wait [&>button:disabled]:opacity-60 [position:fixed] [z-index:1000] [top:var(--comment-menu-top,_0)] [left:var(--comment-menu-left,_0)] [display:grid] [min-width:126px] [padding:5px] [border:1px_solid_#303a3e] [border-radius:10px] [background:#141a1e] [box-shadow:0_10px_28px_rgb(0_0_0_/_35%)]">
                          {user.id === comment.author.id &&
                            editingCommentId !== comment.id && (
                              <button
                                className="disabled:[cursor:wait] disabled:[opacity:0.6]"
                                type="button"
                                onClick={(event) => {
                                  event.currentTarget.closest("details").open =
                                    false;
                                  setEditingCommentId(comment.id);
                                  setEditDraft(comment.text);
                                  setError("");
                                }}
                              >
                                Edit
                              </button>
                            )}
                          <button
                            className="comment-menu-delete [padding:8px_10px] [border:0] [border-radius:7px] [background:transparent] [color:#dce5e6] [cursor:pointer] [font:inherit] [text-align:left] hover:[background:#222d31] [color:#d88989] disabled:[cursor:wait] disabled:[opacity:0.6]"
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.closest("details").open =
                                false;
                              deleteComment(comment);
                            }}
                            disabled={
                              deletingCommentId === comment.id ||
                              editingCommentId === comment.id
                            }
                          >
                            {deletingCommentId === comment.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </details>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <p className="comments-empty [margin:0] [color:#91a4aa] [text-align:center]">
              No comments yet.
            </p>
          )}
          {error && (
            <p
              className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45]"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
        {!isLoading &&
          commentsEnabled &&
          (user ? (
            <form
              className="comment-compose [display:flex] [flex:0_0_auto] [align-items:flex-end] [gap:10px] [padding:14px_24px_18px] [border-top:1px_solid_#252d31] [gap:8px] [padding:12px_16px_calc(14px_+_env(safe-area-inset-bottom))]"
              onSubmit={submitComment}
            >
              <label
                className="visually-hidden [position:absolute] [width:1px] [height:1px] [overflow:hidden] [clip:rect(0,_0,_0,_0)] [white-space:nowrap] [clip-path:inset(50%)]"
                htmlFor="new-opportunity-comment"
              >
                Write a comment
              </label>
              <textarea
                className="focus:[outline:2px_solid_#19c990] focus:[outline-offset:1px] w-auto min-w-0 min-h-10 flex-1 resize-y py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                id="new-opportunity-comment"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={1000}
                rows={1}
                placeholder="Write a comment…"
                disabled={isSubmitting}
              />
              <Button
                variant="primary"
                className="w-auto! [flex:0_0_auto] [min-width:92px] [min-height:44px] [margin:0] max-[600px]:[min-width:78px] max-[600px]:[padding-inline:12px]"
                type="submit"
                disabled={!draft.trim() || isSubmitting}
              >
                {isSubmitting ? "Posting…" : "Comment"}
              </Button>
            </form>
          ) : (
            <p className="comments-signin-note [margin:0] [color:#91a4aa] [text-align:center] [padding:18px_24px] [border-top:1px_solid_#252d31] max-[600px]:[padding:16px]">
              Sign in to add a comment.
            </p>
          ))}
        {!commentsEnabled && (
          <p className="comments-signin-note [margin:0] [color:#91a4aa] [text-align:center] [padding:18px_24px] [border-top:1px_solid_#252d31] max-[600px]:[padding:16px]">
            Comments are turned off for this opportunity.
          </p>
        )}
      </section>
    </div>
  );
}

function OpportunityComposer({
  editingOpportunityId,
  opportunityForm,
  setOpportunityForm,
  opportunitySkillDraft,
  setOpportunitySkillDraft,
  fieldErrors,
  message,
  setFieldErrors,
  handleOpportunityFormChange,
  addOpportunitySkill,
  handleOpportunitySubmit,
  isSubmitting,
  onClose,
}) {
  return (
    <div
      className="profile-modal-backdrop [&::-webkit-scrollbar]:hidden [position:fixed] [z-index:50] [inset:0] [display:grid] [place-items:center] [overflow:hidden] [padding:24px] [background:rgb(3_8_10_/_78%)] [scrollbar-width:none] [padding:0]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        className="profile-edit-modal [&::-webkit-scrollbar]:hidden max-[600px]:[&:not(.confirmation-modal)]:w-full max-[600px]:[&:not(.confirmation-modal)]:max-w-none max-[600px]:[&:not(.confirmation-modal)]:h-dvh max-[600px]:[&:not(.confirmation-modal)]:max-h-dvh max-[600px]:[&:not(.confirmation-modal)]:rounded-none max-[600px]:[&:not(.confirmation-modal)]:border-0 max-[600px]:[&:not(.confirmation-modal)]:p-0 opportunity-composer-modal [width:min(100%,_760px)] [max-height:min(88vh,_820px)] [max-height:min(88dvh,_820px)] [display:flex] [flex-direction:column] [overflow:hidden] [padding:0] [border:1px_solid_#303a3e] [border-radius:18px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_45%)] [scrollbar-width:none]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-opportunity-heading"
      >
        <ModalHeader>
          <h2
            className="max-[600px]:[font-size:21px]"
            id="create-opportunity-heading"
          >
            {editingOpportunityId ? "Edit opportunity" : "Create opportunity"}
          </h2>
          <ModalCloseButton
            type="button"
            label="Close opportunity form"
            onClick={onClose}
            disabled={isSubmitting}
          >
            &times;
          </ModalCloseButton>
        </ModalHeader>
        <form
          className="opportunity-form [&_.form-field:last-of-type]:mb-0 [display:flex] [flex:1_1_auto] [flex-direction:column] [min-height:0]"
          onSubmit={handleOpportunitySubmit}
          noValidate
        >
          <div className="profile-modal-scroll [&::-webkit-scrollbar]:hidden opportunity-modal-scroll [min-height:0] [flex:1_1_auto] [overflow-y:auto] [padding:20px_24px] [overscroll-behavior:contain] [scrollbar-width:none] [padding:16px]">
            <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] opportunity-description-field [display:grid] [gap:8px] [margin-bottom:18px]">
              <label
                className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                htmlFor="opportunity-description"
              >
                What are you building?
              </label>
              <textarea
                className="[min-height:176px]"
                id="opportunity-description"
                name="description"
                rows={5}
                placeholder="Describe your project and who you'd like to collaborate with."
                value={opportunityForm.description}
                onChange={handleOpportunityFormChange}
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={
                  fieldErrors.description
                    ? "opportunity-description-error"
                    : undefined
                }
                required
              />
              {fieldErrors.description && (
                <span
                  className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]"
                  id="opportunity-description-error"
                >
                  {fieldErrors.description}
                </span>
              )}
            </div>

            <section
              className="opportunity-details-panel [min-width:0] [margin-top:24px] [padding:20px] [border:1px_solid_#303a3e] [border-radius:16px] [background:#101619]"
              aria-labelledby="opportunity-details-heading"
            >
              <h3
                className="[margin:0_0_18px] [color:#edf3f4] [font-size:16px] [font-weight:650] [letter-spacing:-0.01em]"
                id="opportunity-details-heading"
              >
                Details
              </h3>
              <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] opportunity-skills-field [display:grid] [gap:8px] [margin-bottom:18px] [min-width:0] [margin:0]">
                <label
                  className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                  htmlFor="opportunity-skills"
                >
                  Skills
                </label>
                <div className="opportunity-skill-entry [display:grid] [min-width:0] [grid-template-columns:minmax(0,_1fr)_auto] [align-items:center] [gap:8px] [grid-template-columns:minmax(0,_1fr)]">
                  <input
                    className="[width:100%] [min-width:0] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease] focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)]"
                    id="opportunity-skills"
                    type="text"
                    maxLength={40}
                    placeholder="For example, React"
                    value={opportunitySkillDraft}
                    onChange={(event) => {
                      setOpportunitySkillDraft(event.target.value);
                      setFieldErrors((current) => ({
                        ...current,
                        skillsSought: undefined,
                      }));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addOpportunitySkill();
                      }
                    }}
                    aria-invalid={Boolean(fieldErrors.skillsSought)}
                    aria-describedby={
                      fieldErrors.skillsSought
                        ? "opportunity-skills-error"
                        : undefined
                    }
                  />
                  <Button
                    variant="secondary"
                    className="[white-space:nowrap] max-[480px]:[justify-self:start]"
                    type="button"
                    onClick={addOpportunitySkill}
                  >
                    Add skill
                  </Button>
                </div>
                {opportunityForm.skillsSought.length > 0 && (
                  <ul
                    className="opportunity-skill-tags [display:flex] [flex-wrap:wrap] [gap:8px] [margin:12px_0_0] [padding:0] [list-style:none]"
                    aria-label="Skills needed"
                  >
                    {opportunityForm.skillsSought.map((skill) => (
                      <li key={skill}>
                        <span>{skill}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${skill} skill`}
                          onClick={() =>
                            setOpportunityForm((current) => ({
                              ...current,
                              skillsSought: current.skillsSought.filter(
                                (item) => item !== skill,
                              ),
                            }))
                          }
                        >
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {fieldErrors.skillsSought && (
                  <span
                    className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]"
                    id="opportunity-skills-error"
                  >
                    {fieldErrors.skillsSought}
                  </span>
                )}
              </div>

              <div className="opportunity-metadata [margin-top:20px] [padding-top:18px] [border-top:1px_solid_#303a3e]">
                <fieldset className="opportunity-categories [min-width:0] [margin:0_0_20px] [padding:0] [border:0]">
                  <legend className="[margin-bottom:10px] [color:#d9e1e2] [font-size:14px] [font-weight:600]">
                    Categories
                  </legend>
                  <div className="opportunity-category-options [display:flex] [flex-wrap:wrap] [gap:8px]">
                    {opportunityCategoryOptions.map(([value, label]) => (
                      <label
                        className="opportunity-category-option [&:has(input:checked)]:border-[#28634f] [&:has(input:checked)]:bg-[#1b3029] [&:has(input:checked)]:text-[#65e7b7] [display:inline-flex] [min-height:38px] [align-items:center] [gap:8px] [padding:7px_11px] [border:1px_solid_#303a3e] [border-radius:999px] [background:#0d1215] [color:#c7d2d3] [cursor:pointer] [font-size:13px]"
                        key={value}
                      >
                        <input
                          className="[width:15px] [height:15px] [margin:0] [accent-color:#19c990]"
                          type="checkbox"
                          name="categories"
                          value={value}
                          checked={opportunityForm.categories.includes(value)}
                          onChange={handleOpportunityFormChange}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.categories && (
                    <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                      {fieldErrors.categories}
                    </span>
                  )}
                </fieldset>
                <div className="opportunity-metadata-fields [display:grid] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [align-items:start] [gap:0_16px] [grid-template-columns:minmax(0,_1fr)]">
                  <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px] [min-width:0] [align-content:start] [margin-bottom:0]">
                    <label
                      className="[color:#d9e1e2] [font-size:14px] [font-weight:600] [min-height:20px] [line-height:20px]"
                      htmlFor="opportunity-experience"
                    >
                      Experience sought
                    </label>
                    <select
                      className="[display:block] [width:100%] [height:48px] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease] [padding:0_40px_0_14px] [appearance:none] [background-color:#0d1215] [background-image:url(data:image/svg+xml,%3Csvg_xmlns='http://www.w3.org/2000/svg'_width='16'_height='16'_viewBox='0_0_16_16'_fill='none'%3E%3Cpath_d='m4_6_4_4_4-4'_stroke='%2391a2a5'_stroke-width='1.5'_stroke-linecap='round'_stroke-linejoin='round'/%3E%3C/svg%3E)] [background-position:right_14px_center] [background-repeat:no-repeat] [cursor:pointer] [line-height:1.2] focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)]"
                      id="opportunity-experience"
                      name="experienceSought"
                      value={opportunityForm.experienceSought}
                      onChange={handleOpportunityFormChange}
                      aria-invalid={Boolean(fieldErrors.experienceSought)}
                    >
                      <option value="">Any experience level</option>
                      {experienceOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.experienceSought && (
                      <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                        {fieldErrors.experienceSought}
                      </span>
                    )}
                  </div>
                  <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px] [min-width:0] [align-content:start] [margin-bottom:0]">
                    <label
                      className="[color:#d9e1e2] [font-size:14px] [font-weight:600] [min-height:20px] [line-height:20px]"
                      htmlFor="opportunity-city"
                    >
                      City (optional)
                    </label>
                    <input
                      className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
                      id="opportunity-city"
                      name="city"
                      type="text"
                      maxLength={100}
                      value={opportunityForm.city}
                      onChange={handleOpportunityFormChange}
                      aria-invalid={Boolean(fieldErrors.city)}
                      placeholder="For local collaboration"
                    />
                    {fieldErrors.city && (
                      <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                        {fieldErrors.city}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>
            {message && (
              <p
                className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45]"
                role="alert"
              >
                {message}
              </p>
            )}
          </div>
          <ModalFooter className="[flex-wrap:wrap] [align-items:center]">
            <Button
              variant="primary"
              className="w-auto! [min-width:150px] [min-height:46px] [margin:0] [padding-inline:16px] [flex:0_0_auto]"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? editingOpportunityId
                  ? "Saving..."
                  : "Publishing..."
                : editingOpportunityId
                  ? "Save changes"
                  : "Publish opportunity"}
            </Button>
            <Button
              variant="secondary"
              className="min-h-12 px-6 text-base"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </ModalFooter>
        </form>
      </section>
    </div>
  );
}

export { CommentsDialog, OpportunityCard, OpportunityComposer };
