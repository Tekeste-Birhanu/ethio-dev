import { FormField } from "./ui.jsx";
import { experienceOptions } from "../constants.js";

function OptionalProfileFields({
  values,
  onChange,
  errors,
  prefix,
  showOptionalLabels = true,
}) {
  return (
    <>
      <FormField>
        <label
          className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
          htmlFor={`${prefix}-city`}
        >
          City{" "}
          {showOptionalLabels && (
            <span className="[color:#91a2a5] [font-weight:400]">
              (optional)
            </span>
          )}
        </label>
        <input
          className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
          id={`${prefix}-city`}
          name="city"
          type="text"
          maxLength={100}
          autoComplete="address-level2"
          value={values.city}
          onChange={onChange}
          aria-invalid={Boolean(errors.city)}
        />
        {errors.city && (
          <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
            {errors.city}
          </span>
        )}
      </FormField>
      <FormField>
        <label
          className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
          htmlFor={`${prefix}-experience`}
        >
          Experience{" "}
          {showOptionalLabels && (
            <span className="[color:#91a2a5] [font-weight:400]">
              (optional)
            </span>
          )}
        </label>
        <select
          className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease] [height:48px] [padding:0_40px_0_14px] [appearance:none] [background-color:#0d1215] [background-image:url(data:image/svg+xml,%3Csvg_xmlns='http://www.w3.org/2000/svg'_width='16'_height='16'_viewBox='0_0_16_16'_fill='none'%3E%3Cpath_d='m4_6_4_4_4-4'_stroke='%2391a2a5'_stroke-width='1.5'_stroke-linecap='round'_stroke-linejoin='round'/%3E%3C/svg%3E)] [background-position:right_14px_center] [background-repeat:no-repeat] [cursor:pointer] [line-height:1.2]"
          id={`${prefix}-experience`}
          name="experience"
          value={values.experience}
          onChange={onChange}
          aria-invalid={Boolean(errors.experience)}
        >
          <option
            className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)]"
            value=""
          >
            Choose a level
          </option>
          {experienceOptions.map(([value, label]) => (
            <option
              className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)]"
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </select>
        {errors.experience && (
          <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
            {errors.experience}
          </span>
        )}
      </FormField>
      <FormField>
        <label
          className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
          htmlFor={`${prefix}-skills`}
        >
          Skills{" "}
          <span className="[color:#91a2a5] [font-weight:400]">
            ({showOptionalLabels ? "optional, " : ""}comma-separated)
          </span>
        </label>
        <input
          className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
          id={`${prefix}-skills`}
          name="skills"
          type="text"
          maxLength={1000}
          placeholder="JavaScript, React, PostgreSQL"
          value={values.skills}
          onChange={onChange}
          aria-invalid={Boolean(errors.skills)}
        />
        {errors.skills && (
          <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
            {errors.skills}
          </span>
        )}
      </FormField>
      <FormField>
        <label
          className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
          htmlFor={`${prefix}-description`}
        >
          Bio{" "}
          {showOptionalLabels && (
            <span className="[color:#91a2a5] [font-weight:400]">
              (optional)
            </span>
          )}
        </label>
        <textarea
          className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease] [min-height:92px] [padding:12px_14px] [resize:vertical]"
          id={`${prefix}-description`}
          name="description"
          maxLength={2000}
          rows={3}
          value={values.description}
          onChange={onChange}
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description && (
          <span className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]">
            {errors.description}
          </span>
        )}
      </FormField>
    </>
  );
}

function DeveloperCard({ developer }) {
  const experience = developer.experience
    ? developer.experience[0] + developer.experience.slice(1).toLowerCase()
    : null;

  return (
    <article className="developer-card [display:flex] [min-width:0] [flex-direction:column] [padding:18px] [border:1px_solid_#252d31] [border-radius:16px] [background:#141a1e]">
      <header className="developer-card-header [display:flex] [min-width:0] [align-items:center] [gap:12px]">
        <div
          className="developer-card-avatar [display:grid] [width:44px] [height:44px] [flex:0_0_auto] [place-items:center] [border:1px_solid_#28634f] [border-radius:50%] [background:#1b3029] [color:#65e7b7] [font-weight:700]"
          aria-hidden="true"
        >
          {developer.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="developer-card-identity [min-width:0]">
          <h2 className="[overflow:hidden] [margin:0_0_3px] [color:#edf3f4] [font-size:16px] [text-overflow:ellipsis] [white-space:nowrap]">
            {developer.name}
          </h2>
          <span className="[color:#91a2a5] [font-size:13px]">
            @{developer.username}
          </span>
        </div>
      </header>
      {(developer.city || experience) && (
        <p className="developer-card-details [display:flex] [flex-wrap:wrap] [gap:8px] [margin:16px_0_0] [color:#91a2a5] [font-size:13px]">
          {developer.city && <span>{developer.city}</span>}
          {developer.city && experience && <span aria-hidden="true">·</span>}
          {experience && <span>{experience}</span>}
        </p>
      )}
      {developer.description && (
        <p className="developer-card-bio [display:-webkit-box] [overflow:hidden] [margin:14px_0_0] [color:#d9e1e2] [line-height:1.55] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
          {developer.description}
        </p>
      )}
      {developer.skills.length > 0 && (
        <ul
          className="developer-card-skills [display:flex] [flex-wrap:wrap] [gap:7px] [margin:15px_0_0] [padding:0] [list-style:none]"
          aria-label={`${developer.name}'s skills`}
        >
          {developer.skills.map((skill) => (
            <li
              className="[padding:5px_9px] [border:1px_solid_#303a3e] [border-radius:999px] [background:#1b2428] [color:#c0cece] [font-size:12px]"
              key={skill}
            >
              {skill}
            </li>
          ))}
        </ul>
      )}
      <a
        className="developer-card-link [align-self:flex-start] [margin-top:auto] [padding-top:18px] [color:#65e7b7] [font-size:13px] [font-weight:650] [text-decoration:none] hover:[color:#9af1d0] hover:[text-decoration:underline]"
        href={`/profile/${encodeURIComponent(developer.username)}`}
      >
        View profile
      </a>
    </article>
  );
}

export { DeveloperCard, OptionalProfileFields };
