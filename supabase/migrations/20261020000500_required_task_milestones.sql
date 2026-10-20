-- A task must belong to a milestone. Move any legacy ungrouped tasks into a
-- generated General milestone for their project before enforcing the invariant.
with created_milestones as (
  insert into public.milestones (
    workspace_id,
    title,
    description,
    completion_mode,
    is_completed,
    created_by
  )
  select distinct
    t.workspace_id,
    'General',
    'Tasks that were not assigned to a milestone before milestone assignment became required.',
    'automatic',
    false,
    w.owner_id
  from public.tasks t
  join public.workspaces w on w.id = t.workspace_id
  where t.milestone_id is null
  returning id, workspace_id
)
update public.tasks t
set milestone_id = created_milestones.id
from created_milestones
where t.workspace_id = created_milestones.workspace_id
  and t.milestone_id is null;

alter table public.tasks
  drop constraint if exists tasks_milestone_id_workspace_id_fkey;

alter table public.tasks
  alter column milestone_id set not null;

alter table public.tasks
  add constraint tasks_milestone_id_workspace_id_fkey
  foreign key (milestone_id, workspace_id)
  references public.milestones(id, workspace_id)
  on delete restrict;

create or replace function public.save_workspace_task(
  p_workspace_id uuid,
  p_task_id uuid default null,
  p_title text default '',
  p_description text default null,
  p_milestone_id uuid default null,
  p_due_at timestamptz default null,
  p_assignee_ids uuid[] default '{}'
)
returns uuid
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare caller uuid := auth.uid(); v_task_id uuid; editable boolean; assignee_count integer;
begin
  if caller is null or public.workspace_role(p_workspace_id, caller) not in ('owner','admin') then
    raise exception 'Only project owner or admin can manage tasks';
  end if;
  select w.project_status = 'active' into editable from public.workspaces w where w.id = p_workspace_id;
  if not found then raise exception 'Project not found'; end if;
  if not editable then raise exception 'Project work is read-only'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Task title must be between 1 and 160 characters';
  end if;
  if p_description is not null and length(p_description) > 5000 then
    raise exception 'Task description is too long';
  end if;
  if p_milestone_id is null then
    raise exception 'Select a milestone before saving a task';
  end if;
  if not exists (
    select 1 from public.milestones m
    where m.id = p_milestone_id and m.workspace_id = p_workspace_id
  ) then
    raise exception 'Milestone not found in this project';
  end if;

  select count(distinct member_id)::integer into assignee_count
  from unnest(coalesce(p_assignee_ids, '{}'::uuid[])) as members(member_id);
  if assignee_count <> cardinality(coalesce(p_assignee_ids, '{}'::uuid[])) then
    raise exception 'Choose each assignee only once';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_assignee_ids, '{}'::uuid[])) as members(member_id)
    where not exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = p_workspace_id
        and wm.user_id = members.member_id
        and wm.ended_at is null
    ) and (p_task_id is null or not exists (
      select 1 from public.task_assignees a join public.tasks t on t.id = a.task_id
      where a.task_id = p_task_id and a.user_id = members.member_id
        and t.workspace_id = p_workspace_id and t.status = 'done'
    ))
  ) then
    raise exception 'New assignees must be active project members';
  end if;

  if p_task_id is null then
    insert into public.tasks (workspace_id, milestone_id, title, description, due_at, created_by)
    values (p_workspace_id, p_milestone_id, btrim(p_title), nullif(btrim(p_description), ''), p_due_at, caller)
    returning id into v_task_id;
  else
    update public.tasks set milestone_id = p_milestone_id, title = btrim(p_title),
      description = nullif(btrim(p_description), ''), due_at = p_due_at
    where id = p_task_id and workspace_id = p_workspace_id returning id into v_task_id;
    if not found then raise exception 'Task not found'; end if;
  end if;

  with requested as (
    select distinct member_id from unnest(coalesce(p_assignee_ids, '{}'::uuid[])) as members(member_id)
  ), added as (
    insert into public.task_assignees (task_id, user_id, assigned_by)
    select v_task_id, requested.member_id, caller from requested
    on conflict (task_id, user_id) do nothing returning user_id
  )
  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  select added.user_id, caller, 'task_assigned', 'task', v_task_id
  from added where added.user_id <> caller;

  delete from public.task_assignees a where a.task_id = v_task_id
    and not (a.user_id = any(coalesce(p_assignee_ids, '{}'::uuid[])));
  return v_task_id;
end $$;

create or replace function public.delete_workspace_milestone(p_milestone_id uuid)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare target_workspace uuid; editable boolean;
begin
  select m.workspace_id into target_workspace
  from public.milestones m where m.id = p_milestone_id for update;
  if not found or auth.uid() is null
    or public.workspace_role(target_workspace, auth.uid()) not in ('owner','admin') then
    raise exception 'Milestone not found or not allowed';
  end if;
  select w.project_status = 'active' into editable
  from public.workspaces w where w.id = target_workspace;
  if not editable then raise exception 'Project work is read-only'; end if;
  if exists (select 1 from public.tasks t where t.milestone_id = p_milestone_id) then
    raise exception 'Move or delete this milestone’s tasks before deleting the milestone';
  end if;
  delete from public.milestones where id = p_milestone_id;
end $$;

revoke all on function public.save_workspace_task(uuid, uuid, text, text, uuid, timestamptz, uuid[]) from public, anon;
revoke all on function public.delete_workspace_milestone(uuid) from public, anon;
grant execute on function public.save_workspace_task(uuid, uuid, text, text, uuid, timestamptz, uuid[]) to authenticated;
grant execute on function public.delete_workspace_milestone(uuid) to authenticated;
