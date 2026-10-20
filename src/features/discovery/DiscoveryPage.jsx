import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";

const OpportunityRequestAction = lazy(() =>
  import("../requests/OpportunityRequestAction.jsx").then((module) => ({
    default: module.OpportunityRequestAction,
  })),
);

const OpportunityForm = lazy(() =>
  import("../opportunities/OpportunityManagement.jsx").then((module) => ({
    default: module.OpportunityForm,
  })),
);

const pageSize = 20;
const projectTypes = [
  ["web", "Web app"],
  ["mobile", "Mobile app"],
  ["desktop", "Desktop app"],
  ["game", "Game"],
  ["developer_tool", "Developer tool"],
  ["data_ai", "Data and AI"],
  ["hardware_iot", "Hardware and IoT"],
  ["other", "Other"],
];
const experienceLevels = [
  ["beginner_friendly", "Beginner friendly"],
  ["junior", "Junior"],
  ["intermediate", "Intermediate"],
  ["experienced_mentor", "Experienced mentor"],
  ["any_level", "Any level"],
];

function cleanSearch(value) {
  return value
    .slice(0, 100)
    .replace(/[^\p{L}\p{N}_\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addTextSearch(query, text, columns) {
  const term = cleanSearch(text);
  if (!term) return query;
  const pattern = `%${term}%`;
  return query.or(
    columns.map((column) => `${column}.ilike.${pattern}`).join(","),
  );
}

function applyLocation(query, location) {
  if (location === "other") {
    return query.is("city_id", null).not("city_other", "is", null);
  }
  if (location) return query.eq("city_id", location);
  return query;
}

function buildDirectoryQuery(filters, offset) {
  const skillsEmbed = filters.skillId
    ? "profile_skills!inner(skill_id, skills(id, name))"
    : "profile_skills(skills(id, name))";
  let query = supabase
    .from("profiles")
    .select(
      `user_id, username, display_name, bio, city_id, city_other, avatar_path, cities(name), ${skillsEmbed}`,
    )
    .order("display_name")
    .order("username")
    .range(offset, offset + pageSize);
  query = addTextSearch(query, filters.search, [
    "display_name",
    "username",
    "bio",
  ]);
  query = applyLocation(query, filters.city);
  if (filters.skillId)
    query = query.eq("profile_skills.skill_id", filters.skillId);
  return query;
}

function buildOpportunityQuery(filters, offset, userId) {
  const skillsEmbed = filters.skillId
    ? "opportunity_skills!inner(skill_id, skills(id, name))"
    : "opportunity_skills(skills(id, name))";
  let query = supabase
    .from("opportunities")
    .select(
      `id, title, description, project_type, project_type_other, experience_levels, commitment, city_id, city_other, cover_path, status, created_at, creator:profiles!opportunities_creator_id_fkey(user_id, username, display_name, avatar_path), city:cities!opportunities_city_id_fkey(name), ${skillsEmbed}`,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + pageSize);
  if (userId) query = query.neq("creator_id", userId);
  query = addTextSearch(query, filters.search, ["title", "description"]);
  query = applyLocation(query, filters.city);
  if (filters.skillId)
    query = query.eq("opportunity_skills.skill_id", filters.skillId);
  if (filters.type) query = query.eq("project_type", filters.type);
  if (filters.experience) {
    query = query.overlaps("experience_levels", [
      filters.experience,
      "any_level",
    ]);
  }
  return query;
}

async function signedImages(bucket, paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return {};
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, 3600);
  return Object.fromEntries(
    (data ?? [])
      .filter((item) => item.signedUrl)
      .map((item) => [item.path, item.signedUrl]),
  );
}

function useFilterOptions() {
  const [cities, setCities] = useState([]);
  const [skills, setSkills] = useState([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    Promise.all([
      supabase
        .from("cities")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("skills").select("id, name").order("normalized_name"),
    ]).then(([citiesResult, skillsResult]) => {
      if (!active) return;
      if (!citiesResult.error) setCities(citiesResult.data ?? []);
      if (!skillsResult.error) setSkills(skillsResult.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);
  return { cities, skills };
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function DiscoveryFilters({
  cities,
  skills,
  values,
  onChange,
  action,
  showOpportunityFilters = false,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState({
    city: values.city,
    skillId: values.skillId,
    type: values.type,
    experience: values.experience,
  });
  function openFilters() {
    if (!filtersOpen) {
      setDraft({
        city: values.city,
        skillId: values.skillId,
        type: values.type,
        experience: values.experience,
      });
    }
    setFiltersOpen(true);
  }
  function clearFilters() {
    onChange("reset", "");
    setDraft({ city: "", skillId: "", type: "", experience: "" });
    setFiltersOpen(false);
  }
  return (
    <section
      className={`discovery-filters${showOpportunityFilters ? " opportunity-search-filters" : ""}`}
      aria-label="Search and filters"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFiltersOpen(false);
        }
      }}
    >
      <label className="field-label discovery-search-label">
        Search
        <input
          className="field-control"
          type="search"
          value={values.search}
          aria-expanded={filtersOpen}
          aria-controls="discovery-filter-options"
          onFocus={openFilters}
          onChange={(event) => onChange("search", event.target.value)}
          placeholder={
            showOpportunityFilters ? "Search projects" : "Search developers"
          }
        />
      </label>
      {action}
      <div
        className="discovery-filter-options"
        id="discovery-filter-options"
        hidden={!filtersOpen}
      >
        {showOpportunityFilters && (
          <>
            <label className="field-label">
              Project type
              <select
                className="field-control"
                value={draft.type}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    type: event.target.value,
                  }))
                }
              >
                <option value="">All types</option>
                {projectTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Experience
              <select
                className="field-control"
                value={draft.experience}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    experience: event.target.value,
                  }))
                }
              >
                <option value="">Any experience</option>
                {experienceLevels.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="field-label">
          City
          <select
            className="field-control"
            value={draft.city}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                city: event.target.value,
              }))
            }
          >
            <option value="">All cities</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
            <option value="other">Other city</option>
          </select>
        </label>
        <label className="field-label">
          Skill
          <select
            className="field-control"
            value={draft.skillId}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                skillId: event.target.value,
              }))
            }
          >
            <option value="">All skills</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
        </label>
        <button className="text-button" type="button" onClick={clearFilters}>
          Clear filters
        </button>
        <button
          className="button button-primary apply-filters-button"
          type="button"
          onClick={() => {
            onChange("apply", draft);
            setFiltersOpen(false);
          }}
        >
          Apply filters
        </button>
      </div>
    </section>
  );
}

function FilteredListing({ mode, user, showComposer = false }) {
  const directory = mode === "developers";
  const { cities, skills } = useFilterOptions();
  const [filters, setFilters] = useState({
    search: "",
    city: "",
    skillId: "",
    type: "",
    experience: "",
  });
  const search = useDebouncedValue(filters.search);
  const [rows, setRows] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [composerOpen, setComposerOpen] = useState(showComposer);
  const [publishNotice, setPublishNotice] = useState("");
  const { city, skillId, type, experience } = filters;
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError("");
      const queryFilters = { search, city, skillId, type, experience };
      const request = directory
        ? buildDirectoryQuery(queryFilters, 0)
        : buildOpportunityQuery(queryFilters, 0, user?.id);
      const { data, error: queryError } = await request;
      if (!active) return;
      if (queryError) {
        setError("We couldn’t load results. Please try again.");
        setRows([]);
        setHasMore(false);
        setOffset(0);
        setLoading(false);
        return;
      }
      const pageResults = data ?? [];
      const results = pageResults.slice(0, pageSize);
      setRows(results);
      setHasMore(pageResults.length > pageSize);
      setOffset(results.length);
      setImageUrls({});
      setLoading(false);
      const avatars = results
        .map((row) => (directory ? row.avatar_path : row.creator?.avatar_path))
        .filter(Boolean);
      const covers = directory
        ? []
        : results.map((row) => row.cover_path).filter(Boolean);
      const [avatarUrls, coverUrls] = await Promise.all([
        signedImages("profile-media", avatars),
        signedImages("opportunity-media", covers),
      ]);
      if (active) setImageUrls({ ...avatarUrls, ...coverUrls });
    }
    load();
    return () => {
      active = false;
    };
  }, [
    directory,
    search,
    city,
    skillId,
    type,
    experience,
    retryCount,
    user?.id,
  ]);

  function updateFilter(key, value) {
    if (key === "apply") {
      setFilters((current) => ({ ...current, ...value }));
      return;
    }
    if (key === "reset") {
      setFilters({
        search: "",
        city: "",
        skillId: "",
        type: "",
        experience: "",
      });
      return;
    }
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function loadMore() {
    setMoreBusy(true);
    const queryFilters = { ...filters, search };
    const request = directory
      ? buildDirectoryQuery(queryFilters, offset)
      : buildOpportunityQuery(queryFilters, offset, user?.id);
    const { data, error: moreError } = await request;
    if (moreError) setError("We couldn’t load more results. Please try again.");
    else {
      const pageResults = data ?? [];
      const results = pageResults.slice(0, pageSize);
      setRows((current) => [...current, ...results]);
      setOffset((current) => current + results.length);
      setHasMore(pageResults.length > pageSize);
      setMoreBusy(false);
      const avatars = results
        .map((row) => (directory ? row.avatar_path : row.creator?.avatar_path))
        .filter(Boolean);
      const covers = directory
        ? []
        : results.map((row) => row.cover_path).filter(Boolean);
      const [avatarUrls, coverUrls] = await Promise.all([
        signedImages("profile-media", avatars),
        signedImages("opportunity-media", covers),
      ]);
      setImageUrls((current) => ({ ...current, ...avatarUrls, ...coverUrls }));
    }
    setMoreBusy(false);
  }

  if (!isSupabaseConfigured) {
    return (
      <StatusPanel
        title="Connect Supabase"
        text="Add the public Supabase URL and key to your local environment to browse EthioDev."
      />
    );
  }

  return (
    <>
      <nav className="explore-tabs" aria-label="Explore">
        <a
          href="/opportunities"
          aria-current={!directory ? "page" : undefined}
          className={!directory ? "is-current" : undefined}
        >
          Discover
        </a>
        <a
          href="/developers"
          aria-current={directory ? "page" : undefined}
          className={directory ? "is-current" : undefined}
        >
          Developers
        </a>
      </nav>
      {!directory && publishNotice && (
        <p className="feedback feedback-success" role="status">
          {publishNotice}
        </p>
      )}
      {!directory && composerOpen && (
        <div className="feed-composer" id="opportunity-composer">
          <Suspense fallback={<p role="status">Loading composer…</p>}>
            <OpportunityForm
              user={user}
              embedded
              onCancel={() => setComposerOpen(false)}
              onPublished={({ coverFailed }) => {
                setComposerOpen(false);
                setRetryCount((count) => count + 1);
                setPublishNotice(
                  coverFailed
                    ? "Your opportunity is posted, but its cover image did not upload. You can add it by editing the post."
                    : "Your opportunity is posted.",
                );
              }}
            />
          </Suspense>
        </div>
      )}
      <DiscoveryFilters
        cities={cities}
        skills={skills}
        values={filters}
        onChange={updateFilter}
        action={
          !directory && (
            <button
              className="button button-primary discovery-post-action"
              type="button"
              onClick={() => {
                if (!user) {
                  window.location.assign(
                    "/auth/sign-in?next=%2Fopportunities%2Fnew",
                  );
                  return;
                }
                setComposerOpen((open) => !open);
              }}
              aria-expanded={composerOpen}
              aria-controls="opportunity-composer"
            >
              Post an opportunity
            </button>
          )
        }
        showOpportunityFilters={!directory}
      />
      {error && rows.length > 0 && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="discovery-results" aria-label="Loading results">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="loading-skeleton discovery-skeleton" key={index} />
          ))}
        </div>
      ) : rows.length === 0 && error ? (
        <StatusPanel
          title="Couldn’t load results"
          text={error}
          action={
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setRetryCount((current) => current + 1)}
            >
              Try again
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <StatusPanel
          title={directory ? "No developers found" : "No projects yet"}
          text={
            directory
              ? "Try a different search or clear your filters."
              : "New project opportunities will appear here. Try changing your search or filters."
          }
          action={
            directory ? null : (
              <a className="text-link" href="/developers">
                Browse developers
              </a>
            )
          }
        />
      ) : (
        <div className={directory ? "developer-grid" : "opportunity-grid"}>
          {rows.map((row) =>
            directory ? (
              <DeveloperCard
                key={row.user_id}
                profile={row}
                imageUrl={imageUrls[row.avatar_path]}
              />
            ) : (
              <OpportunityCard
                key={row.id}
                opportunity={row}
                avatarUrl={imageUrls[row.creator?.avatar_path]}
                coverUrl={imageUrls[row.cover_path]}
                user={user}
              />
            ),
          )}
        </div>
      )}
      {!loading && rows.length > 0 && hasMore && (
        <div className="load-more-row">
          <button
            className="button button-secondary"
            type="button"
            onClick={loadMore}
            disabled={moreBusy}
          >
            {moreBusy ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}

function DeveloperCard({ profile, imageUrl }) {
  const skills = (profile.profile_skills ?? [])
    .map((row) => row.skills?.name)
    .filter(Boolean);
  return (
    <article className="developer-card">
      <div className="developer-card-top">
        <Avatar name={profile.display_name} src={imageUrl} />
        <div className="developer-card-identity">
          <h2>
            <a href={`/u/${encodeURIComponent(profile.username)}`}>
              {profile.display_name}
            </a>
          </h2>
          <p>@{profile.username}</p>
        </div>
      </div>
      {(profile.cities?.name || profile.city_other) && (
        <p className="developer-location">
          {profile.cities?.name ?? profile.city_other}
        </p>
      )}
      {profile.bio && <p className="developer-bio">{profile.bio}</p>}
      {skills.length > 0 ? (
        <ul className="skill-list">
          {skills.slice(0, 5).map((skill) => (
            <li className="skill-chip" key={skill}>
              {skill}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-small">Skills not added yet</p>
      )}
      <a
        className="developer-card-link"
        href={`/u/${encodeURIComponent(profile.username)}`}
      >
        View profile <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

async function processOpportunityStorageCleanup() {
  const { data: jobs, error } = await supabase.rpc(
    "claim_storage_cleanup_jobs",
  );
  if (error || !jobs?.length) return;
  for (const job of jobs) {
    await supabase.storage.from(job.bucket_id).remove([job.object_path]);
    await supabase.rpc("acknowledge_storage_cleanup_job", {
      p_job_id: job.job_id,
    });
  }
}

export function OpportunityCard({ opportunity, avatarUrl, coverUrl, user }) {
  const [expanded, setExpanded] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [status, setStatus] = useState(opportunity.status);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef(null);
  const projectType =
    opportunity.project_type === "other"
      ? opportunity.project_type_other
      : (projectTypes.find(
          ([value]) => value === opportunity.project_type,
        )?.[1] ?? opportunity.project_type);
  const city = opportunity.city?.name ?? opportunity.city_other;
  const experiences = (opportunity.experience_levels ?? []).map(
    (value) => experienceLevels.find(([key]) => key === value)?.[1] ?? value,
  );
  const skills = (opportunity.opportunity_skills ?? [])
    .map((row) => row.skills?.name)
    .filter(Boolean);
  const descriptionIsLong = opportunity.description.length > 320;
  const description =
    !expanded && descriptionIsLong
      ? `${opportunity.description.slice(0, 320).trimEnd()}…`
      : opportunity.description;
  const isOwner = user?.id === opportunity.creator?.user_id;

  async function toggleOpportunityStatus() {
    const nextStatus = status === "open" ? "closed" : "open";
    if (
      nextStatus === "closed" &&
      !window.confirm(
        "Close this opportunity? New join requests will stop. Pending requests will be removed without notifying applicants. You can reopen it later, and applicants can request again.",
      )
    ) {
      return;
    }
    setStatusBusy(true);
    setDeleteError("");
    const { error } = await supabase.rpc("set_opportunity_status", {
      p_opportunity_id: opportunity.id,
      p_status: nextStatus,
    });
    if (error) {
      setDeleteError("The opportunity status couldn’t be changed. Try again.");
    } else {
      setStatus(nextStatus);
    }
    setStatusBusy(false);
  }

  async function deleteOpportunity() {
    if (
      !window.confirm(
        "Delete this opportunity? It will disappear from discovery. Accepted collaborations and any related project will remain private to their participants.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError("");
    const { error } = await supabase.rpc("delete_opportunity", {
      p_opportunity_id: opportunity.id,
    });
    if (error) {
      setDeleteError("This opportunity couldn’t be deleted. Please try again.");
      setDeleting(false);
      return;
    }
    await processOpportunityStorageCleanup();
    setDeleted(true);
  }

  if (deleted) return null;
  return (
    <article className="opportunity-card">
      {coverUrl && (
        <div className="opportunity-card-image has-image">
          <img src={coverUrl} alt="" />
        </div>
      )}
      <div className="opportunity-card-content">
        <div className="opportunity-card-topline">
          <div className="opportunity-card-meta">
            <span className={`status-chip status-${status}`}>{status}</span>
            {projectType && <span>{projectType}</span>}
            {city && <span>{city}</span>}
            {experiences.length > 0 && <span>{experiences.join(", ")}</span>}
          </div>
          {isOwner && (
            <details className="post-menu" ref={menuRef}>
              <summary aria-label="Post settings" title="Post settings">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.7" />
                  <circle cx="12" cy="12" r="1.7" />
                  <circle cx="19" cy="12" r="1.7" />
                </svg>
              </summary>
              <div className="post-menu-panel">
                <button
                  type="button"
                  disabled={statusBusy || deleting}
                  onClick={() => {
                    menuRef.current.open = false;
                    void toggleOpportunityStatus();
                  }}
                >
                  {statusBusy
                    ? "Saving…"
                    : status === "open"
                      ? "Close post"
                      : "Reopen post"}
                </button>
                <a href={`/opportunities/${opportunity.id}/edit`}>Edit post</a>
                <button
                  type="button"
                  className="post-menu-delete"
                  disabled={statusBusy || deleting}
                  onClick={() => {
                    menuRef.current.open = false;
                    void deleteOpportunity();
                  }}
                >
                  {deleting ? "Deleting…" : "Delete post"}
                </button>
              </div>
            </details>
          )}
        </div>
        <h2>{opportunity.title}</h2>
        <p className="opportunity-summary">{description}</p>
        {descriptionIsLong && (
          <button
            className="text-button description-toggle"
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
        {skills.length > 0 && (
          <ul className="skill-list">
            {skills.slice(0, 4).map((skill) => (
              <li className="skill-chip" key={skill}>
                {skill}
              </li>
            ))}
          </ul>
        )}
        {opportunity.commitment && (
          <p className="opportunity-commitment">
            <strong>Commitment:</strong> {opportunity.commitment}
          </p>
        )}
        <a
          className="opportunity-creator"
          href={
            opportunity.creator?.username
              ? `/u/${encodeURIComponent(opportunity.creator.username)}`
              : undefined
          }
        >
          <Avatar
            name={opportunity.creator?.display_name ?? "Developer"}
            src={avatarUrl}
          />
          <span>{opportunity.creator?.display_name ?? "Developer"}</span>
        </a>
        {deleteError && (
          <p className="feedback feedback-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="opportunity-action-area">
          <OpportunityEngagement
            opportunityId={opportunity.id}
            opportunityOwnerId={opportunity.creator?.user_id}
            title={opportunity.title}
            user={user}
          />
          <Suspense fallback={null}>
            <OpportunityRequestAction
              opportunity={{ ...opportunity, status }}
              user={user}
            />
          </Suspense>
        </div>
      </div>
    </article>
  );
}

function CommentItem({
  comment,
  user,
  opportunityOwnerId,
  onReply,
  onEdit,
  onDelete,
  replyTo,
  editing,
  editorKey,
  onSave,
  onCancelReply,
  onCancelEdit,
  saving,
  busyId,
}) {
  const canEdit = user?.id === comment.author_id && !comment.deleted_at;
  const canDelete =
    !comment.deleted_at &&
    (user?.id === comment.author_id || user?.id === opportunityOwnerId);
  return (
    <li className="comment-item">
      {comment.deleted_at ? (
        <>
          <p className="comment-deleted">This comment was deleted.</p>
          {user && (
            <div className="comment-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => onReply(comment)}
              >
                Reply
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="comment-author-row">
            <a
              className="comment-author"
              href={`/u/${encodeURIComponent(comment.author?.username ?? "")}`}
            >
              {comment.author?.display_name ?? "Developer"}
            </a>
            <time dateTime={comment.created_at}>
              {new Date(comment.created_at).toLocaleDateString()}
            </time>
            {comment.edited_at && (
              <span className="comment-edited">Edited</span>
            )}
          </div>
          <p className="comment-body">{comment.body}</p>
          <div className="comment-actions">
            {user && (
              <button
                className="text-button"
                type="button"
                onClick={() => onReply(comment)}
              >
                Reply
              </button>
            )}
            {canEdit && (
              <button
                className="text-button"
                type="button"
                onClick={() => onEdit(comment)}
              >
                Edit
              </button>
            )}
            {canDelete && (
              <button
                className="text-button comment-delete"
                type="button"
                disabled={busyId === comment.id}
                onClick={() => onDelete(comment)}
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}
      {comment.children.length > 0 && (
        <ol className="comment-replies" aria-label="Replies">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              user={user}
              opportunityOwnerId={opportunityOwnerId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              replyTo={replyTo}
              editing={editing}
              editorKey={editorKey}
              onSave={onSave}
              onCancelReply={onCancelReply}
              onCancelEdit={onCancelEdit}
              saving={saving}
              busyId={busyId}
            />
          ))}
        </ol>
      )}
      {replyTo?.id === comment.id && (
        <div className="comment-inline-editor">
          <CommentEditor
            key={`reply-${editorKey}`}
            placeholder={`Reply to ${comment.author?.display_name ?? "comment"}…`}
            submitLabel="Reply"
            onSubmit={(text) => onSave(text, comment.id)}
            onCancel={onCancelReply}
            busy={saving}
          />
        </div>
      )}
      {editing?.id === comment.id && (
        <div className="comment-inline-editor">
          <CommentEditor
            key={`edit-${editorKey}`}
            initialText={comment.body}
            placeholder="Edit your comment…"
            submitLabel="Save"
            onSubmit={(text) => onSave(text, null, comment.id)}
            onCancel={onCancelEdit}
            busy={saving}
          />
        </div>
      )}
    </li>
  );
}

function CommentEditor({
  initialText = "",
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}) {
  const [text, setText] = useState(initialText);
  return (
    <form
      className="comment-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        const saved = await onSubmit(text);
        if (saved) setText("");
      }}
    >
      <label className="field-label">
        <span className="visually-hidden">{placeholder}</span>
        <textarea
          className="field-control comment-textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          maxLength={5000}
          rows={3}
          required
        />
      </label>
      <div className="comment-editor-footer">
        <span className="muted-small">{text.length}/5000</span>
        <div>
          {onCancel && (
            <button
              className="button button-secondary"
              type="button"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
          )}
          <button
            className="button button-primary"
            type="submit"
            disabled={busy || !text.trim()}
          >
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function buildCommentTree(rows) {
  const nodes = new Map(rows.map((row) => [row.id, { ...row, children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const parent = node.parent_comment_id
      ? nodes.get(node.parent_comment_id)
      : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function OpportunityEngagement({
  opportunityId,
  opportunityOwnerId,
  title,
  user,
}) {
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [countsLoading, setCountsLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editorKey, setEditorKey] = useState(0);
  const dialogRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!user || user.id !== opportunityOwnerId) {
      return () => {
        active = false;
      };
    }
    async function refreshRequestCount() {
      const { count } = await supabase
        .from("collaboration_requests")
        .select("id", { count: "exact", head: true })
        .eq("opportunity_id", opportunityId)
        .eq("status", "pending");
      if (active) setRequestCount(count ?? 0);
    }
    refreshRequestCount();
    const channel = supabase
      .channel(`opportunity-requests-${opportunityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "collaboration_requests",
          filter: `opportunity_id=eq.${opportunityId}`,
        },
        refreshRequestCount,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [opportunityId, opportunityOwnerId, user]);

  useEffect(() => {
    let active = true;
    async function loadCounts() {
      setCountsLoading(true);
      const [likeResult, commentResult, userLikeResult] = await Promise.all([
        supabase
          .from("opportunity_like_counts")
          .select("like_count")
          .eq("opportunity_id", opportunityId)
          .maybeSingle(),
        supabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .eq("opportunity_id", opportunityId),
        user
          ? supabase
              .from("opportunity_likes")
              .select("opportunity_id")
              .eq("opportunity_id", opportunityId)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (!active) return;
      const queryError =
        likeResult.error || commentResult.error || userLikeResult.error;
      if (queryError) {
        setError("We couldn't load post activity. Please try again.");
      } else {
        setLikeCount(Number(likeResult.data?.like_count ?? 0));
        setCommentCount(commentResult.count ?? 0);
        setLiked(Boolean(userLikeResult.data));
        setError("");
      }
      setCountsLoading(false);
    }
    loadCounts();
    return () => {
      active = false;
    };
  }, [opportunityId, user, retryCount]);

  useEffect(() => {
    let active = true;
    if (!commentsOpen) return undefined;
    supabase
      .from("comments")
      .select(
        "id, opportunity_id, author_id, parent_comment_id, body, created_at, edited_at, deleted_at, author:profiles!comments_author_id_fkey(username, display_name)",
      )
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError("We couldn't load comments. Please try again.");
        } else {
          setComments(data ?? []);
          setError("");
        }
        setCommentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [commentsOpen, opportunityId, retryCount]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (commentsOpen && dialog && !dialog.open) dialog.showModal();
    else if (!commentsOpen && dialog?.open) dialog.close();
  }, [commentsOpen]);

  async function toggleLike() {
    if (!user) return;
    setBusy(true);
    setError("");
    const result = liked
      ? await supabase
          .from("opportunity_likes")
          .delete()
          .eq("opportunity_id", opportunityId)
          .eq("user_id", user.id)
      : await supabase.from("opportunity_likes").insert({
          opportunity_id: opportunityId,
          user_id: user.id,
        });
    if (result.error) {
      setError("Your like couldn't be saved. Please try again.");
      setBusy(false);
      return;
    }
    setLiked(!liked);
    setLikeCount((count) => Math.max(0, count + (liked ? -1 : 1)));
    setBusy(false);
  }

  async function saveComment(text, parentCommentId = null, commentId = null) {
    if (!user) return false;
    setBusy(true);
    setError("");
    const result = commentId
      ? await supabase
          .from("comments")
          .update({ body: text.trim() })
          .eq("id", commentId)
      : await supabase.from("comments").insert({
          opportunity_id: opportunityId,
          author_id: user.id,
          parent_comment_id: parentCommentId,
          body: text.trim(),
        });
    if (result.error) {
      setError(
        "Your comment couldn't be saved. Your text is still here; try again.",
      );
      setBusy(false);
      return false;
    }
    setReplyTo(null);
    setEditing(null);
    setEditorKey((key) => key + 1);
    setBusy(false);
    setCommentsLoading(true);
    setRetryCount((count) => count + 1);
    return true;
  }

  async function deleteComment(comment) {
    setBusyId(comment.id);
    setError("");
    const { error: deleteError } = await supabase.rpc("delete_comment", {
      p_comment_id: comment.id,
    });
    if (deleteError) {
      setError("This comment couldn't be deleted. Please try again.");
      setBusyId("");
      return;
    }
    setBusyId("");
    setCommentsLoading(true);
    setRetryCount((count) => count + 1);
  }

  function startReply(comment) {
    setEditing(null);
    setReplyTo(comment);
    setEditorKey((key) => key + 1);
  }

  function startEdit(comment) {
    setReplyTo(null);
    setEditing(comment);
    setEditorKey((key) => key + 1);
  }

  const signInHref =
    "/auth/sign-in?next=" + encodeURIComponent(window.location.pathname);
  return (
    <div className="opportunity-engagement">
      <div className="post-action-row" aria-label="Post activity">
        {user ? (
          <button
            className={
              "post-action-button like-action" + (liked ? " is-liked" : "")
            }
            type="button"
            aria-label={
              (liked ? "Unlike" : "Like") + " post. " + likeCount + " likes"
            }
            aria-pressed={liked}
            disabled={busy || countsLoading}
            onClick={toggleLike}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
            </svg>
            <span>{likeCount}</span>
          </button>
        ) : (
          <a
            className="post-action-button like-action"
            href={signInHref}
            aria-label={"Sign in to like post. " + likeCount + " likes"}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
            </svg>
            <span>{likeCount}</span>
          </a>
        )}
        <button
          className="post-action-button comment-action"
          type="button"
          aria-label={"Open comments. " + commentCount + " comments"}
          onClick={() => {
            setCommentsLoading(true);
            setCommentsOpen(true);
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
          </svg>
          <span>{commentCount}</span>
        </button>
        {user?.id === opportunityOwnerId && (
          <a
            className="post-action-button request-action"
            href={`/opportunities/${opportunityId}/requests`}
            aria-label={`View join requests. ${requestCount} pending`}
            title="View join requests"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="10" cy="7" r="4" />
              <path d="M20 8v6m3-3h-6" />
            </svg>
            <span>{requestCount}</span>
          </a>
        )}
      </div>
      {error && !commentsOpen && (
        <p className="feedback feedback-error post-activity-error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            Retry
          </button>
        </p>
      )}
      <dialog
        className="comment-dialog"
        ref={dialogRef}
        aria-labelledby={"comments-title-" + opportunityId}
        onClose={() => setCommentsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setCommentsOpen(false);
        }}
      >
        <div className="comment-dialog-heading">
          <div>
            <h2 id={"comments-title-" + opportunityId}>Comments</h2>
            <p>{title}</p>
          </div>
          <button
            className="comment-dialog-close"
            type="button"
            aria-label="Close comments"
            onClick={() => setCommentsOpen(false)}
          >
            x
          </button>
        </div>
        <div className="comment-dialog-content">
          {error && (
            <p className="feedback feedback-error" role="alert">
              {error}
            </p>
          )}
          {user ? (
            <div className="comment-composer">
              <CommentEditor
                key={"new-" + editorKey}
                placeholder="Write a comment..."
                submitLabel="Comment"
                onSubmit={(text) => saveComment(text)}
                busy={busy}
              />
            </div>
          ) : (
            <p className="comment-sign-in">
              <a className="text-link" href={signInHref}>
                Sign in
              </a>{" "}
              to add a comment or reply.
            </p>
          )}
          {commentsLoading ? (
            <p className="muted-small" role="status">
              Loading comments...
            </p>
          ) : comments.length === 0 && !error ? (
            <p className="comment-empty">
              No comments yet. Start the discussion.
            </p>
          ) : comments.length > 0 ? (
            <ol className="comment-thread" aria-label="Comments">
              {buildCommentTree(comments).map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  user={user}
                  opportunityOwnerId={opportunityOwnerId}
                  onReply={startReply}
                  onEdit={startEdit}
                  onDelete={deleteComment}
                  replyTo={replyTo}
                  editing={editing}
                  editorKey={editorKey}
                  onSave={saveComment}
                  onCancelReply={() => setReplyTo(null)}
                  onCancelEdit={() => setEditing(null)}
                  saving={busy}
                  busyId={busyId}
                />
              ))}
            </ol>
          ) : null}
          {error && !commentsLoading && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setCommentsLoading(true);
                setRetryCount((count) => count + 1);
              }}
            >
              Try again
            </button>
          )}
        </div>
      </dialog>
    </div>
  );
}

function Avatar({ name, src }) {
  return src ? (
    <img className="discovery-avatar" src={src} alt="" />
  ) : (
    <span
      className="discovery-avatar discovery-avatar-fallback"
      aria-hidden="true"
    >
      {name?.trim()?.[0]?.toLocaleUpperCase() ?? "D"}
    </span>
  );
}

function StatusPanel({ title, text, action }) {
  return (
    <section className="discovery-status">
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  );
}

export default function DiscoveryPage({
  mode = "opportunities",
  user,
  showComposer = false,
}) {
  return (
    <FilteredListing mode={mode} user={user} showComposer={showComposer} />
  );
}
