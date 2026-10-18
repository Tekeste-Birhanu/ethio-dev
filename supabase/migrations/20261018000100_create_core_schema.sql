-- T-02: Core EthioDev data model and database-enforced invariants.
-- Row-level security, Storage policies, and actor-authorized workflows are T-03/T-05.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.has_no_duplicates(p_values text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select cardinality(p_values) = (select count(distinct item) from unnest(p_values) as items(item))
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  country_code text not null default 'ET' check (country_code = 'ET'),
  is_active boolean not null default true,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now()
);
create index cities_active_name_idx on public.cities (normalized_name) where is_active;
insert into public.cities (id, name, normalized_name, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Addis Ababa', 'addis ababa', 1),
  ('00000000-0000-4000-8000-000000000002', 'Adama', 'adama', 2),
  ('00000000-0000-4000-8000-000000000003', 'Bahir Dar', 'bahir dar', 3),
  ('00000000-0000-4000-8000-000000000004', 'Dire Dawa', 'dire dawa', 4),
  ('00000000-0000-4000-8000-000000000005', 'Hawassa', 'hawassa', 5),
  ('00000000-0000-4000-8000-000000000006', 'Jimma', 'jimma', 6),
  ('00000000-0000-4000-8000-000000000007', 'Mekelle', 'mekelle', 7),
  ('00000000-0000-4000-8000-000000000008', 'Gondar', 'gondar', 8),
  ('00000000-0000-4000-8000-000000000009', 'Dessie', 'dessie', 9),
  ('00000000-0000-4000-8000-000000000010', 'Bishoftu', 'bishoftu', 10),
  ('00000000-0000-4000-8000-000000000011', 'Shashamane', 'shashamane', 11),
  ('00000000-0000-4000-8000-000000000012', 'Harar', 'harar', 12),
  ('00000000-0000-4000-8000-000000000013', 'Arba Minch', 'arba minch', 13),
  ('00000000-0000-4000-8000-000000000014', 'Wolaita Sodo', 'wolaita sodo', 14),
  ('00000000-0000-4000-8000-000000000015', 'Jijiga', 'jijiga', 15)
on conflict (normalized_name) do nothing;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  bio text check (bio is null or length(bio) <= 1000),
  city_id uuid references public.cities(id) on delete restrict,
  city_other text check (city_other is null or length(btrim(city_other)) between 1 and 100),
  avatar_path text check (avatar_path is null or length(avatar_path) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (city_id is null or city_other is null)
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  normalized_name text not null unique check (normalized_name = lower(btrim(name))),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profile_skills (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);
create index profile_skills_skill_idx on public.profile_skills (skill_id, user_id);

create or replace function public.get_or_create_skill(p_name text, p_created_by uuid default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare normalized text := lower(btrim(p_name)); result_id uuid;
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 60 then
    raise exception 'Skill name must contain 1 to 60 characters';
  end if;
  insert into public.skills (name, normalized_name, created_by)
  values (btrim(p_name), normalized, p_created_by)
  on conflict (normalized_name) do nothing
  returning id into result_id;
  if result_id is null then
    select id into result_id from public.skills where normalized_name = normalized;
  end if;
  return result_id;
end
$$;
revoke all on function public.get_or_create_skill(text, uuid) from public;

create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 40),
  url text not null check (length(url) <= 2048 and url ~* '^https?://[^[:space:]]+$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profile_links_user_sort_idx on public.profile_links (user_id, sort_order);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(user_id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null check (length(btrim(description)) between 1 and 10000),
  project_type text not null check (project_type in ('web','mobile','desktop','game','developer_tool','data_ai','hardware_iot','other')),
  project_type_other text,
  experience_levels text[] not null,
  commitment text check (commitment is null or length(commitment) <= 500),
  city_id uuid references public.cities(id) on delete restrict,
  city_other text check (city_other is null or length(btrim(city_other)) between 1 and 100),
  cover_path text check (cover_path is null or length(cover_path) <= 500),
  status text not null default 'open' check (status in ('open','closed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((project_type = 'other' and project_type_other is not null and length(btrim(project_type_other)) between 1 and 80)
      or (project_type <> 'other' and project_type_other is null)),
  check (city_id is null or city_other is null),
  check (cardinality(experience_levels) between 1 and 5),
  check (array_position(experience_levels, null) is null),
  check (public.has_no_duplicates(experience_levels)),
  check (experience_levels <@ array['beginner_friendly','junior','intermediate','experienced_mentor','any_level']::text[]),
  check (not ('any_level' = any(experience_levels)) or cardinality(experience_levels) = 1)
);
create index opportunities_creator_idx on public.opportunities (creator_id, created_at desc);
create index opportunities_city_idx on public.opportunities (city_id) where deleted_at is null;
create index opportunities_status_idx on public.opportunities (status) where deleted_at is null;
create index opportunities_feed_idx on public.opportunities (created_at desc) where deleted_at is null;
create index opportunities_search_idx on public.opportunities using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
) where deleted_at is null;
create index opportunities_title_trgm_idx on public.opportunities using gin (title extensions.gin_trgm_ops) where deleted_at is null;

create table public.opportunity_skills (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  primary key (opportunity_id, skill_id)
);
create index opportunity_skills_skill_idx on public.opportunity_skills (skill_id, opportunity_id);

create table public.opportunity_likes (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, user_id)
);
create index opportunity_likes_user_idx on public.opportunity_likes (user_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  author_id uuid not null references public.profiles(user_id) on delete restrict,
  parent_comment_id uuid,
  body text check (body is null or length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (id, opportunity_id),
  foreign key (parent_comment_id, opportunity_id)
    references public.comments(id, opportunity_id) on delete cascade,
  check ((deleted_at is null and body is not null) or (deleted_at is not null and body is null))
);
create index comments_opportunity_created_idx on public.comments (opportunity_id, created_at);
create index comments_parent_idx on public.comments (parent_comment_id) where parent_comment_id is not null;

create table public.collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  applicant_id uuid not null references public.profiles(user_id) on delete restrict,
  message text check (message is null or length(message) <= 2000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  acceptance_path text check (acceptance_path in ('private_chat','workspace')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (opportunity_id, applicant_id),
  unique (id, opportunity_id),
  check ((status = 'accepted' and acceptance_path is not null and decided_at is not null)
      or (status <> 'accepted' and acceptance_path is null))
);
create index collaboration_requests_inbox_idx on public.collaboration_requests (opportunity_id, status, created_at);
create index collaboration_requests_applicant_idx on public.collaboration_requests (applicant_id, created_at desc);

create table public.private_conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.collaboration_requests(id) on delete cascade,
  participant_a uuid not null references public.profiles(user_id) on delete restrict,
  participant_b uuid not null references public.profiles(user_id) on delete restrict,
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (participant_a <> participant_b),
  check ((status = 'active' and ended_at is null) or (status = 'ended' and ended_at is not null))
);
create index private_conversations_participants_idx on public.private_conversations (participant_a, participant_b, status);

create table public.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete restrict,
  body text not null check (length(btrim(body)) between 1 and 10000),
  client_key text check (client_key is null or length(client_key) <= 100),
  created_at timestamptz not null default now(),
  unique (conversation_id, sender_id, client_key)
);
create index private_messages_timeline_idx on public.private_messages (conversation_id, created_at, id);

create table public.private_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.private_messages(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (length(btrim(original_name)) between 1 and 255),
  media_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (lower(original_name) ~ '\.(jpg|jpeg)$' and media_type = 'image/jpeg') or
    (lower(original_name) ~ '\.png$' and media_type = 'image/png') or
    (lower(original_name) ~ '\.gif$' and media_type = 'image/gif') or
    (lower(original_name) ~ '\.webp$' and media_type = 'image/webp') or
    (lower(original_name) ~ '\.pdf$' and media_type = 'application/pdf') or
    (lower(original_name) ~ '\.txt$' and media_type in ('text/plain','application/rtf','text/rtf')) or
    (lower(original_name) ~ '\.csv$' and media_type = 'text/csv') or
    (lower(original_name) ~ '\.doc$' and media_type = 'application/msword') or
    (lower(original_name) ~ '\.docx$' and media_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') or
    (lower(original_name) ~ '\.xls$' and media_type = 'application/vnd.ms-excel') or
    (lower(original_name) ~ '\.xlsx$' and media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') or
    (lower(original_name) ~ '\.ppt$' and media_type = 'application/vnd.ms-powerpoint') or
    (lower(original_name) ~ '\.pptx$' and media_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation') or
    (lower(original_name) ~ '\.rtf$' and media_type in ('application/rtf','text/rtf')) or
    (lower(original_name) ~ '\.odt$' and media_type = 'application/vnd.oasis.opendocument.text') or
    (lower(original_name) ~ '\.ods$' and media_type = 'application/vnd.oasis.opendocument.spreadsheet') or
    (lower(original_name) ~ '\.odp$' and media_type = 'application/vnd.oasis.opendocument.presentation')
  )
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.opportunities(id) on delete restrict,
  owner_id uuid not null references public.profiles(user_id) on delete restrict,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  project_status text not null default 'active' check (project_status in ('active','paused','completed','abandoned')),
  inactive_work_editable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id = created_by),
  unique (id, owner_id)
);

create table public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  role text not null check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text check (ended_reason is null or ended_reason in ('removed','left')),
  invited_by uuid references public.profiles(user_id) on delete set null,
  check ((ended_at is null and ended_reason is null) or (ended_at is not null and ended_reason is not null))
);
create unique index workspace_memberships_active_unique_idx on public.workspace_memberships (workspace_id, user_id) where ended_at is null;
create index workspace_memberships_user_idx on public.workspace_memberships (user_id, workspace_id);
create index workspace_memberships_workspace_idx on public.workspace_memberships (workspace_id, joined_at);

create table public.workspace_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete restrict,
  body text not null check (length(btrim(body)) between 1 and 10000),
  client_key text check (client_key is null or length(client_key) <= 100),
  created_at timestamptz not null default now(),
  unique (workspace_id, sender_id, client_key)
);
create index workspace_messages_timeline_idx on public.workspace_messages (workspace_id, created_at, id);

create table public.workspace_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.workspace_messages(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (length(btrim(original_name)) between 1 and 255),
  media_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (lower(original_name) ~ '\.(jpg|jpeg)$' and media_type = 'image/jpeg') or
    (lower(original_name) ~ '\.png$' and media_type = 'image/png') or
    (lower(original_name) ~ '\.gif$' and media_type = 'image/gif') or
    (lower(original_name) ~ '\.webp$' and media_type = 'image/webp') or
    (lower(original_name) ~ '\.pdf$' and media_type = 'application/pdf') or
    (lower(original_name) ~ '\.txt$' and media_type in ('text/plain','application/rtf','text/rtf')) or
    (lower(original_name) ~ '\.csv$' and media_type = 'text/csv') or
    (lower(original_name) ~ '\.doc$' and media_type = 'application/msword') or
    (lower(original_name) ~ '\.docx$' and media_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') or
    (lower(original_name) ~ '\.xls$' and media_type = 'application/vnd.ms-excel') or
    (lower(original_name) ~ '\.xlsx$' and media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') or
    (lower(original_name) ~ '\.ppt$' and media_type = 'application/vnd.ms-powerpoint') or
    (lower(original_name) ~ '\.pptx$' and media_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation') or
    (lower(original_name) ~ '\.rtf$' and media_type in ('application/rtf','text/rtf')) or
    (lower(original_name) ~ '\.odt$' and media_type = 'application/vnd.oasis.opendocument.text') or
    (lower(original_name) ~ '\.ods$' and media_type = 'application/vnd.oasis.opendocument.spreadsheet') or
    (lower(original_name) ~ '\.odp$' and media_type = 'application/vnd.oasis.opendocument.presentation')
  )
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text check (description is null or length(description) <= 2000),
  completion_mode text not null default 'automatic' check (completion_mode in ('automatic','manual')),
  is_completed boolean not null default false,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  milestone_id uuid,
  title text not null check (length(btrim(title)) between 1 and 160),
  description text check (description is null or length(description) <= 5000),
  status text not null default 'to_do' check (status in ('to_do','in_progress','done')),
  due_at timestamptz,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (milestone_id, workspace_id) references public.milestones(id, workspace_id) on delete set null (milestone_id)
);
create index tasks_workspace_status_idx on public.tasks (workspace_id, status);
create index tasks_milestone_idx on public.tasks (milestone_id) where milestone_id is not null;

create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  assigned_by uuid not null references public.profiles(user_id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_assignees_user_idx on public.task_assignees (user_id, task_id);

create table public.showcases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  overview text not null check (length(btrim(overview)) between 1 and 10000),
  status text not null default 'draft' check (status in ('draft','published','unpublished')),
  published_at timestamptz,
  updated_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table public.showcase_links (
  id uuid primary key default gen_random_uuid(),
  showcase_id uuid not null references public.showcases(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 40),
  url text not null check (length(url) <= 2048 and url ~* '^https?://[^[:space:]]+$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);
create index showcase_links_sort_idx on public.showcase_links (showcase_id, sort_order);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(user_id) on delete cascade,
  actor_id uuid references public.profiles(user_id) on delete set null,
  event_type text not null check (event_type in ('request_received','request_decided','workspace_invite','member_joined','member_removed','task_assigned','project_status_changed','opportunity_liked','comment_added','comment_replied')),
  entity_type text not null check (entity_type in ('opportunity','collaboration_request','workspace','task','comment')),
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

create table public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null check (bucket_id in ('profile-media','opportunity-media','private-attachments','workspace-attachments')),
  object_path text not null check (length(object_path) between 1 and 1024),
  authorized_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  unique (bucket_id, object_path)
);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger profile_links_set_updated_at before update on public.profile_links for each row execute function public.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities for each row execute function public.set_updated_at();
create trigger comments_set_updated_at before update on public.comments for each row execute function public.set_updated_at();
create trigger collaboration_requests_set_updated_at before update on public.collaboration_requests for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger milestones_set_updated_at before update on public.milestones for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger showcases_set_updated_at before update on public.showcases for each row execute function public.set_updated_at();

-- Cross-row consistency constraints that cannot be expressed as ordinary CHECKs.
create or replace function public.check_private_conversation_request()
returns trigger language plpgsql set search_path = '' as $$
declare req public.collaboration_requests%rowtype; creator uuid;
begin
  select * into req from public.collaboration_requests where id = new.request_id;
  if not found then raise exception 'Conversation request does not exist'; end if;
  select creator_id into creator from public.opportunities where id = req.opportunity_id;
  if req.status <> 'accepted' or req.acceptance_path <> 'private_chat'
     or new.participant_a <> creator or new.participant_b <> req.applicant_id then
    raise exception 'Conversation must match an accepted private-chat request';
  end if;
  return new;
end $$;
create trigger private_conversation_request_consistency
  before insert or update of request_id, participant_a, participant_b on public.private_conversations
  for each row execute function public.check_private_conversation_request();

create or replace function public.check_workspace_owner()
returns trigger language plpgsql set search_path = '' as $$
declare creator uuid;
begin
  select creator_id into creator from public.opportunities where id = new.opportunity_id;
  if creator is null or new.owner_id <> creator or new.created_by <> creator then
    raise exception 'Workspace owner and creator must be the opportunity creator';
  end if;
  return new;
end $$;
create trigger workspace_owner_consistency
  before insert or update of opportunity_id, owner_id, created_by on public.workspaces
  for each row execute function public.check_workspace_owner();

create or replace function public.check_owner_membership()
returns trigger language plpgsql set search_path = '' as $$
declare owner_user uuid;
begin
  select owner_id into owner_user from public.workspaces where id = new.workspace_id;
  if new.role = 'owner' and new.user_id <> owner_user then
    raise exception 'Owner membership must belong to the workspace owner';
  end if;
  if new.user_id = owner_user and (new.role <> 'owner' or new.ended_at is not null) then
    raise exception 'Workspace owner must remain an active owner member';
  end if;
  return new;
end $$;
create trigger workspace_owner_membership_consistency
  before insert or update of workspace_id, user_id, role, ended_at on public.workspace_memberships
  for each row execute function public.check_owner_membership();

create or replace function public.add_workspace_owner_membership()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger workspace_create_owner_membership after insert on public.workspaces
  for each row execute function public.add_workspace_owner_membership();

create or replace function public.check_message_sender()
returns trigger language plpgsql set search_path = '' as $$
declare allowed boolean;
begin
  if tg_table_name = 'private_messages' then
    select (new.sender_id = participant_a or new.sender_id = participant_b) and status = 'active'
      into allowed from public.private_conversations where id = new.conversation_id;
  else
    select exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = new.workspace_id and m.user_id = new.sender_id and m.ended_at is null
    ) into allowed;
  end if;
  if not coalesce(allowed, false) then raise exception 'Message sender is not an active participant'; end if;
  return new;
end $$;
create trigger private_message_sender_check before insert or update of conversation_id, sender_id on public.private_messages
  for each row execute function public.check_message_sender();
create trigger workspace_message_sender_check before insert or update of workspace_id, sender_id on public.workspace_messages
  for each row execute function public.check_message_sender();

create or replace function public.refresh_automatic_milestone(p_milestone_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  update public.milestones m
  set is_completed = exists (select 1 from public.tasks t where t.milestone_id = m.id)
    and not exists (select 1 from public.tasks t where t.milestone_id = m.id and t.status <> 'done')
  where m.id = p_milestone_id and m.completion_mode = 'automatic';
end $$;
create or replace function public.refresh_milestone_from_task()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' and old.milestone_id is not null then perform public.refresh_automatic_milestone(old.milestone_id); end if;
  if tg_op <> 'DELETE' and new.milestone_id is not null then perform public.refresh_automatic_milestone(new.milestone_id); end if;
  return coalesce(new, old);
end $$;
create trigger tasks_refresh_milestone after insert or update of milestone_id, status or delete on public.tasks
  for each row execute function public.refresh_milestone_from_task();
create or replace function public.refresh_milestone_mode()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.completion_mode = 'automatic' then perform public.refresh_automatic_milestone(new.id); end if;
  return new;
end $$;
create trigger milestones_refresh_mode after insert or update of completion_mode on public.milestones
  for each row execute function public.refresh_milestone_mode();
