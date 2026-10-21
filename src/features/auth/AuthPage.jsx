import { useEffect, useMemo, useState } from "react";
import { navigateTo } from "../../lib/clientNavigation.js";
import {
  isSupabaseConfigured,
  passwordRecoveryStorageKey,
  supabase,
} from "../../lib/supabaseClient.js";

const usernamePattern = /^[A-Za-z0-9_]{3,30}$/;

function safeDestination(value) {
  if (!value || !value.startsWith("/")) return "/";

  try {
    const destination = new URL(value, window.location.origin);
    if (destination.origin !== window.location.origin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

function authHref(path, next) {
  return `${path}?next=${encodeURIComponent(next)}`;
}

function authCallbackUrl(path, next) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

function AuthBrand() {
  return (
    <a className="brand auth-brand" href="/" aria-label="EthioDev home">
      <span className="brand-mark" aria-hidden="true">
        &lt;/&gt;
      </span>
      <span>
        Ethio<span className="brand-accent">Dev</span>
      </span>
    </a>
  );
}

function AuthPage({ user }) {
  const pathname = window.location.pathname;
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const next = safeDestination(params.get("next"));
  const [form, setForm] = useState({
    email: "",
    password: "",
    otp: "",
    username: "",
    displayName: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [passwordRecoveryAuthorized, setPasswordRecoveryAuthorized] =
    useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [pageUser, setPageUser] = useState(user ?? null);
  const [callbackState, setCallbackState] = useState("loading");
  const currentUser = user ?? pageUser;
  const suggestedDisplayName =
    currentUser?.user_metadata?.full_name ??
    currentUser?.user_metadata?.name ??
    "";

  const isSignUp = pathname === "/auth/sign-up";
  const isReset = pathname === "/auth/reset-password";
  const isUpdatePassword = pathname === "/auth/update-password";
  const isCompleteProfile = pathname === "/auth/complete-profile";
  const isCallback = pathname === "/auth/callback";
  const callbackError = isCallback
    ? new URLSearchParams(window.location.hash.slice(1)).get(
        "error_description",
      )
    : null;

  useEffect(() => {
    if (!isCallback && !isUpdatePassword && !isCompleteProfile) return;
    if (!isSupabaseConfigured) return;

    let active = true;
    if (callbackError)
      return () => {
        active = false;
      };
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(
          "This link could not be verified. Request a new link and try again.",
        );
        setCallbackState("error");
        return;
      }
      const sessionUser = data.session?.user ?? user ?? null;
      setPageUser(sessionUser);
      if (isUpdatePassword) {
        const recoveryUserId = window.sessionStorage.getItem(
          passwordRecoveryStorageKey,
        );
        const recoveryAuthorized = recoveryUserId === sessionUser?.id;
        setPasswordRecoveryAuthorized(recoveryAuthorized);
        setCallbackState(recoveryAuthorized ? "ready" : "recovery-required");
      } else {
        setCallbackState(sessionUser ? "ready" : "no-session");
      }
    });

    return () => {
      active = false;
    };
  }, [isCallback, isUpdatePassword, isCompleteProfile, user, callbackError]);

  useEffect(() => {
    if (!isCallback || callbackState !== "ready" || !currentUser) return;

    let active = true;
    supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", currentUser.id)
      .maybeSingle()
      .then(({ data, error: profileError }) => {
        if (!active) return;
        if (profileError) {
          setError("We couldn’t load your profile. Please try again.");
          setCallbackState("error");
          return;
        }
        if (!data) {
          navigateTo(authHref("/auth/complete-profile", next), {
            replace: true,
          });
          return;
        }
        navigateTo(next, { replace: true });
      });

    return () => {
      active = false;
    };
  }, [isCallback, callbackState, currentUser, next]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submitEmailPassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFieldErrors({});

    if (isSignUp) {
      const username = form.username.trim();
      const displayName = form.displayName.trim();
      if (!usernamePattern.test(username)) {
        setFieldErrors({
          username: "Choose 3–30 letters, numbers, or underscores.",
        });
        setBusy(false);
        return;
      }
      if (displayName.length < 1 || displayName.length > 80) {
        setFieldErrors({
          displayName: "Display name must be 1–80 characters.",
        });
        setBusy(false);
        return;
      }

      const { data: matchingUsername, error: usernameQueryError } =
        await supabase
          .from("profiles")
          .select("username")
          .eq("username", username)
          .maybeSingle();
      if (usernameQueryError) {
        setError("We couldn’t check that username. Please try again.");
        setBusy(false);
        return;
      }
      if (matchingUsername) {
        setFieldErrors({ username: "That username is already taken." });
        setBusy(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { username, display_name: displayName },
        },
      });
      setBusy(false);
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("username")) {
          setFieldErrors({
            username: "That username is already taken. Try another one.",
          });
        } else {
          setError(signUpError.message);
        }
        return;
      }
      setForm((current) => ({ ...current, password: "" }));
      if (data.session?.user) {
        navigateTo(next);
      } else {
        setVerificationPending(true);
        setMessage("Enter the code we sent to your email.");
      }
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      {
        email: form.email.trim(),
        password: form.password,
      },
    );
    setBusy(false);
    if (signInError) {
      if (signInError.message.toLowerCase().includes("email not confirmed")) {
        setForm((current) => ({ ...current, password: "", otp: "" }));
        setVerificationPending(true);
        setMessage(
          "Your email still needs verification. Enter the code from your email.",
        );
      } else {
        setError(signInError.message);
      }
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (profileError) {
      setError(
        "You’re signed in, but we couldn’t load your profile. Please try again.",
      );
      return;
    }
    if (!profile) {
      navigateTo(authHref("/auth/complete-profile", next));
      return;
    }
    navigateTo(next);
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authCallbackUrl("/auth/callback", next),
      },
    });
    setBusy(false);
    if (oauthError) setError(oauthError.message);
  }

  async function resendVerification() {
    if (!form.email.trim()) {
      setFieldErrors({ email: "Enter your email address first." });
      return;
    }
    setBusy(true);
    setError("");
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: form.email.trim(),
    });
    setBusy(false);
    if (resendError) setError(resendError.message);
    else {
      setForm((current) => ({ ...current, otp: "" }));
      setMessage(
        "If the account needs verification, a new code is on its way.",
      );
    }
  }

  async function verifySignupCode(event) {
    event.preventDefault();
    const token = form.otp.trim();
    if (!/^\d{6}$/.test(token)) {
      setFieldErrors({ otp: "Enter the 6-digit code from your email." });
      return;
    }
    setBusy(true);
    setError("");
    setFieldErrors({});
    const { error: verificationError } = await supabase.auth.verifyOtp({
      email: form.email.trim(),
      token,
      type: "signup",
    });
    setBusy(false);
    if (verificationError) {
      setError(
        "That code is invalid or expired. Check it or request a new one.",
      );
      return;
    }
    navigateTo(authHref("/auth/callback", next));
  }

  async function sendPasswordReset(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      form.email.trim(),
      { redirectTo: authCallbackUrl("/auth/update-password", next) },
    );
    setBusy(false);
    if (resetError) setError(resetError.message);
    else
      setMessage(
        "If an account matches that email, a password reset link is on its way.",
      );
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (!passwordRecoveryAuthorized || !currentUser) {
      setError("Request a new password reset link to continue.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({
      password: form.password,
    });
    if (updateError) {
      setBusy(false);
      setError(updateError.message);
      return;
    }
    window.sessionStorage.removeItem(passwordRecoveryStorageKey);
    setPasswordRecoveryAuthorized(false);
    setBusy(false);
    setPasswordUpdated(true);
  }

  async function completeProfile(event) {
    event.preventDefault();
    if (!currentUser) return;
    const username = form.username.trim();
    const displayName = (form.displayName || suggestedDisplayName).trim();
    if (!usernamePattern.test(username)) {
      setFieldErrors({
        username: "Choose 3–30 letters, numbers, or underscores.",
      });
      return;
    }
    if (displayName.length < 1 || displayName.length > 80) {
      setFieldErrors({ displayName: "Display name must be 1–80 characters." });
      return;
    }
    setBusy(true);
    setError("");
    setFieldErrors({});
    const { error: insertError } = await supabase.from("profiles").insert({
      user_id: currentUser.id,
      username,
      display_name: displayName,
    });
    setBusy(false);
    if (insertError) {
      if (insertError.code === "23505") {
        setFieldErrors({
          username: "That username is already taken. Try another one.",
        });
      } else {
        setError(insertError.message);
      }
      return;
    }
    navigateTo(next);
  }

  async function requestNewReset() {
    navigateTo(authHref("/auth/reset-password", next));
  }

  if (!isSupabaseConfigured) {
    return (
      <AuthLayout>
        <AuthCard
          title="Connect to EthioDev"
          description="Add the public Supabase URL and publishable key to `.env.local` to use account features."
        >
          <p className="auth-feedback" role="status">
            Authentication is not configured in this environment.
          </p>
          <a className="button button-primary auth-submit" href="/">
            Back to home
          </a>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (isCallback) {
    return (
      <AuthLayout>
        <AuthCard
          title={
            callbackError ||
            callbackState === "error" ||
            callbackState === "no-session"
              ? "Sign-in link issue"
              : "Signing you in"
          }
          description={
            callbackError || callbackState === "error"
              ? callbackError || error
              : callbackState === "no-session"
                ? "This link may have expired. Sign in or request a new verification link."
                : "Please wait while we finish checking your account."
          }
        >
          {(callbackState === "error" || callbackState === "no-session") && (
            <a className="text-link" href={authHref("/auth/sign-in", next)}>
              Return to sign in
            </a>
          )}
        </AuthCard>
      </AuthLayout>
    );
  }

  if (isCompleteProfile) {
    if (callbackState === "loading") {
      return (
        <AuthLayout>
          <AuthCard title="Loading your account" description="Please wait." />
        </AuthLayout>
      );
    }
    if (!currentUser) {
      return (
        <AuthLayout>
          <AuthCard
            title="Sign in to continue"
            description="Your account session is missing or expired."
          >
            <a
              className="button button-primary auth-submit"
              href={authHref("/auth/sign-in", next)}
            >
              Sign in
            </a>
          </AuthCard>
        </AuthLayout>
      );
    }
    return (
      <AuthLayout>
        <AuthCard
          title="Finish your profile"
          description="Choose the name people will see on EthioDev."
        >
          <form className="auth-form" onSubmit={completeProfile}>
            <FormField
              label="Username"
              name="username"
              value={form.username}
              onChange={updateField}
              autoComplete="username"
              required
              maxLength={30}
              hint="3–30 letters, numbers, or underscores. Usernames are case-sensitive."
              error={fieldErrors.username}
            />
            <FormField
              label="Display name"
              name="displayName"
              value={form.displayName || suggestedDisplayName}
              onChange={updateField}
              autoComplete="name"
              required
              maxLength={80}
              error={fieldErrors.displayName}
            />
            <Feedback error={error} message={message} />
            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? "Saving…" : "Continue"}
            </button>
          </form>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (isUpdatePassword) {
    if (passwordUpdated) {
      return (
        <AuthLayout>
          <AuthCard
            title="Password updated"
            description="Your password has been updated. Continue to EthioDev."
          >
            <a className="button button-primary auth-submit" href={next}>
              Continue
            </a>
          </AuthCard>
        </AuthLayout>
      );
    }
    if (callbackState === "loading")
      return (
        <AuthLayout>
          <AuthCard title="Checking reset link" description="Please wait." />
        </AuthLayout>
      );
    if (!currentUser || !passwordRecoveryAuthorized) {
      return (
        <AuthLayout>
          <AuthCard
            title="Reset link expired"
            description="A valid password reset link is required. Request a new one to continue."
          >
            <button
              className="button button-primary auth-submit"
              type="button"
              onClick={requestNewReset}
            >
              Request a new link
            </button>
          </AuthCard>
        </AuthLayout>
      );
    }
    return (
      <AuthLayout>
        <AuthCard
          title="Choose a new password"
          description="Set a new password for your account."
        >
          <form className="auth-form" onSubmit={updatePassword}>
            <FormField
              label="New password"
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              autoComplete="new-password"
              required
            />
            <Feedback error={error} message={message} />
            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (isReset) {
    return (
      <AuthLayout>
        <AuthCard
          title="Reset your password"
          description="We’ll email you a link if an account matches that address."
        >
          <form className="auth-form" onSubmit={sendPasswordReset}>
            <FormField
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              autoComplete="email"
              required
              error={fieldErrors.email}
            />
            <Feedback error={error} message={message} />
            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
          <AuthSwitch
            text="Remembered your password?"
            href={authHref("/auth/sign-in", next)}
            label="Sign in"
          />
        </AuthCard>
      </AuthLayout>
    );
  }

  if (verificationPending) {
    return (
      <AuthLayout>
        <AuthCard
          title="Verify your email"
          description={`Enter the code sent to ${form.email}.`}
        >
          <form className="auth-form" onSubmit={verifySignupCode}>
            <FormField
              label="Verification code"
              name="otp"
              value={form.otp}
              onChange={updateField}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              maxLength={6}
              hint="The code expires after a short time."
              error={fieldErrors.otp}
            />
            <Feedback error={error} message={message} />
            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? "Verifying…" : "Verify email"}
            </button>
            <button
              className="button button-secondary auth-submit"
              type="button"
              onClick={resendVerification}
              disabled={busy}
            >
              Resend code
            </button>
            <button
              className="text-link auth-back-link"
              type="button"
              onClick={() => {
                setVerificationPending(false);
                setMessage("");
                setError("");
                setForm((current) => ({ ...current, otp: "" }));
              }}
            >
              Use a different email
            </button>
          </form>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard
        title={isSignUp ? "Create your account" : "Welcome back"}
        description={
          isSignUp
            ? "Join developers building projects across Ethiopia."
            : "Sign in to continue to EthioDev."
        }
      >
        <button
          className="button button-secondary auth-submit google-button"
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
        >
          <GoogleMark /> Continue with Google
        </button>
        <div className="auth-divider">
          <span>or with email</span>
        </div>
        <form className="auth-form" onSubmit={submitEmailPassword}>
          {isSignUp && (
            <>
              <FormField
                label="Display name"
                name="displayName"
                value={form.displayName}
                onChange={updateField}
                autoComplete="name"
                required
                maxLength={80}
                error={fieldErrors.displayName}
              />
              <FormField
                label="Username"
                name="username"
                value={form.username}
                onChange={updateField}
                autoComplete="username"
                required
                maxLength={30}
                hint="3–30 letters, numbers, or underscores. Usernames are case-sensitive."
                error={fieldErrors.username}
              />
            </>
          )}
          <FormField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            autoComplete="email"
            required
            error={fieldErrors.email}
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
          />
          {!isSignUp && (
            <div className="auth-forgot">
              <a href={authHref("/auth/reset-password", next)}>
                Forgot password?
              </a>
            </div>
          )}
          <Feedback error={error} message={message} />
          <button
            className="button button-primary auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
          {message.includes("verification") && (
            <button
              className="button button-secondary auth-submit"
              type="button"
              onClick={resendVerification}
              disabled={busy}
            >
              Resend verification email
            </button>
          )}
        </form>
        <AuthSwitch
          text={isSignUp ? "Already have an account?" : "New to EthioDev?"}
          href={authHref(isSignUp ? "/auth/sign-in" : "/auth/sign-up", next)}
          label={isSignUp ? "Sign in" : "Create an account"}
        />
      </AuthCard>
    </AuthLayout>
  );
}

function AuthLayout({ children }) {
  return (
    <main className="auth-page">
      <AuthBrand />
      <div className="auth-content">{children}</div>
      <p className="auth-page-note">
        A place to find teammates and build together.
      </p>
    </main>
  );
}

function AuthCard({ title, description, children }) {
  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <h1 id="auth-title">{title}</h1>
      <p className="auth-description">{description}</p>
      {children}
    </section>
  );
}

function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  autoComplete,
  inputMode,
  pattern,
  required,
  maxLength,
  hint,
  error,
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="auth-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        inputMode={inputMode}
        pattern={pattern}
        required={required}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      {hint && <small id={hintId}>{hint}</small>}
      {error && (
        <small className="auth-field-error" id={errorId} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

function Feedback({ error, message }) {
  return (
    <>
      {error && (
        <p className="auth-feedback is-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-feedback" role="status">
          {message}
        </p>
      )}
    </>
  );
}

function AuthSwitch({ text, href, label }) {
  return (
    <p className="auth-switch">
      {text} <a href={href}>{label}</a>
    </p>
  );
}

function GoogleMark() {
  return (
    <span className="google-mark" aria-hidden="true">
      G
    </span>
  );
}

export default AuthPage;
