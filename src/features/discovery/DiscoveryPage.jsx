import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";

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

function buildOpportunityQuery(filters, offset) {
  const skillsEmbed = filters.skillId
    ? "opportunity_skills!inner(skill_id, skills(id, name))"
    : "opportunity_skills(skills(id, name))";
  let query = supabase
    .from("opportunities")
    .select(
      `id, title, description, project_type, project_type_other, experience_levels, city_id, city_other, cover_path, status, created_at, creator:profiles!opportunities_creator_id_fkey(username, display_name, avatar_path), city:cities!opportunities_city_id_fkey(name), ${skillsEmbed}`,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + pageSize);
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
  showOpportunityFilters = false,
}) {
  return (
    <section className="discovery-filters" aria-label="Search and filters">
      <label className="field-label discovery-search-label">
        Search
        <input
          className="field-control"
          type="search"
          value={values.search}
          onChange={(event) => onChange("search", event.target.value)}
          placeholder={
            showOpportunityFilters ? "Search projects" : "Search developers"
          }
        />
      </label>
      {showOpportunityFilters && (
        <>
          <label className="field-label">
            Project type
            <select
              className="field-control"
              value={values.type}
              onChange={(event) => onChange("type", event.target.value)}
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
              value={values.experience}
              onChange={(event) => onChange("experience", event.target.value)}
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
          value={values.city}
          onChange={(event) => onChange("city", event.target.value)}
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
          value={values.skillId}
          onChange={(event) => onChange("skillId", event.target.value)}
        >
          <option value="">All skills</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="text-button"
        type="button"
        onClick={() => onChange("reset", "")}
      >
        Clear filters
      </button>
    </section>
  );
}

function FilteredListing({ mode }) {
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
        : buildOpportunityQuery(queryFilters, 0);
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
  }, [directory, search, city, skillId, type, experience, retryCount]);

  function updateFilter(key, value) {
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
      : buildOpportunityQuery(queryFilters, offset);
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

  const title = directory ? "Developers" : "Find a project";
  const description = directory
    ? "Meet developers by skill and location."
    : "Explore projects looking for collaborators.";
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ETHIODEV</p>
          <h1>{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        {directory && (
          <a
            className="button button-secondary heading-action"
            href="/opportunities"
          >
            Browse projects
          </a>
        )}
      </div>
      <DiscoveryFilters
        cities={cities}
        skills={skills}
        values={filters}
        onChange={updateFilter}
        showOpportunityFilters={!directory}
      />
      <p className="results-summary" aria-live="polite">
        {loading
          ? "Searching…"
          : `Showing ${rows.length} ${directory ? "developers" : "projects"}`}
      </p>
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

function OpportunityCard({ opportunity, avatarUrl, coverUrl }) {
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
  return (
    <article className="opportunity-card">
      <a
        className={`opportunity-card-image${coverUrl ? " has-image" : ""}`}
        href={`/opportunities/${opportunity.id}`}
        aria-label={`Open ${opportunity.title}`}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <span aria-hidden="true">&lt;/&gt;</span>
        )}
      </a>
      <div className="opportunity-card-content">
        <div className="opportunity-card-meta">
          <span className={`status-chip status-${opportunity.status}`}>
            {opportunity.status}
          </span>
          {projectType && <span>{projectType}</span>}
          {city && <span>{city}</span>}
          {experiences.length > 0 && <span>{experiences.join(", ")}</span>}
        </div>
        <h2>
          <a href={`/opportunities/${opportunity.id}`}>{opportunity.title}</a>
        </h2>
        <p className="opportunity-summary">{opportunity.description}</p>
        {skills.length > 0 && (
          <ul className="skill-list">
            {skills.slice(0, 4).map((skill) => (
              <li className="skill-chip" key={skill}>
                {skill}
              </li>
            ))}
          </ul>
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
      </div>
    </article>
  );
}

function OpportunityDetail({ id }) {
  const [opportunity, setOpportunity] = useState(null);
  const [cityName, setCityName] = useState("");
  const [skills, setSkills] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    supabase
      .from("opportunities")
      .select(
        "id, title, description, project_type, project_type_other, experience_levels, commitment, city_other, cover_path, status, created_at, creator:profiles!opportunities_creator_id_fkey(username, display_name, avatar_path), city:cities!opportunities_city_id_fkey(name), opportunity_skills(skills(name))",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
      .then(async ({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError("We couldn’t load this project. Please try again.");
          setLoading(false);
          return;
        }
        setOpportunity(data);
        setCityName(data?.city?.name ?? data?.city_other ?? "");
        setSkills(
          (data?.opportunity_skills ?? [])
            .map((item) => item.skills?.name)
            .filter(Boolean),
        );
        setLoading(false);
        if (!data) return;
        const [cover, avatar] = await Promise.all([
          signedImages("opportunity-media", [data.cover_path]),
          signedImages("profile-media", [data.creator?.avatar_path]),
        ]);
        if (active) setImageUrls({ ...cover, ...avatar });
      });
    return () => {
      active = false;
    };
  }, [id, retryCount]);

  if (!isSupabaseConfigured) {
    return (
      <StatusPanel
        title="Connect Supabase"
        text="Add the public Supabase URL and key to browse project opportunities."
      />
    );
  }
  if (loading)
    return (
      <StatusPanel
        title="Loading project"
        text="Please wait while we load this opportunity."
      />
    );
  if (error)
    return (
      <StatusPanel
        title="Project unavailable"
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
    );
  if (!opportunity)
    return (
      <StatusPanel
        title="Project not found"
        text="This opportunity may have been removed or is no longer public."
        action={
          <a className="text-link" href="/opportunities">
            Browse projects
          </a>
        }
      />
    );

  const projectType =
    opportunity.project_type === "other"
      ? opportunity.project_type_other
      : (projectTypes.find(
          ([value]) => value === opportunity.project_type,
        )?.[1] ?? opportunity.project_type);
  const experiences = opportunity.experience_levels.map(
    (value) => experienceLevels.find(([key]) => key === value)?.[1] ?? value,
  );
  return (
    <article className="opportunity-detail">
      <a className="text-link back-link" href="/opportunities">
        ← All projects
      </a>
      {imageUrls[opportunity.cover_path] && (
        <img
          className="opportunity-detail-cover"
          src={imageUrls[opportunity.cover_path]}
          alt=""
        />
      )}
      <div className="opportunity-detail-heading">
        <div>
          <p className="eyebrow">PROJECT OPPORTUNITY</p>
          <h1>{opportunity.title}</h1>
        </div>
        <span className={`status-chip status-${opportunity.status}`}>
          {opportunity.status}
        </span>
      </div>
      <div className="opportunity-detail-meta">
        <span>{projectType}</span>
        {cityName && <span>{cityName}</span>}
        <span>{experiences.join(", ")}</span>
      </div>
      <section className="opportunity-detail-section">
        <h2>About this project</h2>
        <p className="opportunity-detail-description">
          {opportunity.description}
        </p>
      </section>
      {skills.length > 0 && (
        <section className="opportunity-detail-section">
          <h2>Skills</h2>
          <ul className="skill-list">
            {skills.map((skill) => (
              <li className="skill-chip" key={skill}>
                {skill}
              </li>
            ))}
          </ul>
        </section>
      )}
      {opportunity.commitment && (
        <section className="opportunity-detail-section">
          <h2>Commitment</h2>
          <p>{opportunity.commitment}</p>
        </section>
      )}
      {opportunity.creator && (
        <a
          className="opportunity-creator detail-creator"
          href={`/u/${encodeURIComponent(opportunity.creator.username)}`}
        >
          <Avatar
            name={opportunity.creator.display_name}
            src={imageUrls[opportunity.creator.avatar_path]}
          />
          <span>
            Posted by <strong>{opportunity.creator.display_name}</strong>
          </span>
        </a>
      )}
    </article>
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
  opportunityId,
}) {
  if (opportunityId) return <OpportunityDetail id={opportunityId} />;
  return <FilteredListing mode={mode} />;
}
