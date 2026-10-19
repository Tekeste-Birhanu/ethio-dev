create or replace function public.create_workspace(p_opportunity_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare
  caller uuid := auth.uid();
  new_workspace_id uuid;
begin
  if caller is null then raise exception 'Sign in to create a workspace'; end if;

  perform 1
  from public.opportunities o
  where o.id = p_opportunity_id and o.creator_id = caller
  for update;
  if not found then raise exception 'Opportunity not found'; end if;

  if not exists (
    select 1 from public.collaboration_requests r
    where r.opportunity_id = p_opportunity_id and r.status = 'accepted'
  ) then
    raise exception 'Accept at least one collaboration request before creating a workspace';
  end if;

  if exists (
    select 1 from public.workspaces w where w.opportunity_id = p_opportunity_id
  ) then
    raise exception 'A workspace already exists for this opportunity';
  end if;

  insert into public.workspaces (opportunity_id, owner_id, created_by)
  values (p_opportunity_id, caller, caller)
  returning id into new_workspace_id;

  return new_workspace_id;
end
$$;

revoke all on function public.create_workspace(uuid) from public, anon;
grant execute on function public.create_workspace(uuid) to authenticated;
