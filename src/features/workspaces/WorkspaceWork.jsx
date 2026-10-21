import { useCallback, useEffect, useState } from "react";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import { supabase } from "../../lib/supabaseClient.js";

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toLocalDate(value) {
  return value
    ? new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "No due date";
}

function emptyTask(milestoneId) {
  return {
    id: null,
    title: "",
    description: "",
    milestone_id: milestoneId,
    due_at: "",
    assignee_ids: [],
  };
}

function emptyMilestone() {
  return {
    id: null,
    title: "",
    description: "",
    completion_mode: "automatic",
    is_completed: false,
  };
}

function describeRpcError(error, operation) {
  if (error?.code === "P0001" && error.message)
    return `${error.message.replace(/workspace/gi, "Collabspace")} (Error code: ${error.code})`;
  if (error?.code === "PGRST202")
    return `${operation} is not available yet. Apply the latest Supabase migration, then try again.`;
  return `${operation} could not be saved. Try again. (Error code: ${error?.code ?? "unknown"})`;
}

function TaskEditor({ task, members, milestones, busy, onCancel, onSave }) {
  const [form, setForm] = useState(task);
  const [error, setError] = useState("");
  return (
    <form
      className="workspace-work-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const result = await onSave(form);
        if (result) setError(result);
      }}
    >
      <label className="field-label">
        Task title
        <input
          className="field-control"
          maxLength={160}
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>
      <label className="field-label">
        Description
        <textarea
          className="field-control"
          maxLength={5000}
          rows={3}
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
      </label>
      <div className="workspace-work-form-grid">
        {task.id ? (
          <label className="field-label">
            Milestone
            <select
              className="field-control"
              required
              value={form.milestone_id}
              onChange={(event) =>
                setForm({ ...form, milestone_id: event.target.value })
              }
            >
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="field-label">
            Milestone
            <span className="workspace-task-active-milestone">
              {milestones.find((item) => item.id === form.milestone_id)?.title}
            </span>
          </p>
        )}
        <label className="field-label">
          Due
          <input
            className="field-control"
            type="datetime-local"
            value={form.due_at}
            onChange={(event) =>
              setForm({ ...form, due_at: event.target.value })
            }
          />
        </label>
      </div>
      <fieldset className="workspace-assignee-picker">
        <legend>Assignees</legend>
        {[...members, ...(task.formerAssignees ?? [])].map((member) => (
          <label key={member.user_id}>
            <input
              type="checkbox"
              checked={form.assignee_ids.includes(member.user_id)}
              onChange={(event) =>
                setForm({
                  ...form,
                  assignee_ids: event.target.checked
                    ? [...form.assignee_ids, member.user_id]
                    : form.assignee_ids.filter((id) => id !== member.user_id),
                })
              }
            />
            {member.profiles?.display_name ?? "Developer"}
            {member.former ? " (former member)" : ""}
          </label>
        ))}
      </fieldset>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      <div className="workspace-work-form-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : task.id ? "Save task" : "Create task"}
        </button>
      </div>
    </form>
  );
}

function MilestoneEditor({ milestone, busy, onCancel, onSave }) {
  const [form, setForm] = useState(milestone);
  const [error, setError] = useState("");
  return (
    <form
      className="workspace-work-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const result = await onSave(form);
        if (result) setError(result);
      }}
    >
      <label className="field-label">
        Milestone title
        <input
          className="field-control"
          maxLength={120}
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>
      <label className="field-label">
        Description
        <textarea
          className="field-control"
          maxLength={2000}
          rows={2}
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
      </label>
      <label className="field-label">
        Completion
        <select
          className="field-control"
          value={form.completion_mode}
          onChange={(event) =>
            setForm({
              ...form,
              completion_mode: event.target.value,
              is_completed:
                event.target.value === "manual" ? form.is_completed : false,
            })
          }
        >
          <option value="automatic">Automatic (all tasks completed)</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      {form.completion_mode === "manual" && (
        <label className="workspace-work-check">
          <input
            type="checkbox"
            checked={form.is_completed}
            onChange={(event) =>
              setForm({ ...form, is_completed: event.target.checked })
            }
          />
          Mark milestone complete
        </label>
      )}
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      <div className="workspace-work-form-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy
            ? "Saving…"
            : milestone.id
              ? "Save milestone"
              : "Create milestone"}
        </button>
      </div>
    </form>
  );
}

export default function WorkspaceWork({
  workspaceId,
  user,
  role,
  members,
  projectStatus,
}) {
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [taskEditor, setTaskEditor] = useState(null);
  const [milestoneEditor, setMilestoneEditor] = useState(null);
  const [activeMilestoneId, setActiveMilestoneId] = useState("");
  const canManage = role === "owner" || role === "admin";
  const editable = projectStatus === "active";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [
      { data: taskRows, error: taskError },
      { data: milestoneRows, error: milestoneError },
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, workspace_id, milestone_id, title, description, status, due_at, created_by, task_assignees(user_id, profiles!task_assignees_user_id_fkey(display_name))",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at"),
      supabase
        .from("milestones")
        .select(
          "id, workspace_id, title, description, completion_mode, is_completed, created_at",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at"),
    ]);
    if (taskError || milestoneError)
      setError("Collabspace tasks could not be loaded. Try again.");
    else {
      setTasks(taskRows ?? []);
      setMilestones(milestoneRows ?? []);
      setActiveMilestoneId((currentId) => {
        if (milestoneRows?.some((milestone) => milestone.id === currentId))
          return currentId;
        return (
          milestoneRows?.find((milestone) => !milestone.is_completed)?.id ??
          milestoneRows?.[0]?.id ??
          ""
        );
      });
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveTask(form) {
    setBusy(true);
    setError("");
    const { error: saveError } = await supabase.rpc("save_workspace_task", {
      p_workspace_id: workspaceId,
      p_task_id: form.id,
      p_title: form.title,
      p_description: form.description || null,
      p_milestone_id: form.milestone_id || null,
      p_due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      p_assignee_ids: form.assignee_ids,
    });
    setBusy(false);
    if (saveError) return describeRpcError(saveError, "Task");
    setTaskEditor(null);
    setNotice("Task saved.");
    await load();
    return "";
  }

  async function saveMilestone(form) {
    setBusy(true);
    setError("");
    const { data: savedMilestoneId, error: saveError } = await supabase.rpc(
      "save_workspace_milestone",
      {
        p_workspace_id: workspaceId,
        p_milestone_id: form.id,
        p_title: form.title,
        p_description: form.description || null,
        p_completion_mode: form.completion_mode,
        p_is_completed: form.is_completed,
      },
    );
    setBusy(false);
    if (saveError) return describeRpcError(saveError, "Milestone");
    if (!form.id && savedMilestoneId) setActiveMilestoneId(savedMilestoneId);
    setMilestoneEditor(null);
    setNotice("Milestone saved.");
    await load();
    return "";
  }

  async function updateStatus(taskId, status) {
    setBusy(true);
    setError("");
    setNotice("");
    const { error: updateError } = await supabase.rpc(
      "update_assigned_task_status",
      { p_task_id: taskId, p_status: status },
    );
    setBusy(false);
    if (updateError)
      setError(
        `Task status could not be updated. (Error code: ${updateError.code ?? "unknown"})`,
      );
    else await load();
  }

  async function deleteRecord(operation, id, label) {
    if (!window.confirm(`Delete this ${label}?`)) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase.rpc(
      operation,
      operation === "delete_workspace_task"
        ? { p_task_id: id }
        : { p_milestone_id: id },
    );
    setBusy(false);
    if (deleteError)
      setError(
        deleteError.code === "P0001" && deleteError.message
          ? `${deleteError.message.replace(/workspace/gi, "Collabspace")} (Error code: ${deleteError.code})`
          : `The ${label} could not be deleted. (Error code: ${deleteError.code ?? "unknown"})`,
      );
    else {
      setNotice(`${label[0].toUpperCase()}${label.slice(1)} deleted.`);
      await load();
    }
  }

  function editTask(task) {
    setTaskEditor({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      milestone_id: task.milestone_id ?? "",
      due_at: toLocalInput(task.due_at),
      assignee_ids: (task.task_assignees ?? []).map(
        (assignment) => assignment.user_id,
      ),
      formerAssignees: (task.task_assignees ?? [])
        .filter(
          (assignment) =>
            !members.some((member) => member.user_id === assignment.user_id),
        )
        .map((assignment) => ({
          user_id: assignment.user_id,
          profiles: assignment.profiles,
          former: true,
        })),
    });
  }

  function renderTask(task) {
    const assigned = (task.task_assignees ?? [])
      .map(
        (assignment) =>
          members.find((member) => member.user_id === assignment.user_id) ??
          assignment,
      )
      .filter(Boolean);
    const assignedToMe = (task.task_assignees ?? []).some(
      (assignment) => assignment.user_id === user.id,
    );
    const assigneeNames = assigned.length
      ? assigned
          .map(
            (member) =>
              `${member.profiles?.display_name ?? "Developer"}${members.some((active) => active.user_id === member.user_id) ? "" : " (former member)"}`,
          )
          .join(", ")
      : "Unassigned";
    return (
      <article className="workspace-task-card project-task-card" key={task.id}>
        <div className="workspace-task-card-heading">
          <div className="project-task-title">
            {(canManage || assignedToMe) && editable && (
              <span
                className="task-drag-handle"
                role="button"
                tabIndex={0}
                aria-label={`Move ${task.title} to another status`}
                aria-description="Drag this handle, or use the left and right arrow keys to change status."
                title="Drag this task to another column"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/task-id", task.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                    return;
                  event.preventDefault();
                  const statuses = ["to_do", "in_progress", "done"];
                  const currentIndex = statuses.indexOf(task.status);
                  const nextIndex =
                    currentIndex + (event.key === "ArrowRight" ? 1 : -1);
                  if (nextIndex >= 0 && nextIndex < statuses.length)
                    void updateStatus(task.id, statuses[nextIndex]);
                }}
              >
                <svg viewBox="0 0 12 20" focusable="false">
                  <circle cx="3" cy="3" r="1.5" />
                  <circle cx="9" cy="3" r="1.5" />
                  <circle cx="3" cy="10" r="1.5" />
                  <circle cx="9" cy="10" r="1.5" />
                  <circle cx="3" cy="17" r="1.5" />
                  <circle cx="9" cy="17" r="1.5" />
                </svg>
              </span>
            )}
            <div>
              <h4>{task.title}</h4>
            </div>
          </div>
          {canManage && editable && (
            <details className="three-dot-menu project-task-menu">
              <summary
                aria-label={`Actions for ${task.title}`}
                title="Task actions"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </summary>
              <div className="three-dot-menu-items">
                <button
                  type="button"
                  disabled={busy}
                  onClick={(event) => {
                    event.currentTarget.closest("details").open = false;
                    editTask(task);
                  }}
                >
                  Edit task
                </button>
                <button
                  className="workspace-delete-action"
                  type="button"
                  disabled={busy}
                  onClick={(event) => {
                    event.currentTarget.closest("details").open = false;
                    void deleteRecord("delete_workspace_task", task.id, "task");
                  }}
                >
                  Delete task
                </button>
              </div>
            </details>
          )}
        </div>
        <div className="workspace-task-meta">
          <span>{toLocalDate(task.due_at)}</span>
        </div>
        <details className="project-task-details">
          <summary>View details</summary>
          <div>
            {task.description && <p>{task.description}</p>}
            <p>
              <strong>Assignees:</strong> {assigneeNames}
            </p>
          </div>
        </details>
      </article>
    );
  }

  if (loading && tasks.length === 0 && milestones.length === 0)
    return (
      <LoadingSkeleton variant="tasks" label="Loading Collabspace tasks" />
    );
  return (
    <section
      className="workspace-work-panel"
      aria-label="Collabspace task board and milestones"
    >
      {!editable && (
        <p className="feedback feedback-info" role="status">
          This Collabspace is read-only. Task changes are available while it is
          Active.
        </p>
      )}
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p
          className="feedback feedback-success workspace-work-notice"
          role="status"
        >
          {notice}
        </p>
      )}
      {taskEditor && canManage && editable && (
        <section className="workspace-work-editor">
          <h3>{taskEditor.id ? "Edit task" : "New task"}</h3>
          <TaskEditor
            key={taskEditor.id ?? "new-task"}
            task={taskEditor}
            members={members}
            milestones={milestones}
            busy={busy}
            onCancel={() => setTaskEditor(null)}
            onSave={saveTask}
          />
        </section>
      )}
      {milestoneEditor && canManage && editable && (
        <section className="workspace-work-editor">
          <h3>{milestoneEditor.id ? "Edit milestone" : "New milestone"}</h3>
          <MilestoneEditor
            key={milestoneEditor.id ?? "new-milestone"}
            milestone={milestoneEditor}
            busy={busy}
            onCancel={() => setMilestoneEditor(null)}
            onSave={saveMilestone}
          />
        </section>
      )}
      {milestones.length === 0 ? (
        <section className="empty-card project-milestones-empty">
          <h3>Create a milestone to start planning</h3>
          <p>
            Every task belongs to a milestone. Add one before creating tasks.
          </p>
          {canManage && editable && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => setMilestoneEditor(emptyMilestone())}
            >
              Create milestone
            </button>
          )}
        </section>
      ) : (
        <div className="project-work-layout">
          <aside
            className="project-milestone-sidebar"
            aria-labelledby="project-milestones-title"
          >
            <div className="project-milestone-sidebar-heading">
              <h3 id="project-milestones-title">Milestones</h3>
            </div>
            <div
              className="project-milestone-list"
              aria-label="Select a milestone"
            >
              {milestones.map((milestone) => {
                const count = tasks.filter(
                  (task) => task.milestone_id === milestone.id,
                ).length;
                const selected = activeMilestoneId === milestone.id;
                return (
                  <div
                    className={
                      selected
                        ? "project-milestone-item is-active"
                        : "project-milestone-item"
                    }
                    key={milestone.id}
                  >
                    <button
                      className="project-milestone-select"
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setActiveMilestoneId(milestone.id);
                        setTaskEditor(null);
                      }}
                    >
                      <strong>{milestone.title}</strong>
                      <span>
                        {milestone.is_completed
                          ? "Completed"
                          : count + (count === 1 ? " task" : " tasks")}
                      </span>
                    </button>
                    {canManage && editable && (
                      <details className="three-dot-menu project-milestone-menu">
                        <summary
                          aria-label={`Actions for ${milestone.title}`}
                          title="Milestone actions"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="19" r="1" />
                          </svg>
                        </summary>
                        <div className="three-dot-menu-items">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(event) => {
                              event.currentTarget.closest("details").open =
                                false;
                              setMilestoneEditor(milestone);
                            }}
                          >
                            Edit milestone
                          </button>
                          <button
                            className="workspace-delete-action"
                            type="button"
                            disabled={busy}
                            onClick={(event) => {
                              event.currentTarget.closest("details").open =
                                false;
                              void deleteRecord(
                                "delete_workspace_milestone",
                                milestone.id,
                                "milestone",
                              );
                            }}
                          >
                            Delete milestone
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            {canManage && editable && (
              <button
                className="text-button project-milestone-add"
                type="button"
                disabled={busy}
                onClick={() => setMilestoneEditor(emptyMilestone())}
              >
                Add milestone
              </button>
            )}
          </aside>
          <div className="project-task-board-wrap">
            <div className="project-task-board-heading">
              {canManage && editable && (
                <button
                  className="button button-primary"
                  type="button"
                  disabled={busy || !activeMilestoneId}
                  onClick={() => {
                    setNotice("");
                    setTaskEditor(emptyTask(activeMilestoneId));
                  }}
                >
                  Add task
                </button>
              )}
            </div>
            <div className="project-task-board">
              {[
                ["to_do", "To do"],
                ["in_progress", "In progress"],
                ["done", "Completed"],
              ].map(([status, label]) => (
                <section
                  className="project-task-column"
                  key={status}
                  aria-label={label + " tasks"}
                  onDragOver={(event) => {
                    if (editable && !busy) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!editable || busy) return;
                    const taskId = event.dataTransfer.getData("text/task-id");
                    const task = tasks.find((item) => item.id === taskId);
                    const canUpdateTask =
                      canManage ||
                      task?.task_assignees?.some(
                        (assignment) => assignment.user_id === user.id,
                      );
                    if (task && canUpdateTask && task.status !== status)
                      void updateStatus(taskId, status);
                  }}
                >
                  <h3>
                    {label}
                    <span>
                      {
                        tasks.filter(
                          (task) =>
                            task.milestone_id === activeMilestoneId &&
                            task.status === status,
                        ).length
                      }
                    </span>
                  </h3>
                  {tasks
                    .filter(
                      (task) =>
                        task.milestone_id === activeMilestoneId &&
                        task.status === status,
                    )
                    .map(renderTask)}
                  {tasks.every(
                    (task) =>
                      task.milestone_id !== activeMilestoneId ||
                      task.status !== status,
                  ) && <p className="workspace-work-empty">No tasks</p>}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
