import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "../components/ui.jsx";

const columns = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

function formatDueDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function TaskCard({ task, onOpen, canMove, onTaskDragStart, onDragEnd, isMoving }) {
  const dueDate = formatDueDate(task.dueAt);

  return (
    <article
      className={`rounded-xl border border-[#293236] bg-[#101512] ${canMove ? "cursor-grab active:cursor-grabbing" : ""} ${isMoving ? "opacity-60" : ""}`}
      draggable={canMove && !isMoving}
      onDragStart={(event) => onTaskDragStart(event, task)}
      onDragEnd={onDragEnd}
    >
      <button className="grid w-full gap-3 rounded-xl border-0 bg-transparent p-4 text-left hover:bg-[#192125] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" type="button" onClick={() => onOpen(task)}>
        <h3 className="m-0 break-words text-sm font-semibold leading-5 text-ink">{task.title}</h3>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted">
          <span className="truncate">{task.assignee?.name ?? "Unassigned"}</span>
          {dueDate && <time dateTime={task.dueAt}>{dueDate}</time>}
        </div>
      </button>
    </article>
  );
}

function TaskColumn({ column, tasks, onOpenTask, onCreateTask, onMoveTask, onTaskDragStart, onTaskDragEnd, canMoveTask, draggedTaskId, dropTargetStatus, setDropTargetStatus, movingTaskId }) {
  return (
    <section
      className={`grid min-w-0 content-start gap-3 rounded-xl border p-2 transition-colors ${dropTargetStatus === column.id ? "border-[#45BD76] bg-[#14221f]" : "border-transparent"}`}
      aria-label={`${column.label} tasks`}
      onDragOver={(event) => {
        if (!draggedTaskId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropTargetStatus(column.id);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDropTargetStatus("");
      }}
      onDrop={(event) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
        setDropTargetStatus("");
        if (taskId) onMoveTask(taskId, column.id);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 flex items-center gap-2 text-sm font-bold text-ink">{column.label}<span className="text-xs font-normal text-muted">{tasks.length}</span></h3>
        {onCreateTask && <button className="grid size-7 place-items-center rounded-lg border border-[#354044] bg-transparent text-accent hover:bg-[#192125] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" type="button" aria-label={`Add task to ${column.label}`} title="Add task" onClick={() => onCreateTask(column.id)}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>}
      </div>
      {tasks.length ? (
        <div className="grid content-start gap-2">
          {tasks.map((task) => <TaskCard key={task.id} task={task} onOpen={onOpenTask} canMove={canMoveTask(task)} onTaskDragStart={onTaskDragStart} onDragEnd={onTaskDragEnd} isMoving={movingTaskId === task.id} />)}
        </div>
      ) : (
        <p className="m-0 rounded-xl border border-dashed border-[#293236] px-4 py-5 text-center text-sm text-muted">No tasks</p>
      )}
    </section>
  );
}

export default function CollabspaceTaskboard({ collabspaceId, role, userId }) {
  const [milestones, setMilestones] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("TODO");
  const [selectedTask, setSelectedTask] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState("");
  const [dropTargetStatus, setDropTargetStatus] = useState("");
  const [movingTaskId, setMovingTaskId] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [milestoneDraft, setMilestoneDraft] = useState(null);
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);
  const [openMilestoneMenuId, setOpenMilestoneMenuId] = useState("");
  const [milestoneMenuPosition, setMilestoneMenuPosition] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const milestoneMenuRef = useRef(null);
  const canManage = ["OWNER", "ADMIN"].includes(role);

  const applyTaskUpdate = useCallback((task) => {
    setMilestones((current) => current.map((milestone) => {
      const tasks = milestone.tasks.filter((currentTask) => currentTask.id !== task.id);
      if (milestone.id !== task.milestoneId) return tasks.length === milestone.tasks.length ? milestone : { ...milestone, tasks };
      return { ...milestone, tasks: [...tasks, task].sort((first, second) => first.position - second.position) };
    }));
    setSelectedTask((current) => current?.id === task.id ? task : current);
  }, []);

  const applyTaskCreated = useCallback((task) => {
    setMilestones((current) => current.map((milestone) => milestone.id === task.milestoneId
      ? { ...milestone, tasks: milestone.tasks.some((item) => item.id === task.id) ? milestone.tasks : [...milestone.tasks, task].sort((first, second) => first.position - second.position) }
      : milestone));
  }, []);

  const applyMilestoneCreated = useCallback((milestone, shouldSelect = false) => {
    setMilestones((current) => current.some((item) => item.id === milestone.id)
      ? current
      : [...current, { ...milestone, tasks: [] }].sort((first, second) => first.position - second.position));
    if (shouldSelect) {
      setSelectedMilestoneId(milestone.id);
      setSelectedStatus("TODO");
    }
  }, []);

  const applyMilestoneUpdated = useCallback((milestone) => {
    setMilestones((current) => current.map((item) => item.id === milestone.id ? { ...item, name: milestone.name, position: milestone.position } : item));
  }, []);

  const applyMilestoneDeleted = useCallback((milestoneId) => {
    setMilestones((current) => current.filter((item) => item.id !== milestoneId));
    setSelectedMilestoneId((selectedId) => selectedId === milestoneId ? "" : selectedId);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTaskboard() {
      try {
        const response = await fetch(`/api/collabspaces/${encodeURIComponent(collabspaceId)}/taskboard`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? "Could not load this taskboard.");
        const nextMilestones = result.milestones ?? [];
        setMilestones(nextMilestones);
        setMembers(result.members ?? []);
        setSelectedMilestoneId((currentId) => nextMilestones.some((milestone) => milestone.id === currentId) ? currentId : nextMilestones[0]?.id ?? "");
      } catch (loadError) {
        if (loadError.name !== "AbortError") setError(loadError.message || "Could not reach the server. Try again.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadTaskboard();
    return () => controller.abort();
  }, [collabspaceId]);

  useEffect(() => {
    let disposed = false;
    let retryTimer;
    let retryDelay = 500;
    let socket;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/chat/socket`);
      socket.addEventListener("open", () => { retryDelay = 500; });
      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.workspaceId !== collabspaceId) return;
          if (payload.type === "task.updated") applyTaskUpdate(payload.task);
          if (payload.type === "task.created") applyTaskCreated(payload.task);
          if (payload.type === "milestone.created") applyMilestoneCreated(payload.milestone);
          if (payload.type === "milestone.updated") applyMilestoneUpdated(payload.milestone);
          if (payload.type === "milestone.deleted") applyMilestoneDeleted(payload.milestoneId);
        } catch {
          // Ignore unrelated or malformed socket events.
        }
      });
      socket.addEventListener("close", () => {
        if (disposed) return;
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 8000);
      });
      socket.addEventListener("error", () => socket.close());
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [applyMilestoneCreated, applyMilestoneDeleted, applyMilestoneUpdated, applyTaskCreated, applyTaskUpdate, collabspaceId]);

  useEffect(() => {
    if (!openMilestoneMenuId) return undefined;
    const closeMenu = (event) => {
      if (!milestoneMenuRef.current?.contains(event.target) && !event.target.closest?.("[data-milestone-menu]")) {
        setOpenMilestoneMenuId("");
        setMilestoneMenuPosition(null);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpenMilestoneMenuId("");
        setMilestoneMenuPosition(null);
      }
    };
    const closeOnViewportChange = () => {
      setOpenMilestoneMenuId("");
      setMilestoneMenuPosition(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [openMilestoneMenuId]);

  const selectedMilestone = milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? milestones[0];

  function openTask(task) {
    setActionError("");
    setSelectedTask(task);
    setDraft({
      title: task.title,
      description: task.description ?? "",
      assigneeId: task.assignee?.id ?? "",
      milestoneId: task.milestoneId,
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : "",
      status: task.status,
    });
  }

  function openNewTask(status) {
    if (!canManage || !selectedMilestone) return;
    setActionError("");
    setSelectedTask({ id: "", milestoneId: selectedMilestone.id, status });
    setDraft({ title: "", description: "", assigneeId: "", dueAt: "", status });
  }

  function closeTask() {
    if (isSaving) return;
    setSelectedTask(null);
    setDraft(null);
    setActionError("");
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!selectedTask || !draft || isSaving) return;
    setIsSaving(true);
    setActionError("");
    const payload = canManage
      ? { ...draft, description: draft.description.trim() || null, assigneeId: draft.assigneeId || null, dueAt: draft.dueAt || null }
      : { status: draft.status };
    if (canManage && selectedTask.id) payload.milestoneId = draft.milestoneId;
    try {
      const isNewTask = !selectedTask.id;
      const taskUrl = isNewTask
        ? `/api/collabspaces/${encodeURIComponent(collabspaceId)}/milestones/${encodeURIComponent(selectedTask.milestoneId)}/tasks`
        : `/api/collabspaces/${encodeURIComponent(collabspaceId)}/tasks/${encodeURIComponent(selectedTask.id)}`;
      const response = await fetch(taskUrl, {
        method: isNewTask ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not update this task.");
      if (isNewTask) applyTaskCreated(result.task);
      else applyTaskUpdate(result.task);
      setSelectedTask(null);
      setDraft(null);
    } catch (saveError) {
      setActionError(saveError.message || "Could not reach the server. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function canMoveTask(task) {
    return canManage || task.assignee?.id === userId;
  }

  function startTaskDrag(event, task) {
    if (!canMoveTask(task)) {
      event.preventDefault();
      return;
    }
    setDraggedTaskId(task.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  }

  async function moveTask(taskId, status) {
    const task = selectedMilestone?.tasks.find((item) => item.id === taskId);
    if (!task || !canMoveTask(task) || task.status === status || movingTaskId) {
      setDraggedTaskId("");
      return;
    }
    setActionError("");
    setMovingTaskId(taskId);
    try {
      const response = await fetch(`/api/collabspaces/${encodeURIComponent(collabspaceId)}/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not move this task.");
      applyTaskUpdate(result.task);
    } catch (moveError) {
      setActionError(moveError.message || "Could not reach the server. Try again.");
    } finally {
      setDraggedTaskId("");
      setMovingTaskId("");
      setDropTargetStatus("");
    }
  }

  function openMilestoneDialog(milestone = null) {
    setActionError("");
    setMilestoneDraft({ id: milestone?.id ?? "", name: milestone?.name ?? "" });
    setOpenMilestoneMenuId("");
    setMilestoneMenuPosition(null);
  }

  function closeMilestoneDialog() {
    if (isSavingMilestone) return;
    setMilestoneDraft(null);
    setActionError("");
  }

  async function saveMilestone(event) {
    event.preventDefault();
    if (!milestoneDraft || isSavingMilestone) return;
    setIsSavingMilestone(true);
    setActionError("");
    const isNewMilestone = !milestoneDraft.id;
    try {
      const response = await fetch(isNewMilestone
        ? `/api/collabspaces/${encodeURIComponent(collabspaceId)}/milestones`
        : `/api/collabspaces/${encodeURIComponent(collabspaceId)}/milestones/${encodeURIComponent(milestoneDraft.id)}`, {
        method: isNewMilestone ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: milestoneDraft.name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not save this milestone.");
      if (isNewMilestone) applyMilestoneCreated(result.milestone, true);
      else applyMilestoneUpdated(result.milestone);
      setMilestoneDraft(null);
    } catch (saveError) {
      setActionError(saveError.message || "Could not reach the server. Try again.");
    } finally {
      setIsSavingMilestone(false);
    }
  }

  function requestMilestoneDelete(milestone) {
    setOpenMilestoneMenuId("");
    setMilestoneMenuPosition(null);
    setActionError("");
    const taskCount = milestone.tasks.length;
    setConfirmation({
      title: `Delete “${milestone.name}”?`,
      description: taskCount > 0
        ? `This will permanently delete the milestone and all ${taskCount} ${taskCount === 1 ? "task" : "tasks"} in it. This action cannot be undone.`
        : "This will permanently delete the milestone. This action cannot be undone.",
      confirmLabel: taskCount > 0 ? "Delete milestone and tasks" : "Delete milestone",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/collabspaces/${encodeURIComponent(collabspaceId)}/milestones/${encodeURIComponent(milestone.id)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedTaskCount: taskCount }),
          });
          const result = response.status === 204 ? {} : await response.json();
          if (!response.ok) {
            if (response.status === 409) {
                let boardRefreshed = false;
              try {
                const refreshResponse = await fetch(`/api/collabspaces/${encodeURIComponent(collabspaceId)}/taskboard`);
                const refreshed = await refreshResponse.json();
                if (refreshResponse.ok) {
                  const nextMilestones = refreshed.milestones ?? [];
                  setMilestones(nextMilestones);
                  setMembers(refreshed.members ?? []);
                  setSelectedMilestoneId((currentId) => nextMilestones.some((item) => item.id === currentId) ? currentId : nextMilestones[0]?.id ?? "");
                    boardRefreshed = true;
                }
              } catch {
                // Keep the existing board if refreshing after a concurrent update fails.
              }
                throw new Error(boardRefreshed
                  ? "The taskboard changed. Review the updated milestone and confirm deletion again."
                  : "The taskboard changed. Refresh it before confirming deletion again.");
            }
            throw new Error(result.error?.message ?? "Could not delete this milestone.");
          }
          const next = milestones.filter((item) => item.id !== milestone.id);
          setMilestones(next);
          setSelectedMilestoneId((current) => current === milestone.id ? next[0]?.id ?? "" : current);
        } catch (deleteError) {
          setActionError(deleteError.message || "Could not reach the server. Try again.");
        }
      },
    });
  }

  if (isLoading) {
    return <p className="rounded-xl border border-[#293236] p-6 text-center text-muted" role="status">Loading taskboard...</p>;
  }

  if (error) {
    return <p className="rounded-xl border border-[#85434b] p-4 text-sm text-[#ffb6be]" role="alert">{error}</p>;
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[15rem_minmax(0,1fr)] xl:items-start">
      <aside className="grid min-w-0 content-start gap-2 xl:sticky xl:top-4 xl:border-r xl:border-[#293236] xl:pr-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-bold text-ink">Milestones</h2>
          {canManage && <button className="min-h-9 shrink-0 rounded-lg border border-[#354044] bg-transparent px-2.5 text-sm font-semibold text-accent hover:bg-[#192125]" type="button" onClick={() => openMilestoneDialog()}>Add</button>}
        </div>
        <nav className="flex min-w-0 gap-2 overflow-x-auto pb-2 xl:grid xl:gap-1 xl:overflow-visible xl:pb-0" aria-label="Milestones" ref={milestoneMenuRef}>
          {milestones.map((milestone) => {
            const isSelected = milestone.id === selectedMilestoneId || (!selectedMilestoneId && milestone.id === selectedMilestone?.id);
            return (
              <div className="relative flex shrink-0 items-center rounded-lg xl:w-full" key={milestone.id}>
                <button
                  className={`flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-l-lg px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent xl:rounded-lg xl:text-left ${isSelected ? "bg-[#1b302c] text-accent" : "bg-transparent text-muted hover:bg-[#192125] hover:text-ink"}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => { setSelectedMilestoneId(milestone.id); setSelectedStatus("TODO"); setOpenMilestoneMenuId(""); }}
                >
                  <span className="truncate">{milestone.name}</span>
                </button>
                {canManage && <button className={`grid size-10 shrink-0 place-items-center rounded-r-lg border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent xl:rounded-lg ${isSelected ? "bg-[#1b302c] text-accent xl:bg-transparent" : "bg-transparent text-muted hover:bg-[#192125] hover:text-ink"}`} type="button" aria-label={`Actions for ${milestone.name}`} aria-haspopup="menu" aria-expanded={openMilestoneMenuId === milestone.id} aria-controls={`milestone-menu-${milestone.id}`} onClick={(event) => {
                  if (openMilestoneMenuId === milestone.id) {
                    setOpenMilestoneMenuId("");
                    setMilestoneMenuPosition(null);
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  setOpenMilestoneMenuId(milestone.id);
                  setMilestoneMenuPosition({ top: Math.min(rect.bottom + 4, window.innerHeight - 96), left: Math.max(8, Math.min(rect.right - 176, window.innerWidth - 184)) });
                }}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg></button>}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="grid min-w-0 content-start gap-4">
      {openMilestoneMenuId && milestoneMenuPosition && createPortal(
        <div className="fixed z-[90] grid min-w-44 rounded-xl border border-[#303a3e] bg-[#172024] p-1 shadow-xl" data-milestone-menu id={`milestone-menu-${openMilestoneMenuId}`} role="menu" style={milestoneMenuPosition}>
          <button className="min-h-10 rounded-lg border-0 bg-transparent px-3 text-left text-sm text-ink hover:bg-[#20292d]" type="button" role="menuitem" onClick={() => openMilestoneDialog(milestones.find((milestone) => milestone.id === openMilestoneMenuId))}>Rename</button>
          <button className="min-h-10 rounded-lg border-0 bg-transparent px-3 text-left text-sm text-[#ff9aa5] hover:bg-[#302124]" type="button" role="menuitem" onClick={() => {
            const milestone = milestones.find((item) => item.id === openMilestoneMenuId);
            if (milestone) requestMilestoneDelete(milestone);
          }}>Delete</button>
        </div>,
        document.body,
      )}

      {actionError && !selectedTask && !milestoneDraft && <p className="m-0 text-sm text-[#ffb6be]" role="alert">{actionError}</p>}
      {movingTaskId && <p className="m-0 text-sm text-muted" role="status">Moving task...</p>}

      {milestones.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-xl border border-[#293236] p-6 text-center text-muted">
          <p className="m-0">No milestones yet.</p>
        </div>
      )}

      {selectedMilestone && (
        <section className="grid min-w-0 gap-4" aria-label={`${selectedMilestone.name} tasks`}>
          <div className="flex gap-2 overflow-x-auto border-b border-[#293236] md:hidden" role="tablist" aria-label="Task status">
            {columns.map((column) => (
              <button
                key={column.id}
                className={`min-h-10 shrink-0 border-b-2 px-3 text-sm font-semibold ${selectedStatus === column.id ? "border-[#45BD76] text-accent" : "border-transparent text-muted"}`}
                type="button"
                role="tab"
                aria-selected={selectedStatus === column.id}
                onClick={() => setSelectedStatus(column.id)}
              >
                {column.label} <span className="ml-1 text-xs">{selectedMilestone.tasks.filter((task) => task.status === column.id).length}</span>
              </button>
            ))}
          </div>

          <div className="grid min-w-0 gap-5 md:grid-cols-3">
            {columns.map((column) => {
              const tasks = selectedMilestone.tasks.filter((task) => task.status === column.id);
              return (
                <div key={column.id} className={`${selectedStatus === column.id ? "" : "hidden md:block"}`}>
                  <TaskColumn column={column} tasks={tasks} onOpenTask={openTask} onCreateTask={canManage ? openNewTask : null} onMoveTask={moveTask} onTaskDragStart={startTaskDrag} onTaskDragEnd={() => { setDropTargetStatus(""); setDraggedTaskId(""); }} canMoveTask={canMoveTask} draggedTaskId={draggedTaskId} dropTargetStatus={dropTargetStatus} setDropTargetStatus={setDropTargetStatus} movingTaskId={movingTaskId} />
                </div>
              );
            })}
          </div>
        </section>
      )}
      </div>

      {selectedTask && draft && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTask(); }} onKeyDown={(event) => { if (event.key === "Escape") closeTask(); }}>
          <form className="grid h-full w-full content-start gap-4 overflow-y-auto border border-[#293236] bg-[#101512] p-5 sm:h-auto sm:max-h-[min(90dvh,760px)] sm:max-w-xl sm:rounded-2xl sm:p-6" onSubmit={saveTask} role="dialog" aria-modal="true" aria-labelledby="task-details-title">
            <div className="flex items-start justify-between gap-4">
              <h2 className="m-0 text-lg font-bold text-ink" id="task-details-title">{!selectedTask.id ? "Add task" : canManage ? "Edit task" : "Task details"}</h2>
              <button className="grid size-9 shrink-0 place-items-center rounded-lg border-0 bg-transparent text-muted hover:bg-[#20292d] hover:text-ink" type="button" aria-label="Close task details" onClick={closeTask}>×</button>
            </div>

            {canManage ? (
              <>
                <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="task-title">Title
                  <input className="min-h-11 rounded-lg border border-[#354044] bg-[#141A16] px-3 text-base outline-none focus:border-[#48C97B]" id="task-title" maxLength={200} required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="task-description">Details
                  <textarea className="min-h-[72px] resize-y rounded-lg border border-[#354044] bg-[#141A16] p-3 text-base outline-none focus:border-[#48C97B]" id="task-description" maxLength={5000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <div className={`grid gap-3 sm:grid-cols-2 ${selectedTask.id ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
                  <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="task-assignee">Assignee
                    <select className="min-h-11 rounded-lg border border-[#354044] bg-[#141A16] px-3 text-base outline-none focus:border-[#48C97B]" id="task-assignee" value={draft.assigneeId} onChange={(event) => setDraft((current) => ({ ...current, assigneeId: event.target.value }))}>
                      <option value="">Unassigned</option>
                      {members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.id === userId ? " (you)" : ""}</option>)}
                    </select>
                  </label>
                  {selectedTask.id && <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="task-milestone">Milestone
                    <select className="min-h-11 rounded-lg border border-[#354044] bg-[#141A16] px-3 text-base outline-none focus:border-[#48C97B]" id="task-milestone" value={draft.milestoneId} onChange={(event) => setDraft((current) => ({ ...current, milestoneId: event.target.value }))}>
                      {milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}
                    </select>
                  </label>}
                  <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="task-due-date">Due date
                    <input className="min-h-11 rounded-lg border border-[#354044] bg-[#141A16] px-3 text-base outline-none focus:border-[#48C97B]" id="task-due-date" type="date" value={draft.dueAt} onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="task-status">Status
                    <select className="min-h-11 rounded-lg border border-[#354044] bg-[#141A16] px-3 text-base outline-none focus:border-[#48C97B]" id="task-status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                      {columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
                    </select>
                  </label>
                </div>
              </>
            ) : (
              <div className="grid gap-3 rounded-xl border border-[#293236] bg-[#141A16] p-4">
                <h3 className="m-0 break-words font-semibold text-ink">{selectedTask.title}</h3>
                <p className="m-0 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{selectedTask.description || "No details."}</p>
                <p className="m-0 text-sm text-muted">Assigned to {selectedTask.assignee?.name ?? "no one"}{selectedTask.dueAt ? ` · Due ${formatDueDate(selectedTask.dueAt)}` : ""}</p>
              </div>
            )}

            {!canManage && selectedTask.assignee?.id === userId && (
              <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="task-status">Status
                <select className="min-h-11 rounded-lg border border-[#354044] bg-[#141A16] px-3 text-base outline-none focus:border-[#48C97B]" id="task-status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                  {columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
                </select>
              </label>
            )}

            {actionError && <p className="m-0 text-sm text-[#ffb6be]" role="alert">{actionError}</p>}
            <div className="flex justify-end gap-2 border-t border-[#293236] pt-4">
              <button className="min-h-10 rounded-lg border border-[#354044] bg-transparent px-4 text-sm font-semibold text-ink hover:bg-[#20292d]" type="button" onClick={closeTask} disabled={isSaving}>Close</button>
              {(canManage || selectedTask.assignee?.id === userId) && <button className="min-h-10 rounded-lg border-0 bg-[#1b9b76] px-4 text-sm font-bold text-[#061d16] hover:bg-[#24bd91] disabled:opacity-60" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save changes"}</button>}
            </div>
          </form>
        </div>
      )}

      {milestoneDraft && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMilestoneDialog(); }} onKeyDown={(event) => { if (event.key === "Escape") closeMilestoneDialog(); }}>
          <form className="grid h-full w-full content-start gap-4 border border-[#293236] bg-[#101512] p-5 sm:h-auto sm:max-w-lg sm:rounded-2xl sm:p-6" onSubmit={saveMilestone} role="dialog" aria-modal="true" aria-labelledby="milestone-dialog-title">
            <div className="flex items-start justify-between gap-4">
              <h2 className="m-0 text-lg font-bold text-ink" id="milestone-dialog-title">{milestoneDraft.id ? "Rename milestone" : "Add milestone"}</h2>
              <button className="grid size-9 shrink-0 place-items-center rounded-lg border-0 bg-transparent text-muted hover:bg-[#20292d] hover:text-ink" type="button" aria-label="Close milestone dialog" disabled={isSavingMilestone} onClick={closeMilestoneDialog}>×</button>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-ink" htmlFor="milestone-name">Milestone name
              <input autoFocus className="min-h-11 rounded-lg border border-[#354044] bg-[#141A16] px-3 text-base outline-none focus:border-[#48C97B]" id="milestone-name" maxLength={100} required value={milestoneDraft.name} onChange={(event) => setMilestoneDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            {actionError && <p className="m-0 text-sm text-[#ffb6be]" role="alert">{actionError}</p>}
            <div className="flex justify-end gap-2 border-t border-[#293236] pt-4">
              <button className="min-h-10 rounded-lg border border-[#354044] bg-transparent px-4 text-sm font-semibold text-ink hover:bg-[#20292d]" type="button" disabled={isSavingMilestone} onClick={closeMilestoneDialog}>Cancel</button>
              <button className="min-h-10 rounded-lg border-0 bg-[#1b9b76] px-4 text-sm font-bold text-[#061d16] hover:bg-[#24bd91] disabled:opacity-60" type="submit" disabled={isSavingMilestone}>{isSavingMilestone ? "Saving..." : "Save milestone"}</button>
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  );
}
