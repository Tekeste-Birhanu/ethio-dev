import { useCallback, useEffect, useState } from "react";
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

function emptyTask() {
  return {
    id: null,
    title: "",
    description: "",
    milestone_id: "",
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
    return `${error.message} (Error code: ${error.code})`;
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
        <label className="field-label">
          Milestone
          <select
            className="field-control"
            value={form.milestone_id}
            onChange={(event) =>
              setForm({ ...form, milestone_id: event.target.value })
            }
          >
            <option value="">No milestone</option>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.title}
              </option>
            ))}
          </select>
        </label>
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
          <option value="automatic">Automatic (all tasks done)</option>
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
  inactiveWorkEditable,
}) {
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [taskEditor, setTaskEditor] = useState(null);
  const [milestoneEditor, setMilestoneEditor] = useState(null);
  const canManage = role === "owner" || role === "admin";
  const editable = projectStatus === "active" || inactiveWorkEditable;

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
      setError("Workspace tasks could not be loaded. Try again.");
    else {
      setTasks(taskRows ?? []);
      setMilestones(milestoneRows ?? []);
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
    const { error: saveError } = await supabase.rpc(
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
        `The ${label} could not be deleted. (Error code: ${deleteError.code ?? "unknown"})`,
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
    const mayUpdate =
      canManage ||
      (task.task_assignees ?? []).some(
        (assignment) => assignment.user_id === user.id,
      );
    return (
      <article className="workspace-task-card" key={task.id}>
        <div className="workspace-task-card-heading">
          <div>
            <h4>{task.title}</h4>
            {task.description && <p>{task.description}</p>}
          </div>
          {canManage && editable && (
            <div className="workspace-task-card-actions">
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => editTask(task)}
              >
                Edit
              </button>
              <button
                className="text-button-danger"
                type="button"
                disabled={busy}
                onClick={() =>
                  void deleteRecord("delete_workspace_task", task.id, "task")
                }
              >
                Delete
              </button>
            </div>
          )}
        </div>
        <div className="workspace-task-meta">
          <label>
            <span className="visually-hidden">Status for {task.title}</span>
            <select
              aria-label={`Status for ${task.title}`}
              className="field-control"
              value={task.status}
              disabled={!editable || !mayUpdate || busy}
              onChange={(event) =>
                void updateStatus(task.id, event.target.value)
              }
            >
              <option value="to_do">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <span>{toLocalDate(task.due_at)}</span>
          <span>
            {assigned.length
              ? assigned
                  .map(
                    (member) =>
                      `${member.profiles?.display_name ?? "Developer"}${members.some((active) => active.user_id === member.user_id) ? "" : " (former member)"}`,
                  )
                  .join(", ")
              : "Unassigned"}
          </span>
        </div>
      </article>
    );
  }

  if (loading)
    return (
      <p className="empty-card" role="status">
        Loading workspace tasks…
      </p>
    );
  return (
    <section
      className="workspace-work-panel"
      aria-label="Workspace tasks and milestones"
    >
      <div className="workspace-work-heading">
        <div>
          <h2>Tasks &amp; milestones</h2>
          <p>Coordinate the work and track progress.</p>
        </div>
        {canManage && editable && (
          <div className="workspace-work-heading-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setNotice("");
                setMilestoneEditor(emptyMilestone());
              }}
            >
              Add milestone
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                setNotice("");
                setTaskEditor(emptyTask());
              }}
            >
              Add task
            </button>
          </div>
        )}
      </div>
      {!editable && (
        <p className="feedback feedback-info" role="status">
          This project is read-only. The owner or an admin can allow work edits
          in project settings.
        </p>
      )}
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="feedback feedback-success" role="status">
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
      {milestones.length === 0 && tasks.length === 0 ? (
        <p className="empty-card">No tasks or milestones yet.</p>
      ) : (
        <div className="workspace-work-groups">
          {milestones.map((milestone) => {
            const linked = tasks.filter(
              (task) => task.milestone_id === milestone.id,
            );
            return (
              <section className="workspace-work-group" key={milestone.id}>
                <div className="workspace-work-group-heading">
                  <div>
                    <h3>{milestone.title}</h3>
                    {milestone.description && <p>{milestone.description}</p>}
                    <span
                      className={`status-chip ${milestone.is_completed ? "status-open" : "status-closed"}`}
                    >
                      {milestone.is_completed ? "Complete" : "In progress"} ·{" "}
                      {milestone.completion_mode === "automatic"
                        ? "Automatic"
                        : "Manual"}
                    </span>
                  </div>
                  {canManage && editable && (
                    <div className="workspace-task-card-actions">
                      <button
                        className="text-button"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setNotice("");
                          setMilestoneEditor(milestone);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-button-danger"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void deleteRecord(
                            "delete_workspace_milestone",
                            milestone.id,
                            "milestone",
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {linked.length ? (
                  linked.map(renderTask)
                ) : (
                  <p className="workspace-work-empty">
                    No tasks in this milestone yet.
                  </p>
                )}
              </section>
            );
          })}
          {tasks.some((task) => !task.milestone_id) && (
            <section className="workspace-work-group">
              <h3>Other tasks</h3>
              {tasks.filter((task) => !task.milestone_id).map(renderTask)}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
