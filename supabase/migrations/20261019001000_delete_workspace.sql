-- T-11: allow the permanent workspace owner to delete a workspace.

create or replace function public.delete_workspace(p_workspace_id uuid)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Sign in to delete a workspace'; end if;

  perform 1
  from public.workspaces w
  where w.id = p_workspace_id and w.owner_id = caller
  for update;
  if not found then raise exception 'Workspace owner access required'; end if;

  -- Queue file deletion before cascading workspace membership and message rows.
  perform public.enqueue_storage_cleanup_job(
    'workspace-attachments', a.storage_path, array[caller]
  )
  from public.workspace_messages m
  join public.workspace_attachments a on a.message_id = m.id
  where m.workspace_id = p_workspace_id;

  delete from public.notifications n
  where (n.entity_type = 'workspace' and n.entity_id = p_workspace_id)
     or (n.entity_type = 'task' and exists (
       select 1 from public.tasks t
       where t.id = n.entity_id and t.workspace_id = p_workspace_id
     ));

  -- Cascades remove workspace members, chat metadata, tasks, milestones, and showcase.
  delete from public.workspaces where id = p_workspace_id;
end
$$;

revoke all on function public.delete_workspace(uuid) from public, anon;
grant execute on function public.delete_workspace(uuid) to authenticated;
