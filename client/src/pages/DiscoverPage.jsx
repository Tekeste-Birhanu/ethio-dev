import { Button } from "../components/ui.jsx";

import { DeveloperCard } from "../components/profiles.jsx";
import { OpportunityCard } from "../components/opportunities.jsx";
import { experienceOptions } from "../constants.js";

export default function DiscoverPage(props) {
  const {
    activeDiscoverFilterCount,
    areDiscoverFiltersOpen,
    debouncedDiscoverQuery,
    developersError,
    developersLoadedQuery,
    developersLoading,
    discoverFilters,
    discoverQuery,
    discoverTab,
    getDiscoverRequestKey,
    handleClearDiscoverFilters,
    handleDeleteOpportunity,
    handleDiscoverFilterChange,
    handleEditOpportunity,
    handleOpportunityStatusChange,
    handleLoadMoreDevelopers,
    handleLoadMoreOpportunities,
    handleOpenOpportunityComposer,
    handleSaveOpportunity,
    handleShareOpportunity,
    handleToggleOpportunityComments,
    hasMoreDevelopers,
    hasMoreOpportunities,
    isLoadingMoreDevelopers,
    isLoadingMoreOpportunities,
    latestDiscoverQuery: latestDiscoverQueryRef,
    loadMoreDevelopersError,
    loadMoreOpportunitiesError,
    message,
    opportunitiesError,
    opportunitiesLoadedQuery,
    opportunitiesLoading,
    savedOpportunities,
    setActiveCommentsOpportunity,
    setAreDiscoverFiltersOpen,
    setDevelopersError,
    setDevelopersLoading,
    setDevelopersRetry,
    setDiscoverQuery,
    setDiscoverTab,
    setHasMoreDevelopers,
    setHasMoreOpportunities,
    setIsLoadingMoreDevelopers,
    setIsLoadingMoreOpportunities,
    setLoadMoreDevelopersError,
    setLoadMoreOpportunitiesError,
    setNextDeveloperCursor,
    setNextOpportunityCursor,
    setOpportunitiesError,
    setOpportunitiesLoading,
    setOpportunitiesRetry,
    shareCopiedOpportunityId,
    sharedOpportunity,
    sharedOpportunityError,
    sharedOpportunityId,
    sharedOpportunityLoading,
    user,
    visibleDevelopers,
    visibleOpportunities,
    writeDiscoverUrlState,
  } = props;

  return (
    <section
                  className="discover-content mx-auto w-full max-w-[790px] min-w-0 px-7 pb-16 pt-[42px] max-[760px]:max-w-full max-[760px]:px-4 max-[760px]:pb-[calc(104px+env(safe-area-inset-bottom))] max-[760px]:pt-2"
                  aria-label={sharedOpportunityId ? undefined : "Discover"}
                  aria-labelledby={
                    sharedOpportunityId ? "discover-heading" : undefined
                  }
                >
                  <header
                    className={`discover-header mb-[10px] flex items-center gap-3${sharedOpportunityId ? " is-shared mb-4 justify-between gap-4" : ""} max-[760px]:mb-2`}
                  >
                    {sharedOpportunityId && (
                      <h1
                        className="m-0 text-[28px] tracking-[-0.04em] text-[#f4f7f7]"
                        id="discover-heading"
                      >
                        Opportunity
                      </h1>
                    )}
                    {!sharedOpportunityId && (
                      <label className="discover-search min-w-0 flex-1">
                        <span className="visually-hidden [position:absolute] [width:1px] [height:1px] [overflow:hidden] [clip:rect(0,_0,_0,_0)] [white-space:nowrap] [clip-path:inset(50%)]">
                          Search {discoverTab}
                        </span>
                        <input
                          className="min-h-12 w-full rounded-xl border border-[#303b40] bg-[#0d1215] px-[14px] py-[11px] text-ink placeholder:text-[#82969d] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                          type="search"
                          value={discoverQuery}
                          onChange={(event) => {
                            const value = event.target.value;
                            const nextQuery = value.trim().slice(0, 100);
                            const requestKey = getDiscoverRequestKey(
                              nextQuery,
                              discoverFilters,
                            );
                            latestDiscoverQueryRef.current = requestKey;
                            if (discoverTab === "opportunities") {
                              setOpportunitiesLoading(
                                requestKey !== opportunitiesLoadedQuery,
                              );
                              setOpportunitiesError("");
                              if (requestKey !== opportunitiesLoadedQuery) {
                                setNextOpportunityCursor(null);
                                setHasMoreOpportunities(false);
                              }
                              setIsLoadingMoreOpportunities(false);
                              setLoadMoreOpportunitiesError("");
                            } else {
                              setDevelopersLoading(
                                requestKey !== developersLoadedQuery,
                              );
                              setDevelopersError("");
                              if (requestKey !== developersLoadedQuery) {
                                setNextDeveloperCursor(null);
                                setHasMoreDevelopers(false);
                                setIsLoadingMoreDevelopers(false);
                                setLoadMoreDevelopersError("");
                              }
                            }
                            setDiscoverQuery(value);
                          }}
                          placeholder={`Search ${discoverTab}`}
                          maxLength={100}
                        />
                      </label>
                    )}
                    {!sharedOpportunityId && (
                      <button
                        className={`inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${activeDiscoverFilterCount ? "border-accent/50 bg-accent-dark text-accent-light" : "border-[#303b40] bg-surface text-ink hover:bg-[#1b2529]"}`}
                        type="button"
                        aria-expanded={areDiscoverFiltersOpen}
                        aria-controls={
                          areDiscoverFiltersOpen
                            ? "discover-filter-panel"
                            : undefined
                        }
                        onClick={() =>
                          setAreDiscoverFiltersOpen((isOpen) => !isOpen)
                        }
                      >
                        Filters
                        {activeDiscoverFilterCount > 0 && (
                          <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-[#06251a]">
                            {activeDiscoverFilterCount}
                          </span>
                        )}
                      </button>
                    )}
                    {sharedOpportunityId && user && (
                      <button
                        className="app-post-button m-0 min-h-[46px] cursor-pointer rounded-xl border-0 bg-accent px-[15px] font-bold text-[#06251a] hover:bg-[#28dfa5]"
                        type="button"
                        onClick={handleOpenOpportunityComposer}
                      >
                        Post opportunity
                      </button>
                    )}
                  </header>
                  {!sharedOpportunityId && (
                    <>
                      {areDiscoverFiltersOpen && (
                        <div
                          className="mb-3 grid grid-cols-3 items-end gap-3 rounded-xl border border-border bg-surface p-4 max-[620px]:grid-cols-2 max-[380px]:grid-cols-1"
                          id="discover-filter-panel"
                        >
                          <label className="grid gap-1.5 text-xs font-semibold text-[#aebabb]">
                            Skill
                            <input
                              className="min-h-10 w-full rounded-lg border border-[#303b40] bg-[#0d1215] px-3 py-2 text-sm text-ink placeholder:text-[#82969d] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                              type="search"
                              value={discoverFilters.skill}
                              onChange={(event) =>
                                handleDiscoverFilterChange(
                                  "skill",
                                  event.target.value.slice(0, 60),
                                )
                              }
                              placeholder="Filter by skill"
                              maxLength={60}
                            />
                          </label>
                          <label className="grid gap-1.5 text-xs font-semibold text-[#aebabb]">
                            City
                            <input
                              className="min-h-10 w-full rounded-lg border border-[#303b40] bg-[#0d1215] px-3 py-2 text-sm text-ink placeholder:text-[#82969d] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                              type="search"
                              value={discoverFilters.city}
                              onChange={(event) =>
                                handleDiscoverFilterChange(
                                  "city",
                                  event.target.value.slice(0, 60),
                                )
                              }
                              placeholder="Filter by city"
                              maxLength={60}
                            />
                          </label>
                          <label className="grid gap-1.5 text-xs font-semibold text-[#aebabb]">
                            Experience
                            <select
                              className="min-h-10 w-full rounded-lg border border-[#303b40] bg-[#0d1215] px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                              value={discoverFilters.experience}
                              onChange={(event) =>
                                handleDiscoverFilterChange(
                                  "experience",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Any experience</option>
                              {experienceOptions.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {activeDiscoverFilterCount > 0 && (
                            <button
                              className="min-h-10 w-fit cursor-pointer rounded-lg border-0 bg-transparent px-2 text-sm font-semibold text-accent-light hover:bg-[#1b2529] hover:text-accent max-[620px]:col-span-2 max-[380px]:col-span-1"
                              type="button"
                              onClick={handleClearDiscoverFilters}
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                      )}
                      {activeDiscoverFilterCount > 0 && (
                        <div
                          className="mb-3 flex flex-wrap items-center gap-2"
                          aria-label="Active filters"
                        >
                          {[
                            ["skill", "Skill", discoverFilters.skill],
                            ["city", "City", discoverFilters.city],
                            [
                              "experience",
                              "Experience",
                              experienceOptions.find(
                                ([value]) => value === discoverFilters.experience,
                              )?.[1],
                            ],
                          ]
                            .filter(([, , value]) => Boolean(value))
                            .map(([key, label, value]) => (
                              <button
                                className="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full border border-[#344148] bg-[#182126] px-3 text-xs text-[#cbd7d9] hover:border-accent/60 hover:text-accent-light"
                                key={key}
                                type="button"
                                aria-label={`Remove ${label} filter: ${value}`}
                                onClick={() => handleDiscoverFilterChange(key, "")}
                              >
                                <span>
                                  {label}: {value}
                                </span>
                                <span aria-hidden="true" className="text-[#91a2a5]">
                                  ×
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                  {!sharedOpportunityId && (
                    <div className="discover-controls mb-4 flex items-stretch justify-between gap-3 max-[760px]:mb-3 max-[760px]:gap-2">
                      <nav
                        className="discover-tabs flex min-w-0 gap-[22px] border-b border-border max-[760px]:gap-3"
                        aria-label="Discover content"
                      >
                        <button
                          className={`mb-[-1px] min-h-[46px] cursor-pointer whitespace-nowrap border-0 border-b-2 border-transparent bg-transparent px-0.5 pb-2.5 pt-2 font-semibold text-[#9baeb3] max-[760px]:min-h-[42px] max-[760px]:text-sm ${discoverTab === "opportunities" ? "is-active border-b-accent text-accent-light" : ""}`}
                          type="button"
                          aria-pressed={discoverTab === "opportunities"}
                          onClick={() => {
                            if (discoverTab === "opportunities") return;
                            latestDiscoverQueryRef.current = getDiscoverRequestKey(
                              discoverQuery.trim(),
                              discoverFilters,
                            );
                            setDiscoverTab("opportunities");
                            setOpportunitiesLoading(
                              opportunitiesLoadedQuery !==
                                getDiscoverRequestKey(
                                  debouncedDiscoverQuery,
                                  discoverFilters,
                                ),
                            );
                            setIsLoadingMoreOpportunities(false);
                            setLoadMoreOpportunitiesError("");
                            writeDiscoverUrlState("opportunities", "pushState");
                          }}
                        >
                          Opportunities
                        </button>
                        <button
                          className={`mb-[-1px] min-h-[46px] cursor-pointer whitespace-nowrap border-0 border-b-2 border-transparent bg-transparent px-0.5 pb-2.5 pt-2 font-semibold text-[#9baeb3] max-[760px]:min-h-[42px] max-[760px]:text-sm ${discoverTab === "developers" ? "is-active border-b-accent text-accent-light" : ""}`}
                          type="button"
                          aria-pressed={discoverTab === "developers"}
                          onClick={() => {
                            if (discoverTab === "developers") return;
                            latestDiscoverQueryRef.current = getDiscoverRequestKey(
                              discoverQuery.trim(),
                              discoverFilters,
                            );
                            setDiscoverTab("developers");
                            setDevelopersLoading(
                              developersLoadedQuery !==
                                getDiscoverRequestKey(
                                  debouncedDiscoverQuery,
                                  discoverFilters,
                                ),
                            );
                            writeDiscoverUrlState("developers", "pushState");
                          }}
                        >
                          Developers
                        </button>
                      </nav>
                      {user && (
                        <button
                          className="app-post-button m-0 min-h-[46px] shrink-0 cursor-pointer self-center rounded-xl border-0 bg-accent px-[15px] font-bold text-[#06251a] hover:bg-[#28dfa5] max-[760px]:min-h-[38px] max-[760px]:px-[10px] max-[760px]:text-xs"
                          type="button"
                          onClick={handleOpenOpportunityComposer}
                        >
                          Post opportunity
                        </button>
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
                  {sharedOpportunityId && sharedOpportunityLoading && (
                    <p
                      className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                      role="status"
                    >
                      Loading opportunity...
                    </p>
                  )}
                  {sharedOpportunityId && sharedOpportunityError && (
                    <p
                      className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                      role="alert"
                    >
                      {sharedOpportunityError}
                    </p>
                  )}
                  {sharedOpportunity && (
                    <div className="shared-opportunity-card [margin-bottom:16px]">
                      <OpportunityCard
                        key={sharedOpportunity.id}
                        opportunity={sharedOpportunity}
                        isOwner={Boolean(
                          user && user.id === sharedOpportunity.owner.id,
                        )}
                        isSaved={savedOpportunities.some(
                          (item) => item.id === sharedOpportunity.id,
                        )}
                        isLinkCopied={
                          shareCopiedOpportunityId === sharedOpportunity.id
                        }
                        onEdit={handleEditOpportunity}
                        onDelete={handleDeleteOpportunity}
                        onStatusChange={handleOpportunityStatusChange}
                        onComments={setActiveCommentsOpportunity}
                        onToggleComments={handleToggleOpportunityComments}
                        onSave={handleSaveOpportunity}
                        onShare={handleShareOpportunity}
                      />
                    </div>
                  )}
                  {!sharedOpportunityId && discoverTab === "developers" ? (
                    developersLoading ? (
                      <p
                        className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                        role="status"
                      >
                        Loading developers...
                      </p>
                    ) : developersError ? (
                      <div
                        className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                        role="alert"
                      >
                        <p className="[margin:0_0_16px]">{developersError}</p>
                        <Button
                          variant="secondary"
                          type="button"
                          onClick={() => {
                            setDevelopersLoading(true);
                            setDevelopersRetry((retry) => retry + 1);
                          }}
                        >
                          Try again
                        </Button>
                      </div>
                    ) : (
                      <>
                        {visibleDevelopers.length > 0 ? (
                          <div className="developer-grid [display:grid] [grid-template-columns:repeat(auto-fill,_minmax(min(100%,_320px),_1fr))] [gap:14px]">
                            {visibleDevelopers.map((developer) => (
                              <DeveloperCard
                                key={developer.id}
                                developer={developer}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="discover-empty-state [display:grid] [justify-items:center] [gap:14px] [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]">
                            <p className="[margin:0]">
                              {hasMoreDevelopers
                                ? "More developer profiles are available."
                                : debouncedDiscoverQuery
                                  ? "No developers match your search."
                                  : "No developer profiles to show yet."}
                            </p>
                          </div>
                        )}
                        {loadMoreDevelopersError && (
                          <div
                            className="discover-state [margin-top:16px] [padding:20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                            role="alert"
                          >
                            <p className="[margin:0_0_14px]">
                              {loadMoreDevelopersError}
                            </p>
                            <Button
                              variant="secondary"
                              type="button"
                              onClick={handleLoadMoreDevelopers}
                            >
                              Try again
                            </Button>
                          </div>
                        )}
                        {hasMoreDevelopers && !loadMoreDevelopersError && (
                          <div className="[display:flex] [justify-content:center] [padding:20px_0]">
                            <Button
                              variant="secondary"
                              type="button"
                              disabled={isLoadingMoreDevelopers}
                              onClick={handleLoadMoreDevelopers}
                            >
                              {isLoadingMoreDevelopers
                                ? "Loading developers..."
                                : "Load more developers"}
                            </Button>
                          </div>
                        )}
                      </>
                    )
                  ) : opportunitiesLoading ? (
                    <p
                      className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                      role="status"
                    >
                      Loading opportunities...
                    </p>
                  ) : opportunitiesError ? (
                    <div
                      className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                      role="alert"
                    >
                      <p className="[margin:0_0_16px]">{opportunitiesError}</p>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          setOpportunitiesLoading(true);
                          setOpportunitiesRetry((retry) => retry + 1);
                        }}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <>
                      {visibleOpportunities.length > 0 && (
                        <div className="opportunity-feed grid gap-[14px]">
                          {visibleOpportunities.map((opportunity) => (
                            <OpportunityCard
                              key={opportunity.id}
                              opportunity={opportunity}
                              isOwner={Boolean(
                                user && user.id === opportunity.owner.id,
                              )}
                              onEdit={handleEditOpportunity}
                              onDelete={handleDeleteOpportunity}
                              onStatusChange={handleOpportunityStatusChange}
                              onComments={setActiveCommentsOpportunity}
                              onToggleComments={handleToggleOpportunityComments}
                              isSaved={savedOpportunities.some(
                                (item) => item.id === opportunity.id,
                              )}
                              isLinkCopied={
                                shareCopiedOpportunityId === opportunity.id
                              }
                              onSave={handleSaveOpportunity}
                              onShare={handleShareOpportunity}
                            />
                          ))}
                        </div>
                      )}
                      {visibleOpportunities.length === 0 &&
                        !hasMoreOpportunities && (
                          <div className="discover-empty-state [display:grid] [justify-items:center] [gap:14px] [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]">
                            <p className="[margin:0]">
                              {sharedOpportunityId
                                ? "No other opportunities to show yet."
                                : debouncedDiscoverQuery
                                  ? "No opportunities match your search."
                                  : "No opportunities yet. Be the first to share one."}
                            </p>
                          </div>
                        )}
                      {loadMoreOpportunitiesError && (
                        <div
                          className="discover-state [padding:28px_20px] [border:1px_solid_#252d31] [border-radius:16px] [color:#aebabb] [text-align:center]"
                          role="alert"
                        >
                          <p className="[margin:0_0_16px]">
                            {loadMoreOpportunitiesError}
                          </p>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={handleLoadMoreOpportunities}
                            disabled={isLoadingMoreOpportunities}
                          >
                            Try again
                          </Button>
                        </div>
                      )}
                      {hasMoreOpportunities && !loadMoreOpportunitiesError && (
                        <div className="discover-load-more [display:flex] [justify-content:center] [padding:8px_0_20px]">
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={handleLoadMoreOpportunities}
                            disabled={isLoadingMoreOpportunities}
                          >
                            {isLoadingMoreOpportunities
                              ? "Loading more..."
                              : "Load more opportunities"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </section>
  );
}
