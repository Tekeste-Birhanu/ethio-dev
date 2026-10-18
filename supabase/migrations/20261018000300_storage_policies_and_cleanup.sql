-- Create the four private buckets through the Supabase Dashboard before applying
-- this migration. Storage bucket configuration is managed through the Storage API.
do $$
declare required_bucket record; actual_bucket storage.buckets%rowtype;
begin
  for required_bucket in
    select * from (values
      ('profile-media', array['image/jpeg','image/png','image/gif','image/webp']::text[]),
      ('opportunity-media', array['image/jpeg','image/png','image/gif','image/webp']::text[]),
      ('private-attachments', array[
        'image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]::text[]),
      ('workspace-attachments', array[
        'image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]::text[])
    ) as buckets(bucket_id, mime_types)
  loop
    select * into actual_bucket from storage.buckets where id = required_bucket.bucket_id;
    if not found then
      raise exception 'Create the private Storage bucket "%" in the Supabase Dashboard before applying this migration', required_bucket.bucket_id;
    end if;
    if actual_bucket.public is distinct from false
       or actual_bucket.file_size_limit is distinct from 10485760
       or actual_bucket.allowed_mime_types is null
       or not (required_bucket.mime_types <@ actual_bucket.allowed_mime_types) then
      raise exception 'Configure Storage bucket "%" as private, max 10 MiB, with the required MIME allowlist before applying this migration', required_bucket.bucket_id;
    end if;
  end loop;
end
$$;

create or replace function public.is_allowed_storage_image(p_object_name text, p_mime_type text)
returns boolean
language sql immutable parallel safe
set search_path = ''
as $$
  select case lower(substring(split_part(p_object_name, '/', 2) from '\.([^.]+)$'))
    when 'jpg' then p_mime_type = 'image/jpeg'
    when 'jpeg' then p_mime_type = 'image/jpeg'
    when 'png' then p_mime_type = 'image/png'
    when 'webp' then p_mime_type = 'image/webp'
    else false
  end
$$;

create or replace function public.is_allowed_storage_attachment(p_object_name text, p_mime_type text)
returns boolean
language sql immutable parallel safe
set search_path = ''
as $$
  select case lower(substring(split_part(p_object_name, '/', 3) from '\.([^.]+)$'))
    when 'jpg' then p_mime_type = 'image/jpeg'
    when 'jpeg' then p_mime_type = 'image/jpeg'
    when 'png' then p_mime_type = 'image/png'
    when 'webp' then p_mime_type = 'image/webp'
    when 'pdf' then p_mime_type = 'application/pdf'
    when 'txt' then p_mime_type = 'text/plain'
    when 'csv' then p_mime_type = 'text/csv'
    when 'docx' then p_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    else false
  end
$$;

create or replace function public.can_access_private_conversation_path(p_conversation_path text)
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select case
    when p_conversation_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_access_private_conversation(p_conversation_path::uuid)
    else false
  end
$$;

create or replace function public.is_workspace_member_path(p_workspace_path text)
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select case
    when p_workspace_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_workspace_member(p_workspace_path::uuid)
    else false
  end
$$;

revoke all on function public.is_allowed_storage_image(text, text) from public;
revoke all on function public.is_allowed_storage_attachment(text, text) from public;
grant execute on function public.is_allowed_storage_image(text, text) to anon, authenticated;
grant execute on function public.is_allowed_storage_attachment(text, text) to authenticated;
revoke all on function public.can_access_private_conversation_path(text) from public, anon;
revoke all on function public.is_workspace_member_path(text) from public, anon;
grant execute on function public.can_access_private_conversation_path(text) to authenticated;
grant execute on function public.is_workspace_member_path(text) to authenticated;

-- Object path shapes:
-- profile-media/<user uuid>/<object id>.<ext>
-- opportunity-media/<opportunity uuid>/<object id>.<ext>
-- private-attachments/<conversation uuid>/<uploader uuid>/<object id>.<ext>
-- workspace-attachments/<workspace uuid>/<uploader uuid>/<object id>.<ext>
-- Clients upload new unique paths (no upsert); replacing/removing objects uses cleanup jobs.

create policy profile_media_read on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'profile-media'
  and array_length(storage.foldername(name), 1) = 1
  and (
    (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
    or exists (
      select 1 from public.profiles p
      where p.avatar_path = name
        and (storage.foldername(name))[1] = p.user_id::text
    )
  )
);

create policy profile_media_insert_self on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(storage.foldername(name), 1) = 1
  and public.is_allowed_storage_image(name, metadata->>'mimetype')
);

create policy opportunity_media_read on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'opportunity-media'
  and array_length(storage.foldername(name), 1) = 1
  and (
    exists (
      select 1 from public.opportunities o
      where o.cover_path = name and o.deleted_at is null
        and (storage.foldername(name))[1] = o.id::text
    )
    or (
      auth.uid() is not null
      and exists (
        select 1 from public.opportunities o
        where o.id::text = (storage.foldername(name))[1]
          and o.creator_id = auth.uid() and o.cover_path = name
      )
    )
    or exists (
      select 1 from public.opportunities o
      where o.cover_path = name and o.deleted_at is not null
        and (storage.foldername(name))[1] = o.id::text
        and public.can_view_opportunity(o.id)
    )
  )
);

create policy opportunity_media_insert_creator on storage.objects
for insert to authenticated
with check (
  bucket_id = 'opportunity-media'
  and array_length(storage.foldername(name), 1) = 1
  and public.is_allowed_storage_image(name, metadata->>'mimetype')
  and exists (
    select 1 from public.opportunities o
    where o.id::text = (storage.foldername(name))[1]
      and o.creator_id = auth.uid() and o.deleted_at is null
  )
);

create policy private_attachments_read_participants on storage.objects
for select to authenticated
using (
  bucket_id = 'private-attachments'
  and array_length(storage.foldername(name), 1) = 2
  and public.can_access_private_conversation_path((storage.foldername(name))[1])
);

create policy private_attachments_insert_participants on storage.objects
for insert to authenticated
with check (
  bucket_id = 'private-attachments'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_access_private_conversation_path((storage.foldername(name))[1])
  and public.is_allowed_storage_attachment(name, metadata->>'mimetype')
);

create policy workspace_attachments_read_members on storage.objects
for select to authenticated
using (
  bucket_id = 'workspace-attachments'
  and array_length(storage.foldername(name), 1) = 2
  and public.is_workspace_member_path((storage.foldername(name))[1])
);

create policy workspace_attachments_insert_members on storage.objects
for insert to authenticated
with check (
  bucket_id = 'workspace-attachments'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_workspace_member_path((storage.foldername(name))[1])
  and public.is_allowed_storage_attachment(name, metadata->>'mimetype')
);

-- No direct table access: trusted lifecycle functions enqueue jobs, and callers
-- can only claim and acknowledge paths explicitly authorized for their identity.
revoke all on table public.storage_cleanup_jobs from public, anon, authenticated;

create or replace function public.enqueue_storage_cleanup_job(
  p_bucket_id text,
  p_object_path text,
  p_authorized_user_ids uuid[]
)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare allowed_users uuid[];
begin
  select array_agg(distinct user_id order by user_id)
    into allowed_users
  from unnest(coalesce(p_authorized_user_ids, '{}'::uuid[])) as supplied(user_id)
  where user_id is not null;

  if p_bucket_id not in ('profile-media','opportunity-media','private-attachments','workspace-attachments')
     or p_object_path is null or length(p_object_path) not between 1 and 1024
     or coalesce(cardinality(allowed_users), 0) = 0 then
    raise exception 'Invalid Storage cleanup job';
  end if;

  insert into public.storage_cleanup_jobs (bucket_id, object_path, authorized_user_ids)
  values (p_bucket_id, p_object_path, allowed_users)
  on conflict (bucket_id, object_path) do nothing;
end
$$;

create or replace function public.claim_storage_cleanup_jobs()
returns table (job_id uuid, bucket_id text, object_path text)
language sql security definer
set search_path = ''
set row_security = off
as $$
  update public.storage_cleanup_jobs j
  set attempt_count = j.attempt_count + 1,
      last_attempt_at = now()
  where auth.uid() is not null
    and auth.uid() = any(j.authorized_user_ids)
  returning j.id, j.bucket_id, j.object_path
$$;

create or replace function public.acknowledge_storage_cleanup_job(p_job_id uuid)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
begin
  delete from public.storage_cleanup_jobs j
  where j.id = p_job_id
    and auth.uid() is not null
    and auth.uid() = any(j.authorized_user_ids)
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = j.bucket_id and o.name = j.object_path
    );
  if not found then raise exception 'Authorized cleanup job not found or Storage object still exists'; end if;
end
$$;

create or replace function public.is_authorized_storage_cleanup(p_bucket_id text, p_object_path text)
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.storage_cleanup_jobs j
    where j.bucket_id = p_bucket_id and j.object_path = p_object_path
      and auth.uid() is not null and auth.uid() = any(j.authorized_user_ids)
  )
$$;

revoke all on function public.enqueue_storage_cleanup_job(text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.claim_storage_cleanup_jobs() from public, anon;
revoke all on function public.acknowledge_storage_cleanup_job(uuid) from public, anon;
grant execute on function public.claim_storage_cleanup_jobs() to authenticated;
grant execute on function public.acknowledge_storage_cleanup_job(uuid) to authenticated;
revoke all on function public.is_authorized_storage_cleanup(text, text) from public, anon;
grant execute on function public.is_authorized_storage_cleanup(text, text) to authenticated;

create policy storage_cleanup_job_delete on storage.objects
for delete to authenticated
using (
  public.is_authorized_storage_cleanup(bucket_id, name)
);

comment on function public.enqueue_storage_cleanup_job(text, text, uuid[]) is
  'Internal helper for trusted SECURITY DEFINER lifecycle functions; execute is not granted to API roles.';
comment on function public.claim_storage_cleanup_jobs() is
  'Claims pending Storage object deletions explicitly authorized for the current user.';
comment on function public.acknowledge_storage_cleanup_job(uuid) is
  'Removes a cleanup job after its object has been deleted or confirmed absent through the Storage API.';
comment on function public.is_authorized_storage_cleanup(text, text) is
  'Checks a Storage DELETE against a cleanup job without exposing the internal queue table.';

create or replace function public.queue_old_profile_media()
returns trigger
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
begin
  if old.avatar_path is not null and old.avatar_path is distinct from new.avatar_path then
    perform public.enqueue_storage_cleanup_job('profile-media', old.avatar_path, array[old.user_id]);
  end if;
  return new;
end
$$;
create trigger profiles_queue_old_avatar
before update of avatar_path on public.profiles
for each row execute function public.queue_old_profile_media();

create or replace function public.queue_old_opportunity_media()
returns trigger
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
begin
  if old.cover_path is not null and old.cover_path is distinct from new.cover_path then
    perform public.enqueue_storage_cleanup_job('opportunity-media', old.cover_path, array[old.creator_id]);
  end if;
  return new;
end
$$;
create trigger opportunities_queue_old_cover
before update of cover_path on public.opportunities
for each row execute function public.queue_old_opportunity_media();

create or replace function public.queue_deleted_opportunity_media()
returns trigger
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
begin
  if old.cover_path is not null then
    perform public.enqueue_storage_cleanup_job('opportunity-media', old.cover_path, array[old.creator_id]);
  end if;
  return old;
end
$$;
create trigger opportunities_queue_cover_on_delete
before delete on public.opportunities
for each row execute function public.queue_deleted_opportunity_media();

create or replace function public.queue_private_conversation_attachments()
returns trigger
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare target_conversation_id uuid; authorized_users uuid[];
begin
  if tg_op = 'DELETE' then
    target_conversation_id := old.id;
    authorized_users := array[old.participant_a, old.participant_b];
  elsif old.status = 'active' and new.status = 'ended' then
    target_conversation_id := new.id;
    authorized_users := array[new.participant_a, new.participant_b];
  else
    return new;
  end if;

  perform public.enqueue_storage_cleanup_job('private-attachments', a.storage_path, authorized_users)
  from public.private_attachments a
  join public.private_messages m on m.id = a.message_id
  where m.conversation_id = target_conversation_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
create trigger private_conversations_queue_attachments_on_end
before update of status on public.private_conversations
for each row execute function public.queue_private_conversation_attachments();
create trigger private_conversations_queue_attachments_on_delete
before delete on public.private_conversations
for each row execute function public.queue_private_conversation_attachments();

create or replace function public.queue_deleted_workspace_message_attachments()
returns trigger
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare authorized_users uuid[];
begin
  select array_agg(m.user_id order by m.user_id) into authorized_users
  from public.workspace_memberships m
  where m.workspace_id = old.workspace_id and m.ended_at is null;

  if coalesce(cardinality(authorized_users), 0) > 0 then
    perform public.enqueue_storage_cleanup_job('workspace-attachments', a.storage_path, authorized_users)
    from public.workspace_attachments a where a.message_id = old.id;
  end if;
  return old;
end
$$;
create trigger workspace_messages_queue_attachments_on_delete
before delete on public.workspace_messages
for each row execute function public.queue_deleted_workspace_message_attachments();

revoke all on function public.queue_old_profile_media() from public, anon, authenticated;
revoke all on function public.queue_old_opportunity_media() from public, anon, authenticated;
revoke all on function public.queue_deleted_opportunity_media() from public, anon, authenticated;
revoke all on function public.queue_private_conversation_attachments() from public, anon, authenticated;
revoke all on function public.queue_deleted_workspace_message_attachments() from public, anon, authenticated;
