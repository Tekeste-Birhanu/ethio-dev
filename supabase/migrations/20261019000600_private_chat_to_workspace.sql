create or replace function public.add_private_collaborator_to_workspace(p_request_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare
  caller uuid := auth.uid();
  target_opportunity_id uuid;
  owner_id uuid;
  applicant_id uuid;
  workspace_id uuid;
  membership_id uuid;
begin
  if caller is null then raise exception 'Sign in to create a workspace'; end if;

  select r.opportunity_id, o.creator_id, r.applicant_id
  into target_opportunity_id, owner_id, applicant_id
  from public.collaboration_requests r
  join public.opportunities o on o.id = r.opportunity_id
  where r.id = p_request_id
    and r.status = 'accepted'
    and r.acceptance_path = 'private_chat'
  for update of o;

  if not found or owner_id <> caller then
    raise exception 'Accepted private collaboration not found';
  end if;

  insert into public.workspaces (opportunity_id, owner_id, created_by)
  values (target_opportunity_id, owner_id, owner_id)
  on conflict (opportunity_id) do nothing;

  select w.id into workspace_id
  from public.workspaces w
  where w.opportunity_id = target_opportunity_id;
  if workspace_id is null then raise exception 'Workspace could not be created'; end if;

  insert into public.workspace_memberships (workspace_id, user_id, role, invited_by)
  values (workspace_id, applicant_id, 'member', caller)
  on conflict (workspace_id, user_id) where ended_at is null do nothing
  returning id into membership_id;

  if membership_id is not null then
    insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
    values (applicant_id, caller, 'workspace_invite', 'workspace', workspace_id);
  end if;

  return workspace_id;
end
$$;

revoke all on function public.add_private_collaborator_to_workspace(uuid) from public, anon;
grant execute on function public.add_private_collaborator_to_workspace(uuid) to authenticated;
