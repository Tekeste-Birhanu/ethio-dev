import { Button } from "../components/ui.jsx";

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

  const isRegistration = mode === "register";

  return (
    <main className="auth-page [min-height:100vh] [display:grid] [place-items:center] [padding:32px_20px] [background:radial-gradient(ellipse_at_50%_0%,_rgb(23_92_73_/_16%),_transparent_45%),_#0d1114]">
      <button
        className="back-button auth-back-button [position:absolute] [top:20px] [left:20px] [display:inline-flex] [min-height:42px] [align-items:center] [padding:0_15px] [border:1px_solid_#303a3e] [border-radius:10px] [background:#1b2327] [color:#edf3f4] [cursor:pointer] [font-weight:600] [text-decoration:none] hover:[border-color:#59696c] hover:[background:#222d31] [margin-bottom:18px]"
        type="button"
        onClick={() => {
          handleAppNavigation("discover");
          setMessage("");
        }}
      >
        Back to Discover
      </button>
      <section
        className="auth-card [width:min(100%,_440px)] [padding:38px] [border:1px_solid_#252d31] [border-radius:20px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_24%)] [padding:28px_22px]"
        aria-labelledby="auth-heading"
      >
        <h1 className="max-[520px]:[font-size:26px]" id="auth-heading">
          {isRegistration ? "Create account" : "Sign in"}
        </h1>
        <a
          className="google-button [display:flex] [min-height:48px] [align-items:center] [justify-content:center] [border:1px_solid_#303a3e] [border-radius:12px] [color:#edf3f4] [font-weight:650] [text-decoration:none] [transition:background_120ms_ease,_border-color_120ms_ease] hover:[border-color:#59696c] hover:[background:#1b2327] focus-visible:[outline:3px_solid_#9af1d0] focus-visible:[outline-offset:3px]"
          href="/api/auth/google"
        >
          Continue with Google
        </a>
        <div
          className="auth-divider before:content-[''] before:h-px before:flex-1 before:bg-[#303a3e] after:content-[''] after:h-px after:flex-1 after:bg-[#303a3e] [display:flex] [align-items:center] [gap:12px] [margin:18px_0] [color:#91a2a5] [font-size:13px]"
          aria-hidden="true"
        >
          <span>or</span>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          {isRegistration ? (
            registrationFields.map(({ label, ...field }) => (
              <div
                className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px]"
                key={field.name}
              >
                <label
                  className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                  htmlFor={field.name}
                >
                  {label}
                </label>
                <input
                  className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
                  {...field}
                  id={field.name}
                  name={field.name}
                  value={registration[field.name]}
                  onChange={handleRegistrationChange}
                  required
                  aria-invalid={Boolean(fieldErrors[field.name])}
                  aria-describedby={
                    fieldErrors[field.name] ? `${field.name}-error` : undefined
                  }
                />
                {fieldErrors[field.name] && (
                  <span
                    className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]"
                    id={`${field.name}-error`}
                  >
                    {fieldErrors[field.name]}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px]">
              <label
                className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                htmlFor="identifier"
              >
                Email or username
              </label>
              <input
                className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
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

          <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px]">
            <label
              className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
              htmlFor="password"
            >
              Password
            </label>
            <input
              className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
              id="password"
              name="password"
              type="password"
              autoComplete={
                isRegistration ? "new-password" : "current-password"
              }
              minLength={isRegistration ? 8 : undefined}
              maxLength={128}
              value={
                isRegistration ? registration.password : credentials.password
              }
              onChange={
                isRegistration
                  ? handleRegistrationChange
                  : handleCredentialsChange
              }
              required
            />
            {fieldErrors.password && (
              <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isRegistration
                ? "Creating account..."
                : "Signing in..."
              : isRegistration
                ? "Create account"
                : "Sign in"}
          </Button>
          {message && (
            <p
              className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45]"
              role="alert"
            >
              {message}
            </p>
          )}
        </form>

        <p className="auth-switch [margin:22px_0_0] [color:#aebabb] [font-size:14px] [text-align:center]">
          {isRegistration ? "Already have an account?" : "New to EthioDev?"}{" "}
          <button
            className="focus-visible:[outline:2px_solid_#9af1d0] focus-visible:[outline-offset:3px] [padding:0] [border:0] [background:transparent] [color:#55dfb0] [cursor:pointer] [font-weight:650]"
            type="button"
            onClick={() => switchMode(isRegistration ? "login" : "register")}
          >
            {isRegistration ? "Sign in" : "Create account"}
          </button>
        </p>
      </section>
    </main>
  );
}

