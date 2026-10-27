import { Button, ModalCloseButton, ModalFooter, ModalHeader } from "../components/ui.jsx";

import { OpportunityCard } from "../components/opportunities.jsx";
import { ProfileOverflowMenu } from "../components/layout.jsx";
import { OptionalProfileFields } from "../components/profiles.jsx";
import { experienceOptions, opportunityCategoryOptions, opportunityWorkSetupOptions } from "../constants.js";

export default function ProfilePage(props) {
  const {
    addOpportunitySkill,
    confirmDeleteOpportunity,
    deleteOpportunityError,
    editingOpportunityId,
    fieldErrors,
    handleAppNavigation,
    handleDeleteOpportunity,
    handleEditOpportunity,
    handleOpenOpportunityComposer,
    handleOpportunityFormChange,
    handleOpportunitySubmit,
    handlePasswordChange,
    handlePasswordFormChange,
    handleProfileFormChange,
    handleProfileSave,
    handleSaveOpportunity,
    handleShareOpportunity,
    handleSignOut,
    handleToggleOpportunityComments,
    isDeletingOpportunity,
    isEditProfileOpen,
    isLoadingProfile,
    isOwnProfile,
    isSettingsOpen,
    isSubmitting,
    message,
    myOpportunities,
    myOpportunitiesError,
    myOpportunitiesLoading,
    opportunityForm,
    opportunityReturnPage,
    opportunitySkillDraft,
    page,
    passwordForm,
    pendingDeleteOpportunity,
    profileData,
    profileForm,
    profileTab,
    savedOpportunities,
    savedOpportunitiesError,
    savedOpportunitiesLoading,
    setActiveCommentsOpportunity,
    setEditingOpportunityId,
    setFieldErrors,
    setIsEditProfileOpen,
    setIsSettingsOpen,
    setMessage,
    setMyOpportunitiesLoading,
    setOpportunityForm,
    setOpportunitySkillDraft,
    setPendingDeleteOpportunity,
    setProfileTab,
    shareCopiedOpportunityId,
    user,
  } = props;

  return (
    <section
                  className={`app-main-content min-w-0 px-8 pb-16 pt-8 max-[760px]:px-4 max-[760px]:pb-[calc(104px+env(safe-area-inset-bottom))] max-[760px]:pt-6${page === "profile" || page === "public-profile" ? " profile-main-content" : ""}`}
                >
                  <section className="profile-shell mx-auto w-full max-w-[790px] min-w-0">
                    {page !== "profile" && page !== "public-profile" && (
                      <button
                        className="back-button [display:inline-flex] [min-height:42px] [align-items:center] [padding:0_15px] [border:1px_solid_#303a3e] [border-radius:10px] [background:#1b2327] [color:#edf3f4] [cursor:pointer] [font-weight:600] [text-decoration:none] hover:[border-color:#59696c] hover:[background:#222d31] [margin-bottom:18px]"
                        type="button"
                        onClick={() =>
                          handleAppNavigation(
                            page === "create-opportunity"
                              ? opportunityReturnPage
                              : "profile",
                          )
                        }
                      >
                        {page === "create-opportunity" &&
                        opportunityReturnPage === "discover"
                          ? "Back to Discover"
                          : "Back to profile"}
                      </button>
                    )}
    
                    {isLoadingProfile ? (
                      <p className="session-loading [color:#c0cece] [text-align:center]">
                        Loading profile...
                      </p>
                    ) : profileData ? (
                      page === "create-opportunity" && user ? (
                        <section
                          className="profile-panel [padding:clamp(24px,_5vw,_48px)] [border:1px_solid_#252d31] [border-radius:20px] [background:#141a1e]"
                          aria-labelledby="create-opportunity-heading"
                        >
                          <h1
                            className="[margin:0_0_28px] [color:#f4f7f7] [font-size:clamp(26px,_5vw,_36px)] [letter-spacing:-0.04em]"
                            id="create-opportunity-heading"
                          >
                            {editingOpportunityId
                              ? "Edit opportunity"
                              : "Create opportunity"}
                          </h1>
                          <form
                            className="opportunity-form [&_.form-field:last-of-type]:mb-0 [display:flex] [flex:1_1_auto] [flex-direction:column] [min-height:0]"
                            onSubmit={handleOpportunitySubmit}
                            noValidate
                          >
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
    
                            <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] opportunity-skills-field [display:grid] [gap:8px] [margin-bottom:18px] [min-width:0] [margin:0]">
                              <label
                                className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                                htmlFor="opportunity-skills"
                              >
                                Skills
                              </label>
                              <p
                                className="field-hint [display:block] [margin:6px_0_10px] [color:#91a2a5] [font-size:13px] [line-height:1.5]"
                                id="opportunity-skills-hint"
                              >
                                Add skill tags to help developers find this
                                opportunity.
                              </p>
                              <div className="opportunity-skill-entry [display:grid] [min-width:0] [grid-template-columns:minmax(0,_1fr)_auto] [align-items:center] [gap:8px] [grid-template-columns:minmax(0,_1fr)]">
                                <input
                                  className="[width:100%] [min-width:0]"
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
                                    if (
                                      event.key === "Enter" ||
                                      event.key === ","
                                    ) {
                                      event.preventDefault();
                                      addOpportunitySkill();
                                    }
                                  }}
                                  aria-invalid={Boolean(fieldErrors.skillsSought)}
                                  aria-describedby={
                                    fieldErrors.skillsSought
                                      ? "opportunity-skills-error"
                                      : "opportunity-skills-hint"
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
                                            skillsSought:
                                              current.skillsSought.filter(
                                                (item) => item !== skill,
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
                                  {opportunityCategoryOptions.map(
                                    ([value, label]) => (
                                      <label
                                        className="opportunity-category-option [&:has(input:checked)]:border-[#28634f] [&:has(input:checked)]:bg-[#1b3029] [&:has(input:checked)]:text-[#65e7b7] [display:inline-flex] [min-height:38px] [align-items:center] [gap:8px] [padding:7px_11px] [border:1px_solid_#303a3e] [border-radius:999px] [background:#0d1215] [color:#c7d2d3] [cursor:pointer] [font-size:13px]"
                                        key={value}
                                      >
                                        <input
                                          className="[width:15px] [height:15px] [margin:0] [accent-color:#19c990]"
                                          type="checkbox"
                                          name="categories"
                                          value={value}
                                          checked={opportunityForm.categories.includes(
                                            value,
                                          )}
                                          onChange={handleOpportunityFormChange}
                                        />
                                        <span>{label}</span>
                                      </label>
                                    ),
                                  )}
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
                                    aria-invalid={Boolean(
                                      fieldErrors.experienceSought,
                                    )}
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
                                    htmlFor="opportunity-work-setup"
                                  >
                                    Work setup
                                  </label>
                                  <select
                                    className="[display:block] [width:100%] [height:48px] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease] [padding:0_40px_0_14px] [appearance:none] [background-color:#0d1215] [background-image:url(data:image/svg+xml,%3Csvg_xmlns='http://www.w3.org/2000/svg'_width='16'_height='16'_viewBox='0_0_16_16'_fill='none'%3E%3Cpath_d='m4_6_4_4_4-4'_stroke='%2391a2a5'_stroke-width='1.5'_stroke-linecap='round'_stroke-linejoin='round'/%3E%3C/svg%3E)] [background-position:right_14px_center] [background-repeat:no-repeat] [cursor:pointer] [line-height:1.2] focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)]"
                                    id="opportunity-work-setup"
                                    name="workSetup"
                                    value={opportunityForm.workSetup}
                                    onChange={handleOpportunityFormChange}
                                    aria-invalid={Boolean(fieldErrors.workSetup)}
                                  >
                                    {opportunityWorkSetupOptions.map(
                                      ([value, label]) => (
                                        <option key={value} value={value}>
                                          {label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                  {fieldErrors.workSetup && (
                                    <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                                      {fieldErrors.workSetup}
                                    </span>
                                  )}
                                </div>
    
                                {["IN_PERSON", "HYBRID"].includes(
                                  opportunityForm.workSetup,
                                ) && (
                                  <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px] [min-width:0] [align-content:start] [margin-bottom:0]">
                                    <label
                                      className="[color:#d9e1e2] [font-size:14px] [font-weight:600] [min-height:20px] [line-height:20px]"
                                      htmlFor="opportunity-work-city"
                                    >
                                      City
                                    </label>
                                    <input
                                      className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
                                      id="opportunity-work-city"
                                      name="workCity"
                                      type="text"
                                      maxLength={100}
                                      value={opportunityForm.workCity}
                                      onChange={handleOpportunityFormChange}
                                      aria-invalid={Boolean(fieldErrors.workCity)}
                                      required
                                    />
                                    {fieldErrors.workCity && (
                                      <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                                        {fieldErrors.workCity}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
    
                            <div className="opportunity-form-actions [display:flex] [flex-wrap:wrap] [gap:10px] [align-items:center] [justify-content:flex-end]">
                              <Button
                                variant="primary"
                                className="[width:auto] [flex:0_0_auto] [min-width:188px] max-[600px]:[min-width:0]"
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
                                type="button"
                                onClick={() => {
                                  setEditingOpportunityId(null);
                                  if (opportunityReturnPage === "profile")
                                    setMyOpportunitiesLoading(true);
                                  handleAppNavigation(opportunityReturnPage);
                                }}
                                disabled={isSubmitting}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                          {message && (
                            <p
                              className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45] [margin:18px_0_0]"
                              role="status"
                            >
                              {message}
                            </p>
                          )}
                        </section>
                      ) : page === "settings" && isOwnProfile ? (
                        <section
                          className="profile-panel [padding:clamp(24px,_5vw,_48px)] [border:1px_solid_#252d31] [border-radius:20px] [background:#141a1e]"
                          aria-labelledby="settings-heading"
                        >
                          <h1
                            className="[margin:0_0_28px] [color:#f4f7f7] [font-size:clamp(26px,_5vw,_36px)] [letter-spacing:-0.04em]"
                            id="settings-heading"
                          >
                            Settings
                          </h1>
                          {profileData.hasPassword && (
                            <form
                              className="password-form [margin-top:32px] [padding-top:26px] [border-top:1px_solid_#252d31]"
                              onSubmit={handlePasswordChange}
                              noValidate
                            >
                              <h2 className="[margin:0_0_22px] [color:#edf3f4] [font-size:20px]">
                                Change password
                              </h2>
                              {[
                                "currentPassword",
                                "newPassword",
                                "confirmPassword",
                              ].map((fieldName) => {
                                const labels = {
                                  currentPassword: "Current password",
                                  newPassword: "New password",
                                  confirmPassword: "Confirm new password",
                                };
                                return (
                                  <div
                                    className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px]"
                                    key={fieldName}
                                  >
                                    <label
                                      className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                                      htmlFor={fieldName}
                                    >
                                      {labels[fieldName]}
                                    </label>
                                    <input
                                      className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
                                      id={fieldName}
                                      name={fieldName}
                                      type="password"
                                      autoComplete={
                                        fieldName === "currentPassword"
                                          ? "current-password"
                                          : "new-password"
                                      }
                                      minLength={
                                        fieldName === "currentPassword"
                                          ? undefined
                                          : 8
                                      }
                                      maxLength={128}
                                      value={passwordForm[fieldName]}
                                      onChange={handlePasswordFormChange}
                                      required
                                      aria-invalid={Boolean(fieldErrors[fieldName])}
                                    />
                                    {fieldErrors[fieldName] && (
                                      <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                                        {fieldErrors[fieldName]}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              <Button
                                variant="primary"
                                type="submit"
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? "Updating..." : "Update password"}
                              </Button>
                            </form>
                          )}
                          {message && (
                            <p
                              className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45] [margin:18px_0_0]"
                              role="status"
                            >
                              {message}
                            </p>
                          )}
                        </section>
                      ) : (
                        <>
                          <article
                            className="profile-panel public-profile w-full rounded-2xl border border-[#252d31] bg-[#111719] px-7 pb-6 pt-7 max-[760px]:px-4 max-[760px]:pb-5 max-[760px]:pt-5"
                            aria-labelledby="profile-name"
                          >
                            <header
                              className={`profile-header grid items-center gap-x-5 gap-y-4 ${isOwnProfile ? "grid-cols-[88px_minmax(0,1fr)_auto] max-[760px]:grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[88px_minmax(0,1fr)] max-[760px]:grid-cols-[72px_minmax(0,1fr)]"}`}
                            >
                              <div
                                className="profile-avatar grid size-[88px] shrink-0 place-items-center rounded-full border border-[#28634f] bg-accent-dark text-[30px] font-bold text-accent-light max-[760px]:size-[72px] max-[760px]:text-[25px]"
                                aria-hidden="true"
                              >
                                {profileData.name.slice(0, 1).toUpperCase()}
                              </div>
                              <div className="profile-identity min-w-0">
                                <div className="profile-name-row flex min-w-0 items-center gap-2.5">
                                  <h1
                                    className="m-0 overflow-hidden text-ellipsis text-[32px] font-bold leading-tight tracking-[-0.04em] text-ink max-[760px]:text-[25px]"
                                    id="profile-name"
                                  >
                                    {profileData.name}
                                  </h1>
                                  {isOwnProfile && (
                                    <button
                                      className="profile-edit-button [display:inline-grid] [width:36px] [height:36px] [flex:0_0_auto] [place-items:center] [margin-bottom:5px] [padding:0] [border:1px_solid_#303a3e] [border-radius:50%] [background:transparent] [color:#aebabb] [cursor:pointer] hover:[border-color:#65e7b7] hover:[background:#1b3029] hover:[color:#65e7b7] focus-visible:[outline:2px_solid_#9af1d0] focus-visible:[outline-offset:2px]"
                                      type="button"
                                      aria-label="Edit profile"
                                      title="Edit profile"
                                      onClick={() => setIsEditProfileOpen(true)}
                                    >
                                      <svg
                                        className="[width:17px] [height:17px] [fill:none] [stroke:currentColor] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                      >
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                <p className="mt-1 text-[15px] text-muted">
                                  @{profileData.username}
                                </p>
                              </div>
                              {isOwnProfile && (
                                <div className="profile-actions col-start-3 row-start-1 flex flex-wrap items-center justify-end gap-2 max-[760px]:col-span-2 max-[760px]:col-start-1 max-[760px]:row-start-2 max-[760px]:justify-start">
                                  <Button
                                    variant="secondary"
                                    className="[min-height:40px] [padding-inline:12px] [font-size:13px]"
                                    type="button"
                                    onClick={handleOpenOpportunityComposer}
                                  >
                                    Post opportunity
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    className="[min-height:40px] [padding-inline:12px] [font-size:13px]"
                                    type="button"
                                    onClick={() => {
                                      setFieldErrors({});
                                      setMessage("");
                                      setIsSettingsOpen(true);
                                    }}
                                  >
                                    Settings
                                  </Button>
                                  <ProfileOverflowMenu
                                    onSignOut={handleSignOut}
                                    isSubmitting={isSubmitting}
                                  />
                                </div>
                              )}
                            </header>
                            {profileData.description && (
                              <p className="profile-description mt-6 max-w-[72ch] whitespace-pre-wrap text-[16px] leading-[1.65] text-[#d9e1e2] [overflow-wrap:anywhere]">
                                {profileData.description}
                              </p>
                            )}
                            {profileData.skills.length > 0 && (
                              <ul
                                className="profile-skills mt-4 flex max-w-full list-none flex-wrap gap-2 p-0"
                                aria-label="Skills"
                              >
                                {profileData.skills.map((skill) => (
                                  <li
                                    className="rounded-full border border-[#303a3e] bg-surface px-3 py-1.5 text-[13px] text-accent-light"
                                    key={skill}
                                  >
                                    {skill}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {(profileData.city || profileData.experience) && (
                              <div className="profile-facts mt-3 flex flex-wrap items-center gap-0 text-[13px] text-muted">
                                {profileData.city && (
                                  <span className="[padding:0] [border:0] [background:transparent]">
                                    {profileData.city}
                                  </span>
                                )}
                                {profileData.city && profileData.experience && (
                                  <span
                                    className="px-2 text-[#59696c]"
                                    aria-hidden="true"
                                  >
                                    {"\u00b7"}
                                  </span>
                                )}
                                {profileData.experience && (
                                  <span className="[padding:0] [border:0] [background:transparent]">
                                    {profileData.experience[0] +
                                      profileData.experience.slice(1).toLowerCase()}
                                  </span>
                                )}
                              </div>
                            )}
                            {message && (
                              <p
                                className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45] [margin:18px_0_0]"
                                role="status"
                              >
                                {message}
                              </p>
                            )}
                          </article>
                          {isOwnProfile && isEditProfileOpen && (
                            <div
                              className="profile-modal-backdrop [&::-webkit-scrollbar]:hidden [position:fixed] [z-index:50] [inset:0] [display:grid] [place-items:center] [overflow:hidden] [padding:24px] [background:rgb(3_8_10_/_78%)] [scrollbar-width:none] [padding:0]"
                              onMouseDown={(event) => {
                                if (
                                  event.target === event.currentTarget &&
                                  !isSubmitting
                                )
                                  setIsEditProfileOpen(false);
                              }}
                            >
                              <section
                                className="profile-edit-modal [&::-webkit-scrollbar]:hidden max-[600px]:[&:not(.confirmation-modal)]:w-full max-[600px]:[&:not(.confirmation-modal)]:max-w-none max-[600px]:[&:not(.confirmation-modal)]:h-dvh max-[600px]:[&:not(.confirmation-modal)]:max-h-dvh max-[600px]:[&:not(.confirmation-modal)]:rounded-none max-[600px]:[&:not(.confirmation-modal)]:border-0 max-[600px]:[&:not(.confirmation-modal)]:p-0 [width:min(100%,_760px)] [max-height:min(88vh,_820px)] [max-height:min(88dvh,_820px)] [display:flex] [flex-direction:column] [overflow:hidden] [padding:0] [border:1px_solid_#303a3e] [border-radius:18px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_45%)] [scrollbar-width:none]"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="edit-profile-heading"
                              >
                                <ModalHeader>
                                  <h2
                                    className="max-[600px]:[font-size:21px]"
                                    id="edit-profile-heading"
                                  >
                                    Edit profile
                                  </h2>
                                  <ModalCloseButton
                                    type="button"
                                    label="Close edit profile"
                                    onClick={() => setIsEditProfileOpen(false)}
                                    disabled={isSubmitting}
                                  >
                                    &times;
                                  </ModalCloseButton>
                                </ModalHeader>
                                <form
                                  className="profile-edit-form [display:flex] [flex:1_1_auto] [flex-direction:column] [min-height:0]"
                                  onSubmit={handleProfileSave}
                                  noValidate
                                >
                                  <div className="profile-modal-scroll [&::-webkit-scrollbar]:hidden [min-height:0] [flex:1_1_auto] [overflow-y:auto] [padding:20px_24px] [overscroll-behavior:contain] [scrollbar-width:none] [padding:16px]">
                                    <div className="profile-edit-fields [&>.form-field:nth-child(n+5)]:col-span-full max-[600px]:[&>.form-field:nth-child(n+5)]:[grid-column:auto] [display:grid] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [column-gap:16px] [grid-template-columns:minmax(0,_1fr)]">
                                      <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px]">
                                        <label
                                          className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                                          htmlFor="edit-name"
                                        >
                                          Name
                                        </label>
                                        <input
                                          className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)]"
                                          id="edit-name"
                                          name="name"
                                          value={profileForm.name}
                                          onChange={handleProfileFormChange}
                                          maxLength={100}
                                          required
                                          aria-invalid={Boolean(fieldErrors.name)}
                                        />
                                        {fieldErrors.name && (
                                          <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                                            {fieldErrors.name}
                                          </span>
                                        )}
                                      </div>
                                      <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px]">
                                        <label
                                          className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                                          htmlFor="edit-username"
                                        >
                                          Username
                                        </label>
                                        <input
                                          className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
                                          id="edit-username"
                                          name="username"
                                          value={profileForm.username}
                                          onChange={handleProfileFormChange}
                                          minLength={3}
                                          maxLength={30}
                                          pattern="[A-Za-z0-9_]{3,30}"
                                          required
                                          aria-invalid={Boolean(
                                            fieldErrors.username,
                                          )}
                                        />
                                        {fieldErrors.username && (
                                          <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                                            {fieldErrors.username}
                                          </span>
                                        )}
                                      </div>
                                      <OptionalProfileFields
                                        values={profileForm}
                                        onChange={handleProfileFormChange}
                                        errors={fieldErrors}
                                        prefix="edit-profile"
                                        showOptionalLabels={false}
                                      />
                                    </div>
                                    {message && (
                                      <p
                                        className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45] [margin:18px_0_0]"
                                        role="alert"
                                      >
                                        {message}
                                      </p>
                                    )}
                                  </div>
                                  <ModalFooter>
                                    <Button
                                      variant="secondary"
                                      type="button"
                                      onClick={() => setIsEditProfileOpen(false)}
                                      disabled={isSubmitting}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="primary"
                                      className="[width:auto] [min-width:150px] [min-height:42px] [margin:0] [padding-inline:16px] max-[600px]:[min-width:0]"
                                      type="submit"
                                      disabled={isSubmitting}
                                    >
                                      {isSubmitting ? "Saving..." : "Save changes"}
                                    </Button>
                                  </ModalFooter>
                                </form>
                              </section>
                            </div>
                          )}
                          {isOwnProfile && isSettingsOpen && (
                            <div
                              className="profile-modal-backdrop [&::-webkit-scrollbar]:hidden [position:fixed] [z-index:50] [inset:0] [display:grid] [place-items:center] [overflow:hidden] [padding:24px] [background:rgb(3_8_10_/_78%)] [scrollbar-width:none] [padding:0]"
                              onMouseDown={(event) => {
                                if (
                                  event.target === event.currentTarget &&
                                  !isSubmitting
                                )
                                  setIsSettingsOpen(false);
                              }}
                            >
                              <section
                                className="profile-edit-modal [&::-webkit-scrollbar]:hidden max-[600px]:[&:not(.confirmation-modal)]:w-full max-[600px]:[&:not(.confirmation-modal)]:max-w-none max-[600px]:[&:not(.confirmation-modal)]:h-dvh max-[600px]:[&:not(.confirmation-modal)]:max-h-dvh max-[600px]:[&:not(.confirmation-modal)]:rounded-none max-[600px]:[&:not(.confirmation-modal)]:border-0 max-[600px]:[&:not(.confirmation-modal)]:p-0 settings-modal [width:min(100%,_760px)] [max-height:min(88vh,_820px)] [max-height:min(88dvh,_820px)] [display:flex] [flex-direction:column] [overflow:hidden] [padding:0] [border:1px_solid_#303a3e] [border-radius:18px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_45%)] [scrollbar-width:none]"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="settings-heading"
                              >
                                <ModalHeader>
                                  <h2
                                    className="max-[600px]:[font-size:21px]"
                                    id="settings-heading"
                                  >
                                    Settings
                                  </h2>
                                  <ModalCloseButton
                                    type="button"
                                    label="Close settings"
                                    onClick={() => setIsSettingsOpen(false)}
                                    disabled={isSubmitting}
                                  >
                                    &times;
                                  </ModalCloseButton>
                                </ModalHeader>
                                {profileData.hasPassword ? (
                                  <form
                                    className="password-form flex min-h-0 flex-1 flex-col"
                                    onSubmit={handlePasswordChange}
                                    noValidate
                                  >
                                    <div className="profile-modal-scroll [&::-webkit-scrollbar]:hidden settings-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 [scrollbar-width:none]">
                                      <h3 className="[margin:0_0_20px] [color:#edf3f4] [font-size:16px]">
                                        Change password
                                      </h3>
                                      {[
                                        "currentPassword",
                                        "newPassword",
                                        "confirmPassword",
                                      ].map((fieldName) => {
                                        const labels = {
                                          currentPassword: "Current password",
                                          newPassword: "New password",
                                          confirmPassword: "Confirm new password",
                                        };
                                        return (
                                          <div
                                            className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px]"
                                            key={fieldName}
                                          >
                                            <label
                                              className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                                              htmlFor={fieldName}
                                            >
                                              {labels[fieldName]}
                                            </label>
                                            <input
                                              className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)]"
                                              id={fieldName}
                                              name={fieldName}
                                              type="password"
                                              autoComplete={
                                                fieldName === "currentPassword"
                                                  ? "current-password"
                                                  : "new-password"
                                              }
                                              minLength={
                                                fieldName === "currentPassword"
                                                  ? undefined
                                                  : 8
                                              }
                                              maxLength={128}
                                              value={passwordForm[fieldName]}
                                              onChange={handlePasswordFormChange}
                                              required
                                              aria-invalid={Boolean(
                                                fieldErrors[fieldName],
                                              )}
                                            />
                                            {fieldErrors[fieldName] && (
                                              <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                                                {fieldErrors[fieldName]}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                      {message && (
                                        <p
                                          className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45] [margin:18px_0_0]"
                                          role="alert"
                                        >
                                          {message}
                                        </p>
                                      )}
                                    </div>
                                    <ModalFooter>
                                      <Button
                                        variant="secondary"
                                        type="button"
                                        onClick={() => setIsSettingsOpen(false)}
                                        disabled={isSubmitting}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="primary"
                                        className="[width:auto] [min-width:150px] [min-height:42px] [margin:0] [padding-inline:16px] max-[600px]:[min-width:0]"
                                        type="submit"
                                        disabled={isSubmitting}
                                      >
                                        {isSubmitting
                                          ? "Updating..."
                                          : "Update password"}
                                      </Button>
                                    </ModalFooter>
                                  </form>
                                ) : (
                                  <p className="settings-oauth-note [margin:0] [padding:20px_24px] [color:#aebabb] [line-height:1.6] [padding:16px]">
                                    Your account uses Google sign-in, so there is no
                                    password to change here.
                                  </p>
                                )}
                              </section>
                            </div>
                          )}
                          {pendingDeleteOpportunity && (
                            <div
                              className="profile-modal-backdrop [&::-webkit-scrollbar]:hidden confirmation-backdrop [position:fixed] [z-index:50] [inset:0] [display:grid] [place-items:center] [overflow:hidden] [padding:24px] [background:rgb(3_8_10_/_78%)] [scrollbar-width:none] [padding:0] [padding:16px]"
                              onMouseDown={(event) => {
                                if (
                                  event.target === event.currentTarget &&
                                  !isDeletingOpportunity
                                )
                                  setPendingDeleteOpportunity(null);
                              }}
                            >
                              <section
                                className="profile-edit-modal [&::-webkit-scrollbar]:hidden max-[600px]:[&:not(.confirmation-modal)]:w-full max-[600px]:[&:not(.confirmation-modal)]:max-w-none max-[600px]:[&:not(.confirmation-modal)]:h-dvh max-[600px]:[&:not(.confirmation-modal)]:max-h-dvh max-[600px]:[&:not(.confirmation-modal)]:rounded-none max-[600px]:[&:not(.confirmation-modal)]:border-0 max-[600px]:[&:not(.confirmation-modal)]:p-0 confirmation-modal [width:min(100%,_760px)] [max-height:min(88vh,_820px)] [max-height:min(88dvh,_820px)] [display:flex] [flex-direction:column] [overflow:hidden] [padding:0] [border:1px_solid_#303a3e] [border-radius:18px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_45%)] [scrollbar-width:none] [width:min(100%,_380px)] [max-height:min(80dvh,_420px)] [height:auto] [max-height:80dvh]"
                                role="alertdialog"
                                aria-modal="true"
                                aria-labelledby="delete-opportunity-heading"
                                aria-describedby="delete-opportunity-description"
                              >
                                <ModalHeader>
                                  <h2
                                    className="max-[600px]:[font-size:21px]"
                                    id="delete-opportunity-heading"
                                  >
                                    Delete opportunity?
                                  </h2>
                                  <ModalCloseButton
                                    type="button"
                                    label="Close confirmation"
                                    onClick={() =>
                                      setPendingDeleteOpportunity(null)
                                    }
                                    disabled={isDeletingOpportunity}
                                  >
                                    &times;
                                  </ModalCloseButton>
                                </ModalHeader>
                                <div className="profile-modal-scroll [&::-webkit-scrollbar]:hidden confirmation-content [min-height:0] [flex:1_1_auto] [overflow-y:auto] [padding:20px_24px] [overscroll-behavior:contain] [scrollbar-width:none] [padding:16px]">
                                  <p
                                    className="[margin:0] [color:#c0cece] [line-height:1.6]"
                                    id="delete-opportunity-description"
                                  >
                                    This will remove the opportunity from your
                                    profile and Discover. This action can’t be
                                    undone.
                                  </p>
                                  {deleteOpportunityError && (
                                    <p
                                      className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45] [margin:18px_0_0]"
                                      role="alert"
                                    >
                                      {deleteOpportunityError}
                                    </p>
                                  )}
                                </div>
                                <ModalFooter>
                                  <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={() =>
                                      setPendingDeleteOpportunity(null)
                                    }
                                    disabled={isDeletingOpportunity}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="danger"
                                    className="[padding-inline:12px] [font-size:13px]"
                                    type="button"
                                    onClick={confirmDeleteOpportunity}
                                    disabled={isDeletingOpportunity}
                                  >
                                    {isDeletingOpportunity
                                      ? "Deleting..."
                                      : "Delete opportunity"}
                                  </Button>
                                </ModalFooter>
                              </section>
                            </div>
                          )}
                          {(isOwnProfile || page === "public-profile") && (
                            <>
                              <nav
                                className="profile-content-tabs mt-5 mb-[18px] flex gap-6 border-b border-[#252d31]"
                                aria-label="Profile posts"
                              >
                                <button
                                  className={`[display:inline-flex] [align-items:center] [gap:8px] [margin-bottom:-1px] [padding:10px_2px_12px] [border:0] [border-bottom:2px_solid_transparent] [background:transparent] [color:#9baeb3] [cursor:pointer] [font:inherit] [font-weight:600] ${!isOwnProfile || profileTab === "opportunities" ? "[border-bottom-color:#19c990] [color:#65e7b7]" : ""}`}
                                  type="button"
                                  aria-pressed={
                                    !isOwnProfile || profileTab === "opportunities"
                                  }
                                  onClick={() => setProfileTab("opportunities")}
                                >
                                  {isOwnProfile
                                    ? "My opportunities"
                                    : "Opportunities"}
                                </button>
                                {isOwnProfile && (
                                  <button
                                    className={`[display:inline-flex] [align-items:center] [gap:8px] [margin-bottom:-1px] [padding:10px_2px_12px] [border:0] [border-bottom:2px_solid_transparent] [background:transparent] [color:#9baeb3] [cursor:pointer] [font:inherit] [font-weight:600] ${profileTab === "saved" ? "[border-bottom-color:#19c990] [color:#65e7b7]" : ""}`}
                                    type="button"
                                    aria-pressed={profileTab === "saved"}
                                    onClick={() => setProfileTab("saved")}
                                  >
                                    Saved
                                  </button>
                                )}
                              </nav>
                              {(!isOwnProfile ||
                                profileTab === "opportunities") && (
                                <section
                                  className="my-opportunities-section [margin-top:0]"
                                  aria-label={
                                    isOwnProfile
                                      ? "My opportunities"
                                      : "Opportunities"
                                  }
                                >
                                  {myOpportunitiesLoading ? (
                                    <p
                                      className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                                      role="status"
                                    >
                                      Loading opportunities...
                                    </p>
                                  ) : myOpportunitiesError ? (
                                    <p
                                      className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                                      role="alert"
                                    >
                                      {myOpportunitiesError}
                                    </p>
                                  ) : myOpportunities.length > 0 ? (
                                    <div className="opportunity-feed grid gap-[14px]">
                                      {myOpportunities.map((opportunity) => (
                                        <OpportunityCard
                                          key={opportunity.id}
                                          opportunity={opportunity}
                                          isOwner={isOwnProfile}
                                          onEdit={handleEditOpportunity}
                                          onDelete={handleDeleteOpportunity}
                                          onComments={setActiveCommentsOpportunity}
                                          onToggleComments={
                                            handleToggleOpportunityComments
                                          }
                                          isSaved={savedOpportunities.some(
                                            (item) => item.id === opportunity.id,
                                          )}
                                          isLinkCopied={
                                            shareCopiedOpportunityId ===
                                            opportunity.id
                                          }
                                          onSave={handleSaveOpportunity}
                                          onShare={handleShareOpportunity}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]">
                                      {isOwnProfile
                                        ? "You have not posted any opportunities yet."
                                        : "No opportunities yet."}
                                    </p>
                                  )}
                                </section>
                              )}
                              {isOwnProfile && profileTab === "saved" && (
                                <section
                                  className="my-opportunities-section [margin-top:0]"
                                  aria-label="Saved opportunities"
                                >
                                  {savedOpportunitiesLoading ? (
                                    <p
                                      className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                                      role="status"
                                    >
                                      Loading saved opportunities...
                                    </p>
                                  ) : savedOpportunitiesError ? (
                                    <p
                                      className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                                      role="alert"
                                    >
                                      {savedOpportunitiesError}
                                    </p>
                                  ) : savedOpportunities.length > 0 ? (
                                    <div className="opportunity-feed grid gap-[14px]">
                                      {savedOpportunities.map((opportunity) => (
                                        <OpportunityCard
                                          key={opportunity.id}
                                          opportunity={opportunity}
                                          isOwner={Boolean(
                                            user &&
                                            user.id === opportunity.owner.id,
                                          )}
                                          isSaved
                                          isLinkCopied={
                                            shareCopiedOpportunityId ===
                                            opportunity.id
                                          }
                                          onEdit={handleEditOpportunity}
                                          onDelete={handleDeleteOpportunity}
                                          onComments={setActiveCommentsOpportunity}
                                          onToggleComments={
                                            handleToggleOpportunityComments
                                          }
                                          onSave={handleSaveOpportunity}
                                          onShare={handleShareOpportunity}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]">
                                      You have not saved any opportunities yet.
                                    </p>
                                  )}
                                </section>
                              )}
                            </>
                          )}
                        </>
                      )
                    ) : (
                      <p
                        className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45] [margin:18px_0_0]"
                        role="status"
                      >
                        {message || "Could not load profile."}
                      </p>
                    )}
                  </section>
                </section>
  );
}
