-- Let collaboration participants see whether their private-chat tombstone ended.
-- Message history and attachments remain inaccessible after the conversation ends.
create or replace function public.get_private_conversation_state(p_request_id uuid)
returns table (conversation_id uuid, status text)
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Sign in to view collaboration status'; end if;
  if not exists (
    select 1
    from public.collaboration_requests r
    join public.opportunities o on o.id = r.opportunity_id
    where r.id = p_request_id
      and r.status = 'accepted'
      and r.acceptance_path = 'private_chat'
      and caller in (r.applicant_id, o.creator_id)
  ) then
    raise exception 'Private collaboration not found';
  end if;

  return query
  select c.id, c.status
  from public.private_conversations c
  where c.request_id = p_request_id;
end
$$;

revoke all on function public.get_private_conversation_state(uuid) from public, anon;
grant execute on function public.get_private_conversation_state(uuid) to authenticated;
