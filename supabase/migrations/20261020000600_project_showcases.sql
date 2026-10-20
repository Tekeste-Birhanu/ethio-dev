create or replace function public.save_project_showcase(
  p_workspace_id uuid,
  p_title text,
  p_overview text,
  p_links jsonb default '[]'::jsonb,
  p_publish boolean default true
)
returns uuid
language plpgsql security definer
set search_path = ''
set row_security = off
as $$
declare
  caller uuid := auth.uid();
  v_project_status text;
  v_showcase_id uuid;
  link jsonb;
  link_index integer;
begin
  if caller is null then raise exception 'Sign in to manage this showcase'; end if;
  if not exists (
    select 1 from public.workspace_memberships m
    where m.workspace_id = p_workspace_id and m.user_id = caller
      and m.ended_at is null and m.role in ('owner', 'admin')
  ) then raise exception 'Only project owner or admin can manage the showcase'; end if;

  select w.project_status into v_project_status
  from public.workspaces w where w.id = p_workspace_id;
  if not found then raise exception 'Project not found'; end if;
  if p_publish and v_project_status <> 'completed' then
    raise exception 'Complete the project before publishing a showcase';
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 1 and 160 then
    raise exception 'Showcase title must be between 1 and 160 characters';
  end if;
  if length(btrim(coalesce(p_overview, ''))) not between 1 and 10000 then
    raise exception 'Showcase overview must be between 1 and 10000 characters';
  end if;
  if p_links is null or jsonb_typeof(p_links) <> 'array' then
    raise exception 'Provide at most 10 showcase links';
  end if;
  for link in select value from jsonb_array_elements(p_links) loop
    if jsonb_typeof(link) <> 'object'
      or length(btrim(coalesce(link->>'label', ''))) not between 1 and 40
      or length(coalesce(link->>'url', '')) > 2048
      or coalesce(link->>'url', '') !~* '^https?://[^[:space:]]+$' then
      raise exception 'Each link needs a label and a valid http or https URL';
    end if;
  end loop;

  insert into public.showcases (workspace_id, title, overview, status, published_at, updated_by)
  values (
    p_workspace_id, btrim(p_title), btrim(p_overview),
    case when p_publish then 'published' else 'unpublished' end,
    case when p_publish then now() else null end, caller
  )
  on conflict (workspace_id) do update set
    title = excluded.title,
    overview = excluded.overview,
    status = excluded.status,
    published_at = excluded.published_at,
    updated_by = caller,
    updated_at = now()
    returning id into v_showcase_id;

  delete from public.showcase_links where showcase_links.showcase_id = v_showcase_id;
  link_index := 0;
  for link in select value from jsonb_array_elements(p_links) loop
    insert into public.showcase_links (showcase_id, label, url, sort_order)
    values (v_showcase_id, btrim(link->>'label'), btrim(link->>'url'), link_index);
    link_index := link_index + 1;
  end loop;
  return v_showcase_id;
end
$$;

create or replace function public.get_project_showcase_contributors(p_workspace_id uuid)
returns table (user_id uuid, username text, display_name text)
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select p.user_id, p.username, p.display_name
  from public.profiles p
  where exists (
    select 1 from public.workspace_memberships me
    where me.workspace_id = p_workspace_id and me.user_id = auth.uid()
      and me.ended_at is null and me.role in ('owner', 'admin')
  ) and (
    exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.owner_id = p.user_id)
    or exists (
      select 1 from public.workspaces w
      join public.collaboration_requests r on r.opportunity_id = w.opportunity_id
      where w.id = p_workspace_id and r.applicant_id = p.user_id and r.status = 'accepted'
    )
    or exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = p_workspace_id and m.user_id = p.user_id
    )
  )
  order by lower(p.display_name), p.user_id
$$;

create or replace function public.get_public_project_showcases(p_showcase_id uuid default null)
returns table (
  id uuid,
  workspace_id uuid,
  title text,
  overview text,
  published_at timestamptz,
  project_title text,
  contributors jsonb,
  links jsonb
)
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select s.id, s.workspace_id, s.title, s.overview, s.published_at,
    case when o.deleted_at is null then o.title else 'Completed project' end as project_title,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'username', p.username, 'display_name', p.display_name
      ) order by lower(p.display_name), p.user_id)
      from public.profiles p
      where p.user_id = w.owner_id
        or exists (
          select 1 from public.collaboration_requests r
          where r.opportunity_id = w.opportunity_id and r.applicant_id = p.user_id and r.status = 'accepted'
        )
        or exists (
          select 1 from public.workspace_memberships m
          where m.workspace_id = w.id and m.user_id = p.user_id
        )
    ), '[]'::jsonb) as contributors,
    coalesce((
      select jsonb_agg(jsonb_build_object('label', sl.label, 'url', sl.url) order by sl.sort_order, sl.created_at)
      from public.showcase_links sl where sl.showcase_id = s.id
    ), '[]'::jsonb) as links
  from public.showcases s
  join public.workspaces w on w.id = s.workspace_id and w.project_status = 'completed'
  join public.opportunities o on o.id = w.opportunity_id
  where s.status = 'published' and (p_showcase_id is null or s.id = p_showcase_id)
  order by s.published_at desc, s.id
$$;

revoke all on function public.save_project_showcase(uuid, text, text, jsonb, boolean) from public, anon;
revoke all on function public.get_project_showcase_contributors(uuid) from public, anon;
revoke all on function public.get_public_project_showcases(uuid) from public;
grant execute on function public.save_project_showcase(uuid, text, text, jsonb, boolean) to authenticated;
grant execute on function public.get_project_showcase_contributors(uuid) to authenticated;
grant execute on function public.get_public_project_showcases(uuid) to anon, authenticated;
