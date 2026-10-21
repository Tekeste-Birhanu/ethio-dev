alter table public.notifications
  drop constraint if exists notifications_event_type_check;

alter table public.notifications
  add constraint notifications_event_type_check
  check (event_type in (
    'request_received', 'request_decided', 'workspace_invite', 'member_joined',
    'member_left', 'member_removed', 'member_role_changed', 'task_assigned', 'project_status_changed',
    'opportunity_liked', 'comment_added', 'comment_replied'
  ));

create or replace function public.notify_opportunity_like()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  select o.creator_id, new.user_id, 'opportunity_liked', 'opportunity', o.id
  from public.opportunities o
  where o.id = new.opportunity_id
    and o.creator_id <> new.user_id
    and o.deleted_at is null;
  return new;
end
$$;

create trigger opportunity_like_notification
after insert on public.opportunity_likes
for each row execute function public.notify_opportunity_like();

create or replace function public.notify_opportunity_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  owner_id uuid;
  parent_author_id uuid;
  notification_type text;
begin
  select o.creator_id into owner_id
  from public.opportunities o
  where o.id = new.opportunity_id and o.deleted_at is null;
  if owner_id is null then return new; end if;

  notification_type := case when new.parent_comment_id is null
    then 'comment_added' else 'comment_replied' end;

  if new.parent_comment_id is not null then
    select c.author_id into parent_author_id
    from public.comments c where c.id = new.parent_comment_id;
    if parent_author_id is not null and parent_author_id <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
      values (parent_author_id, new.author_id, notification_type, 'comment', new.id);
    end if;
  end if;

  if owner_id <> new.author_id and (parent_author_id is null or owner_id <> parent_author_id) then
    insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
    values (owner_id, new.author_id, notification_type, 'comment', new.id);
  end if;
  return new;
end
$$;

create trigger opportunity_comment_notification
after insert on public.comments
for each row execute function public.notify_opportunity_comment();

create or replace function public.notify_workspace_member_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  select m.user_id, new.user_id, 'member_joined', 'workspace', new.workspace_id
  from public.workspace_memberships m
  where m.workspace_id = new.workspace_id
    and m.ended_at is null
    and m.user_id <> new.user_id;
  return new;
end
$$;

create trigger workspace_member_joined_notification
after insert on public.workspace_memberships
for each row execute function public.notify_workspace_member_joined();

create or replace function public.notify_workspace_member_left()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if old.ended_at is null and new.ended_at is not null and new.ended_reason = 'left' then
    insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
    select m.user_id, new.user_id, 'member_left', 'workspace', new.workspace_id
    from public.workspace_memberships m
    where m.workspace_id = new.workspace_id
      and m.ended_at is null
      and m.user_id <> new.user_id;
  end if;
  return new;
end
$$;

create trigger workspace_member_left_notification
after update of ended_at, ended_reason on public.workspace_memberships
for each row execute function public.notify_workspace_member_left();

create or replace function public.set_workspace_admin(p_workspace_id uuid, p_user_id uuid, p_make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  old_role text;
  new_role text := case when p_make_admin then 'admin' else 'member' end;
begin
  if public.workspace_role(p_workspace_id, auth.uid()) <> 'owner' then
    raise exception 'Only the workspace owner can appoint admins';
  end if;
  select m.role into old_role
  from public.workspace_memberships m
  where m.workspace_id = p_workspace_id
    and m.user_id = p_user_id
    and m.ended_at is null
  for update;
  if not found or old_role = 'owner' then raise exception 'Active non-owner membership not found'; end if;
  if old_role = new_role then return; end if;
  update public.workspace_memberships m
  set role = new_role
  where m.workspace_id = p_workspace_id and m.user_id = p_user_id and m.ended_at is null;

  insert into public.notifications (recipient_id, actor_id, event_type, entity_type, entity_id)
  values (p_user_id, auth.uid(), 'member_role_changed', 'workspace', p_workspace_id);
end
$$;

revoke all on function public.notify_opportunity_like() from public, anon, authenticated;
revoke all on function public.notify_opportunity_comment() from public, anon, authenticated;
revoke all on function public.notify_workspace_member_joined() from public, anon, authenticated;
revoke all on function public.notify_workspace_member_left() from public, anon, authenticated;
revoke all on function public.set_workspace_admin(uuid, uuid, boolean) from public;
grant execute on function public.set_workspace_admin(uuid, uuid, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end
$$;
