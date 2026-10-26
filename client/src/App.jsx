import { useEffect, useState } from 'react'
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

function OptionalProfileFields({ values, onChange, errors, prefix }) {
  return (
    <>
      <div className="form-field">
        <label htmlFor={`${prefix}-city`}>City <span>(optional)</span></label>
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
        <label htmlFor={`${prefix}-experience`}>Experience <span>(optional)</span></label>
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
        <label htmlFor={`${prefix}-skills`}>Skills <span>(optional, comma-separated)</span></label>
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
        <label htmlFor={`${prefix}-description`}>About <span>(optional)</span></label>
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
  const [page, setPage] = useState(() => publicUsername ? 'public-profile' : 'profile')
  const [mode, setMode] = useState('register')
  const [registration, setRegistration] = useState({ name: '', username: '', email: '', password: '' })
  const [credentials, setCredentials] = useState({ identifier: '', password: '' })
  const [googleUsername, setGoogleUsername] = useState('')
  const [profileDetails, setProfileDetails] = useState(emptyProfileFields)
  const [profileData, setProfileData] = useState(null)
  const [profileForm, setProfileForm] = useState({ name: '', username: '', ...emptyProfileFields })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
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
    const endpoint = isPublicProfile
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
        setMessage('Account created successfully. Sign in to continue.')
      } else {
        setUser(result.user)
        setCredentials((current) => ({ ...current, password: '' }))
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
      setMode('login')
      setMessage('You are signed out.')
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
      setPage('profile')
      setMessage('Profile saved.')
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
      setMessage('Password updated.')
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

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

  if (user || publicUsername) {
    const isOwnProfile = Boolean(user && (!publicUsername || user.username === profileData?.username))
    const needsProfile = page === 'public-profile' || Boolean(user?.username && !user.profileDetailsPromptPending)
    const isLoadingProfile = needsProfile && !profileData && !profileLoadFailed

    return (
      <main className="profile-page">
        <section className="profile-shell">
          {page !== 'profile' && (
            <button className="back-button" type="button" onClick={() => setPage('profile')}>
              Back to profile
            </button>
          )}

          {isLoadingProfile ? (
            <p className="session-loading">Loading profile...</p>
          ) : profileData ? (
            page === 'edit-profile' && isOwnProfile ? (
              <section className="profile-panel" aria-labelledby="edit-profile-heading">
                <h1 id="edit-profile-heading">Edit profile</h1>
                <form onSubmit={handleProfileSave} noValidate>
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
                  <OptionalProfileFields values={profileForm} onChange={handleProfileFormChange} errors={fieldErrors} prefix="edit-profile" />
                  <button className="submit-button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save changes'}
                  </button>
                </form>
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
              <article className="profile-panel public-profile" aria-labelledby="profile-name">
                <header className="profile-header">
                  <div className="profile-avatar" aria-hidden="true">{profileData.name.slice(0, 1).toUpperCase()}</div>
                  <div className="profile-identity">
                    <h1 id="profile-name">{profileData.name}</h1>
                    <p>@{profileData.username}</p>
                  </div>
                </header>
                <div className="profile-facts">
                  {profileData.city && <span>{profileData.city}</span>}
                  {profileData.experience && <span>{profileData.experience[0] + profileData.experience.slice(1).toLowerCase()}</span>}
                </div>
                {profileData.description && <p className="profile-description">{profileData.description}</p>}
                {profileData.skills.length > 0 && (
                  <ul className="profile-skills" aria-label="Skills">
                    {profileData.skills.map((skill) => <li key={skill}>{skill}</li>)}
                  </ul>
                )}
                {isOwnProfile && (
                  <div className="profile-actions">
                    <button className="secondary-button" type="button" onClick={() => setPage('edit-profile')}>
                      Edit profile
                    </button>
                    <button className="secondary-button" type="button" onClick={() => setPage('settings')}>
                      Settings
                    </button>
                    <button className="text-button" type="button" onClick={handleSignOut} disabled={isSubmitting}>
                      {isSubmitting ? 'Signing out...' : 'Sign out'}
                    </button>
                  </div>
                )}
                {message && <p className="form-message" role="status">{message}</p>}
              </article>
            )
          ) : (
            <p className="form-message" role="status">{message || 'Could not load profile.'}</p>
          )}
        </section>
      </main>
    )
  }

  const isRegistration = mode === 'register'

  return (
    <main className="auth-page">
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
