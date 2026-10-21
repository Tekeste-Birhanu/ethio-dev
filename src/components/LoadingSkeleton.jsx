const skeletonItems = (count, className) =>
  Array.from({ length: count }, (_, index) => (
    <span className={`loading-skeleton ${className}`} key={index} />
  ));

function SkeletonLines({ count = 2, className = "" }) {
  return (
    <span className={`skeleton-lines ${className}`} aria-hidden="true">
      {skeletonItems(count, "skeleton-line")}
    </span>
  );
}

function SkeletonRows({ count = 4, className = "" }) {
  return (
    <div className={`skeleton-row-list ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="loading-skeleton skeleton-avatar" />
          <SkeletonLines count={2} />
        </div>
      ))}
    </div>
  );
}

function SkeletonCards({ count = 3, className = "" }) {
  return (
    <div className={`skeleton-card-grid ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="skeleton-card" key={index}>
          <span className="loading-skeleton skeleton-card-image" />
          <span className="loading-skeleton skeleton-line skeleton-line-title" />
          <SkeletonLines count={3} />
        </article>
      ))}
    </div>
  );
}

function SkeletonBoard() {
  return (
    <div className="skeleton-board" aria-hidden="true">
      {Array.from({ length: 3 }, (_, column) => (
        <div className="skeleton-board-column" key={column}>
          <span className="loading-skeleton skeleton-line skeleton-line-title" />
          {skeletonItems(column === 0 ? 2 : 1, "skeleton-task")}
        </div>
      ))}
    </div>
  );
}

function SkeletonConversation() {
  return (
    <div className="skeleton-conversation" aria-hidden="true">
      <span className="loading-skeleton skeleton-conversation-header" />
      <div className="skeleton-message-stack">
        <span className="loading-skeleton skeleton-message" />
        <span className="loading-skeleton skeleton-message is-own" />
        <span className="loading-skeleton skeleton-message" />
      </div>
      <span className="loading-skeleton skeleton-composer" />
    </div>
  );
}

const variantContent = {
  rows: <SkeletonRows />,
  notifications: <SkeletonRows className="skeleton-notifications" count={5} />,
  conversations: <SkeletonRows className="skeleton-conversations" count={4} />,
  cards: <SkeletonCards />,
  form: (
    <div className="skeleton-form" aria-hidden="true">
      <span className="loading-skeleton skeleton-line skeleton-line-title" />
      <SkeletonLines count={2} />
      {skeletonItems(4, "skeleton-field")}
      <span className="loading-skeleton skeleton-form-action" />
    </div>
  ),
  profile: (
    <div className="skeleton-profile" aria-hidden="true">
      <div className="skeleton-profile-heading">
        <span className="loading-skeleton skeleton-avatar skeleton-avatar-large" />
        <SkeletonLines count={3} />
      </div>
      <SkeletonLines count={4} className="skeleton-profile-bio" />
      <SkeletonCards count={2} />
    </div>
  ),
  conversation: <SkeletonConversation />,
  project: (
    <div className="skeleton-project" aria-hidden="true">
      <SkeletonLines count={2} />
      <span className="loading-skeleton skeleton-project-tabs" />
      <SkeletonConversation />
    </div>
  ),
  tasks: (
    <div className="skeleton-project-work" aria-hidden="true">
      <div className="skeleton-milestones">
        <span className="loading-skeleton skeleton-line skeleton-line-title" />
        {skeletonItems(3, "skeleton-milestone")}
      </div>
      <SkeletonBoard />
    </div>
  ),
};

export default function LoadingSkeleton({ variant = "rows", label }) {
  return (
    <div
      className={`page-skeleton page-skeleton-${variant}`}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="visually-hidden">{label}</span>
      {variantContent[variant] ?? variantContent.rows}
    </div>
  );
}
