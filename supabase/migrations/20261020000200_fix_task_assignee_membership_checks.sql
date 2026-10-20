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
declare
  caller uuid := auth.uid();
  v_task_id uuid;
  editable boolean;
  assignee_count integer;
begin
  if caller is null or public.workspace_role(p_workspace_id, caller) not in ('owner','admin') then
    raise exception 'Only workspace owner or admin can manage tasks';
  end if;
  select w.project_status = 'active' or w.inactive_work_editable into editable
    from public.workspaces w where w.id = p_workspace_id;
  if not found then raise exception 'Workspace not found'; end if;
  if not editable then raise exception 'Workspace work is read-only'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Task title must be between 1 and 160 characters';
  end if;
  if p_description is not null and length(p_description) > 5000 then
    raise exception 'Task description is too long';
  end if;
  if p_milestone_id is not null and not exists (
    select 1 from public.milestones m where m.id = p_milestone_id and m.workspace_id = p_workspace_id
  ) then raise exception 'Milestone not found in this workspace'; end if;

  select count(distinct member_id)::integer into assignee_count
  from unnest(coalesce(p_assignee_ids, '{}'::uuid[])) as members(member_id);
  if assignee_count <> cardinality(coalesce(p_assignee_ids, '{}'::uuid[])) then
    raise exception 'Choose each assignee only once';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_assignee_ids, '{}'::uuid[])) as members(member_id)
    where not exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = p_workspace_id and wm.user_id = members.member_id and wm.ended_at is null
    )
      and (p_task_id is null or not exists (
        select 1 from public.task_assignees a join public.tasks t on t.id = a.task_id
        where a.task_id = p_task_id and a.user_id = members.member_id
          and t.workspace_id = p_workspace_id and t.status = 'done'
      ))
  ) then raise exception 'New assignees must be active workspace members'; end if;

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
    on conflict (task_id, user_id) do nothing
    returning user_id
  )
  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  select added.user_id, caller, 'task_assigned', 'task', v_task_id
  from added where added.user_id <> caller;

  delete from public.task_assignees a where a.task_id = v_task_id
    and not (a.user_id = any(coalesce(p_assignee_ids, '{}'::uuid[])));
  return v_task_id;
end $$;

create or replace function public.update_assigned_task_status(p_task_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare caller uuid := auth.uid(); task_row public.tasks%rowtype; role text; editable boolean;
begin
  if p_status not in ('to_do','in_progress','done') then raise exception 'Invalid task status'; end if;
  select t.* into task_row from public.tasks t where t.id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if not public.is_workspace_member(task_row.workspace_id, caller) then raise exception 'Not an active member'; end if;
  select w.project_status = 'active' or w.inactive_work_editable into editable
    from public.workspaces w where w.id = task_row.workspace_id;
  role := public.workspace_role(task_row.workspace_id, caller);
  if not editable then raise exception 'Workspace work is read-only'; end if;
  if role not in ('owner','admin') and not exists (
    select 1 from public.task_assignees a where a.task_id = p_task_id and a.user_id = caller
  ) then raise exception 'Only an assignee can update this task'; end if;
  if task_row.status = 'done' and p_status <> 'done' then
    delete from public.task_assignees a where a.task_id = p_task_id
      and not exists (
        select 1 from public.workspace_memberships wm
        where wm.workspace_id = task_row.workspace_id and wm.user_id = a.user_id and wm.ended_at is null
      );
  end if;
  update public.tasks set status = p_status where id = p_task_id;
end $$;

revoke all on function public.save_workspace_task(uuid, uuid, text, text, uuid, timestamptz, uuid[]) from public, anon;
revoke all on function public.update_assigned_task_status(uuid, text) from public, anon;
grant execute on function public.save_workspace_task(uuid, uuid, text, text, uuid, timestamptz, uuid[]) to authenticated;
grant execute on function public.update_assigned_task_status(uuid, text) to authenticated;
