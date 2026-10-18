-- Create the required public profile when email/password registration creates
-- an Auth user. OAuth users can complete their profile after returning.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_username text := new.raw_user_meta_data ->> 'username';
  new_display_name text := new.raw_user_meta_data ->> 'display_name';
begin
  if new_username is null or new_display_name is null then
    return new;
  end if;

  insert into public.profiles (user_id, username, display_name)
  values (new.id, new_username, new_display_name);

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();
