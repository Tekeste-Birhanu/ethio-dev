import { useEffect, useRef, useState } from 'react'
import './App.css'

const registrationFields = [
  { name: 'name', label: 'Full name', type: 'text', autoComplete: 'name', maxLength: 100 },
  {
    name: 'username',
    label: 'Username',
    type: 'text',
    autoComplete: 'username',
    maxLength: 30,
    pattern: '[A-Za-z0-9_]{3,30}',
    title: 'Use 3-30 letters, numbers, or underscores.',
  },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', maxLength: 254 },
]

const experienceOptions = [
  ['BEGINNER', 'Beginner'],
  ['JUNIOR', 'Junior'],
  ['INTERMEDIATE', 'Intermediate'],
  ['SENIOR', 'Senior'],
]

const opportunityCategoryOptions = [
  ['WEB', 'Web'],
  ['MOBILE', 'Mobile'],
  ['DESKTOP', 'Desktop'],
  ['DATA_AI', 'Data/AI'],
  ['GAMES', 'Games'],
  ['DEVELOPER_TOOLS_OPEN_SOURCE', 'Developer Tools/Open Source'],
  ['HARDWARE_IOT', 'Hardware/IoT'],
  ['OTHER', 'Other'],
]

const opportunityWorkSetupOptions = [
  ['', 'Any work setup'],
  ['REMOTE', 'Remote'],
  ['IN_PERSON', 'In-person'],
  ['HYBRID', 'Hybrid'],
]

function OptionalProfileFields({ values, onChange, errors, prefix, showOptionalLabels = true }) {
  return (
    <>
      <div className="form-field">
        <label htmlFor={`${prefix}-city`}>City {showOptionalLabels && <span>(optional)</span>}</label>
        <input
          id={`${prefix}-city`}
          name="city"
          type="text"
          maxLength={100}
          autoComplete="address-level2"
          value={values.city}
          onChange={onChange}
          aria-invalid={Boolean(errors.city)}
        />
        {errors.city && <span className="field-error">{errors.city}</span>}
      </div>
      <div className="form-field">
        <label htmlFor={`${prefix}-experience`}>Experience {showOptionalLabels && <span>(optional)</span>}</label>
        <select
          id={`${prefix}-experience`}
          name="experience"
          value={values.experience}
          onChange={onChange}
          aria-invalid={Boolean(errors.experience)}
        >
          <option value="">Choose a level</option>
          {experienceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {errors.experience && <span className="field-error">{errors.experience}</span>}
      </div>
      <div className="form-field">
        <label htmlFor={`${prefix}-skills`}>Skills <span>({showOptionalLabels ? 'optional, ' : ''}comma-separated)</span></label>
        <input
          id={`${prefix}-skills`}
          name="skills"
          type="text"
          maxLength={1000}
          placeholder="JavaScript, React, PostgreSQL"
          value={values.skills}
          onChange={onChange}
          aria-invalid={Boolean(errors.skills)}
        />
        {errors.skills && <span className="field-error">{errors.skills}</span>}
      </div>
      <div className="form-field">
        <label htmlFor={`${prefix}-description`}>Bio {showOptionalLabels && <span>(optional)</span>}</label>
        <textarea
          id={`${prefix}-description`}
          name="description"
          maxLength={2000}
          rows={3}
          value={values.description}
          onChange={onChange}
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description && <span className="field-error">{errors.description}</span>}
      </div>
    </>
  )
}

const emptyProfileFields = { city: '', experience: '', skills: '', description: '' }
const emptyOpportunityForm = {
  description: '',
  categories: [],
  skillsSought: [],
  experienceSought: '',
  workSetup: '',
  workCity: '',
}

function formatPostTime(dateString) {
  const postDate = new Date(dateString)
  const secondsAgo = Math.max(0, Math.floor((Date.now() - postDate.getTime()) / 1000))
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]

  for (const [unit, seconds] of units) {
    if (secondsAgo >= seconds) return formatter.format(-Math.floor(secondsAgo / seconds), unit)
  }

  return 'just now'
}

function OpportunityCard({ opportunity, isOwner, isSaved, isLinkCopied, onEdit, onDelete, onComments, onToggleComments, onSave, onShare }) {
  const descriptionRef = useRef(null)
  const ownerMenuRef = useRef(null)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [hasLongDescription, setHasLongDescription] = useState(false)
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = useState(false)
  const categories = opportunity.categories.map((category) => opportunityCategoryOptions.find(([value]) => value === category)?.[1] ?? category)
  const experience = opportunity.experienceSought
    ? opportunity.experienceSought[0] + opportunity.experienceSought.slice(1).toLowerCase()
    : null
  const workSetup = opportunity.workSetup
    ? `${opportunity.workSetup === 'IN_PERSON' ? 'In-person' : opportunity.workSetup[0] + opportunity.workSetup.slice(1).toLowerCase()}${opportunity.workCity ? ` · ${opportunity.workCity}` : ''}`
    : null

  useEffect(() => {
    const descriptionElement = descriptionRef.current
    if (!descriptionElement || isDescriptionExpanded) return undefined

    const updateDescriptionOverflow = () => {
      setHasLongDescription(descriptionElement.scrollHeight > descriptionElement.clientHeight + 1)
    }

    updateDescriptionOverflow()
    const resizeObserver = new ResizeObserver(updateDescriptionOverflow)
    resizeObserver.observe(descriptionElement)

    return () => resizeObserver.disconnect()
  }, [isDescriptionExpanded, opportunity.description])

  useEffect(() => {
    if (!isOwnerMenuOpen) return undefined

    function closeOnOutsidePointer(event) {
      if (!ownerMenuRef.current?.contains(event.target)) {
        ownerMenuRef.current.open = false
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        ownerMenuRef.current.open = false
        ownerMenuRef.current.querySelector('summary')?.focus()
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOwnerMenuOpen])

  return (
    <article className="opportunity-card">
      <header className="opportunity-card-author">
        <a className="opportunity-card-avatar" href={`/profile/${encodeURIComponent(opportunity.owner.username)}`} aria-label={`${opportunity.owner.name}'s profile`}>
          {opportunity.owner.name.slice(0, 1).toUpperCase()}
        </a>
        <div className="opportunity-card-identity">
          <a href={`/profile/${encodeURIComponent(opportunity.owner.username)}`}>{opportunity.owner.name}</a>
          <span>@{opportunity.owner.username} · {formatPostTime(opportunity.createdAt)}</span>
        </div>
        {opportunity.status !== 'OPEN' && (
          <span className={`opportunity-status opportunity-status-${opportunity.status.toLowerCase()}`}>
            {opportunity.status[0] + opportunity.status.slice(1).toLowerCase()}
          </span>
        )}
        {isOwner && (
          <details
            ref={ownerMenuRef}
            className="opportunity-owner-menu"
            onToggle={(event) => setIsOwnerMenuOpen(event.currentTarget.open)}
          >
            <summary aria-label="Opportunity actions">•••</summary>
            <div className="opportunity-owner-menu-items">
              <button type="button" onClick={() => { ownerMenuRef.current.open = false; onEdit(opportunity) }}>Edit</button>
              <button type="button" onClick={() => { ownerMenuRef.current.open = false; onToggleComments(opportunity) }}>
                Turn comments {opportunity.commentsEnabled ? 'off' : 'on'}
              </button>
              <button className="opportunity-delete-action" type="button" onClick={() => { ownerMenuRef.current.open = false; onDelete(opportunity) }}>Delete</button>
            </div>
          </details>
        )}
      </header>
      <p
        ref={descriptionRef}
        className={`opportunity-card-description${isDescriptionExpanded ? '' : ' is-collapsed'}`}
        id={`opportunity-description-${opportunity.id}`}
      >
        {opportunity.description}
      </p>
      {hasLongDescription && (
        <div className="opportunity-card-expand-row">
          <button
            className="opportunity-card-expand"
            type="button"
            aria-expanded={isDescriptionExpanded}
            aria-controls={`opportunity-description-${opportunity.id}`}
            onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
          >
            {isDescriptionExpanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}
      {(categories.length > 0 || opportunity.skillsSought.length > 0 || experience || workSetup) && (
        <div className="opportunity-card-metadata" aria-label="Opportunity details">
          {categories.length > 0 && (
            <div className="opportunity-card-tag-group opportunity-card-category-group">
              <ul className="opportunity-card-tags">
                {categories.map((category) => <li key={category}>{category}</li>)}
              </ul>
            </div>
          )}
          {opportunity.skillsSought.length > 0 && (
            <div className="opportunity-card-tag-group opportunity-card-skills-group">
              <ul className="opportunity-card-tags">
                {opportunity.skillsSought.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            </div>
          )}
          {(experience || workSetup) && (
            <div className="opportunity-card-context opportunity-card-context-group">
              {experience && <span>{experience}</span>}
              {workSetup && <span>{workSetup}</span>}
            </div>
          )}
        </div>
      )}
      <footer className="opportunity-card-actions">
        <button className={`opportunity-card-action${isSaved ? ' is-saved' : ''}`} type="button" onClick={() => onSave(opportunity)} aria-pressed={Boolean(isSaved)} aria-label={isSaved ? 'Remove from saved opportunities' : 'Save opportunity'} title={isSaved ? 'Remove from saved' : 'Save opportunity'}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4V4.75Z" />
          </svg>
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>
        <button className="opportunity-comment-action" type="button" onClick={() => onComments(opportunity)} aria-label={`Open ${opportunity.commentCount ?? 0} comments`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
          </svg>
          <span>{opportunity.commentCount ?? 0}</span>
        </button>
        <button className="opportunity-card-action" type="button" onClick={() => onShare(opportunity)} aria-label={isLinkCopied ? 'Link copied' : 'Share opportunity'} title={isLinkCopied ? 'Link copied' : 'Share opportunity'}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
          </svg>
          <span>{isLinkCopied ? 'Copied' : 'Share'}</span>
        </button>
      </footer>
    </article>
  )
}

function CommentsDialog({ opportunity, user, isOwner, onClose, onCommentCountChange }) {
  const [comments, setComments] = useState([])
  const [commentsEnabled, setCommentsEnabled] = useState(opportunity.commentsEnabled)
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState(null)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingCommentId, setSavingCommentId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    fetch(`/api/opportunities/${encodeURIComponent(opportunity.id)}/comments`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message ?? 'Could not load comments.')
        if (isCurrent) {
          setComments(result.comments)
          setCommentsEnabled(result.commentsEnabled)
        }
      })
      .catch((loadError) => { if (isCurrent) setError(loadError.message) })
      .finally(() => { if (isCurrent) setIsLoading(false) })

    return () => { isCurrent = false }
  }, [opportunity.id])

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      const openMenu = document.querySelector('.comment-menu[open]')
      if (openMenu) {
        openMenu.open = false
        event.stopPropagation()
      } else if (!isSubmitting) onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isSubmitting, onClose])

  useEffect(() => {
    const closeMenusOutside = (event) => {
      document.querySelectorAll('.comment-menu[open]').forEach((menu) => {
        if (!menu.contains(event.target)) menu.open = false
      })
    }
    document.addEventListener('pointerdown', closeMenusOutside)
    return () => document.removeEventListener('pointerdown', closeMenusOutside)
  }, [])

  async function submitComment(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || isSubmitting) return
    setIsSubmitting(true)
    setError('')
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(opportunity.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not post your comment.')
      setComments((current) => [...current, result.comment])
      setDraft('')
      onCommentCountChange(opportunity.id, comments.length + 1)
    } catch (submitError) {
      setError(submitError.message || 'Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function deleteComment(comment) {
    setDeletingCommentId(comment.id)
    setError('')
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(opportunity.id)}/comments/${encodeURIComponent(comment.id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error?.message ?? 'Could not delete the comment.')
      }
      const nextComments = comments.filter((item) => item.id !== comment.id)
      setComments(nextComments)
      onCommentCountChange(opportunity.id, nextComments.length)
    } catch (deleteError) {
      setError(deleteError.message || 'Could not reach the server. Check your connection and try again.')
    } finally {
      setDeletingCommentId(null)
    }
  }

  async function saveComment(comment) {
    const text = editDraft.trim()
    if (!text || savingCommentId) return
    setSavingCommentId(comment.id)
    setError('')
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(opportunity.id)}/comments/${encodeURIComponent(comment.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not update the comment.')
      setComments((current) => current.map((item) => item.id === comment.id ? result.comment : item))
      setEditingCommentId(null)
      setEditDraft('')
    } catch (saveError) {
      setError(saveError.message || 'Could not reach the server. Check your connection and try again.')
    } finally {
      setSavingCommentId(null)
    }
  }

  return (
    <div className="profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose() }}>
      <section className="profile-edit-modal comments-modal" role="dialog" aria-modal="true" aria-labelledby="comments-heading">
        <header className="profile-edit-modal-header">
          <div className="comments-modal-title">
            <h2 id="comments-heading">Comments</h2>
            <p>On {opportunity.owner.name}’s opportunity</p>
          </div>
          <button className="profile-edit-modal-close" type="button" aria-label="Close comments" onClick={onClose}>&times;</button>
        </header>
        <div className="profile-modal-scroll comments-modal-scroll">
          {isLoading ? (
            <p className="discover-state" role="status">Loading comments...</p>
          ) : comments.length > 0 ? (
            <ol className="comment-list">
              {comments.map((comment) => (
                <li key={comment.id}>
                  <article className="comment-item">
                    <div className="comment-avatar" aria-hidden="true">{comment.author.name.slice(0, 1).toUpperCase()}</div>
                    <div className="comment-content">
                      <header>
                        <a href={`/profile/${encodeURIComponent(comment.author.username)}`}>{comment.author.name}</a>
                        <span>@{comment.author.username} · {formatPostTime(comment.createdAt)}</span>
                      </header>
                      {editingCommentId === comment.id ? (
                        <div className="comment-edit-form">
                          <label className="visually-hidden" htmlFor={`edit-comment-${comment.id}`}>Edit your comment</label>
                          <textarea id={`edit-comment-${comment.id}`} value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={1000} rows={3} disabled={savingCommentId === comment.id} />
                          <div>
                            <button type="button" onClick={() => { setEditingCommentId(null); setEditDraft('') }} disabled={savingCommentId === comment.id}>Cancel</button>
                            <button type="button" onClick={() => saveComment(comment)} disabled={!editDraft.trim() || savingCommentId === comment.id}>{savingCommentId === comment.id ? 'Saving...' : 'Save'}</button>
                          </div>
                        </div>
                      ) : <p>{comment.text}</p>}
                    </div>
                    {user && (user.id === comment.author.id || isOwner) && (
                      <details className="comment-menu" onToggle={(event) => {
                        if (!event.currentTarget.open) return
                        const rect = event.currentTarget.querySelector('summary').getBoundingClientRect()
                        const menuWidth = 126
                        const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
                        const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 96))
                        event.currentTarget.style.setProperty('--comment-menu-left', `${left}px`)
                        event.currentTarget.style.setProperty('--comment-menu-top', `${top}px`)
                      }}>
                        <summary aria-label="Comment actions">•••</summary>
                        <div className="comment-menu-items">
                          {user.id === comment.author.id && editingCommentId !== comment.id && (
                            <button type="button" onClick={(event) => { event.currentTarget.closest('details').open = false; setEditingCommentId(comment.id); setEditDraft(comment.text); setError('') }}>Edit</button>
                          )}
                          <button className="comment-menu-delete" type="button" onClick={(event) => { event.currentTarget.closest('details').open = false; deleteComment(comment) }} disabled={deletingCommentId === comment.id || editingCommentId === comment.id}>
                            {deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </details>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <p className="comments-empty">No comments yet.</p>
          )}
          {error && <p className="form-message" role="alert">{error}</p>}
        </div>
        {!isLoading && commentsEnabled && (user ? (
          <form className="comment-compose" onSubmit={submitComment}>
            <label className="visually-hidden" htmlFor="new-opportunity-comment">Write a comment</label>
            <textarea id="new-opportunity-comment" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={2} placeholder="Write a comment…" disabled={isSubmitting} />
            <button className="submit-button" type="submit" disabled={!draft.trim() || isSubmitting}>{isSubmitting ? 'Posting…' : 'Comment'}</button>
          </form>
        ) : (
          <p className="comments-signin-note">Sign in to add a comment.</p>
        ))}
        {!commentsEnabled && <p className="comments-signin-note">Comments are turned off for this opportunity.</p>}
      </section>
    </div>
  )
}

function AppSidebar({ user, activePage, onNavigate, onSignIn, onRegister, onSignOut }) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef(null)

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined

    const closeOnOutsideClick = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setIsAccountMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsAccountMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isAccountMenuOpen])

  return (
    <aside className="app-sidebar" aria-label="Main navigation">
      <a className="app-wordmark" href="/" onClick={(event) => { event.preventDefault(); onNavigate('discover') }}>EthioDev</a>
      <nav className="app-nav">
        <button className={`app-nav-link${activePage === 'discover' ? ' is-active' : ''}`} type="button" onClick={() => onNavigate('discover')} aria-current={activePage === 'discover' ? 'page' : undefined}>Discover</button>
        {user && <button className={`app-nav-link${activePage === 'profile' ? ' is-active' : ''}`} type="button" onClick={() => onNavigate('profile')} aria-current={activePage === 'profile' ? 'page' : undefined}>Profile</button>}
      </nav>
      {!user && (
        <div className="app-auth-actions">
          <button className="secondary-button" type="button" onClick={onSignIn}>Sign in</button>
          <button className="app-post-button" type="button" onClick={onRegister}>Create account</button>
        </div>
      )}
      {user && (
        <div className="app-account-menu" ref={accountMenuRef}>
          <button
            className="app-sidebar-user"
            type="button"
            aria-label={`${user.name} account menu`}
            aria-expanded={isAccountMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsAccountMenuOpen((open) => !open)}
          >
            <span className="app-account-identity">{user.name}<span>@{user.username}</span></span>
            <span className="app-account-menu-icon" aria-hidden="true">···</span>
          </button>
          {isAccountMenuOpen && (
            <div className="app-account-popover" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsAccountMenuOpen(false)
                  onSignOut()
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

function ProfileOverflowMenu({ onSignOut, isSubmitting }) {
  const menuRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined

    const closeOnOutsidePointer = (event) => {
      if (!menuRef.current?.contains(event.target)) menuRef.current.open = false
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        menuRef.current.open = false
        menuRef.current.querySelector('summary')?.focus()
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <details ref={menuRef} className="profile-overflow-menu" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary aria-label="More profile actions">···</summary>
      <div className="profile-overflow-menu-items" role="menu">
        <button type="button" role="menuitem" onClick={() => { menuRef.current.open = false; onSignOut() }} disabled={isSubmitting}>
          {isSubmitting ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </details>
  )
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
    <div className="profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose() }}>
      <section className="profile-edit-modal opportunity-composer-modal" role="dialog" aria-modal="true" aria-labelledby="create-opportunity-heading">
        <header className="profile-edit-modal-header">
          <h2 id="create-opportunity-heading">{editingOpportunityId ? 'Edit opportunity' : 'Create opportunity'}</h2>
          <button className="profile-edit-modal-close" type="button" aria-label="Close opportunity form" onClick={onClose} disabled={isSubmitting}>&times;</button>
        </header>
        <form className="opportunity-form" onSubmit={handleOpportunitySubmit} noValidate>
          <div className="profile-modal-scroll opportunity-modal-scroll">
            <div className="form-field opportunity-description-field">
              <label htmlFor="opportunity-description">What are you building?</label>
              <textarea id="opportunity-description" name="description" rows={5} placeholder="Describe your project and who you'd like to collaborate with." value={opportunityForm.description} onChange={handleOpportunityFormChange} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? 'opportunity-description-error' : undefined} required />
              {fieldErrors.description && <span className="field-error" id="opportunity-description-error">{fieldErrors.description}</span>}
            </div>

            <section className="opportunity-details-panel" aria-labelledby="opportunity-details-heading">
              <h3 id="opportunity-details-heading">Details</h3>
              <div className="form-field opportunity-skills-field">
                <label htmlFor="opportunity-skills">Skills</label>
                <div className="opportunity-skill-entry">
                  <input id="opportunity-skills" type="text" maxLength={40} placeholder="For example, React" value={opportunitySkillDraft} onChange={(event) => { setOpportunitySkillDraft(event.target.value); setFieldErrors((current) => ({ ...current, skillsSought: undefined })) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addOpportunitySkill() } }} aria-invalid={Boolean(fieldErrors.skillsSought)} aria-describedby={fieldErrors.skillsSought ? 'opportunity-skills-error' : undefined} />
                  <button className="secondary-button" type="button" onClick={addOpportunitySkill}>Add skill</button>
                </div>
                {opportunityForm.skillsSought.length > 0 && (
                  <ul className="opportunity-skill-tags" aria-label="Skills needed">
                    {opportunityForm.skillsSought.map((skill) => (
                      <li key={skill}><span>{skill}</span><button type="button" aria-label={`Remove ${skill} skill`} onClick={() => setOpportunityForm((current) => ({ ...current, skillsSought: current.skillsSought.filter((item) => item !== skill) }))}>&times;</button></li>
                    ))}
                  </ul>
                )}
                {fieldErrors.skillsSought && <span className="field-error" id="opportunity-skills-error">{fieldErrors.skillsSought}</span>}
              </div>

              <div className="opportunity-metadata">
            <fieldset className="opportunity-categories">
              <legend>Categories</legend>
              <div className="opportunity-category-options">
                {opportunityCategoryOptions.map(([value, label]) => (
                  <label className="opportunity-category-option" key={value}>
                    <input type="checkbox" name="categories" value={value} checked={opportunityForm.categories.includes(value)} onChange={handleOpportunityFormChange} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {fieldErrors.categories && <span className="field-error">{fieldErrors.categories}</span>}
            </fieldset>
            <div className="opportunity-metadata-fields">
              <div className="form-field">
                <label htmlFor="opportunity-experience">Experience sought</label>
                <select id="opportunity-experience" name="experienceSought" value={opportunityForm.experienceSought} onChange={handleOpportunityFormChange} aria-invalid={Boolean(fieldErrors.experienceSought)}>
                  <option value="">Any experience level</option>
                  {experienceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {fieldErrors.experienceSought && <span className="field-error">{fieldErrors.experienceSought}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="opportunity-work-setup">Work setup</label>
                <select id="opportunity-work-setup" name="workSetup" value={opportunityForm.workSetup} onChange={handleOpportunityFormChange} aria-invalid={Boolean(fieldErrors.workSetup)}>
                  {opportunityWorkSetupOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {fieldErrors.workSetup && <span className="field-error">{fieldErrors.workSetup}</span>}
              </div>
              {['IN_PERSON', 'HYBRID'].includes(opportunityForm.workSetup) && (
                <div className="form-field">
                  <label htmlFor="opportunity-work-city">City</label>
                  <input id="opportunity-work-city" name="workCity" type="text" maxLength={100} value={opportunityForm.workCity} onChange={handleOpportunityFormChange} aria-invalid={Boolean(fieldErrors.workCity)} required />
                  {fieldErrors.workCity && <span className="field-error">{fieldErrors.workCity}</span>}
                </div>
              )}
            </div>
              </div>
            </section>
            {message && <p className="form-message" role="alert">{message}</p>}
          </div>
          <div className="profile-edit-modal-actions opportunity-form-actions">
            <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? (editingOpportunityId ? 'Saving...' : 'Publishing...') : (editingOpportunityId ? 'Save changes' : 'Publish opportunity')}</button>
            <button className="secondary-button" type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function App() {
  const [publicUsername] = useState(() => {
    const match = window.location.pathname.match(/^\/profile\/([^/]+)\/?$/)
    if (!match) return ''
    try {
      return decodeURIComponent(match[1])
    } catch {
      return ''
    }
  })
  const [sharedOpportunityId] = useState(() => {
    const match = window.location.pathname.match(/^\/opportunities\/([^/]+)\/?$/)
    if (!match) return ''
    try {
      return decodeURIComponent(match[1])
    } catch {
      return ''
    }
  })
  const [page, setPage] = useState(() => publicUsername ? 'public-profile' : 'discover')
  const [mode, setMode] = useState('register')
  const [registration, setRegistration] = useState({ name: '', username: '', email: '', password: '' })
  const [credentials, setCredentials] = useState({ identifier: '', password: '' })
  const [googleUsername, setGoogleUsername] = useState('')
  const [profileDetails, setProfileDetails] = useState(emptyProfileFields)
  const [profileData, setProfileData] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true)
  const [opportunitiesError, setOpportunitiesError] = useState('')
  const [sharedOpportunity, setSharedOpportunity] = useState(null)
  const [sharedOpportunityLoading, setSharedOpportunityLoading] = useState(Boolean(sharedOpportunityId))
  const [sharedOpportunityError, setSharedOpportunityError] = useState('')
  const [myOpportunities, setMyOpportunities] = useState([])
  const [myOpportunitiesLoading, setMyOpportunitiesLoading] = useState(false)
  const [myOpportunitiesError, setMyOpportunitiesError] = useState('')
  const [savedOpportunities, setSavedOpportunities] = useState([])
  const [savedOpportunitiesUserId, setSavedOpportunitiesUserId] = useState('')
  const [savedOpportunitiesError, setSavedOpportunitiesError] = useState('')
  const [profileTab, setProfileTab] = useState('opportunities')
  const [shareCopiedOpportunityId, setShareCopiedOpportunityId] = useState('')
  const [profileForm, setProfileForm] = useState({ name: '', username: '', ...emptyProfileFields })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [opportunityForm, setOpportunityForm] = useState(emptyOpportunityForm)
  const [opportunitySkillDraft, setOpportunitySkillDraft] = useState('')
  const [editingOpportunityId, setEditingOpportunityId] = useState(null)
  const [opportunityReturnPage, setOpportunityReturnPage] = useState('discover')
  const [profileLoadFailed, setProfileLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [message, setMessage] = useState(() => {
    const authError = new URLSearchParams(window.location.search).get('authError')
    if (authError === 'cancelled') return 'Google sign-in was cancelled.'
    return authError ? 'Google sign-in could not be completed. Try again.' : ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [user, setUser] = useState(null)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isOpportunityComposerOpen, setIsOpportunityComposerOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeCommentsOpportunity, setActiveCommentsOpportunity] = useState(null)
  const [pendingDeleteOpportunity, setPendingDeleteOpportunity] = useState(null)
  const [isDeletingOpportunity, setIsDeletingOpportunity] = useState(false)
  const [deleteOpportunityError, setDeleteOpportunityError] = useState('')

  useEffect(() => {
    if (!isEditProfileOpen && !isOpportunityComposerOpen && !isSettingsOpen && !activeCommentsOpportunity && !pendingDeleteOpportunity) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isEditProfileOpen, isOpportunityComposerOpen, isSettingsOpen, activeCommentsOpportunity, pendingDeleteOpportunity])

  useEffect(() => {
    if (!isEditProfileOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isSubmitting) setIsEditProfileOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isEditProfileOpen, isSubmitting])

  useEffect(() => {
    if (!isOpportunityComposerOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isSubmitting) setIsOpportunityComposerOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isOpportunityComposerOpen, isSubmitting])

  useEffect(() => {
    if (!isSettingsOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isSubmitting) setIsSettingsOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isSettingsOpen, isSubmitting])

  useEffect(() => {
    if (!pendingDeleteOpportunity) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isDeletingOpportunity) setPendingDeleteOpportunity(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [pendingDeleteOpportunity, isDeletingOpportunity])

  useEffect(() => {
    let isCurrent = true
    const url = new URL(window.location.href)
    if (url.searchParams.has('authError')) {
      url.searchParams.delete('authError')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }

    fetch('/api/auth/me')
      .then(async (response) => {
        if (response.ok) {
          const result = await response.json()
          if (isCurrent) setUser(result.user)
        }
      })
      .catch(() => {
        if (isCurrent) setMessage('Could not reach the server. Check your connection and try again.')
      })
      .finally(() => {
        if (isCurrent) setIsCheckingSession(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    const isPublicProfile = page === 'public-profile'
    if (!isPublicProfile && (!user?.username || user.profileDetailsPromptPending)) return

    let isCurrent = true
    const viewingOwnProfile = user?.username === publicUsername
    const endpoint = isPublicProfile && !viewingOwnProfile
      ? `/api/profiles/u/${encodeURIComponent(publicUsername)}`
      : '/api/profiles/me'

    fetch(endpoint)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message ?? 'Could not load profile.')
        if (!isCurrent) return

        setProfileLoadFailed(false)
        setProfileData(result.profile)
        setProfileForm({
          name: result.profile.name,
          username: result.profile.username,
          city: result.profile.city ?? '',
          experience: result.profile.experience ?? '',
          skills: result.profile.skills.join(', '),
          description: result.profile.description ?? '',
        })
      })
      .catch((error) => {
        if (isCurrent) {
          setProfileLoadFailed(true)
          setMessage(error.message)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [page, publicUsername, user?.id, user?.username, user?.profileDetailsPromptPending])

  useEffect(() => {
    if (page !== 'discover') return undefined

    let isCurrent = true

    fetch('/api/opportunities')
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message ?? 'Could not load opportunities.')
        if (isCurrent) {
          setOpportunities(result.opportunities)
          setOpportunitiesError('')
        }
      })
      .catch((error) => {
        if (isCurrent) setOpportunitiesError(error.message)
      })
      .finally(() => {
        if (isCurrent) setOpportunitiesLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [page])

  useEffect(() => {
    if (!sharedOpportunityId) return undefined
    let isCurrent = true
    fetch(`/api/opportunities/${encodeURIComponent(sharedOpportunityId)}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message ?? 'This opportunity could not be found.')
        if (isCurrent) {
          setSharedOpportunity(result.opportunity)
          setSharedOpportunityError('')
        }
      })
      .catch((error) => { if (isCurrent) setSharedOpportunityError(error.message) })
      .finally(() => { if (isCurrent) setSharedOpportunityLoading(false) })
    return () => { isCurrent = false }
  }, [sharedOpportunityId])

  useEffect(() => {
    if (!user?.id) return undefined
    let isCurrent = true
    fetch('/api/opportunities/saved')
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message ?? 'Could not load saved opportunities.')
        if (isCurrent) {
          setSavedOpportunities(result.opportunities)
          setSavedOpportunitiesUserId(user.id)
          setSavedOpportunitiesError('')
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setSavedOpportunitiesUserId(user.id)
          setSavedOpportunitiesError(error.message)
        }
      })
    return () => { isCurrent = false }
  }, [user?.id])

  useEffect(() => {
    const viewingOwnProfile = page === 'profile' || (page === 'public-profile' && user?.username === publicUsername)
    if (!viewingOwnProfile || !user?.id) return undefined

    let isCurrent = true

    fetch('/api/opportunities/mine')
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message ?? 'Could not load your opportunities.')
        if (isCurrent) setMyOpportunities(result.opportunities)
      })
      .catch((error) => {
        if (isCurrent) setMyOpportunitiesError(error.message)
      })
      .finally(() => {
        if (isCurrent) setMyOpportunitiesLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [page, publicUsername, user?.id, user?.username])

  function handleRegistrationChange(event) {
    const { name, value } = event.target
    setRegistration((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  function handleCredentialsChange(event) {
    const { name, value } = event.target
    setCredentials((current) => ({ ...current, [name]: value }))
    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setFieldErrors({})
    setMessage('')

    const isRegistration = mode === 'register'
    const endpoint = isRegistration ? 'register' : 'login'
    const body = isRegistration ? registration : credentials

    try {
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()

      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {})
        setMessage(result.error?.message ?? 'Could not complete the request.')
        return
      }

      if (isRegistration) {
        setMode('login')
        setCredentials({ identifier: registration.email, password: '' })
        setRegistration({ name: '', username: '', email: '', password: '' })
      } else {
        setUser(result.user)
        setCredentials((current) => ({ ...current, password: '' }))
        setPage('discover')
      }
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true)
    setMessage('')

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) {
        setMessage(result.error?.message ?? 'Could not sign out. Try again.')
        return
      }

      setUser(null)
      setSavedOpportunities([])
      setSavedOpportunitiesUserId('')
      setSavedOpportunitiesError('')
      setMode('login')
      setPage('discover')
      setMessage('')
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleProfileSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setFieldErrors({})
    setMessage('')

    try {
      const response = await fetch('/api/auth/google/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: googleUsername }),
      })
      const result = await response.json()

      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {})
        setMessage(result.error?.message ?? 'Could not complete your profile.')
        return
      }

      setUser(result.user)
      setGoogleUsername('')
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setFieldErrors({})
    setMessage('')
  }

  function handleGoogleProfileChange(event) {
    const { value } = event.target
    setGoogleUsername(value)
    setFieldErrors((current) => ({ ...current, username: undefined }))
    setMessage('')
  }

  async function handleProfileDetailsSubmit(event, skip = false) {
    event?.preventDefault()
    setIsSubmitting(true)
    setFieldErrors({})
    setMessage('')

    try {
      const response = await fetch('/api/auth/profile-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skip ? {} : profileDetails),
      })
      const result = await response.json()

      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {})
        setMessage(result.error?.message ?? 'Could not save your profile.')
        return
      }

      setUser(result.user)
      setProfileDetails(emptyProfileFields)
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleProfileDetailsChange(event) {
    const { name, value } = event.target
    setProfileDetails((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  function handleProfileFormChange(event) {
    const { name, value } = event.target
    setProfileForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  function handlePasswordFormChange(event) {
    const { name, value } = event.target
    setPasswordForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  async function handleProfileSave(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setFieldErrors({})
    setMessage('')

    try {
      const response = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })
      const result = await response.json()
      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {})
        setMessage(result.error?.message ?? 'Could not save your profile.')
        return
      }

      setProfileData(result.profile)
      setUser((current) => current
        ? { ...current, name: result.profile.name, username: result.profile.username }
        : current)
      setIsEditProfileOpen(false)
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault()
    setFieldErrors({})
    setMessage('')
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/profiles/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {})
        setMessage(result.error?.message ?? 'Could not change your password.')
        return
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setIsSettingsOpen(false)
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpportunityFormChange(event) {
    const { name, value, checked } = event.target
    if (name === 'categories') {
      setOpportunityForm((current) => ({
        ...current,
        categories: checked
          ? [...current.categories, value]
          : current.categories.filter((category) => category !== value),
      }))
    } else {
      setOpportunityForm((current) => ({
        ...current,
        [name]: value,
        ...(name === 'workSetup' && (!value || value === 'REMOTE') ? { workCity: '' } : {}),
      }))
    }

    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  function addOpportunitySkill() {
    const skill = opportunitySkillDraft.trim().replace(/,$/, '').trim()
    if (!skill) {
      setFieldErrors((current) => ({ ...current, skillsSought: 'Enter a skill before adding it.' }))
      return
    }

    setOpportunityForm((current) => ({
      ...current,
      skillsSought: current.skillsSought.some((existing) => existing.toLowerCase() === skill.toLowerCase())
        ? current.skillsSought
        : [...current.skillsSought, skill],
    }))
    setOpportunitySkillDraft('')
    setFieldErrors((current) => ({ ...current, skillsSought: undefined }))
    setMessage('')
  }

  async function handleOpportunitySubmit(event) {
    event.preventDefault()
    setFieldErrors({})
    setMessage('')

    const description = opportunityForm.description.trim()
    if (!description) {
      setFieldErrors({ description: 'Write a description for the opportunity.' })
      return
    }

    const skillsSought = [...opportunityForm.skillsSought, opportunitySkillDraft.trim()]
      .map((skill) => skill.trim())
      .filter(Boolean)

    setIsSubmitting(true)
    try {
      const response = await fetch(editingOpportunityId
        ? `/api/opportunities/${encodeURIComponent(editingOpportunityId)}`
        : '/api/opportunities', {
        method: editingOpportunityId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          categories: opportunityForm.categories,
          skillsSought,
          experienceSought: opportunityForm.experienceSought || null,
          workSetup: opportunityForm.workSetup || null,
          workCity: ['IN_PERSON', 'HYBRID'].includes(opportunityForm.workSetup)
            ? opportunityForm.workCity.trim()
            : null,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {})
        setMessage(result.error?.message ?? 'Could not publish the opportunity.')
        return
      }

      if (editingOpportunityId) {
        setOpportunities((current) => current.map((item) => item.id === result.opportunity.id ? result.opportunity : item))
        setMyOpportunities((current) => current.map((item) => item.id === result.opportunity.id ? result.opportunity : item))
      } else {
        setOpportunities((current) => [result.opportunity, ...current])
        setMyOpportunities((current) => [result.opportunity, ...current])
      }

      setOpportunityForm(emptyOpportunityForm)
      setOpportunitySkillDraft('')
      setEditingOpportunityId(null)
      setIsOpportunityComposerOpen(false)
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenOpportunityComposer() {
    setFieldErrors({})
    setMessage('')
    setEditingOpportunityId(null)
    setOpportunityForm(emptyOpportunityForm)
    setOpportunitySkillDraft('')
    const returnPage = ['discover', 'public-profile'].includes(page)
      ? 'discover'
      : page === 'create-opportunity'
        ? opportunityReturnPage
        : 'profile'
    setOpportunityReturnPage(returnPage)
    setIsOpportunityComposerOpen(true)
  }

  function handleEditOpportunity(opportunity) {
    setFieldErrors({})
    setMessage('')
    setEditingOpportunityId(opportunity.id)
    setOpportunityForm({
      description: opportunity.description,
      categories: opportunity.categories,
      skillsSought: opportunity.skillsSought,
      experienceSought: opportunity.experienceSought ?? '',
      workSetup: opportunity.workSetup ?? '',
      workCity: opportunity.workCity ?? '',
    })
    setOpportunitySkillDraft('')
    setOpportunityReturnPage(page === 'discover' ? 'discover' : 'profile')
    setIsOpportunityComposerOpen(true)
  }

  async function handleDeleteOpportunity(opportunity) {
    setDeleteOpportunityError('')
    setPendingDeleteOpportunity(opportunity)
  }

  function updateOpportunityInLists(opportunityId, changes) {
    const update = (opportunity) => opportunity.id === opportunityId ? { ...opportunity, ...changes } : opportunity
    setOpportunities((current) => current.map(update))
    setMyOpportunities((current) => current.map(update))
    setActiveCommentsOpportunity((current) => current?.id === opportunityId ? { ...current, ...changes } : current)
  }

  function handleCommentCountChange(opportunityId, commentCount) {
    updateOpportunityInLists(opportunityId, { commentCount })
  }

  async function handleToggleOpportunityComments(opportunity) {
    const commentsEnabled = !opportunity.commentsEnabled
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(opportunity.id)}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentsEnabled }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not update the comment setting.')
      updateOpportunityInLists(opportunity.id, { commentsEnabled: result.commentsEnabled })
    } catch (error) {
      setMessage(error.message || 'Could not reach the server. Check your connection and try again.')
    }
  }

  async function handleSaveOpportunity(opportunity) {
    if (!user) {
      setMode('login')
      setMessage('Sign in to save opportunities.')
      setPage('auth')
      return
    }

    const isSaved = savedOpportunities.some((item) => item.id === opportunity.id)
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(opportunity.id)}/save`, {
        method: isSaved ? 'DELETE' : 'POST',
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error?.message ?? 'Could not update saved opportunities.')
      }
      setSavedOpportunities((current) => isSaved
        ? current.filter((item) => item.id !== opportunity.id)
        : [{ ...opportunity, savedAt: new Date().toISOString() }, ...current])
      setSavedOpportunitiesUserId(user.id)
      setSavedOpportunitiesError('')
    } catch (error) {
      setMessage(error.message || 'Could not reach the server. Check your connection and try again.')
    }
  }

  async function handleShareOpportunity(opportunity) {
    const url = new URL(`/opportunities/${encodeURIComponent(opportunity.id)}`, window.location.origin).toString()
    if (navigator.share) {
      try {
        await navigator.share({ title: `EthioDev opportunity by ${opportunity.owner.name}`, url })
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setShareCopiedOpportunityId(opportunity.id)
      window.setTimeout(() => setShareCopiedOpportunityId((current) => current === opportunity.id ? '' : current), 1600)
    } catch {
      setMessage('Could not copy the opportunity link. Check your browser permissions and try again.')
    }
  }

  async function confirmDeleteOpportunity() {
    if (!pendingDeleteOpportunity) return
    setIsDeletingOpportunity(true)
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(pendingDeleteOpportunity.id)}`, { method: 'DELETE' })
      const result = response.status === 204 ? {} : await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not delete the opportunity.')

      setOpportunities((current) => current.filter((item) => item.id !== pendingDeleteOpportunity.id))
      setMyOpportunities((current) => current.filter((item) => item.id !== pendingDeleteOpportunity.id))
      setPendingDeleteOpportunity(null)
    } catch (error) {
      setDeleteOpportunityError(error.message || 'Could not reach the server. Check your connection and try again.')
    } finally {
      setIsDeletingOpportunity(false)
    }
  }

  function handleAppNavigation(destination) {
    if (destination === 'profile') {
      setProfileData(null)
      setProfileLoadFailed(false)
      setMyOpportunitiesLoading(true)
      setMyOpportunitiesError('')
    }
    setPage(destination)
  }

  const savedOpportunitiesLoading = Boolean(user?.id && savedOpportunitiesUserId !== user.id)

  if (isCheckingSession) {
    return <main className="auth-page"><p className="session-loading">Checking sign-in...</p></main>
  }

  if (user && !user.username) {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="signed-in-heading">
          {user.username && user.profileDetailsPromptPending ? (
            <>
              <h1 id="signed-in-heading">Complete your profile</h1>
              <p className="profile-prompt">Add a few details to help developers find you.</p>
              <form onSubmit={handleProfileDetailsSubmit} noValidate>
                <OptionalProfileFields
                  values={profileDetails}
                  onChange={handleProfileDetailsChange}
                  errors={fieldErrors}
                  prefix="profile-details"
                />
                <button className="submit-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save profile'}
                </button>
                <button
                  className="skip-button"
                  type="button"
                  onClick={() => handleProfileDetailsSubmit(undefined, true)}
                  disabled={isSubmitting}
                >
                  Skip for now
                </button>
              </form>
            </>
          ) : user.username ? (
            <>
              <h1 id="signed-in-heading">You’re signed in</h1>
              <p className="signed-in-user">{user.name} <span>@{user.username}</span></p>
              <button className="submit-button" type="button" onClick={handleSignOut} disabled={isSubmitting}>
                {isSubmitting ? 'Signing out...' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <h1 id="signed-in-heading">Choose a username</h1>
              <form onSubmit={handleGoogleProfileSubmit} noValidate>
                <div className="form-field">
                  <label htmlFor="google-username">Username</label>
                  <input
                    id="google-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    minLength={3}
                    maxLength={30}
                    pattern="[A-Za-z0-9_]{3,30}"
                    value={googleUsername}
                    onChange={(event) => {
                      handleGoogleProfileChange(event)
                    }}
                    aria-invalid={Boolean(fieldErrors.username)}
                    aria-describedby={fieldErrors.username ? 'google-username-error' : undefined}
                    required
                  />
                  {fieldErrors.username && (
                    <span className="field-error" id="google-username-error">
                      {fieldErrors.username}
                    </span>
                  )}
                </div>
                <button className="submit-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Continue'}
                </button>
              </form>
            </>
          )}
          {message && <p className="form-message" role="status">{message}</p>}
        </section>
      </main>
    )
  }

  if (user?.profileDetailsPromptPending && !publicUsername) {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="signed-in-heading">
          <h1 id="signed-in-heading">Complete your profile</h1>
          <p className="profile-prompt">Add a few details to help developers find you.</p>
          <form onSubmit={handleProfileDetailsSubmit} noValidate>
            <OptionalProfileFields
              values={profileDetails}
              onChange={handleProfileDetailsChange}
              errors={fieldErrors}
              prefix="profile-details"
            />
            <button className="submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save profile'}
            </button>
            <button
              className="skip-button"
              type="button"
              onClick={() => handleProfileDetailsSubmit(undefined, true)}
              disabled={isSubmitting}
            >
              Skip for now
            </button>
          </form>
          {message && <p className="form-message" role="status">{message}</p>}
        </section>
      </main>
    )
  }

  if (user || publicUsername || page === 'discover') {
    const isOwnProfile = Boolean(user && (!publicUsername || user.username === profileData?.username))
    const needsProfile = page === 'public-profile' || Boolean(user?.username && !user.profileDetailsPromptPending)
    const isLoadingProfile = needsProfile && !profileData && !profileLoadFailed

    return (
      <main className="profile-page">
        <div className="app-shell">
          <AppSidebar
            user={user}
            activePage={page === 'discover' || page === 'public-profile' || (page === 'create-opportunity' && opportunityReturnPage === 'discover') ? 'discover' : 'profile'}
            onNavigate={handleAppNavigation}
            onSignIn={() => { setMode('login'); setPage('auth') }}
            onRegister={() => { setMode('register'); setPage('auth') }}
            onSignOut={handleSignOut}
          />
        {page === 'discover' ? (
          <section className="discover-content" aria-labelledby="discover-heading">
              <header className="discover-header">
                <h1 id="discover-heading">{sharedOpportunityId ? 'Opportunity' : 'Discover'}</h1>
                {user && <button className="app-post-button" type="button" onClick={handleOpenOpportunityComposer}>Post opportunity</button>}
              </header>
              {message && <p className="form-message" role="status">{message}</p>}
              {sharedOpportunityId && sharedOpportunityLoading && <p className="discover-state" role="status">Loading opportunity...</p>}
              {sharedOpportunityId && sharedOpportunityError && <p className="discover-state" role="alert">{sharedOpportunityError}</p>}
              {sharedOpportunity && (
                <div className="shared-opportunity-card">
                  <OpportunityCard
                    key={sharedOpportunity.id}
                    opportunity={sharedOpportunity}
                    isOwner={Boolean(user && user.id === sharedOpportunity.owner.id)}
                    isSaved={savedOpportunities.some((item) => item.id === sharedOpportunity.id)}
                    isLinkCopied={shareCopiedOpportunityId === sharedOpportunity.id}
                    onEdit={handleEditOpportunity}
                    onDelete={handleDeleteOpportunity}
                    onComments={setActiveCommentsOpportunity}
                    onToggleComments={handleToggleOpportunityComments}
                    onSave={handleSaveOpportunity}
                    onShare={handleShareOpportunity}
                  />
                </div>
              )}
              {opportunitiesLoading ? (
                <p className="discover-state" role="status">Loading opportunities...</p>
              ) : opportunitiesError ? (
                <div className="discover-state" role="alert">
                  <p>{opportunitiesError}</p>
                  <button className="secondary-button" type="button" onClick={() => window.location.reload()}>Try again</button>
                </div>
              ) : opportunities.filter((item) => item.id !== sharedOpportunityId).length > 0 ? (
                <div className="opportunity-feed">
                  {opportunities.filter((item) => item.id !== sharedOpportunityId).map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      isOwner={Boolean(user && user.id === opportunity.owner.id)}
                      onEdit={handleEditOpportunity}
                      onDelete={handleDeleteOpportunity}
                      onComments={setActiveCommentsOpportunity}
                      onToggleComments={handleToggleOpportunityComments}
                      isSaved={savedOpportunities.some((item) => item.id === opportunity.id)}
                      isLinkCopied={shareCopiedOpportunityId === opportunity.id}
                      onSave={handleSaveOpportunity}
                      onShare={handleShareOpportunity}
                    />
                  ))}
                </div>
              ) : (
                <p className="discover-state">No opportunities yet.</p>
              )}
          </section>
        ) : (
        <section className={`app-main-content${page === 'profile' || page === 'public-profile' ? ' profile-main-content' : ''}`}>
        <section className="profile-shell">
          {page !== 'profile' && page !== 'public-profile' && (
            <button className="back-button" type="button" onClick={() => setPage(page === 'create-opportunity' ? opportunityReturnPage : 'profile')}>
              {page === 'create-opportunity' && opportunityReturnPage === 'discover' ? 'Back to Discover' : 'Back to profile'}
            </button>
          )}

          {isLoadingProfile ? (
            <p className="session-loading">Loading profile...</p>
          ) : profileData ? (
            page === 'create-opportunity' && user ? (
              <section className="profile-panel" aria-labelledby="create-opportunity-heading">
                <h1 id="create-opportunity-heading">{editingOpportunityId ? 'Edit opportunity' : 'Create opportunity'}</h1>
                <form className="opportunity-form" onSubmit={handleOpportunitySubmit} noValidate>
                  <div className="form-field opportunity-description-field">
                    <label htmlFor="opportunity-description">What are you building?</label>
                    <textarea
                      id="opportunity-description"
                      name="description"
                      rows={5}
                      placeholder="Describe your project and who you'd like to collaborate with."
                      value={opportunityForm.description}
                      onChange={handleOpportunityFormChange}
                      aria-invalid={Boolean(fieldErrors.description)}
                      aria-describedby={fieldErrors.description ? 'opportunity-description-error' : undefined}
                      required
                    />
                    {fieldErrors.description && (
                      <span className="field-error" id="opportunity-description-error">
                        {fieldErrors.description}
                      </span>
                    )}
                  </div>

                  <div className="form-field opportunity-skills-field">
                    <label htmlFor="opportunity-skills">Skills</label>
                    <p className="field-hint" id="opportunity-skills-hint">Add skill tags to help developers find this opportunity.</p>
                    <div className="opportunity-skill-entry">
                      <input
                        id="opportunity-skills"
                        type="text"
                        maxLength={40}
                        placeholder="For example, React"
                        value={opportunitySkillDraft}
                        onChange={(event) => {
                          setOpportunitySkillDraft(event.target.value)
                          setFieldErrors((current) => ({ ...current, skillsSought: undefined }))
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ',') {
                            event.preventDefault()
                            addOpportunitySkill()
                          }
                        }}
                        aria-invalid={Boolean(fieldErrors.skillsSought)}
                        aria-describedby={fieldErrors.skillsSought ? 'opportunity-skills-error' : 'opportunity-skills-hint'}
                      />
                      <button className="secondary-button" type="button" onClick={addOpportunitySkill}>
                        Add skill
                      </button>
                    </div>
                    {opportunityForm.skillsSought.length > 0 && (
                      <ul className="opportunity-skill-tags" aria-label="Skills needed">
                        {opportunityForm.skillsSought.map((skill) => (
                          <li key={skill}>
                            <span>{skill}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${skill} skill`}
                              onClick={() => setOpportunityForm((current) => ({
                                ...current,
                                skillsSought: current.skillsSought.filter((item) => item !== skill),
                              }))}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {fieldErrors.skillsSought && <span className="field-error" id="opportunity-skills-error">{fieldErrors.skillsSought}</span>}
                  </div>

                  <div className="opportunity-metadata">
                    <fieldset className="opportunity-categories">
                      <legend>Categories</legend>
                      <div className="opportunity-category-options">
                        {opportunityCategoryOptions.map(([value, label]) => (
                          <label className="opportunity-category-option" key={value}>
                            <input
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
                      {fieldErrors.categories && <span className="field-error">{fieldErrors.categories}</span>}
                    </fieldset>

                    <div className="opportunity-metadata-fields">
                      <div className="form-field">
                        <label htmlFor="opportunity-experience">Experience sought</label>
                        <select
                          id="opportunity-experience"
                          name="experienceSought"
                          value={opportunityForm.experienceSought}
                          onChange={handleOpportunityFormChange}
                          aria-invalid={Boolean(fieldErrors.experienceSought)}
                        >
                          <option value="">Any experience level</option>
                          {experienceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        {fieldErrors.experienceSought && <span className="field-error">{fieldErrors.experienceSought}</span>}
                      </div>

                      <div className="form-field">
                        <label htmlFor="opportunity-work-setup">Work setup</label>
                        <select
                          id="opportunity-work-setup"
                          name="workSetup"
                          value={opportunityForm.workSetup}
                          onChange={handleOpportunityFormChange}
                          aria-invalid={Boolean(fieldErrors.workSetup)}
                        >
                          {opportunityWorkSetupOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        {fieldErrors.workSetup && <span className="field-error">{fieldErrors.workSetup}</span>}
                      </div>

                      {['IN_PERSON', 'HYBRID'].includes(opportunityForm.workSetup) && (
                        <div className="form-field">
                          <label htmlFor="opportunity-work-city">City</label>
                          <input
                            id="opportunity-work-city"
                            name="workCity"
                            type="text"
                            maxLength={100}
                            value={opportunityForm.workCity}
                            onChange={handleOpportunityFormChange}
                            aria-invalid={Boolean(fieldErrors.workCity)}
                            required
                          />
                          {fieldErrors.workCity && <span className="field-error">{fieldErrors.workCity}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="opportunity-form-actions">
                    <button className="submit-button" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (editingOpportunityId ? 'Saving...' : 'Publishing...') : (editingOpportunityId ? 'Save changes' : 'Publish opportunity')}
                    </button>
                    <button className="secondary-button" type="button" onClick={() => {
                      setEditingOpportunityId(null)
                      if (opportunityReturnPage === 'profile') setMyOpportunitiesLoading(true)
                      setPage(opportunityReturnPage)
                    }} disabled={isSubmitting}>
                      Cancel
                    </button>
                  </div>
                </form>
                {message && <p className="form-message" role="status">{message}</p>}
              </section>
            ) : page === 'settings' && isOwnProfile ? (
              <section className="profile-panel" aria-labelledby="settings-heading">
                <h1 id="settings-heading">Settings</h1>
                {profileData.hasPassword && (
                  <form className="password-form" onSubmit={handlePasswordChange} noValidate>
                    <h2>Change password</h2>
                    {['currentPassword', 'newPassword', 'confirmPassword'].map((fieldName) => {
                      const labels = {
                        currentPassword: 'Current password',
                        newPassword: 'New password',
                        confirmPassword: 'Confirm new password',
                      }
                      return (
                        <div className="form-field" key={fieldName}>
                          <label htmlFor={fieldName}>{labels[fieldName]}</label>
                          <input
                            id={fieldName}
                            name={fieldName}
                            type="password"
                            autoComplete={fieldName === 'currentPassword' ? 'current-password' : 'new-password'}
                            minLength={fieldName === 'currentPassword' ? undefined : 8}
                            maxLength={128}
                            value={passwordForm[fieldName]}
                            onChange={handlePasswordFormChange}
                            required
                            aria-invalid={Boolean(fieldErrors[fieldName])}
                          />
                          {fieldErrors[fieldName] && <span className="field-error">{fieldErrors[fieldName]}</span>}
                        </div>
                      )
                    })}
                    <button className="submit-button" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Updating...' : 'Update password'}
                    </button>
                  </form>
                )}
                {message && <p className="form-message" role="status">{message}</p>}
              </section>
            ) : (
              <>
              <article className="profile-panel public-profile" aria-labelledby="profile-name">
                <header className="profile-header">
                  <div className="profile-avatar" aria-hidden="true">{profileData.name.slice(0, 1).toUpperCase()}</div>
                  <div className="profile-identity">
                    <div className="profile-name-row">
                      <h1 id="profile-name">{profileData.name}</h1>
                      {isOwnProfile && (
                        <button className="profile-edit-button" type="button" aria-label="Edit profile" title="Edit profile" onClick={() => setIsEditProfileOpen(true)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <p>@{profileData.username}</p>
                  </div>
                  {isOwnProfile && (
                    <div className="profile-actions">
                      <button className="secondary-button" type="button" onClick={handleOpenOpportunityComposer}>Post opportunity</button>
                      <button className="secondary-button" type="button" onClick={() => { setFieldErrors({}); setMessage(''); setIsSettingsOpen(true) }}>Settings</button>
                      <ProfileOverflowMenu onSignOut={handleSignOut} isSubmitting={isSubmitting} />
                    </div>
                  )}
                </header>
                {profileData.description && <p className="profile-description">{profileData.description}</p>}
                {profileData.skills.length > 0 && (
                  <ul className="profile-skills" aria-label="Skills">
                    {profileData.skills.map((skill) => <li key={skill}>{skill}</li>)}
                  </ul>
                )}
                {(profileData.city || profileData.experience) && (
                  <div className="profile-facts">
                    {profileData.city && <span>{profileData.city}</span>}
                    {profileData.experience && <span>{profileData.experience[0] + profileData.experience.slice(1).toLowerCase()}</span>}
                  </div>
                )}
                {message && <p className="form-message" role="status">{message}</p>}
              </article>
              {isOwnProfile && isEditProfileOpen && (
                <div className="profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsEditProfileOpen(false) }}>
                  <section className="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-heading">
                    <header className="profile-edit-modal-header">
                      <h2 id="edit-profile-heading">Edit profile</h2>
                      <button className="profile-edit-modal-close" type="button" aria-label="Close edit profile" onClick={() => setIsEditProfileOpen(false)} disabled={isSubmitting}>&times;</button>
                    </header>
                    <form className="profile-edit-form" onSubmit={handleProfileSave} noValidate>
                      <div className="profile-modal-scroll">
                        <div className="profile-edit-fields">
                        <div className="form-field">
                          <label htmlFor="edit-name">Name</label>
                          <input id="edit-name" name="name" value={profileForm.name} onChange={handleProfileFormChange} maxLength={100} required aria-invalid={Boolean(fieldErrors.name)} />
                          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                        </div>
                        <div className="form-field">
                          <label htmlFor="edit-username">Username</label>
                          <input id="edit-username" name="username" value={profileForm.username} onChange={handleProfileFormChange} minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" required aria-invalid={Boolean(fieldErrors.username)} />
                          {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}
                        </div>
                        <OptionalProfileFields values={profileForm} onChange={handleProfileFormChange} errors={fieldErrors} prefix="edit-profile" showOptionalLabels={false} />
                        </div>
                        {message && <p className="form-message" role="alert">{message}</p>}
                      </div>
                      <div className="profile-edit-modal-actions">
                        <button className="secondary-button" type="button" onClick={() => setIsEditProfileOpen(false)} disabled={isSubmitting}>Cancel</button>
                        <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save changes'}</button>
                      </div>
                    </form>
                  </section>
                </div>
              )}
              {isOwnProfile && isSettingsOpen && (
                <div className="profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsSettingsOpen(false) }}>
                  <section className="profile-edit-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
                    <header className="profile-edit-modal-header">
                      <h2 id="settings-heading">Settings</h2>
                      <button className="profile-edit-modal-close" type="button" aria-label="Close settings" onClick={() => setIsSettingsOpen(false)} disabled={isSubmitting}>&times;</button>
                    </header>
                    {profileData.hasPassword ? (
                      <form className="password-form" onSubmit={handlePasswordChange} noValidate>
                        <div className="profile-modal-scroll settings-modal-scroll">
                        <h3>Change password</h3>
                        {['currentPassword', 'newPassword', 'confirmPassword'].map((fieldName) => {
                          const labels = {
                            currentPassword: 'Current password',
                            newPassword: 'New password',
                            confirmPassword: 'Confirm new password',
                          }
                          return (
                            <div className="form-field" key={fieldName}>
                              <label htmlFor={fieldName}>{labels[fieldName]}</label>
                              <input
                                id={fieldName}
                                name={fieldName}
                                type="password"
                                autoComplete={fieldName === 'currentPassword' ? 'current-password' : 'new-password'}
                                minLength={fieldName === 'currentPassword' ? undefined : 8}
                                maxLength={128}
                                value={passwordForm[fieldName]}
                                onChange={handlePasswordFormChange}
                                required
                                aria-invalid={Boolean(fieldErrors[fieldName])}
                              />
                              {fieldErrors[fieldName] && <span className="field-error">{fieldErrors[fieldName]}</span>}
                            </div>
                          )
                        })}
                        {message && <p className="form-message" role="alert">{message}</p>}
                        </div>
                        <div className="profile-edit-modal-actions">
                          <button className="secondary-button" type="button" onClick={() => setIsSettingsOpen(false)} disabled={isSubmitting}>Cancel</button>
                          <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update password'}</button>
                        </div>
                      </form>
                    ) : (
                      <p className="settings-oauth-note">Your account uses Google sign-in, so there is no password to change here.</p>
                    )}
                  </section>
                </div>
              )}
              {isOwnProfile && pendingDeleteOpportunity && (
                <div className="profile-modal-backdrop confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeletingOpportunity) setPendingDeleteOpportunity(null) }}>
                  <section className="profile-edit-modal confirmation-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-opportunity-heading" aria-describedby="delete-opportunity-description">
                    <header className="profile-edit-modal-header">
                      <h2 id="delete-opportunity-heading">Delete opportunity?</h2>
                      <button className="profile-edit-modal-close" type="button" aria-label="Close confirmation" onClick={() => setPendingDeleteOpportunity(null)} disabled={isDeletingOpportunity}>&times;</button>
                    </header>
                    <div className="profile-modal-scroll confirmation-content">
                      <p id="delete-opportunity-description">This will remove the opportunity from your profile and Discover. This action can’t be undone.</p>
                      {deleteOpportunityError && <p className="form-message" role="alert">{deleteOpportunityError}</p>}
                    </div>
                    <div className="profile-edit-modal-actions">
                      <button className="secondary-button" type="button" onClick={() => setPendingDeleteOpportunity(null)} disabled={isDeletingOpportunity}>Cancel</button>
                      <button className="danger-button" type="button" onClick={confirmDeleteOpportunity} disabled={isDeletingOpportunity}>{isDeletingOpportunity ? 'Deleting...' : 'Delete opportunity'}</button>
                    </div>
                  </section>
                </div>
              )}
              {isOwnProfile && (
                <>
                <nav className="profile-content-tabs" aria-label="Profile posts">
                  <button className={profileTab === 'opportunities' ? 'is-active' : ''} type="button" aria-pressed={profileTab === 'opportunities'} onClick={() => setProfileTab('opportunities')}>
                    My opportunities
                  </button>
                  <button className={profileTab === 'saved' ? 'is-active' : ''} type="button" aria-pressed={profileTab === 'saved'} onClick={() => setProfileTab('saved')}>
                    Saved
                  </button>
                </nav>
                {profileTab === 'opportunities' && (
                <section className="my-opportunities-section" aria-label="My opportunities">
                  {myOpportunitiesLoading ? (
                    <p className="discover-state" role="status">Loading your opportunities...</p>
                  ) : myOpportunitiesError ? (
                    <p className="discover-state" role="alert">{myOpportunitiesError}</p>
                  ) : myOpportunities.length > 0 ? (
                    <div className="opportunity-feed">
                      {myOpportunities.map((opportunity) => (
                        <OpportunityCard
                          key={opportunity.id}
                          opportunity={opportunity}
                          isOwner
                          onEdit={handleEditOpportunity}
                          onDelete={handleDeleteOpportunity}
                          onComments={setActiveCommentsOpportunity}
                          onToggleComments={handleToggleOpportunityComments}
                          isSaved={savedOpportunities.some((item) => item.id === opportunity.id)}
                          isLinkCopied={shareCopiedOpportunityId === opportunity.id}
                          onSave={handleSaveOpportunity}
                          onShare={handleShareOpportunity}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="discover-state">You have not posted any opportunities yet.</p>
                  )}
                </section>
                )}
                {profileTab === 'saved' && (
                  <section className="my-opportunities-section" aria-label="Saved opportunities">
                    {savedOpportunitiesLoading ? (
                      <p className="discover-state" role="status">Loading saved opportunities...</p>
                    ) : savedOpportunitiesError ? (
                      <p className="discover-state" role="alert">{savedOpportunitiesError}</p>
                    ) : savedOpportunities.length > 0 ? (
                      <div className="opportunity-feed">
                        {savedOpportunities.map((opportunity) => (
                          <OpportunityCard
                            key={opportunity.id}
                            opportunity={opportunity}
                            isOwner={Boolean(user && user.id === opportunity.owner.id)}
                            isSaved
                            isLinkCopied={shareCopiedOpportunityId === opportunity.id}
                            onEdit={handleEditOpportunity}
                            onDelete={handleDeleteOpportunity}
                            onComments={setActiveCommentsOpportunity}
                            onToggleComments={handleToggleOpportunityComments}
                            onSave={handleSaveOpportunity}
                            onShare={handleShareOpportunity}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="discover-state">You have not saved any opportunities yet.</p>
                    )}
                  </section>
                )}
                </>
              )}
              </>
            )
          ) : (
            <p className="form-message" role="status">{message || 'Could not load profile.'}</p>
          )}
        </section>
        </section>
        )}
        {user && isOpportunityComposerOpen && (
          <OpportunityComposer
            editingOpportunityId={editingOpportunityId}
            opportunityForm={opportunityForm}
            setOpportunityForm={setOpportunityForm}
            opportunitySkillDraft={opportunitySkillDraft}
            setOpportunitySkillDraft={setOpportunitySkillDraft}
            fieldErrors={fieldErrors}
            message={message}
            setFieldErrors={setFieldErrors}
            handleOpportunityFormChange={handleOpportunityFormChange}
            addOpportunitySkill={addOpportunitySkill}
            handleOpportunitySubmit={handleOpportunitySubmit}
            isSubmitting={isSubmitting}
            onClose={() => {
              setIsOpportunityComposerOpen(false)
              setEditingOpportunityId(null)
              setOpportunityForm(emptyOpportunityForm)
              setOpportunitySkillDraft('')
              setFieldErrors({})
              setMessage('')
            }}
          />
        )}
        {activeCommentsOpportunity && (
          <CommentsDialog
            opportunity={activeCommentsOpportunity}
            user={user}
            isOwner={Boolean(user && user.id === activeCommentsOpportunity.owner.id)}
            onClose={() => setActiveCommentsOpportunity(null)}
            onCommentCountChange={handleCommentCountChange}
          />
        )}
        </div>
      </main>
    )
  }

  const isRegistration = mode === 'register'

  return (
    <main className="auth-page">
      <button className="back-button auth-back-button" type="button" onClick={() => { setPage('discover'); setMessage('') }}>
        Back to Discover
      </button>
      <section className="auth-card" aria-labelledby="auth-heading">
        <h1 id="auth-heading">{isRegistration ? 'Create account' : 'Sign in'}</h1>
        <a className="google-button" href="/api/auth/google">
          Continue with Google
        </a>
        <div className="auth-divider" aria-hidden="true"><span>or</span></div>
        <form onSubmit={handleSubmit} noValidate>
          {isRegistration ? (
            registrationFields.map(({ label, ...field }) => (
              <div className="form-field" key={field.name}>
                <label htmlFor={field.name}>{label}</label>
                <input
                  {...field}
                  id={field.name}
                  name={field.name}
                  value={registration[field.name]}
                  onChange={handleRegistrationChange}
                  required
                  aria-invalid={Boolean(fieldErrors[field.name])}
                  aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
                />
                {fieldErrors[field.name] && (
                  <span className="field-error" id={`${field.name}-error`}>
                    {fieldErrors[field.name]}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="form-field">
              <label htmlFor="identifier">Email or username</label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                maxLength={254}
                value={credentials.identifier}
                onChange={handleCredentialsChange}
                required
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isRegistration ? 'new-password' : 'current-password'}
              minLength={isRegistration ? 8 : undefined}
              maxLength={128}
              value={isRegistration ? registration.password : credentials.password}
              onChange={isRegistration ? handleRegistrationChange : handleCredentialsChange}
              required
            />
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </div>

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isRegistration ? 'Creating account...' : 'Signing in...'
              : isRegistration ? 'Create account' : 'Sign in'}
          </button>
          {message && <p className="form-message" role="alert">{message}</p>}
        </form>

        <p className="auth-switch">
          {isRegistration ? 'Already have an account?' : 'New to EthioDev?'}{' '}
          <button type="button" onClick={() => switchMode(isRegistration ? 'login' : 'register')}>
            {isRegistration ? 'Sign in' : 'Create account'}
          </button>
        </p>
      </section>
    </main>
  )
}

export default App
