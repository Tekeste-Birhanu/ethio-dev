import { useEffect, useState } from "react";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import { invalidateRequestCache } from "../../lib/requestCache.js";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient.js";
import { OpportunityCard } from "../discovery/DiscoveryPage.jsx";

const usernamePattern = /^[A-Za-z0-9_]{3,30}$/;
const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

function uniqueSkills(values) {
  const seen = new Set();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const normalized = value.toLocaleLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

function Avatar({ name, src, large = false }) {
  return src ? (
    <img
      className={`profile-avatar${large ? " profile-avatar-large" : ""}`}
      src={src}
      alt={`${name}'s profile`}
    />
  ) : (
    <span
      className={`profile-avatar profile-avatar-fallback${large ? " profile-avatar-large" : ""}`}
      role="img"
      aria-label={`${name}'s profile`}
    >
      {name?.trim()?.[0]?.toLocaleUpperCase() ?? "D"}
    </span>
  );
}

function fetchProfileOpportunities(ownerId) {
  return supabase
    .from("opportunities")
    .select(
      "id, title, description, project_type, project_type_other, experience_levels, city_id, city_other, status, created_at, creator:profiles!opportunities_creator_id_fkey(user_id, username, display_name, avatar_path), city:cities!cities_id_fkey(name), opportunity_skills(skills(name))",
    )
    .eq("creator_id", ownerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
}

function ProfilePage({ user, username, viewOwn = false }) {
  const editing = !username && !viewOwn;
  const [profile, setProfile] = useState(null);
  const [cities, setCities] = useState([]);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    bio: "",
    cityId: "",
    cityOther: "",
    skills: [],
    links: [],
  });
  const [skillDraft, setSkillDraft] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarError, setAvatarError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [opportunities, setOpportunities] = useState([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [opportunitiesError, setOpportunitiesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [usernameError, setUsernameError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || ((editing || viewOwn) && !user)) {
      return undefined;
    }
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const profileQuery = supabase
        .from("profiles")
        .select(
          "user_id, username, display_name, bio, city_id, city_other, avatar_path, cities(name), profile_skills(skill_id, skills(id, name)), profile_links(id, label, url, sort_order)",
        )
        .eq(
          editing || viewOwn ? "user_id" : "username",
          editing || viewOwn ? user.id : username,
        )
        .maybeSingle();
      const [profileResult, citiesResult] = await Promise.all([
        profileQuery,
        editing
          ? supabase
              .from("cities")
              .select("id, name")
              .eq("is_active", true)
              .order("sort_order")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (!active) return;
      if (profileResult.error || citiesResult.error) {
        setError("We couldn’t load this profile. Please try again.");
        setLoading(false);
        return;
      }
      const record = profileResult.data;
      setCities(citiesResult.data ?? []);
      setProfile(record);
      if (!record) {
        setLoading(false);
        return;
      }
      const skillNames = (record.profile_skills ?? [])
        .map((row) => row.skills?.name)
        .filter(Boolean);
      const links = record.profile_links ?? [];
      setForm({
        username: record.username,
        displayName: record.display_name,
        bio: record.bio ?? "",
        cityId: record.city_id ?? "",
        cityOther: record.city_other ?? "",
        skills: skillNames,
        links: links.map(({ id, label, url }) => ({ id, label, url })),
      });
      if (viewOwn) {
        window.history.replaceState(
          null,
          "",
          `/u/${encodeURIComponent(record.username)}`,
        );
      }
      setLoading(false);
      if (!editing) {
        setOpportunitiesLoading(true);
        const opportunitiesResult = await fetchProfileOpportunities(
          record.user_id,
        );
        if (!active) return;
        if (opportunitiesResult.error) {
          setOpportunitiesError(
            "Couldn’t load this developer’s opportunities.",
          );
        } else {
          const posts = opportunitiesResult.data ?? [];
          setOpportunities(posts);
          setOpportunitiesError("");
        }
        if (active) setOpportunitiesLoading(false);
      }
      if (record.avatar_path) {
        const { data: signedImage } = await supabase.storage
          .from("profile-media")
          .createSignedUrl(record.avatar_path, 3600);
        if (active) setAvatarUrl(signedImage?.signedUrl ?? "");
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [editing, user, username, viewOwn]);

  useEffect(() => {
    if (!editing || !profile) return undefined;
    const candidate = form.username;
    let active = true;
    const wait =
      candidate === profile.username || !usernamePattern.test(candidate)
        ? 0
        : 350;
    const timer = window.setTimeout(async () => {
      if (candidate === profile.username) {
        setUsernameError("");
        return;
      }
      if (!usernamePattern.test(candidate)) {
        setUsernameError(
          candidate.length < 3 || candidate.length > 30
            ? "Username must be 3-30 characters."
            : "Use only letters, numbers, and underscores.",
        );
        return;
      }
      const { data, error: lookupError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", candidate)
        .maybeSingle();
      if (!active) return;
      if (lookupError) {
        setUsernameError("Could not check username availability.");
      } else if (data && data.user_id !== profile.user_id) {
        setUsernameError("That username is already taken.");
      } else {
        setUsernameError("");
      }
    }, wait);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [editing, form.username, profile]);
  async function retryOpportunities() {
    if (!profile) return;
    setOpportunitiesLoading(true);
    setOpportunitiesError("");
    const result = await fetchProfileOpportunities(profile.user_id);
    if (result.error) {
      setOpportunitiesError(
        "Couldnâ€™t load this developerâ€™s opportunities.",
      );
    } else {
      setOpportunities(result.data ?? []);
    }
    setOpportunitiesLoading(false);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "username") setUsernameError("");
    setError("");
    setNotice("");
  }

  function addSkill() {
    const normalized = uniqueSkills([...form.skills, skillDraft]);
    if (normalized.length === form.skills.length) return;
    setForm((current) => ({ ...current, skills: normalized }));
    setSkillDraft("");
  }

  function updateLink(index, key, value) {
    setForm((current) => ({
      ...current,
      links: current.links.map((link, linkIndex) =>
        linkIndex === index ? { ...link, [key]: value } : link,
      ),
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user || !profile) return;
    const cleanUsername = form.username.trim();
    const cleanDisplayName = form.displayName.trim();
    const cleanSkills = uniqueSkills(form.skills);
    const cleanLinks = form.links
      .map((link) => ({
        ...link,
        label: link.label.trim(),
        url: link.url.trim(),
      }))
      .filter((link) => link.label || link.url);
    if (!usernamePattern.test(cleanUsername)) {
      setUsernameError("Use 3-30 letters, numbers, and underscores.");
      return;
    }
    if (!cleanDisplayName || cleanDisplayName.length > 80) {
      setError("Display name must be 1–80 characters.");
      return;
    }
    if (form.bio.length > 1000) {
      setError("Bio must be 1,000 characters or fewer.");
      return;
    }
    if (cleanLinks.some((link) => !link.label || !link.url)) {
      setError("Add both a label and a URL for each profile link.");
      return;
    }
    if (
      cleanLinks.some((link) => {
        try {
          const parsed = new URL(link.url);
          return !["http:", "https:"].includes(parsed.protocol);
        } catch {
          return true;
        }
      })
    ) {
      setError("Profile links must use a valid http or https URL.");
      return;
    }
    if (
      avatarFile &&
      (!imageExtensions[avatarFile.type] || avatarFile.size > 10 * 1024 * 1024)
    ) {
      setAvatarError(
        !imageExtensions[avatarFile.type]
          ? "Choose a JPEG, PNG, GIF, or WebP image."
          : "Image must be 10 MB or smaller.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    let newAvatarPath = profile.avatar_path;
    if (avatarFile) {
      const extension = imageExtensions[avatarFile.type];
      newAvatarPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-media")
        .upload(newAvatarPath, avatarFile, {
          contentType: avatarFile.type,
          upsert: false,
        });
      if (uploadError) {
        setBusy(false);
        setError("We couldn’t upload that profile image. Please try again.");
        return;
      }
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        display_name: cleanDisplayName,
        bio: form.bio.trim() || null,
        city_id: form.cityId || null,
        city_other:
          form.cityId === "" && form.cityOther.trim()
            ? form.cityOther.trim()
            : null,
        avatar_path: newAvatarPath ?? null,
      })
      .eq("user_id", user.id);
    if (profileError) {
      if (avatarFile && newAvatarPath) {
        await supabase.storage.from("profile-media").remove([newAvatarPath]);
      }
      setBusy(false);
      if (profileError.code === "23505") {
        setUsernameError("That username is already taken.");
        return;
      }
      setError(
        profileError.code === "23505"
          ? "That username is already taken."
          : "We couldn’t save your profile. Please try again.",
      );
      return;
    }
    invalidateRequestCache("discovery:developers:");
    invalidateRequestCache("signed-images:profile-media:");
    setProfile((current) => ({
      ...current,
      username: cleanUsername,
      display_name: cleanDisplayName,
      bio: form.bio.trim() || null,
      city_id: form.cityId || null,
      city_other:
        form.cityId === "" && form.cityOther.trim()
          ? form.cityOther.trim()
          : null,
      avatar_path: newAvatarPath,
    }));

    const skillIds = [];
    for (const name of cleanSkills) {
      const { data: skillId, error: skillError } = await supabase.rpc(
        "add_skill",
        { p_name: name },
      );
      if (skillError) {
        setBusy(false);
        setError(
          "Your profile was saved, but we couldn’t save the skill list. Please try again.",
        );
        return;
      }
      skillIds.push(skillId);
    }
    const { error: clearSkillsError } = await supabase
      .from("profile_skills")
      .delete()
      .eq("user_id", user.id);
    if (clearSkillsError) {
      setBusy(false);
      setError(
        "Your profile was saved, but we couldn’t update the skill list. Please try again.",
      );
      return;
    }
    if (skillIds.length) {
      const { error: skillInsertError } = await supabase
        .from("profile_skills")
        .insert(skillIds.map((skill_id) => ({ user_id: user.id, skill_id })));
      if (skillInsertError) {
        setBusy(false);
        setError(
          "Your profile was saved, but we couldn’t update the skill list. Please try again.",
        );
        return;
      }
    }
    const oldLinks = form.links.filter((link) => link.id);
    const savedLinks = [];
    for (const link of cleanLinks) {
      const values = {
        user_id: user.id,
        label: link.label,
        url: link.url,
        sort_order: cleanLinks.indexOf(link),
      };
      let linkError;
      let insertedLink;
      if (link.id) {
        ({ error: linkError } = await supabase
          .from("profile_links")
          .update(values)
          .eq("id", link.id)
          .eq("user_id", user.id));
      } else {
        ({ data: insertedLink, error: linkError } = await supabase
          .from("profile_links")
          .insert(values)
          .select("id")
          .single());
      }
      if (linkError) {
        setBusy(false);
        setError(
          "Your profile and skills were saved, but a profile link could not be saved.",
        );
        return;
      }
      if (link.id) savedLinks.push(link);
      else {
        if (!insertedLink) {
          setBusy(false);
          setError(
            "Your profile and skills were saved, but a profile link could not be confirmed.",
          );
          return;
        }
        savedLinks.push({ ...link, id: insertedLink.id });
      }
    }
    const retainedIds = new Set(
      cleanLinks.map((link) => link.id).filter(Boolean),
    );
    const removedIds = oldLinks
      .filter((link) => !retainedIds.has(link.id))
      .map((link) => link.id);
    if (removedIds.length) {
      const { error: removeLinksError } = await supabase
        .from("profile_links")
        .delete()
        .eq("user_id", user.id)
        .in("id", removedIds);
      if (removeLinksError) {
        setBusy(false);
        setError(
          "Your profile was saved, but a removed link could not be deleted.",
        );
        return;
      }
    }
    setForm((current) => ({
      ...current,
      skills: cleanSkills,
      links: savedLinks,
    }));
    if (avatarFile && newAvatarPath) {
      const { data: signedImage } = await supabase.storage
        .from("profile-media")
        .createSignedUrl(newAvatarPath, 3600);
      setAvatarUrl(signedImage?.signedUrl ?? "");
      setAvatarFile(null);
    }
    setBusy(false);
    setNotice("Profile saved.");
    invalidateRequestCache("catalog:");
    if (cleanUsername !== username)
      window.history.replaceState(null, "", `/settings/profile`);
  }

  if (!isSupabaseConfigured) {
    return (
      <ProfileMessage
        title="Connect Supabase"
        text="Add the public Supabase URL and key to your local environment to use profiles."
      />
    );
  }
  if ((editing || viewOwn) && !user) {
    return (
      <ProfileMessage
        title={
          editing
            ? "Sign in to edit your profile"
            : "Sign in to view your profile"
        }
        text={
          editing
            ? "Your profile settings are available after you sign in."
            : "Your profile is available after you sign in."
        }
      >
        <a className="button button-primary" href="/auth/sign-in">
          Sign in
        </a>
      </ProfileMessage>
    );
  }
  if (loading && !profile)
    return <LoadingSkeleton variant="profile" label="Loading profile" />;
  if (error && !profile)
    return <ProfileMessage title="Profile unavailable" text={error} />;
  if (!profile)
    return (
      <ProfileMessage
        title="Profile not found"
        text="This developer profile may have been removed or the username may be incorrect."
      />
    );

  const cityName = form.cityId
    ? cities.find((city) => city.id === form.cityId)?.name
    : profile.cities?.name;
  const displayedCity = cityName || form.cityOther;

  if (!editing) {
    return (
      <>
        <section className="public-profile-card">
          <div className="public-profile-top">
            <Avatar name={profile.display_name} src={avatarUrl} large />
            <div>
              <h2>{profile.display_name}</h2>
              <p className="profile-username">@{profile.username}</p>
              {displayedCity && (
                <p className="profile-location">{displayedCity}</p>
              )}
            </div>
            {user?.id === profile.user_id && (
              <a className="button button-secondary" href="/settings/profile">
                Edit profile
              </a>
            )}
          </div>
          {profile.bio && (
            <section className="profile-section">
              <h3>About</h3>
              <p className="profile-bio">{profile.bio}</p>
            </section>
          )}
          {form.skills.length > 0 && (
            <section className="profile-section">
              <h3>Skills</h3>
              <ul className="skill-list">
                {form.skills.map((skill) => (
                  <li className="skill-chip" key={skill}>
                    {skill}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {form.links.length > 0 && (
            <section className="profile-section">
              <h3>Links</h3>
              <ul className="profile-link-list">
                {form.links.map((link) => (
                  <li key={link.id}>
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.label}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!profile.bio &&
            !form.skills.length &&
            !form.links.length &&
            !displayedCity && (
              <p className="profile-empty">
                This developer hasn’t added profile details yet.
              </p>
            )}
        </section>
        <section
          className="profile-section profile-opportunities"
          id="opportunities"
          aria-labelledby="profile-posts-title"
        >
          <div className="section-heading">
            <div>
              <h2 id="profile-posts-title">Posts</h2>
            </div>
          </div>
          {opportunitiesLoading ? (
            <p className="muted-small" role="status">
              Loading posts...
            </p>
          ) : opportunitiesError ? (
            <div className="profile-opportunities-error">
              <p className="feedback feedback-error" role="alert">
                {opportunitiesError}
              </p>
              <button
                className="button button-secondary"
                type="button"
                disabled={opportunitiesLoading}
                onClick={() => void retryOpportunities()}
              >
                Try again
              </button>
            </div>
          ) : opportunities.length ? (
            <div className="opportunity-grid profile-opportunity-grid">
              {opportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  avatarUrl={avatarUrl}
                  user={user}
                />
              ))}
            </div>
          ) : user?.id === profile.user_id ? (
            <div className="profile-opportunities-empty">
              <p>You haven&apos;t posted yet.</p>
              <a className="text-link" href="/opportunities/new">
                Post an opportunity
              </a>
            </div>
          ) : (
            <p className="profile-empty">No posts yet.</p>
          )}
        </section>
      </>
    );
  }

  return (
    <div className="profile-editor-page">
      <div className="profile-editor-topbar">
        <a
          className="text-link"
          href={`/u/${encodeURIComponent(profile.username)}`}
        >
          <span aria-hidden="true">←</span> Back to profile
        </a>
      </div>
      <form className="profile-editor" onSubmit={saveProfile}>
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
        <section className="profile-form-section">
          <div className="profile-avatar-edit">
            <Avatar name={form.displayName} src={avatarUrl} />
            <label className="field-label">
              Profile image
              <input
                className="field-control"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                aria-invalid={Boolean(avatarError)}
                aria-describedby={
                  avatarError ? "profile-image-error" : undefined
                }
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setAvatarFile(file);
                  setAvatarError(
                    !file
                      ? ""
                      : !imageExtensions[file.type]
                        ? "Choose a JPEG, PNG, GIF, or WebP image."
                        : file.size > 10 * 1024 * 1024
                          ? "Image must be 10 MB or smaller."
                          : "",
                  );
                  setError("");
                }}
              />
              {avatarError && (
                <span
                  className="field-error"
                  id="profile-image-error"
                  role="status"
                  aria-live="polite"
                >
                  {avatarError}
                </span>
              )}
            </label>
          </div>
          <label className="field-label">
            Username
            <input
              className="field-control"
              name="username"
              value={form.username}
              onChange={updateField}
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]{3,30}"
              aria-invalid={Boolean(usernameError)}
              aria-describedby={usernameError ? "username-error" : undefined}
              required
            />
            {usernameError && (
              <span
                className="field-error"
                id="username-error"
                role="status"
                aria-live="polite"
              >
                {usernameError}
              </span>
            )}
          </label>
          <label className="field-label">
            Display name
            <input
              className="field-control"
              name="displayName"
              value={form.displayName}
              onChange={updateField}
              maxLength={80}
              required
            />
          </label>
        </section>
        <section className="profile-form-section profile-bio-section">
          <h2>About you</h2>
          <label className="field-label">
            <span className="sr-only">About you</span>
            <textarea
              className="field-control profile-textarea"
              name="bio"
              value={form.bio}
              onChange={updateField}
              maxLength={1000}
              rows={3}
              placeholder="What are you learning or building?"
            />
            <span className="field-hint">{form.bio.length}/1,000</span>
          </label>
        </section>
        <section className="profile-form-section profile-skills-section">
          <h2>Skills</h2>
          <p className="form-section-description">
            Add the tools and technologies you use.
          </p>
          <div className="skill-entry">
            <label className="sr-only" htmlFor="skill-draft">
              Add a skill
            </label>
            <input
              className="field-control"
              id="skill-draft"
              value={skillDraft}
              onChange={(event) => setSkillDraft(event.target.value)}
              maxLength={60}
              placeholder="e.g. React"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill();
                }
              }}
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
                        skills: current.skills.filter(
                          (value) => value !== skill,
                        ),
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
        <section className="profile-form-section profile-location-section">
          <h2>Location</h2>
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
              <option value="">Choose a city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Or enter another city
            <input
              className="field-control"
              name="cityOther"
              value={form.cityOther}
              onChange={(event) => {
                updateField(event);
                if (event.target.value)
                  setForm((current) => ({ ...current, cityId: "" }));
              }}
              maxLength={100}
              placeholder="Other city"
            />
          </label>
        </section>
        <section className="profile-form-section profile-links-section">
          <div className="section-heading">
            <div>
              <h2>Links</h2>
              <p>Add your portfolio, GitHub, or other public links.</p>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  links: [...current.links, { label: "", url: "" }],
                }))
              }
            >
              Add link
            </button>
          </div>
          {form.links.map((link, index) => (
            <div
              className="profile-link-fields"
              key={link.id ?? `new-${index}`}
            >
              <label className="field-label">
                Label
                <input
                  className="field-control"
                  value={link.label}
                  maxLength={40}
                  onChange={(event) =>
                    updateLink(index, "label", event.target.value)
                  }
                  placeholder="GitHub"
                />
              </label>
              <label className="field-label">
                URL
                <input
                  className="field-control"
                  type="url"
                  value={link.url}
                  maxLength={2048}
                  onChange={(event) =>
                    updateLink(index, "url", event.target.value)
                  }
                  placeholder="https://github.com/username"
                />
              </label>
              <button
                className="profile-remove-link"
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    links: current.links.filter(
                      (_, linkIndex) => linkIndex !== index,
                    ),
                  }))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </section>
        <div className="profile-save-row">
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProfileMessage({ title, text, children }) {
  return (
    <section className="profile-message">
      <h1>{title}</h1>
      <p className="page-description">{text}</p>
      {children}
    </section>
  );
}

export default ProfilePage;
