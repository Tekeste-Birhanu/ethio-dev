-- T-01: deny-by-default row security and atomic collaboration workflows.
-- Storage object policies and cleanup operations follow in the next migration.

create or replace function public.is_workspace_member(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.workspace_memberships m
    where m.workspace_id = p_workspace_id and m.user_id = p_user_id and m.ended_at is null
      and p_user_id is not distinct from auth.uid()
  )
$$;

create or replace function public.workspace_role(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns text
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select m.role from public.workspace_memberships m
  where m.workspace_id = p_workspace_id and m.user_id = p_user_id and m.ended_at is null
    and p_user_id is not distinct from auth.uid()
  limit 1
$$;

create or replace function public.can_view_opportunity(p_opportunity_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.opportunities o
    where o.id = p_opportunity_id and o.deleted_at is null
  ) or exists (
    select 1 from public.collaboration_requests r
    join public.opportunities o on o.id = r.opportunity_id
    where r.opportunity_id = p_opportunity_id
      and (r.applicant_id = p_user_id or o.creator_id = p_user_id)
      and r.status = 'accepted' and o.deleted_at is not null
      and p_user_id is not distinct from auth.uid()
  ) or exists (
    select 1 from public.workspaces w
    where w.opportunity_id = p_opportunity_id and public.is_workspace_member(w.id, p_user_id)
      and p_user_id is not distinct from auth.uid()
  )
$$;

create or replace function public.can_access_private_conversation(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.private_conversations c
    where c.id = p_conversation_id and c.status = 'active'
      and p_user_id in (c.participant_a, c.participant_b)
      and p_user_id is not distinct from auth.uid()
  )
$$;

revoke all on function public.is_workspace_member(uuid, uuid) from public;
revoke all on function public.workspace_role(uuid, uuid) from public;
revoke all on function public.can_view_opportunity(uuid, uuid) from public;
revoke all on function public.can_access_private_conversation(uuid, uuid) from public;
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.workspace_role(uuid, uuid) to authenticated;
grant execute on function public.can_view_opportunity(uuid, uuid) to authenticated;
grant execute on function public.can_view_opportunity(uuid, uuid) to anon;
grant execute on function public.can_access_private_conversation(uuid, uuid) to authenticated;

create or replace function public.is_verified_user(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select p_user_id is not distinct from auth.uid() and exists (
    select 1 from auth.users u where u.id = p_user_id and u.email_confirmed_at is not null
  )
$$;
revoke all on function public.is_verified_user(uuid) from public;
grant execute on function public.is_verified_user(uuid) to authenticated;

create or replace function public.add_skill(p_name text)
returns uuid language plpgsql security definer
set search_path = '' set row_security = off
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to add a skill'; end if;
  return public.get_or_create_skill(p_name, auth.uid());
end $$;
revoke all on function public.add_skill(text) from public;
grant execute on function public.add_skill(text) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'cities','profiles','skills','profile_skills','profile_links','opportunities',
    'opportunity_skills','opportunity_likes','comments','collaboration_requests',
    'private_conversations','private_messages','private_attachments','workspaces',
    'workspace_memberships','workspace_messages','workspace_attachments','milestones',
    'tasks','task_assignees','showcases','showcase_links','notifications','storage_cleanup_jobs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Public discovery data.
create policy cities_public_read on public.cities for select to anon, authenticated using (is_active);
create policy profiles_public_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_insert_self on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy skills_public_read on public.skills for select to anon, authenticated using (true);
create policy profile_skills_public_read on public.profile_skills for select to anon, authenticated using (true);
create policy profile_skills_manage_self on public.profile_skills for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profile_links_public_read on public.profile_links for select to anon, authenticated using (true);
create policy profile_links_manage_self on public.profile_links for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy opportunities_public_or_collaborator_read on public.opportunities for select to anon, authenticated
  using (public.can_view_opportunity(id));
create policy opportunities_insert_verified_self on public.opportunities for insert to authenticated
  with check (
    creator_id = (select auth.uid()) and status = 'open' and deleted_at is null
    and public.is_verified_user()
  );
create policy opportunity_skills_public_read on public.opportunity_skills for select to anon, authenticated
  using (public.can_view_opportunity(opportunity_id));
create policy opportunity_skills_manage_creator on public.opportunity_skills for all to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id and o.creator_id = (select auth.uid()) and o.deleted_at is null))
  with check (exists (select 1 from public.opportunities o where o.id = opportunity_id and o.creator_id = (select auth.uid()) and o.deleted_at is null));

-- Like identities remain private; clients can only see their own row.
create policy opportunity_likes_read_self on public.opportunity_likes for select to authenticated
  using (user_id = (select auth.uid()));
create policy opportunity_likes_insert_self on public.opportunity_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.opportunities o where o.id = opportunity_id and o.deleted_at is null
  ));
create policy opportunity_likes_delete_self on public.opportunity_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create view public.opportunity_like_counts as
  select l.opportunity_id, count(*)::bigint as like_count
  from public.opportunity_likes l
  join public.opportunities o on o.id = l.opportunity_id
  where o.deleted_at is null
  group by l.opportunity_id;
grant select on public.opportunity_like_counts to anon, authenticated;

create or replace function public.guard_comment_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.opportunity_id <> old.opportunity_id or new.author_id <> old.author_id
     or new.parent_comment_id is distinct from old.parent_comment_id or new.created_at <> old.created_at then
    raise exception 'Comment identity and thread position cannot be changed';
  end if;
  if old.deleted_at is not null then raise exception 'Deleted comments cannot be restored'; end if;
  if new.deleted_at is not null and new.body is not null then raise exception 'Deleted comment body must be cleared'; end if;
  if new.deleted_at is null and (new.body is null or length(btrim(new.body)) = 0) then
    raise exception 'Comment body is required';
  end if;
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  return new;
end $$;
create trigger comments_guard_update before update on public.comments
  for each row execute function public.guard_comment_update();

create policy comments_public_read on public.comments for select to anon, authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id and o.deleted_at is null));
create policy comments_insert_self on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and deleted_at is null and body is not null
    and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.deleted_at is null));
create policy comments_update_author on public.comments for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null and exists (
    select 1 from public.opportunities o where o.id = opportunity_id and o.deleted_at is null
  ))
  with check (author_id = (select auth.uid()));
-- Comment deletion is a tombstone update; physical deletes are reserved for opportunity cleanup.

-- Requests are visible only to the applicant and listing creator.
create policy requests_read_parties on public.collaboration_requests for select to authenticated
  using (applicant_id = (select auth.uid()) or exists (
    select 1 from public.opportunities o where o.id = opportunity_id and o.creator_id = (select auth.uid())
  ));

-- Private chat history is available only to current participants of an active conversation.
create policy private_conversations_read_participants on public.private_conversations for select to authenticated
  using (status = 'active' and (participant_a = (select auth.uid()) or participant_b = (select auth.uid())));
create policy private_messages_read_participants on public.private_messages for select to authenticated
  using (public.can_access_private_conversation(conversation_id));
create policy private_attachments_read_participants on public.private_attachments for select to authenticated
  using (exists (select 1 from public.private_messages m where m.id = message_id
    and public.can_access_private_conversation(m.conversation_id)));

-- Current workspace members can see workspace data; membership history is hidden from nonmembers.
create policy workspaces_read_members on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
create policy memberships_read_members on public.workspace_memberships for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy workspace_messages_read_members on public.workspace_messages for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy workspace_attachments_read_members on public.workspace_attachments for select to authenticated
  using (exists (select 1 from public.workspace_messages m where m.id = message_id
    and public.is_workspace_member(m.workspace_id)));
create policy milestones_read_members on public.milestones for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy tasks_read_members on public.tasks for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy task_assignees_read_members on public.task_assignees for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id)));
create policy showcases_public_read on public.showcases for select to anon, authenticated
  using (status = 'published' or public.is_workspace_member(workspace_id));
create policy showcase_links_public_read on public.showcase_links for select to anon, authenticated
  using (exists (select 1 from public.showcases s where s.id = showcase_id
    and (s.status = 'published' or public.is_workspace_member(s.workspace_id))));
create policy notifications_read_recipient on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
-- Notification rows are immutable to clients apart from the read marker RPC below.

-- Atomic request operations. Direct request table writes have no RLS policies.
create or replace function public.request_to_join(p_opportunity_id uuid, p_message text default null)
returns uuid
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare caller uuid := auth.uid(); new_request_id uuid;
begin
  if caller is null then raise exception 'Sign in to request collaboration'; end if;
  if not public.is_verified_user(caller) then
    raise exception 'Verify your email before requesting to join';
  end if;
  if p_message is not null and length(p_message) > 2000 then raise exception 'Message is too long'; end if;
  perform 1 from public.opportunities o where o.id = p_opportunity_id
    and o.status = 'open' and o.deleted_at is null and o.creator_id <> caller for update;
  if not found then
    raise exception 'Opportunity is unavailable for requests';
  end if;
  insert into public.collaboration_requests (opportunity_id, applicant_id, message)
  values (p_opportunity_id, caller, nullif(btrim(p_message), '')) returning id into new_request_id;
  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  select o.creator_id, caller, 'request_received', 'collaboration_request', new_request_id
  from public.opportunities o where o.id = p_opportunity_id;
  return new_request_id;
end $$;

create or replace function public.delete_comment(p_comment_id uuid)
returns void language plpgsql security definer
set search_path = '' set row_security = off
as $$
declare comment_row public.comments%rowtype; caller uuid := auth.uid();
begin
  select c.* into comment_row from public.comments c where c.id = p_comment_id for update;
  if not found or comment_row.deleted_at is not null then raise exception 'Comment not found'; end if;
  if comment_row.author_id <> caller and not exists (
    select 1 from public.opportunities o where o.id = comment_row.opportunity_id and o.creator_id = caller
  ) then raise exception 'Not allowed to delete this comment'; end if;
  update public.comments set body = null, deleted_at = now() where id = p_comment_id;
end $$;

create or replace function public.withdraw_request(p_request_id uuid)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
begin
  update public.collaboration_requests set status = 'withdrawn', decided_at = now()
  where id = p_request_id and applicant_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Pending request not found'; end if;
end $$;

create or replace function public.decide_request(p_request_id uuid, p_accept boolean, p_path text default null)
returns uuid
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare caller uuid := auth.uid(); req public.collaboration_requests%rowtype;
  owner_id uuid; conversation_id uuid; workspace_id uuid; opportunity_id uuid;
begin
  select r.opportunity_id into opportunity_id from public.collaboration_requests r where r.id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  perform 1 from public.opportunities o where o.id = opportunity_id and o.creator_id = caller for update;
  if not found then raise exception 'Request not found'; end if;
  select r.* into req from public.collaboration_requests r where r.id = p_request_id for update;
  if not found or req.status <> 'pending' then raise exception 'Pending request not found'; end if;
  if p_accept and p_path not in ('private_chat','workspace') then
    raise exception 'Choose private_chat or workspace when accepting';
  end if;
  if p_accept then
    update public.collaboration_requests set status = 'accepted', acceptance_path = p_path, decided_at = now()
      where id = req.id;
    if p_path = 'private_chat' then
      select creator_id into owner_id from public.opportunities where id = req.opportunity_id;
      insert into public.private_conversations (request_id, participant_a, participant_b)
      values (req.id, owner_id, req.applicant_id) returning id into conversation_id;
    else
      select creator_id into owner_id from public.opportunities where id = req.opportunity_id;
      insert into public.workspaces (opportunity_id, owner_id, created_by)
      values (req.opportunity_id, owner_id, owner_id)
      on conflict (opportunity_id) do update set opportunity_id = excluded.opportunity_id
      returning id into workspace_id;
      insert into public.workspace_memberships (workspace_id, user_id, role, invited_by)
      values (workspace_id, req.applicant_id, 'member', caller)
      on conflict (workspace_id, user_id) where ended_at is null do nothing;
      conversation_id := workspace_id;
    end if;
  else
    update public.collaboration_requests set status = 'rejected', decided_at = now() where id = req.id;
  end if;
  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  values (req.applicant_id, caller, 'request_decided', 'collaboration_request', req.id);
  return conversation_id;
end $$;

create or replace function public.set_opportunity_status(p_opportunity_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
begin
  if p_status not in ('open','closed') then raise exception 'Invalid opportunity status'; end if;
  update public.opportunities set status = p_status
  where id = p_opportunity_id and creator_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'Opportunity not found'; end if;
  if p_status = 'closed' then
    delete from public.collaboration_requests where opportunity_id = p_opportunity_id and status = 'pending';
  end if;
end $$;

create or replace function public.set_project_status(p_workspace_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare current_status text; owner_id uuid;
begin
  select project_status, w.owner_id into current_status, owner_id
  from public.workspaces w where w.id = p_workspace_id for update;
  if not found or owner_id <> auth.uid() then raise exception 'Workspace owner not found'; end if;
  if p_status not in ('active','paused','completed','abandoned') then raise exception 'Invalid project status'; end if;
  if current_status in ('completed','abandoned') and p_status <> current_status then
    raise exception 'Completed and abandoned projects are final';
  end if;
  if p_status = current_status then return; end if;
  update public.workspaces set project_status = p_status where id = p_workspace_id;
  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  select m.user_id, auth.uid(), 'project_status_changed', 'workspace', p_workspace_id
  from public.workspace_memberships m where m.workspace_id = p_workspace_id and m.ended_at is null
    and m.user_id <> auth.uid();
end $$;

create or replace function public.invite_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare caller uuid := auth.uid(); membership_id uuid;
begin
  if public.workspace_role(p_workspace_id, caller) not in ('owner','admin') then
    raise exception 'Only workspace owner or admin can invite members';
  end if;
  if p_user_id = (select owner_id from public.workspaces where id = p_workspace_id) then
    raise exception 'Workspace owner is already a member';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = p_user_id) then raise exception 'Profile not found'; end if;
  insert into public.workspace_memberships (workspace_id, user_id, role, invited_by)
  values (p_workspace_id, p_user_id, 'member', caller) returning id into membership_id;
  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  values (p_user_id, caller, 'workspace_invite', 'workspace', p_workspace_id);
  return membership_id;
end $$;

create or replace function public.set_workspace_admin(p_workspace_id uuid, p_user_id uuid, p_make_admin boolean)
returns void language plpgsql security definer
set search_path = '' set row_security = off
as $$
begin
  if public.workspace_role(p_workspace_id, auth.uid()) <> 'owner' then
    raise exception 'Only the workspace owner can appoint admins';
  end if;
  update public.workspace_memberships
  set role = case when p_make_admin then 'admin' else 'member' end
  where workspace_id = p_workspace_id and user_id = p_user_id and ended_at is null and role <> 'owner';
  if not found then raise exception 'Active non-owner membership not found'; end if;
end $$;

create or replace function public.end_workspace_membership(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare caller uuid := auth.uid(); target_role text; caller_role text;
begin
  select role into target_role from public.workspace_memberships
  where workspace_id = p_workspace_id and user_id = p_user_id and ended_at is null for update;
  if not found then raise exception 'Active membership not found'; end if;
  if target_role = 'owner' then raise exception 'Workspace owner cannot leave or be removed'; end if;
  caller_role := public.workspace_role(p_workspace_id, caller);
  if caller <> p_user_id and caller_role not in ('owner','admin') then raise exception 'Not allowed to remove this member'; end if;
  if caller = p_user_id and caller_role is null then raise exception 'Not an active workspace member'; end if;
  update public.workspace_memberships set ended_at = now(), ended_reason = case when caller = p_user_id then 'left' else 'removed' end
    where workspace_id = p_workspace_id and user_id = p_user_id and ended_at is null;
  delete from public.task_assignees a using public.tasks t
    where a.task_id = t.id and t.workspace_id = p_workspace_id and t.status <> 'done' and a.user_id = p_user_id;
  if caller <> p_user_id then
    insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
    values (p_user_id, caller, 'member_removed', 'workspace', p_workspace_id);
  end if;
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
  select project_status = 'active' or inactive_work_editable into editable
    from public.workspaces where id = task_row.workspace_id;
  role := public.workspace_role(task_row.workspace_id, caller);
  if not editable then raise exception 'Workspace work is read-only'; end if;
  if role not in ('owner','admin') and not exists (
    select 1 from public.task_assignees a where a.task_id = p_task_id and a.user_id = caller
  ) then raise exception 'Only an assignee can update this task'; end if;
  update public.tasks set status = p_status where id = p_task_id;
end $$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer
set search_path = '' set row_security = off
as $$
begin
  update public.notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_id = auth.uid();
  if not found then raise exception 'Notification not found'; end if;
end $$;

revoke all on function public.request_to_join(uuid, text) from public;
revoke all on function public.delete_comment(uuid) from public;
revoke all on function public.withdraw_request(uuid) from public;
revoke all on function public.decide_request(uuid, boolean, text) from public;
revoke all on function public.set_opportunity_status(uuid, text) from public;
revoke all on function public.set_project_status(uuid, text) from public;
revoke all on function public.invite_workspace_member(uuid, uuid) from public;
revoke all on function public.set_workspace_admin(uuid, uuid, boolean) from public;
revoke all on function public.end_workspace_membership(uuid, uuid) from public;
revoke all on function public.update_assigned_task_status(uuid, text) from public;
revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.request_to_join(uuid, text) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;
grant execute on function public.withdraw_request(uuid) to authenticated;
grant execute on function public.decide_request(uuid, boolean, text) to authenticated;
grant execute on function public.set_opportunity_status(uuid, text) to authenticated;
grant execute on function public.set_project_status(uuid, text) to authenticated;
grant execute on function public.invite_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.set_workspace_admin(uuid, uuid, boolean) to authenticated;
grant execute on function public.end_workspace_membership(uuid, uuid) to authenticated;
grant execute on function public.update_assigned_task_status(uuid, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
