-- T-12: persist workspace chat messages and publish inserts to Realtime.

create or replace function public.send_workspace_message(
  p_workspace_id uuid,
  p_body text,
  p_client_key text,
  p_attachment_path text default null,
  p_original_name text default null,
  p_media_type text default null,
  p_size_bytes bigint default null
)
returns uuid
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare
  caller uuid := auth.uid();
  new_message_id uuid;
  has_attachment boolean := p_attachment_path is not null;
begin
  if caller is null then raise exception 'Sign in to send a message'; end if;
  if p_client_key is null or length(p_client_key) not between 1 and 100 then
    raise exception 'Invalid message key';
  end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 10000 then
    raise exception 'Message must be between 1 and 10000 characters';
  end if;
  if not public.is_workspace_member(p_workspace_id, caller) then
    raise exception 'Workspace is unavailable';
  end if;
  if has_attachment then
    if p_original_name is null or p_media_type is null or p_size_bytes is null
       or p_size_bytes not between 1 and 10485760
       or p_attachment_path !~ ('^' || p_workspace_id::text || '/' || caller::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|pdf|txt|csv|docx)$')
       or not public.is_allowed_storage_attachment(p_attachment_path, p_media_type) then
      raise exception 'Invalid attachment';
    end if;
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'workspace-attachments'
        and o.name = p_attachment_path
        and o.metadata->>'mimetype' = p_media_type
    ) then
      raise exception 'Uploaded attachment is unavailable';
    end if;
  elsif p_original_name is not null or p_media_type is not null or p_size_bytes is not null then
    raise exception 'Incomplete attachment';
  end if;

  insert into public.workspace_messages (workspace_id, sender_id, body, client_key)
  values (p_workspace_id, caller, btrim(p_body), p_client_key)
  returning id into new_message_id;

  if has_attachment then
    insert into public.workspace_attachments (
      message_id, storage_path, original_name, media_type, size_bytes, uploaded_by
    ) values (
      new_message_id, p_attachment_path, p_original_name, p_media_type, p_size_bytes, caller
    );
  end if;
  return new_message_id;
end
$$;

revoke all on function public.send_workspace_message(uuid, text, text, text, text, text, bigint) from public, anon;
grant execute on function public.send_workspace_message(uuid, text, text, text, text, text, bigint) to authenticated;
revoke insert on public.workspace_messages, public.workspace_attachments from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'workspace_messages'
     ) then
    execute 'alter publication supabase_realtime add table public.workspace_messages';
  end if;
end
$$;
