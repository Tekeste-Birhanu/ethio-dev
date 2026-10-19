-- Opportunity publishing and lifecycle operations.
-- All mutations validate the caller and keep relational changes atomic.

-- Opportunity inserts are routed through the verified, validated RPC below.
drop policy opportunities_insert_verified_self on public.opportunities;

create or replace function public.create_opportunity(
  p_title text,
  p_description text,
  p_project_type text,
  p_project_type_other text,
  p_experience_levels text[],
  p_commitment text,
  p_city_id uuid,
  p_city_other text,
  p_skill_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  caller uuid := auth.uid();
  opportunity_id uuid;
  requested_skill_ids uuid[] := coalesce(p_skill_ids, '{}'::uuid[]);
begin
  if caller is null then raise exception 'Sign in to publish an opportunity'; end if;
  if not public.is_verified_user(caller) then
    raise exception 'Verify your email before publishing an opportunity';
  end if;
  if p_city_id is not null and not exists (
    select 1 from public.cities c where c.id = p_city_id and c.is_active
  ) then raise exception 'Choose an active city'; end if;
  if array_position(requested_skill_ids, null) is not null
     or cardinality(requested_skill_ids) <> (
       select count(distinct selected.id)::integer from unnest(requested_skill_ids) selected(id)
     ) then
    raise exception 'Choose each skill only once';
  end if;
  if cardinality(requested_skill_ids) > 0 and exists (
    select 1 from unnest(requested_skill_ids) selected(id)
    left join public.skills s on s.id = selected.id
    where s.id is null
  ) then raise exception 'A selected skill is unavailable'; end if;

  insert into public.opportunities (
    creator_id, title, description, project_type, project_type_other,
    experience_levels, commitment, city_id, city_other, status
  ) values (
    caller, p_title, p_description, p_project_type,
    case when p_project_type = 'other' then nullif(btrim(p_project_type_other), '') else null end,
    p_experience_levels, nullif(btrim(p_commitment), ''), p_city_id,
    case when p_city_id is null then nullif(btrim(p_city_other), '') else null end,
    'open'
  ) returning id into opportunity_id;

  insert into public.opportunity_skills (opportunity_id, skill_id)
  select opportunity_id, selected.id from unnest(requested_skill_ids) selected(id);
  return opportunity_id;
end
$$;

create or replace function public.update_opportunity(
  p_opportunity_id uuid,
  p_title text,
  p_description text,
  p_project_type text,
  p_project_type_other text,
  p_experience_levels text[],
  p_commitment text,
  p_city_id uuid,
  p_city_other text,
  p_skill_ids uuid[],
  p_cover_path text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  caller uuid := auth.uid();
  requested_skill_ids uuid[] := coalesce(p_skill_ids, '{}'::uuid[]);
begin
  if caller is null then raise exception 'Sign in to edit this opportunity'; end if;
  perform 1 from public.opportunities o
  where o.id = p_opportunity_id and o.creator_id = caller and o.deleted_at is null
  for update;
  if not found then raise exception 'Opportunity not found'; end if;
  if p_city_id is not null and not exists (
    select 1 from public.cities c where c.id = p_city_id and c.is_active
  ) then raise exception 'Choose an active city'; end if;
  if array_position(requested_skill_ids, null) is not null
     or cardinality(requested_skill_ids) <> (
       select count(distinct selected.id)::integer from unnest(requested_skill_ids) selected(id)
     ) then
    raise exception 'Choose each skill only once';
  end if;
  if cardinality(requested_skill_ids) > 0 and exists (
    select 1 from unnest(requested_skill_ids) selected(id)
    left join public.skills s on s.id = selected.id
    where s.id is null
  ) then raise exception 'A selected skill is unavailable'; end if;
  if p_cover_path is not null and (
    p_cover_path !~ ('^' || p_opportunity_id::text || '/[A-Za-z0-9._-]+$')
    or not exists (
      select 1 from storage.objects so
      where so.bucket_id = 'opportunity-media' and so.name = p_cover_path
    )
  ) then raise exception 'Cover image is unavailable'; end if;

  update public.opportunities set
    title = p_title,
    description = p_description,
    project_type = p_project_type,
    project_type_other = case when p_project_type = 'other' then nullif(btrim(p_project_type_other), '') else null end,
    experience_levels = p_experience_levels,
    commitment = nullif(btrim(p_commitment), ''),
    city_id = p_city_id,
    city_other = case when p_city_id is null then nullif(btrim(p_city_other), '') else null end,
    cover_path = p_cover_path
  where id = p_opportunity_id;

  delete from public.opportunity_skills where opportunity_id = p_opportunity_id;
  insert into public.opportunity_skills (opportunity_id, skill_id)
  select p_opportunity_id, selected.id from unnest(requested_skill_ids) selected(id);
end
$$;

create or replace function public.discard_opportunity_media(
  p_opportunity_id uuid,
  p_object_path text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not exists (
    select 1 from public.opportunities o
    where o.id = p_opportunity_id and o.creator_id = auth.uid()
  ) then raise exception 'Opportunity not found'; end if;
  if p_object_path !~ ('^' || p_opportunity_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Invalid opportunity media path';
  end if;
  if exists (
    select 1 from public.opportunities o
    where o.id = p_opportunity_id and o.cover_path = p_object_path
  ) then raise exception 'Cover image is currently in use'; end if;
  if exists (
    select 1 from storage.objects so
    where so.bucket_id = 'opportunity-media' and so.name = p_object_path
  ) then
    perform public.enqueue_storage_cleanup_job('opportunity-media', p_object_path, array[auth.uid()]);
  end if;
end
$$;

create or replace function public.delete_opportunity(p_opportunity_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  opportunity_row public.opportunities%rowtype;
  preserve_context boolean;
begin
  select o.* into opportunity_row
  from public.opportunities o
  where o.id = p_opportunity_id and o.creator_id = auth.uid() and o.deleted_at is null
  for update;
  if not found then raise exception 'Opportunity not found'; end if;

  select exists (
    select 1 from public.collaboration_requests r
    where r.opportunity_id = p_opportunity_id and r.status = 'accepted'
  ) or exists (
    select 1 from public.workspaces w where w.opportunity_id = p_opportunity_id
  ) into preserve_context;

  if preserve_context then
    update public.opportunities
    set deleted_at = now(), status = 'closed'
    where id = p_opportunity_id;
    delete from public.collaboration_requests
    where opportunity_id = p_opportunity_id and status <> 'accepted';
    delete from public.opportunity_likes where opportunity_id = p_opportunity_id;
    delete from public.comments where opportunity_id = p_opportunity_id;
    return true;
  end if;

  delete from public.opportunities where id = p_opportunity_id;
  return false;
end
$$;

revoke all on function public.create_opportunity(text, text, text, text, text[], text, uuid, text, uuid[]) from public, anon;
revoke all on function public.update_opportunity(uuid, text, text, text, text, text[], text, uuid, text, uuid[], text) from public, anon;
revoke all on function public.discard_opportunity_media(uuid, text) from public, anon;
revoke all on function public.delete_opportunity(uuid) from public, anon;
grant execute on function public.create_opportunity(text, text, text, text, text[], text, uuid, text, uuid[]) to authenticated;
grant execute on function public.update_opportunity(uuid, text, text, text, text, text[], text, uuid, text, uuid[], text) to authenticated;
grant execute on function public.discard_opportunity_media(uuid, text) to authenticated;
grant execute on function public.delete_opportunity(uuid) to authenticated;

comment on function public.create_opportunity(text, text, text, text, text[], text, uuid, text, uuid[]) is
  'Creates an open opportunity for a verified caller and associates its selected shared skills atomically.';
comment on function public.update_opportunity(uuid, text, text, text, text, text[], text, uuid, text, uuid[], text) is
  'Updates an undeleted opportunity and its skill associations for its creator.';
comment on function public.discard_opportunity_media(uuid, text) is
  'Queues an unattached opportunity image for deletion after an upload or cover update fails.';
comment on function public.delete_opportunity(uuid) is
  'Deletes a listing. Preserves accepted collaboration/workspace context privately when present; otherwise hard deletes it.';
