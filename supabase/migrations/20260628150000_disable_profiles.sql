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
using (
    id = auth.uid()
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
);

drop policy if exists "sheets_select_owner_or_staff" on public.sheets;
create policy "sheets_select_owner_or_staff"
on public.sheets for select
using (
    public.current_profile_is_active()
    and exists (
        select 1
        from public.profiles owner_profile
        where owner_profile.id = sheets.user_id
          and owner_profile.disabled_at is null
    )
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
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;
