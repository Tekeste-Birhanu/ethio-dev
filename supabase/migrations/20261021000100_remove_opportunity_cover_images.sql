-- Remove opportunity cover image support. Existing objects are queued for
-- deletion through the Storage API before their database references are dropped.

do $$
declare
  existing_image record;
begin
  for existing_image in
    select o.creator_id, so.name as object_path
    from storage.objects so
    join public.opportunities o
      on o.id::text = (storage.foldername(so.name))[1]
    where so.bucket_id = 'opportunity-media'
  loop
    perform public.enqueue_storage_cleanup_job(
      'opportunity-media',
      existing_image.object_path,
      array[existing_image.creator_id]
    );
  end loop;
end
$$;

drop policy if exists opportunity_media_read on storage.objects;
drop policy if exists opportunity_media_insert_creator on storage.objects;

drop trigger if exists opportunities_queue_old_cover on public.opportunities;
drop trigger if exists opportunities_queue_cover_on_delete on public.opportunities;
drop function if exists public.queue_old_opportunity_media();
drop function if exists public.queue_deleted_opportunity_media();

drop function if exists public.discard_opportunity_media(uuid, text);
drop function if exists public.update_opportunity(
  uuid, text, text, text, text, text[], text, uuid, text, uuid[], text
);

create function public.update_opportunity(
  p_opportunity_id uuid,
  p_title text,
  p_description text,
  p_project_type text,
  p_project_type_other text,
  p_experience_levels text[],
  p_commitment text,
  p_city_id uuid,
  p_city_other text,
  p_skill_ids uuid[]
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

  update public.opportunities set
    title = p_title,
    description = p_description,
    project_type = p_project_type,
    project_type_other = case when p_project_type = 'other' then nullif(btrim(p_project_type_other), '') else null end,
    experience_levels = p_experience_levels,
    commitment = nullif(btrim(p_commitment), ''),
    city_id = p_city_id,
    city_other = case when p_city_id is null then nullif(btrim(p_city_other), '') else null end
  where id = p_opportunity_id;

  delete from public.opportunity_skills where opportunity_id = p_opportunity_id;
  insert into public.opportunity_skills (opportunity_id, skill_id)
  select p_opportunity_id, selected.id from unnest(requested_skill_ids) selected(id);
end
$$;

revoke all on function public.update_opportunity(
  uuid, text, text, text, text, text[], text, uuid, text, uuid[]
) from public, anon;
grant execute on function public.update_opportunity(
  uuid, text, text, text, text, text[], text, uuid, text, uuid[]
) to authenticated;
comment on function public.update_opportunity(
  uuid, text, text, text, text, text[], text, uuid, text, uuid[]
) is 'Updates an undeleted opportunity and its skill associations for its creator.';

create or replace function public.delete_opportunity(p_opportunity_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  preserve_context boolean;
begin
  perform 1 from public.opportunities o
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

alter table public.opportunities drop column cover_path;
