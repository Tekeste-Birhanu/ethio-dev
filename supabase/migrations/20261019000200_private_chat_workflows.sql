-- T-10: private chat write, end, and realtime workflows.

create or replace function public.send_private_message(
  p_conversation_id uuid,
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
  if not public.can_access_private_conversation(p_conversation_id) then
    raise exception 'Conversation is unavailable';
  end if;
  if has_attachment then
    if p_original_name is null or p_media_type is null or p_size_bytes is null
       or p_size_bytes not between 1 and 10485760
       or p_attachment_path !~ ('^' || p_conversation_id::text || '/' || caller::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|pdf|txt|csv|docx)$') then
      raise exception 'Invalid attachment';
    end if;
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'private-attachments'
        and o.name = p_attachment_path
        and o.metadata->>'mimetype' = p_media_type
    ) then
      raise exception 'Uploaded attachment is unavailable';
    end if;
  elsif p_original_name is not null or p_media_type is not null or p_size_bytes is not null then
    raise exception 'Incomplete attachment';
  end if;

  insert into public.private_messages (conversation_id, sender_id, body, client_key)
  values (p_conversation_id, caller, btrim(p_body), p_client_key)
  returning id into new_message_id;

  if has_attachment then
    insert into public.private_attachments (
      message_id, storage_path, original_name, media_type, size_bytes, uploaded_by
    ) values (
      new_message_id, p_attachment_path, p_original_name, p_media_type, p_size_bytes, caller
    );
  end if;
  return new_message_id;
end
$$;

create or replace function public.end_private_conversation(p_conversation_id uuid)
returns void
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare conversation public.private_conversations%rowtype;
begin
  select * into conversation
  from public.private_conversations c
  where c.id = p_conversation_id
  for update;
  if not found or conversation.status <> 'active'
     or auth.uid() not in (conversation.participant_a, conversation.participant_b) then
    raise exception 'Active conversation not found';
  end if;

  update public.private_conversations
  set status = 'ended', ended_at = now()
  where id = p_conversation_id;

  -- The trigger above queues authorized Storage deletion before metadata cascades.
  delete from public.private_messages where conversation_id = p_conversation_id;
end
$$;

revoke all on function public.send_private_message(uuid, text, text, text, text, text, bigint) from public, anon;
grant execute on function public.send_private_message(uuid, text, text, text, text, text, bigint) to authenticated;
revoke all on function public.end_private_conversation(uuid) from public, anon;
grant execute on function public.end_private_conversation(uuid) to authenticated;

-- Message inserts must go through the trusted function so the sender, active
-- conversation, idempotency key, and optional attachment metadata are checked together.
revoke insert on public.private_messages from anon, authenticated;

-- Postgres Changes uses the table's SELECT RLS policy to authorize each row.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'private_messages'
     ) then
    execute 'alter publication supabase_realtime add table public.private_messages';
  end if;
end
$$;

-- Permit an uploader to clean up an object if the atomic send operation fails.
create policy private_attachments_delete_uploader on storage.objects
for delete to authenticated
using (
  bucket_id = 'private-attachments'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_access_private_conversation_path((storage.foldername(name))[1])
);
