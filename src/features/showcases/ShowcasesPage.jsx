import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";

function ShowcaseStatus({ title, children }) {
  return (
    <section className="discovery-status">
      <h1>{title}</h1>
      {children}
    </section>
  );
}

export function ShowcaseEditor({
  workspaceId,
  projectTitle,
  projectStatus,
  onBack,
}) {
  const [showcase, setShowcase] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [title, setTitle] = useState(projectTitle ?? "");
  const [overview, setOverview] = useState("");
  const [links, setLinks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const [
        { data, error: showcaseError },
        { data: people, error: peopleError },
      ] = await Promise.all([
        supabase
          .from("showcases")
          .select("id, title, overview, status, published_at")
          .eq("workspace_id", workspaceId)
          .maybeSingle(),
        supabase.rpc("get_project_showcase_contributors", {
          p_workspace_id: workspaceId,
        }),
      ]);
      if (!active) return;
      if (showcaseError || peopleError) {
        setError("Showcase details could not be loaded. Try again.");
        setLoading(false);
        return;
      }
      setShowcase(data ?? null);
      setTitle(data?.title ?? projectTitle ?? "");
      setOverview(data?.overview ?? "");
      setContributors(people ?? []);
      if (data) {
        const { data: savedLinks, error: linksError } = await supabase
          .from("showcase_links")
          .select("label, url")
          .eq("showcase_id", data.id)
          .order("sort_order");
        if (!active) return;
        if (linksError)
          setError("Showcase links could not be loaded. Try again.");
        setLinks(savedLinks ?? []);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [workspaceId, projectTitle]);

  async function save(publish) {
    setBusy(true);
    setError("");
    setNotice("");
    const { data, error: saveError } = await supabase.rpc(
      "save_project_showcase",
      {
        p_workspace_id: workspaceId,
        p_title: title,
        p_overview: overview,
        p_links: links.filter((link) => link.label.trim() || link.url.trim()),
        p_publish: publish,
      },
    );
    setBusy(false);
    if (saveError) {
      setError(
        saveError.code === "PGRST202"
          ? "Showcase publishing is not available yet. Apply the latest Supabase migration, then try again."
          : `${saveError.message?.replace(/workspace/gi, "project") ?? "The showcase could not be saved."} (Error code: ${saveError.code ?? "unknown"})`,
      );
      return;
    }
    setShowcase((current) => ({
      ...current,
      id: data,
      title: title.trim(),
      overview: overview.trim(),
      status: publish ? "published" : "unpublished",
    }));
    setNotice(publish ? "Showcase published." : "Showcase unpublished.");
  }

  if (loading) return <p role="status">Loading showcase…</p>;
  return (
    <section
      className="showcase-editor"
      aria-labelledby="showcase-editor-title"
    >
      <button
        className="button button-secondary"
        type="button"
        onClick={onBack}
      >
        <span aria-hidden="true">←</span> Back to project
      </button>
      <div className="section-heading">
        <div>
          <h2 id="showcase-editor-title">Project showcase</h2>
          <p className="page-description">
            {projectStatus === "completed"
              ? "Present this completed project publicly."
              : "Complete the project before publishing its showcase."}
          </p>
        </div>
        {showcase?.status === "published" && (
          <a className="text-link" href={`/showcases/${showcase.id}`}>
            View public showcase
          </a>
        )}
      </div>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      )}
      <label className="field-label" htmlFor="showcase-title">
        Title
        <input
          className="field-control"
          id="showcase-title"
          value={title}
          maxLength={160}
          required
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy}
        />
      </label>
      <label className="field-label" htmlFor="showcase-overview">
        Overview
        <textarea
          className="field-control"
          id="showcase-overview"
          value={overview}
          maxLength={10000}
          rows={7}
          required
          onChange={(event) => setOverview(event.target.value)}
          disabled={busy}
        />
      </label>
      <fieldset className="showcase-links-editor">
        <legend>Project links</legend>
        {links.map((link, index) => (
          <div className="showcase-link-fields" key={`${index}-${link.url}`}>
            <label className="field-label">
              Link label
              <input
                className="field-control"
                maxLength={40}
                value={link.label}
                onChange={(event) =>
                  setLinks((items) =>
                    items.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, label: event.target.value }
                        : item,
                    ),
                  )
                }
                disabled={busy}
              />
            </label>
            <label className="field-label">
              URL
              <input
                className="field-control"
                type="url"
                maxLength={2048}
                placeholder="https://…"
                value={link.url}
                onChange={(event) =>
                  setLinks((items) =>
                    items.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, url: event.target.value }
                        : item,
                    ),
                  )
                }
                disabled={busy}
              />
            </label>
            <button
              className="text-button-danger"
              type="button"
              disabled={busy}
              onClick={() =>
                setLinks((items) =>
                  items.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              aria-label={`Remove link ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          onClick={() =>
            setLinks((items) => [...items, { label: "", url: "" }])
          }
        >
          Add link
        </button>
      </fieldset>
      <section
        className="showcase-contributors"
        aria-labelledby="showcase-contributors-title"
      >
        <h3 id="showcase-contributors-title">Contributors</h3>
        <p>Contributor names are included automatically.</p>
        <ul>
          {contributors.map((person) => (
            <li key={person.user_id}>
              <a href={`/u/${encodeURIComponent(person.username)}`}>
                {person.display_name}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <div className="showcase-editor-actions">
        {showcase?.status === "published" && (
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={() => void save(false)}
          >
            {busy ? "Saving…" : "Unpublish"}
          </button>
        )}
        <button
          className="button button-primary"
          type="button"
          disabled={
            busy ||
            projectStatus !== "completed" ||
            !title.trim() ||
            !overview.trim()
          }
          onClick={() => void save(true)}
        >
          {busy
            ? "Publishing…"
            : showcase?.status === "published"
              ? "Save changes"
              : "Publish showcase"}
        </button>
      </div>
    </section>
  );
}

export default function ShowcasesPage({ user, showcaseId = null }) {
  const [showcases, setShowcases] = useState([]);
  const [editableWorkspaceIds, setEditableWorkspaceIds] = useState(
    () => new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isSupabaseConfigured) {
        setError("Showcases are unavailable until Supabase is configured.");
        setLoading(false);
        return;
      }
      const { data, error: loadError } = await supabase.rpc(
        "get_public_project_showcases",
        { p_showcase_id: showcaseId },
      );
      if (!active) return;
      if (loadError) setError("Showcases could not be loaded. Try again.");
      else {
        const rows = data ?? [];
        setShowcases(rows);
        if (user && rows.length > 0) {
          const { data: memberships } = await supabase
            .from("workspace_memberships")
            .select("workspace_id")
            .eq("user_id", user.id)
            .in(
              "workspace_id",
              rows.map((row) => row.workspace_id),
            )
            .in("role", ["owner", "admin"])
            .is("ended_at", null);
          if (!active) return;
          setEditableWorkspaceIds(
            new Set((memberships ?? []).map((row) => row.workspace_id)),
          );
        } else {
          setEditableWorkspaceIds(new Set());
        }
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [showcaseId, user]);

  if (loading)
    return <ShowcaseStatus title="Showcases">Loading…</ShowcaseStatus>;
  if (error)
    return (
      <ShowcaseStatus title="Showcases">
        <p role="alert">{error}</p>
      </ShowcaseStatus>
    );
  if (showcaseId && showcases.length === 0) {
    return (
      <ShowcaseStatus title="Showcase unavailable">
        <p>This showcase may have been unpublished or removed.</p>
        <a className="button button-secondary" href="/showcases">
          All showcases
        </a>
      </ShowcaseStatus>
    );
  }
  if (showcaseId) {
    const showcase = showcases[0];
    return (
      <article className="public-showcase">
        <a className="text-link" href="/showcases">
          All showcases
        </a>
        <p className="page-description">
          Completed project · {showcase.project_title}
        </p>
        <div className="section-heading">
          <h1>{showcase.title}</h1>
          {editableWorkspaceIds.has(showcase.workspace_id) && (
            <a
              className="button button-secondary"
              href={`/projects/${encodeURIComponent(showcase.workspace_id)}?view=showcase`}
            >
              Edit showcase
            </a>
          )}
        </div>
        <p className="public-showcase-overview">{showcase.overview}</p>
        {showcase.links.length > 0 && (
          <section>
            <h2>Project links</h2>
            <ul>
              {showcase.links.map((link) => (
                <li key={`${link.url}-${link.label}`}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h2>Contributors</h2>
          <ul className="public-showcase-contributors">
            {showcase.contributors.map((person) => (
              <li key={person.username}>
                <a href={`/u/${encodeURIComponent(person.username)}`}>
                  {person.display_name}
                </a>
                <span>@{person.username}</span>
              </li>
            ))}
          </ul>
        </section>
      </article>
    );
  }
  return (
    <section className="showcases-page">
      <div className="page-heading">
        <div>
          <h1>Showcases</h1>
          <p className="page-description">
            Completed projects shared by the community.
          </p>
        </div>
      </div>
      {showcases.length === 0 ? (
        <p className="empty-card">No project showcases yet.</p>
      ) : (
        <div className="showcases-grid">
          {showcases.map((showcase) => (
            <article className="showcase-card" key={showcase.id}>
              <p className="page-description">
                Completed project · {showcase.project_title}
              </p>
              <h2>
                <a href={`/showcases/${showcase.id}`}>{showcase.title}</a>
              </h2>
              <p>{showcase.overview}</p>
              <ul className="showcase-card-contributors">
                {showcase.contributors.slice(0, 4).map((person) => (
                  <li key={person.username}>{person.display_name}</li>
                ))}
              </ul>
              <a className="text-link" href={`/showcases/${showcase.id}`}>
                View showcase
              </a>
              {editableWorkspaceIds.has(showcase.workspace_id) && (
                <a
                  className="button button-secondary"
                  href={`/projects/${encodeURIComponent(showcase.workspace_id)}?view=showcase`}
                >
                  Edit showcase
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
