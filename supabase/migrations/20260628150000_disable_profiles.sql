-- Reversible account disabling.
-- Disabled users cannot use the app and their sheets are hidden from normal lists.

alter table public.profiles
add column if not exists disabled_at timestamptz,
add column if not exists disabled_by uuid references public.profiles(id);

create index if not exists profiles_disabled_at_idx
on public.profiles (disabled_at);

create index if not exists profiles_role_active_idx
on public.profiles (role)
where disabled_at is null;

create extension if not exists pg_trgm;

create index if not exists sheets_name_trgm_idx
on public.sheets using gin (name gin_trgm_ops);

create or replace function public.current_profile_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and disabled_at is null
    );
$$;

create or replace function public.profile_is_active(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = profile_id
          and disabled_at is null
    );
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (
            select role
            from public.profiles
            where id = auth.uid()
              and disabled_at is null
        ),
        'user'
    );
$$;

create or replace function public.current_mj_guild_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select mj_guild_id
    from public.profiles
    where id = auth.uid()
      and role = 'mj'
      and disabled_at is null;
$$;

create or replace function public.complete_profile(new_pseudo text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_pseudo text;
    updated_profile public.profiles;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    if exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and disabled_at is not null
    ) then
        raise exception 'account disabled';
    end if;

    normalized_pseudo := regexp_replace(btrim(coalesce(new_pseudo, '')), '\s+', ' ', 'g');

    if char_length(normalized_pseudo) < 2 or char_length(normalized_pseudo) > 32 then
        raise exception 'pseudo must be between 2 and 32 characters';
    end if;

    insert into public.profiles (id, pseudo, email, role)
    values (
        auth.uid(),
        normalized_pseudo,
        (select email from auth.users where id = auth.uid()),
        'user'
    )
    on conflict (id) do update
        set pseudo = excluded.pseudo,
            email = coalesce(public.profiles.email, excluded.email)
    returning * into updated_profile;

    return updated_profile;
end;
$$;

create or replace function public.admin_set_user_disabled(target_user_id uuid, disabled boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
    updated_profile public.profiles;
    target_profile public.profiles;
    active_admin_count integer;
begin
    if public.current_app_role() <> 'admin' then
        raise exception 'admin role required';
    end if;

    if target_user_id = auth.uid() then
        raise exception 'cannot disable yourself';
    end if;

    select * into target_profile
    from public.profiles
    where id = target_user_id;

    if target_profile.id is null then
        raise exception 'profile not found';
    end if;

    if disabled and target_profile.role = 'admin' and target_profile.disabled_at is null then
        select count(*) into active_admin_count
        from public.profiles
        where role = 'admin'
          and disabled_at is null;

        if active_admin_count <= 1 then
            raise exception 'cannot disable last active admin';
        end if;
    end if;

    update public.profiles
    set disabled_at = case when disabled then coalesce(disabled_at, now()) else null end,
        disabled_by = case when disabled then auth.uid() else null end
    where id = target_user_id
    returning * into updated_profile;

    return updated_profile;
end;
$$;

drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff"
on public.profiles for select
using (id = auth.uid());

create or replace function public.list_visible_profiles()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
    select profiles.*
    from public.profiles
    where
        profiles.id = auth.uid()
        or public.current_app_role() = 'admin'
        or (
            public.current_app_role() = 'mj'
            and profiles.disabled_at is null
            and exists (
                select 1
                from public.sheets
                where sheets.user_id = profiles.id
                  and sheets.guild_id = public.current_mj_guild_id()
            )
        )
    order by profiles.pseudo nulls last;
$$;

create or replace function public.admin_list_sheets(
    filter_guild_id text default null,
    filter_user_id uuid default null,
    search_name text default null,
    limit_count integer default 50,
    offset_count integer default 0
)
returns table (
    id text,
    name text,
    saved_at timestamptz,
    user_id uuid,
    guild_id text,
    owner_pseudo text,
    total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
    select
        sheets.id,
        sheets.name,
        sheets.saved_at,
        sheets.user_id,
        sheets.guild_id,
        profiles.pseudo as owner_pseudo,
        count(*) over() as total_count
    from public.sheets
    join public.profiles on profiles.id = sheets.user_id
    where public.current_app_role() = 'admin'
      and profiles.disabled_at is null
      and (
          filter_guild_id is null
          or (filter_guild_id = '__none__' and sheets.guild_id is null)
          or sheets.guild_id = filter_guild_id
      )
      and (filter_user_id is null or sheets.user_id = filter_user_id)
      and (
          nullif(btrim(coalesce(search_name, '')), '') is null
          or sheets.name ilike ('%' || btrim(search_name) || '%')
      )
    order by sheets.saved_at desc
    limit greatest(1, least(coalesce(limit_count, 50), 100))
    offset greatest(0, coalesce(offset_count, 0));
$$;

create or replace function public.mj_list_player_sheets(
    filter_user_id uuid default null,
    search_name text default null,
    limit_count integer default 50,
    offset_count integer default 0
)
returns table (
    id text,
    name text,
    saved_at timestamptz,
    user_id uuid,
    guild_id text,
    owner_pseudo text,
    total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
    select
        sheets.id,
        sheets.name,
        sheets.saved_at,
        sheets.user_id,
        sheets.guild_id,
        profiles.pseudo as owner_pseudo,
        count(*) over() as total_count
    from public.sheets
    join public.profiles on profiles.id = sheets.user_id
    where public.current_app_role() = 'mj'
      and profiles.disabled_at is null
      and sheets.guild_id is not null
      and sheets.guild_id = public.current_mj_guild_id()
      and sheets.user_id <> auth.uid()
      and (filter_user_id is null or sheets.user_id = filter_user_id)
      and (
          nullif(btrim(coalesce(search_name, '')), '') is null
          or sheets.name ilike ('%' || btrim(search_name) || '%')
      )
    order by sheets.saved_at desc
    limit greatest(1, least(coalesce(limit_count, 50), 100))
    offset greatest(0, coalesce(offset_count, 0));
$$;

drop policy if exists "sheets_select_owner_or_staff" on public.sheets;
create policy "sheets_select_owner_or_staff"
on public.sheets for select
using (
    public.current_profile_is_active()
    and public.profile_is_active(sheets.user_id)
    and (
        user_id = auth.uid()
        or public.current_app_role() = 'admin'
        or (
            public.current_app_role() = 'mj'
            and guild_id is not null
            and guild_id = public.current_mj_guild_id()
        )
    )
);

drop policy if exists "sheets_insert_owner" on public.sheets;
create policy "sheets_insert_owner"
on public.sheets for insert
with check (public.current_profile_is_active() and user_id = auth.uid());

drop policy if exists "sheets_update_owner" on public.sheets;
create policy "sheets_update_owner"
on public.sheets for update
using (public.current_profile_is_active() and user_id = auth.uid())
with check (public.current_profile_is_active() and user_id = auth.uid());

drop policy if exists "sheets_delete_owner" on public.sheets;
create policy "sheets_delete_owner"
on public.sheets for delete
using (public.current_profile_is_active() and user_id = auth.uid());

grant execute on function public.current_profile_is_active() to authenticated;
grant execute on function public.profile_is_active(uuid) to authenticated;
grant execute on function public.list_visible_profiles() to authenticated;
grant execute on function public.admin_list_sheets(text, uuid, text, integer, integer) to authenticated;
grant execute on function public.mj_list_player_sheets(uuid, text, integer, integer) to authenticated;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;
