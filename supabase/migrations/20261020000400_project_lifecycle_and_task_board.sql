-- Use the project lifecycle agreed for the product and enforce board permissions.

alter table public.workspaces
  drop constraint if exists workspaces_project_status_check;

-- Previously abandoned projects remain available as paused projects so their
-- members can resume them or the owner can delete them explicitly.
update public.workspaces set project_status = 'paused'
where project_status = 'abandoned';

alter table public.workspaces
  add constraint workspaces_project_status_check
  check (project_status in ('active', 'paused', 'completed'));

create or replace function public.set_project_status(p_workspace_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare caller uuid := auth.uid(); current_status text; owner_id uuid;
begin
  if caller is null then raise exception 'Sign in to change project status'; end if;
  if p_status is null or p_status not in ('active', 'paused', 'completed') then
    raise exception 'Invalid project status';
  end if;
  select w.project_status, w.owner_id into current_status, owner_id
  from public.workspaces w where w.id = p_workspace_id for update;
  if not found or owner_id <> caller then raise exception 'Project owner access required'; end if;
  if current_status = 'completed' and p_status <> 'completed' then
    raise exception 'Completed projects are final';
  end if;
  if p_status = current_status then return; end if;
  update public.workspaces set project_status = p_status where id = p_workspace_id;
  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  select m.user_id, caller, 'project_status_changed', 'workspace', p_workspace_id
  from public.workspace_memberships m
  where m.workspace_id = p_workspace_id and m.ended_at is null and m.user_id <> caller;
end $$;

create or replace function public.update_assigned_task_status(p_task_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare caller uuid := auth.uid(); task_row public.tasks%rowtype; role text; editable boolean;
begin
  if p_status is null or p_status not in ('to_do', 'in_progress', 'done') then
    raise exception 'Invalid task status';
  end if;
  select t.* into task_row from public.tasks t where t.id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if not public.is_workspace_member(task_row.workspace_id, caller) then
    raise exception 'Not an active project member';
  end if;
  select w.project_status = 'active' into editable
  from public.workspaces w where w.id = task_row.workspace_id;
  if not editable then raise exception 'Project work is read-only'; end if;
  role := public.workspace_role(task_row.workspace_id, caller);
  if role not in ('owner', 'admin') and not exists (
    select 1 from public.task_assignees a
    where a.task_id = p_task_id and a.user_id = caller
  ) then
    raise exception 'Only project admins or task assignees can update status';
  end if;
  if task_row.status = 'done' and p_status <> 'done' then
    delete from public.task_assignees a where a.task_id = p_task_id and not exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = task_row.workspace_id
        and wm.user_id = a.user_id and wm.ended_at is null
    );
  end if;
  update public.tasks set status = p_status where id = p_task_id;
end $$;

revoke all on function public.set_project_status(uuid, text) from public, anon;
revoke all on function public.update_assigned_task_status(uuid, text) from public, anon;
grant execute on function public.set_project_status(uuid, text) to authenticated;
grant execute on function public.update_assigned_task_status(uuid, text) to authenticated;
