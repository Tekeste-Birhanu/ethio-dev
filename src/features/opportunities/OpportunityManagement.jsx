import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";

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
const experienceOptions = [
  ["beginner_friendly", "Beginner friendly"],
  ["junior", "Junior"],
  ["intermediate", "Intermediate"],
  ["experienced_mentor", "Experienced mentor"],
  ["any_level", "Any level"],
];
const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const emptyForm = {
  title: "",
  description: "",
  projectType: "web",
  projectTypeOther: "",
  experienceLevels: [],
  commitment: "",
  cityId: "",
  cityOther: "",
  skills: [],
  coverPath: null,
};

function signInHref(path) {
  return `/auth/sign-in?next=${encodeURIComponent(path)}`;
}

function StatusPanel({ title, text, action }) {
  return (
    <section className="discovery-status">
      <h1>{title}</h1>
      <p>{text}</p>
      {action}
    </section>
  );
}

function uniqueSkills(skills) {
  const result = [];
  const seen = new Set();
  for (const skill of skills) {
    const cleaned = skill.trim().replace(/\s+/g, " ");
    const key = cleaned.toLocaleLowerCase();
    if (cleaned && !seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }
  return result;
}

async function processStorageCleanup() {
  const { data: jobs, error: claimError } = await supabase.rpc(
    "claim_storage_cleanup_jobs",
  );
  if (claimError || !jobs?.length) return;
  for (const job of jobs) {
    await supabase.storage.from(job.bucket_id).remove([job.object_path]);
    await supabase.rpc("acknowledge_storage_cleanup_job", {
      p_job_id: job.job_id,
    });
  }
}

function OpportunityForm({
  user,
  opportunityId,
  embedded = false,
  onCancel,
  onPublished,
}) {
  const [form, setForm] = useState(emptyForm);
  const [cities, setCities] = useState([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [localCoverPreview, setLocalCoverPreview] = useState("");
  const [storedCoverPreview, setStoredCoverPreview] = useState("");
  const [loading, setLoading] = useState(Boolean(opportunityId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    supabase
      .from("cities")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (active) setCities(data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !opportunityId || !user) return undefined;
    let active = true;
    async function load() {
      const { data, error: queryError } = await supabase
        .from("opportunities")
        .select(
          "id, creator_id, title, description, project_type, project_type_other, experience_levels, commitment, city_id, city_other, cover_path, deleted_at, opportunity_skills(skill_id, skills(name))",
        )
        .eq("id", opportunityId)
        .eq("creator_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!active) return;
      if (queryError || !data) {
        setError("This opportunity could not be loaded for editing.");
        setLoading(false);
        return;
      }
      setForm({
        title: data.title,
        description: data.description,
        projectType: data.project_type,
        projectTypeOther: data.project_type_other ?? "",
        experienceLevels: data.experience_levels ?? [],
        commitment: data.commitment ?? "",
        cityId: data.city_id ?? "",
        cityOther: data.city_other ?? "",
        skills: (data.opportunity_skills ?? [])
          .map((row) => row.skills?.name)
          .filter(Boolean),
        coverPath: data.cover_path,
      });
      if (data.cover_path) {
        const { data: signed } = await supabase.storage
          .from("opportunity-media")
          .createSignedUrl(data.cover_path, 3600);
        if (active) setStoredCoverPreview(signed?.signedUrl ?? "");
      }
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [opportunityId, user]);

  useEffect(
    () => () => {
      if (localCoverPreview) URL.revokeObjectURL(localCoverPreview);
    },
    [localCoverPreview],
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateExperience(value, checked) {
    setForm((current) => {
      if (value === "any_level") {
        return {
          ...current,
          experienceLevels: checked ? ["any_level"] : [],
        };
      }
      const specific = current.experienceLevels.filter(
        (level) => level !== "any_level",
      );
      return {
        ...current,
        experienceLevels: checked
          ? [...specific, value]
          : specific.filter((level) => level !== value),
      };
    });
  }

  function addSkill() {
    const skills = uniqueSkills([...form.skills, skillDraft]);
    if (skills.length !== uniqueSkills(form.skills).length) {
      setForm((current) => ({ ...current, skills }));
      setSkillDraft("");
    }
  }

  async function getSkillIds() {
    const results = await Promise.all(
      uniqueSkills(form.skills).map((name) =>
        supabase.rpc("add_skill", { p_name: name }),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed) throw failed.error;
    return results.map((result) => result.data);
  }

  function fields(skillIds, coverPath = form.coverPath) {
    return {
      p_title: form.title.trim(),
      p_description: form.description.trim(),
      p_project_type: form.projectType,
      p_project_type_other:
        form.projectType === "other" ? form.projectTypeOther.trim() : null,
      p_experience_levels: form.experienceLevels,
      p_commitment: form.commitment.trim() || null,
      p_city_id: form.cityId || null,
      p_city_other: form.cityId ? null : form.cityOther.trim() || null,
      p_skill_ids: skillIds,
      p_cover_path: coverPath,
    };
  }

  function validate() {
    if (!form.title.trim() || form.title.trim().length > 120) {
      return "Enter a title between 1 and 120 characters.";
    }
    if (!form.description.trim() || form.description.trim().length > 10000) {
      return "Enter a description between 1 and 10,000 characters.";
    }
    if (form.projectType === "other" && !form.projectTypeOther.trim()) {
      return "Describe the project type.";
    }
    if (!form.experienceLevels.length) {
      return "Choose at least one experience level.";
    }
    if (form.commitment.length > 500) {
      return "Commitment details must be 500 characters or fewer.";
    }
    if (form.cityOther.trim().length > 100) {
      return "Other city must be 100 characters or fewer.";
    }
    if (
      coverFile &&
      (!imageExtensions[coverFile.type] || coverFile.size > 10485760)
    ) {
      return "Choose a JPEG, PNG, GIF, or WebP image under 10 MB.";
    }
    return "";
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!opportunityId && !user.email_confirmed_at) {
      setError("Verify your email before publishing an opportunity.");
      return;
    }
    setBusy(true);
    let uploadedPath = null;
    try {
      const skillIds = await getSkillIds();
      if (!opportunityId) {
        const { data: newId, error: createError } = await supabase.rpc(
          "create_opportunity",
          {
            p_title: form.title.trim(),
            p_description: form.description.trim(),
            p_project_type: form.projectType,
            p_project_type_other:
              form.projectType === "other"
                ? form.projectTypeOther.trim()
                : null,
            p_experience_levels: form.experienceLevels,
            p_commitment: form.commitment.trim() || null,
            p_city_id: form.cityId || null,
            p_city_other: form.cityId ? null : form.cityOther.trim() || null,
            p_skill_ids: skillIds,
          },
        );
        if (createError) {
          setBusy(false);
          if (!createError.code) {
            setError(
              "We couldn’t confirm whether this opportunity was published. Check My opportunities before trying again.",
            );
            return;
          }
          throw createError;
        }
        if (coverFile) {
          const extension = imageExtensions[coverFile.type];
          uploadedPath = `${newId}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("opportunity-media")
            .upload(uploadedPath, coverFile, {
              contentType: coverFile.type,
              upsert: false,
            });
          if (uploadError) {
            await supabase.rpc("discard_opportunity_media", {
              p_opportunity_id: newId,
              p_object_path: uploadedPath,
            });
            await processStorageCleanup();
            setBusy(false);
            if (onPublished) onPublished({ id: newId, coverFailed: true });
            else window.location.assign(`/opportunities/${newId}?cover=failed`);
            return;
          }
        }
        if (uploadedPath) {
          const { error: updateError } = await supabase.rpc(
            "update_opportunity",
            {
              p_opportunity_id: newId,
              ...fields(skillIds, uploadedPath),
            },
          );
          if (updateError) {
            await supabase.rpc("discard_opportunity_media", {
              p_opportunity_id: newId,
              p_object_path: uploadedPath,
            });
            await processStorageCleanup();
            setBusy(false);
            if (onPublished) onPublished({ id: newId, coverFailed: true });
            else window.location.assign(`/opportunities/${newId}?cover=failed`);
            return;
          }
        }
        await processStorageCleanup();
        if (onPublished) onPublished({ id: newId, coverFailed: false });
        else window.location.assign(`/opportunities/${newId}`);
        return;
      }

      if (coverFile) {
        const extension = imageExtensions[coverFile.type];
        uploadedPath = `${opportunityId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("opportunity-media")
          .upload(uploadedPath, coverFile, {
            contentType: coverFile.type,
            upsert: false,
          });
        if (uploadError) {
          await supabase.rpc("discard_opportunity_media", {
            p_opportunity_id: opportunityId,
            p_object_path: uploadedPath,
          });
          await processStorageCleanup();
          throw uploadError;
        }
      }
      const coverPath = uploadedPath ?? (form.coverPath || null);
      const { error: updateError } = await supabase.rpc("update_opportunity", {
        p_opportunity_id: opportunityId,
        ...fields(skillIds, coverPath),
      });
      if (updateError) {
        if (uploadedPath) {
          await supabase.rpc("discard_opportunity_media", {
            p_opportunity_id: opportunityId,
            p_object_path: uploadedPath,
          });
          await processStorageCleanup();
        }
        throw updateError;
      }
      await processStorageCleanup();
      window.location.assign(`/opportunities/${opportunityId}`);
    } catch (submitError) {
      setError(
        submitError.message?.includes("Verify your email")
          ? "Verify your email before publishing an opportunity."
          : submitError.message?.includes("skill")
            ? "A skill could not be saved. Check the list and try again."
            : "We couldn’t save this opportunity. Your entered details are still here; please try again.",
      );
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <StatusPanel
        title="Connect Supabase"
        text="Add the public Supabase URL and key to your local environment to publish opportunities."
      />
    );
  }
  if (!user) {
    const intendedPath = opportunityId
      ? `/opportunities/${opportunityId}/edit`
      : "/opportunities/new";
    return (
      <StatusPanel
        title="Sign in to publish"
        text="Sign in to create and manage your opportunities."
        action={
          <a className="button button-primary" href={signInHref(intendedPath)}>
            Sign in
          </a>
        }
      />
    );
  }
  if (loading) {
    return <StatusPanel title="Loading opportunity" text="Please wait…" />;
  }
  if (opportunityId && error && !form.title) {
    return (
      <StatusPanel
        title="Couldn’t load this opportunity"
        text={error}
        action={
          <a className="button button-secondary" href="/my-opportunities">
            Back to my opportunities
          </a>
        }
      />
    );
  }

  return (
    <section
      className={`opportunity-form-page${embedded ? " is-embedded" : ""}`}
    >
      {embedded && (
        <div className="composer-heading">
          <h2>New opportunity post</h2>
        </div>
      )}
      {!embedded && (
        <div className="page-heading">
          <div>
            <p className="eyebrow">OPPORTUNITIES</p>
            <h1>
              {opportunityId ? "Edit opportunity" : "Post an opportunity"}
            </h1>
            <p className="page-description">
              Share the project, skills, and experience you’re looking for.
            </p>
          </div>
        </div>
      )}
      {!opportunityId && !user.email_confirmed_at && (
        <p className="feedback verification-notice" role="status">
          Email verification is required before publishing. Verify your account,
          then return to this form.
        </p>
      )}
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {error.includes("confirm whether") && (
        <a className="text-link" href="/my-opportunities">
          Check my opportunities
        </a>
      )}
      <form className="opportunity-form" onSubmit={onSubmit}>
        <label className="field-label">
          Project title <span aria-hidden="true">*</span>
          <input
            className="field-control"
            name="title"
            value={form.title}
            onChange={updateField}
            maxLength={120}
            required
          />
        </label>
        <label className="field-label">
          Project description <span aria-hidden="true">*</span>
          <textarea
            className="field-control opportunity-description-input"
            name="description"
            value={form.description}
            onChange={updateField}
            maxLength={10000}
            rows={8}
            required
          />
        </label>
        <div className="opportunity-form-grid">
          <label className="field-label">
            Project type <span aria-hidden="true">*</span>
            <select
              className="field-control"
              name="projectType"
              value={form.projectType}
              onChange={updateField}
            >
              {projectTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {form.projectType === "other" && (
            <label className="field-label">
              Describe the project type <span aria-hidden="true">*</span>
              <input
                className="field-control"
                name="projectTypeOther"
                value={form.projectTypeOther}
                onChange={updateField}
                maxLength={80}
                required
              />
            </label>
          )}
          <fieldset className="field-label experience-fieldset">
            <legend>
              Experience needed <span aria-hidden="true">*</span>
            </legend>
            {experienceOptions.map(([value, label]) => (
              <label className="checkbox-option" key={value}>
                <input
                  type="checkbox"
                  checked={form.experienceLevels.includes(value)}
                  onChange={(event) =>
                    updateExperience(value, event.target.checked)
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="field-label">
            City
            <select
              className="field-control"
              name="cityId"
              value={form.cityId}
              onChange={(event) => {
                updateField(event);
                if (event.target.value)
                  setForm((current) => ({ ...current, cityOther: "" }));
              }}
            >
              <option value="">Choose a city or enter another</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          {!form.cityId && (
            <label className="field-label">
              Other city
              <input
                className="field-control"
                name="cityOther"
                value={form.cityOther}
                onChange={updateField}
                maxLength={100}
                placeholder="Optional"
              />
            </label>
          )}
        </div>
        <label className="field-label">
          Commitment
          <textarea
            className="field-control opportunity-description-input short-textarea"
            name="commitment"
            value={form.commitment}
            onChange={updateField}
            maxLength={500}
            rows={3}
            placeholder="Time or availability expectations (optional)"
          />
        </label>
        <section className="opportunity-form-section">
          <h2>Skills</h2>
          <p className="form-section-description">
            Add the skills collaborators should bring. New skills join the
            shared list.
          </p>
          <div className="skill-entry">
            <label className="sr-only" htmlFor="opportunity-skill-draft">
              Add a skill
            </label>
            <input
              className="field-control"
              id="opportunity-skill-draft"
              value={skillDraft}
              onChange={(event) => setSkillDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill();
                }
              }}
              maxLength={60}
              placeholder="e.g. React"
            />
            <button
              className="button button-secondary"
              type="button"
              onClick={addSkill}
              disabled={!skillDraft.trim()}
            >
              Add
            </button>
          </div>
          {form.skills.length > 0 && (
            <ul className="skill-list">
              {form.skills.map((skill) => (
                <li className="skill-chip" key={skill}>
                  {skill}
                  <button
                    type="button"
                    aria-label={`Remove ${skill}`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        skills: current.skills.filter((item) => item !== skill),
                      }))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="opportunity-form-section">
          <h2>Cover image</h2>
          <p className="form-section-description">
            Optional. Use a JPEG, PNG, GIF, or WebP image up to 10 MB.
          </p>
          {(coverFile
            ? localCoverPreview
            : form.coverPath
              ? storedCoverPreview
              : "") && (
            <img
              className="opportunity-cover-preview"
              src={coverFile ? localCoverPreview : storedCoverPreview}
              alt="Opportunity cover preview"
            />
          )}
          <label className="field-label">
            {form.coverPath ? "Replace cover image" : "Choose cover image"}
            <input
              className="field-control file-control"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setCoverFile(file);
                setLocalCoverPreview(file ? URL.createObjectURL(file) : "");
                setError("");
              }}
            />
          </label>
          {(form.coverPath || coverFile) && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setCoverFile(null);
                setLocalCoverPreview("");
                setForm((current) => ({ ...current, coverPath: null }));
              }}
            >
              Remove cover image
            </button>
          )}
        </section>
        <div className="opportunity-form-actions">
          {onCancel ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : (
            <a
              className="button button-secondary"
              href={
                opportunityId
                  ? `/opportunities/${opportunityId}`
                  : "/opportunities"
              }
            >
              Cancel
            </a>
          )}
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Publishing…"
              : opportunityId
                ? "Save changes"
                : "Publish opportunity"}
          </button>
        </div>
      </form>
    </section>
  );
}

function MyOpportunities({ user }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return undefined;
    let active = true;
    supabase
      .from("opportunities")
      .select("id, title, status, created_at, deleted_at")
      .eq("creator_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setRows(data ?? []);
        setError(queryError ? "We couldn’t load your opportunities." : "");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, retry]);

  async function changeStatus(row) {
    const nextStatus = row.status === "open" ? "closed" : "open";
    if (
      nextStatus === "closed" &&
      !window.confirm(
        "Close this opportunity? New join requests will stop. Pending requests will be removed without notifying applicants. You can reopen it later, and applicants can request again.",
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError("");
    const { error: statusError } = await supabase.rpc(
      "set_opportunity_status",
      {
        p_opportunity_id: row.id,
        p_status: nextStatus,
      },
    );
    if (statusError)
      setError("The opportunity status couldn’t be changed. Try again.");
    else
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, status: nextStatus } : item,
        ),
      );
    setBusyId("");
  }

  async function deleteOpportunity(row) {
    const message =
      "Delete this opportunity? It will disappear from discovery. Accepted collaborations and any related project will remain private to their participants.";
    if (!window.confirm(message)) return;
    setBusyId(row.id);
    setError("");
    const { error: deleteError } = await supabase.rpc("delete_opportunity", {
      p_opportunity_id: row.id,
    });
    if (deleteError) {
      setError("This opportunity couldn’t be deleted. Please try again.");
      setBusyId("");
      return;
    }
    await processStorageCleanup();
    setRows((current) => current.filter((item) => item.id !== row.id));
    setBusyId("");
  }

  if (!isSupabaseConfigured) {
    return (
      <StatusPanel
        title="Connect Supabase"
        text="Add the public Supabase URL and key to manage your opportunities."
      />
    );
  }
  if (!user) {
    return (
      <StatusPanel
        title="Sign in to manage opportunities"
        text="Your published opportunities will appear here."
        action={
          <a
            className="button button-primary"
            href={signInHref("/my-opportunities")}
          >
            Sign in
          </a>
        }
      />
    );
  }
  return (
    <section className="my-opportunities-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR PROJECTS</p>
          <h1>My opportunities</h1>
          <p className="page-description">
            Manage the listings you’ve published.
          </p>
        </div>
        <a
          className="button button-primary heading-action"
          href="/opportunities/new"
        >
          Post an opportunity
        </a>
      </div>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <StatusPanel title="Loading opportunities" text="Please wait…" />
      ) : error && rows.length === 0 ? (
        <StatusPanel
          title="Couldn’t load your opportunities"
          text={error}
          action={
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
          }
        />
      ) : rows.length === 0 ? (
        <StatusPanel
          title="No opportunities yet"
          text="Publish a project idea when you’re ready to find collaborators."
          action={
            <a className="button button-primary" href="/opportunities/new">
              Post an opportunity
            </a>
          }
        />
      ) : (
        <div className="my-opportunity-list">
          {rows.map((row) => (
            <article className="my-opportunity-row" key={row.id}>
              <div>
                <span className={`status-chip status-${row.status}`}>
                  {row.status}
                </span>
                <h2>{row.title}</h2>
                <p className="muted-small">
                  Posted {new Date(row.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="my-opportunity-actions">
                <a
                  className="button button-secondary"
                  href={`/opportunities/${row.id}/edit`}
                >
                  Edit
                </a>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => changeStatus(row)}
                >
                  {row.status === "open" ? "Close" : "Reopen"}
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => deleteOpportunity(row)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export { MyOpportunities, OpportunityForm };
