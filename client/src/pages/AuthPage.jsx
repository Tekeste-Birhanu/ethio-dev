import { useState } from "react";

export default function AuthPage(props) {
  const {
    mode,
    handleAppNavigation,
    setMessage,
    handleSubmit,
    registrationFields,
    registration,
    handleRegistrationChange,
    fieldErrors,
    credentials,
    handleCredentialsChange,
    isSubmitting,
    message,
    switchMode,
  } = props;
  const [showPassword, setShowPassword] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [signupErrors, setSignupErrors] = useState({});
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const isRegistration = mode === "register";
  const passwordValue = isRegistration
    ? registration.password
    : credentials.password;
  const passwordChange = isRegistration
    ? handleRegistrationChange
    : handleCredentialsChange;
  const passwordError = fieldErrors.password || signupErrors.password;

  function returnToDiscover() {
    handleAppNavigation("discover");
    setMessage("");
  }

  function changeMode(nextMode) {
    setShowPassword(false);
    setSignupErrors({});
    setConfirmPassword("");
    setConfirmPasswordError("");
    setSignupStep(1);
    switchMode(nextMode);
  }

  function handleAccountDetailsChange(event) {
    const { name } = event.target;
    handleRegistrationChange(event);
    setSignupErrors((current) => ({ ...current, [name]: undefined }));
  }

  function validateAccountDetails() {
    const errors = {};
    const name = registration.name.trim();
    const username = registration.username.trim();
    const email = registration.email.trim();

    if (!name || name.length > 100) {
      errors.name = "Enter a name up to 100 characters.";
    }
    if (!/^[a-z0-9_]{4,20}$/i.test(username)) {
      errors.username = "Use 4-20 letters, numbers, or underscores.";
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email address.";
    }

    setSignupErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validatePasswordStep() {
    const errors = {};
    const passwordLength = Array.from(registration.password).length;

    if (passwordLength < 8 || passwordLength > 128) {
      errors.password = "Password must be at least 8 characters.";
    }
    setSignupErrors(errors);

    if (!confirmPassword) {
      setConfirmPasswordError("Confirm your password.");
      return false;
    }
    if (registration.password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      return false;
    }

    setConfirmPasswordError("");
    return Object.keys(errors).length === 0;
  }

  async function handleRegistrationStepSubmit(event) {
    event.preventDefault();

    if (signupStep === 1) {
      if (validateAccountDetails()) setSignupStep(2);
      return;
    }

    if (!validatePasswordStep()) return;

    await handleSubmit(event);
    setConfirmPassword("");
  }

  return (
    <main className="grid min-h-[100dvh] grid-cols-1 bg-[#101416] text-[#f1f5f3] min-[761px]:h-[100dvh] min-[761px]:min-h-0 min-[761px]:grid-cols-2 min-[761px]:overflow-hidden">
      <section
        className="relative flex min-w-0 flex-col overflow-hidden bg-[#101b19] px-6 pt-6 pb-2 [background:radial-gradient(ellipse_at_70%_0%,_rgb(23_70_55_/_42%),_transparent_55%),_#101b19] max-[760px]:hidden min-[761px]:h-full min-[761px]:min-h-0 min-[761px]:px-[clamp(32px,4.45vw,64px)] min-[761px]:py-12"
        aria-label="About EthioDev"
      >
        <div className="mt-11 w-full pb-[22px] min-[761px]:mt-[clamp(100px,15.2vh,146px)] min-[761px]:w-[min(100%,592px)] min-[761px]:py-0">
          <h1 className="m-0 text-[clamp(36px,9vw,48px)] font-semibold leading-[1.09] tracking-[-1.8px] min-[761px]:text-[clamp(42px,4.2vw,60px)] min-[761px]:tracking-[-2.8px]">
            Your next chapter
            <br />
            <span className="text-[#49ddb5]">starts here.</span>
          </h1>
          <p className="mt-3 mb-0 max-w-[520px] text-[14px] leading-[1.6] tracking-[-0.16px] text-[#9ca9a5] min-[761px]:mt-5 min-[761px]:max-w-[470px] min-[761px]:text-[18px]">
            Connect, collaborate, and grow with the Ethiopian developer
            community.
          </p>
        </div>
      </section>

      <section
        className="relative flex min-w-0 flex-col items-center justify-start bg-[#101416] px-6 pt-[88px] pb-6 max-[760px]:min-h-[100dvh] min-[761px]:h-full min-[761px]:min-h-0 min-[761px]:justify-center min-[761px]:overflow-hidden min-[761px]:border-l min-[761px]:border-[#293330] min-[761px]:px-10 min-[761px]:pt-14 min-[761px]:pb-6 [@media(min-width:761px)_and_(max-height:700px)]:overflow-y-auto max-[420px]:px-5"
        aria-labelledby="auth-heading"
      >
        <button
          className="absolute top-[22px] right-[22px] grid size-10 cursor-pointer place-items-center rounded-[13px] border border-[#30383a] bg-[#171d1f] text-[23px] leading-none text-[#f1f5f3] transition-colors duration-[120ms] hover:border-[#59696c] hover:bg-[#222d31] focus-visible:outline-3 focus-visible:outline-[#9af1d0] focus-visible:outline-offset-3 min-[761px]:top-8 min-[761px]:right-6 min-[761px]:size-12 min-[761px]:rounded-2xl"
          type="button"
          aria-label="Close and return to Discover"
          onClick={returnToDiscover}
        >
          ×
        </button>

        <div className="my-auto w-full max-w-[400px]">
          <header className="mb-7 min-[761px]:mb-5">
            <h2
              className="m-0 text-[25px] text-center font-semibold leading-[1.2] tracking-[-0.9px] text-[#f1f5f3] min-[761px]:text-[32px]"
              id="auth-heading"
            >
              {isRegistration ? "Join EthioDev" : "Sign in to EthioDev"}
            </h2>
          </header>

          <div className="grid gap-5 min-[761px]:gap-4">
            <a
              className="flex min-h-[52px] items-center justify-center gap-3 rounded-lg border border-[#30383a] bg-[#171d1f] text-sm font-medium text-[#f1f5f3] no-underline transition-[border-color,background] duration-[120ms] hover:border-[#59696c] hover:bg-[#1d2527] focus-visible:outline-3 focus-visible:outline-[#9af1d0] focus-visible:outline-offset-3"
              href="/api/auth/google"
            >
              <img
                className="block size-[18px]"
                src="/assets/google-mark.png"
                alt=""
              />
              <span>Continue with Google</span>
            </a>

            <div
              className="flex items-center gap-3 whitespace-nowrap text-xs text-[#6f817a] before:h-px before:flex-1 before:bg-[#293330] before:content-[''] after:h-px after:flex-1 after:bg-[#293330] after:content-[''] max-[420px]:gap-2 max-[420px]:text-[11px]"
              aria-hidden="true"
            >
              <span>or continue with email or username</span>
            </div>

            <form
              className="grid gap-[18px] min-[761px]:gap-3"
              onSubmit={
                isRegistration ? handleRegistrationStepSubmit : handleSubmit
              }
              noValidate
            >
              {isRegistration && (
                <div className="grid gap-2" aria-live="polite">
                  <p className="m-0 text-center text-xs font-medium text-[#9ca9a5]">
                    Step {signupStep} of 2
                  </p>
                  <div className="grid grid-cols-2 gap-2" aria-hidden="true">
                    <span
                      className={`h-1 rounded-full ${signupStep >= 1 ? "bg-[#49ddb5]" : "bg-[#30383a]"}`}
                    />
                    <span
                      className={`h-1 rounded-full ${signupStep >= 2 ? "bg-[#49ddb5]" : "bg-[#30383a]"}`}
                    />
                  </div>
                </div>
              )}

              {isRegistration && signupStep === 1 ? (
                registrationFields.map(({ label, ...field }) => {
                  const error =
                    fieldErrors[field.name] || signupErrors[field.name];

                  return (
                    <div className="grid min-w-0 gap-2.5" key={field.name}>
                      <label
                        className="text-sm font-medium text-[#f1f5f3]"
                        htmlFor={field.name}
                      >
                        {label}
                      </label>
                      <input
                        className="min-h-[52px] w-full min-w-0 rounded-lg border border-[#30383a] bg-[#171d1f] px-3 text-sm text-[#f1f5f3] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[#6f817a] focus-visible:border-[#49ddb5] focus-visible:shadow-[0_0_0_3px_rgb(73_221_181_/_15%)] aria-[invalid=true]:border-[#f27a7a]"
                        {...field}
                        id={field.name}
                        name={field.name}
                        placeholder={
                          field.name === "email"
                            ? "Enter your email"
                            : `Enter your ${label.toLowerCase()}`
                        }
                        value={registration[field.name]}
                        onChange={handleAccountDetailsChange}
                        required
                        aria-invalid={Boolean(error)}
                        aria-describedby={
                          error ? `${field.name}-error` : undefined
                        }
                      />
                      {error && (
                        <span
                          className="text-[13px] leading-[1.45] text-[#ffaaaa]"
                          id={`${field.name}-error`}
                          role="alert"
                        >
                          {error}
                        </span>
                      )}
                    </div>
                  );
                })
              ) : !isRegistration ? (
                <div className="grid min-w-0 gap-2.5">
                  <label
                    className="text-sm font-medium text-[#f1f5f3]"
                    htmlFor="identifier"
                  >
                    Email or username
                  </label>
                  <input
                    className="min-h-[52px] w-full min-w-0 rounded-lg border border-[#30383a] bg-[#171d1f] px-3 text-sm text-[#f1f5f3] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[#6f817a] focus-visible:border-[#49ddb5] focus-visible:shadow-[0_0_0_3px_rgb(73_221_181_/_15%)] aria-[invalid=true]:border-[#f27a7a]"
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    maxLength={254}
                    placeholder="Enter your email or username"
                    value={credentials.identifier}
                    onChange={handleCredentialsChange}
                    required
                  />
                </div>
              ) : null}

              {(!isRegistration || signupStep === 2) && (
                <div className="grid min-w-0 gap-2.5">
                  <label
                    className="text-sm font-medium text-[#f1f5f3]"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      className="min-h-[52px] w-full min-w-0 rounded-lg border border-[#30383a] bg-[#171d1f] py-0 pr-12 pl-3 text-sm text-[#f1f5f3] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[#6f817a] focus-visible:border-[#49ddb5] focus-visible:shadow-[0_0_0_3px_rgb(73_221_181_/_15%)] aria-[invalid=true]:border-[#f27a7a]"
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        isRegistration ? "new-password" : "current-password"
                      }
                      minLength={isRegistration ? 8 : undefined}
                      maxLength={128}
                      placeholder={
                        isRegistration
                          ? "Create a password"
                          : "Enter your password"
                      }
                      value={passwordValue}
                      onChange={(event) => {
                        passwordChange(event);
                        setSignupErrors((current) => ({
                          ...current,
                          password: undefined,
                        }));
                      }}
                      required
                      aria-invalid={Boolean(passwordError)}
                      aria-describedby={
                        passwordError ? "password-error" : undefined
                      }
                    />
                    <button
                      className="absolute top-1/2 right-3 grid h-8 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 focus-visible:outline-3 focus-visible:outline-[#9af1d0] focus-visible:outline-offset-3"
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      <img
                        className="block"
                        src="/assets/password-eye.svg"
                        alt=""
                      />
                    </button>
                  </div>
                  {passwordError && (
                    <span
                      className="text-[13px] leading-[1.45] text-[#ffaaaa]"
                      id="password-error"
                      role="alert"
                    >
                      {passwordError}
                    </span>
                  )}
                </div>
              )}

              {isRegistration && signupStep === 2 && (
                <div className="grid min-w-0 gap-2.5">
                  <label
                    className="text-sm font-medium text-[#f1f5f3]"
                    htmlFor="confirm-password"
                  >
                    Confirm password
                  </label>
                  <input
                    className="min-h-[52px] w-full min-w-0 rounded-lg border border-[#30383a] bg-[#171d1f] px-3 text-sm text-[#f1f5f3] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[#6f817a] focus-visible:border-[#49ddb5] focus-visible:shadow-[0_0_0_3px_rgb(73_221_181_/_15%)] aria-[invalid=true]:border-[#f27a7a]"
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    maxLength={128}
                    placeholder="Enter your password again"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setConfirmPasswordError("");
                    }}
                    required
                    aria-invalid={Boolean(confirmPasswordError)}
                    aria-describedby={
                      confirmPasswordError
                        ? "confirm-password-error"
                        : undefined
                    }
                  />
                  {confirmPasswordError && (
                    <span
                      className="text-[13px] leading-[1.45] text-[#ffaaaa]"
                      id="confirm-password-error"
                    >
                      {confirmPasswordError}
                    </span>
                  )}
                </div>
              )}

              {isRegistration ? (
                <div className="grid grid-cols-2 gap-3">
                  {signupStep === 2 && (
                    <button
                      className="min-h-[52px] w-full cursor-pointer rounded-lg border border-[#30383a] bg-[#171d1f] px-4 py-3 text-sm font-medium text-[#f1f5f3] transition-[background,border-color] duration-[120ms] hover:border-[#59696c] hover:bg-[#1d2527] focus-visible:outline-3 focus-visible:outline-[#9af1d0] focus-visible:outline-offset-3"
                      type="button"
                      onClick={() => {
                        setSignupStep(1);
                        setConfirmPasswordError("");
                      }}
                    >
                      Back
                    </button>
                  )}
                  <button
                    className={`min-h-[52px] w-full cursor-pointer rounded-lg border-0 bg-[#22cca0] px-6 py-3 text-sm font-semibold text-[#06271e] transition-[background,transform] duration-[120ms] hover:enabled:-translate-y-px hover:enabled:bg-[#35d8ac] focus-visible:outline-3 focus-visible:outline-[#9af1d0] focus-visible:outline-offset-3 disabled:cursor-wait disabled:opacity-70 ${signupStep === 1 ? "col-span-2" : ""}`}
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {signupStep === 1
                      ? "Next"
                      : isSubmitting
                        ? "Creating account..."
                        : "Create account"}
                  </button>
                </div>
              ) : (
                <button
                  className="min-h-[52px] w-full cursor-pointer rounded-lg border-0 bg-[#22cca0] px-6 py-3 text-sm font-semibold text-[#06271e] transition-[background,transform] duration-[120ms] hover:enabled:-translate-y-px hover:enabled:bg-[#35d8ac] focus-visible:outline-3 focus-visible:outline-[#9af1d0] focus-visible:outline-offset-3 disabled:cursor-wait disabled:opacity-70"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </button>
              )}

              {message && (
                <p
                  className="m-0 text-[13px] leading-[1.45] text-[#ffaaaa]"
                  role="alert"
                >
                  {message}
                </p>
              )}
            </form>
          </div>

          <p className="mt-[22px] mb-0 text-center text-sm text-[#9ca9a5]">
            {isRegistration
              ? "Already have an account?"
              : "Don’t have an account?"}{" "}
            <button
              className="cursor-pointer border-0 bg-transparent p-0 font-medium text-[#49ddb5] hover:text-[#7af0cb] focus-visible:outline-2 focus-visible:outline-[#9af1d0] focus-visible:outline-offset-3"
              type="button"
              onClick={() => changeMode(isRegistration ? "login" : "register")}
            >
              {isRegistration ? "Sign in" : "Create account"}
            </button>
          </p>
        </div>

        <footer className="mt-8 flex justify-center text-[10px] text-[#6f817a] min-[761px]:mt-4">
          © {new Date().getFullYear()} EthioDev
        </footer>
      </section>
    </main>
  );
}
