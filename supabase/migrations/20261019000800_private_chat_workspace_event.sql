alter table public.private_messages
  add column message_type text not null default 'user'
    check (message_type in ('user', 'system')),
  add column workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.private_messages
  add constraint private_messages_workspace_event_check
  check (
    (message_type = 'user' and workspace_id is null)
    or (message_type = 'system' and workspace_id is not null)
  );

create or replace function public.add_private_collaborator_to_workspace(p_request_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare
  caller uuid := auth.uid();
  target_opportunity_id uuid;
  target_conversation_id uuid;
  owner_id uuid;
  owner_name text;
  applicant_id uuid;
  applicant_name text;
  new_workspace_id uuid;
  membership_id uuid;
begin
  if caller is null then raise exception 'Sign in to create a workspace'; end if;

  select
    r.opportunity_id,
    c.id,
    o.creator_id,
    coalesce(owner_profile.display_name, 'Project creator'),
    r.applicant_id,
    coalesce(applicant_profile.display_name, 'Collaborator')
  into
    target_opportunity_id,
    target_conversation_id,
    owner_id,
    owner_name,
    applicant_id,
    applicant_name
  from public.collaboration_requests r
  join public.opportunities o on o.id = r.opportunity_id
  join public.private_conversations c
    on c.request_id = r.id and c.status = 'active'
  left join public.profiles owner_profile on owner_profile.user_id = o.creator_id
  left join public.profiles applicant_profile on applicant_profile.user_id = r.applicant_id
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

  select w.id into new_workspace_id
  from public.workspaces w
  where w.opportunity_id = target_opportunity_id;
  if new_workspace_id is null then
    raise exception 'Workspace could not be created';
  end if;

  insert into public.workspace_memberships (
    workspace_id,
    user_id,
    role,
    invited_by
  )
  values (new_workspace_id, applicant_id, 'member', caller)
  on conflict (workspace_id, user_id) where ended_at is null do nothing
  returning id into membership_id;

  if membership_id is not null then
    insert into public.notifications (
      recipient_id,
      actor_id,
      event_type,
      entity_type,
      entity_id
    )
    values (
      applicant_id,
      caller,
      'workspace_invite',
      'workspace',
      new_workspace_id
    );

    insert into public.private_messages (
      conversation_id,
      sender_id,
      body,
      message_type,
      workspace_id
    )
    values (
      target_conversation_id,
      caller,
      owner_name || ' added ' || applicant_name || ' to the workspace.',
      'system',
      new_workspace_id
    );
  end if;

  return new_workspace_id;
end
$$;

revoke all on function public.add_private_collaborator_to_workspace(uuid)
from public, anon;
grant execute on function public.add_private_collaborator_to_workspace(uuid)
to authenticated;
