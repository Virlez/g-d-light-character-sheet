-- Guilds and scoped MJ access.
-- Apply after 20260628120000_profiles_roles.sql.

create table if not exists public.guilds (
    id text primary key,
    name text not null unique
);

insert into public.guilds (id, name)
values
    ('ordo_augustus', 'Ordo Augustus'),
    ('arcanum_astralis', 'Arcanum Astralis')
on conflict (id) do update
set name = excluded.name;

alter table public.guilds enable row level security;

drop policy if exists "guilds_select_authenticated" on public.guilds;
create policy "guilds_select_authenticated"
on public.guilds for select
using (auth.role() = 'authenticated');

alter table public.profiles
add column if not exists mj_guild_id text references public.guilds(id);

alter table public.sheets
add column if not exists guild_id text references public.guilds(id);

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
      and role = 'mj';
$$;

drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff"
on public.profiles for select
using (
    id = auth.uid()
    or public.current_app_role() = 'admin'
    or (
        public.current_app_role() = 'mj'
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
    user_id = auth.uid()
    or public.current_app_role() = 'admin'
    or (
        public.current_app_role() = 'mj'
        and guild_id is not null
        and guild_id = public.current_mj_guild_id()
    )
);

create or replace function public.admin_set_user_role(
    target_user_id uuid,
    new_role text,
    new_mj_guild_id text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
    updated_profile public.profiles;
begin
    if public.current_app_role() <> 'admin' then
        raise exception 'admin role required';
    end if;

    if new_role not in ('user', 'mj', 'admin') then
        raise exception 'invalid role';
    end if;

    if new_role = 'mj' and new_mj_guild_id is null then
        raise exception 'mj guild required';
    end if;

    if new_role = 'mj' and not exists (select 1 from public.guilds where id = new_mj_guild_id) then
        raise exception 'invalid guild';
    end if;

    update public.profiles
    set role = new_role,
        mj_guild_id = case when new_role = 'mj' then new_mj_guild_id else null end
    where id = target_user_id
    returning * into updated_profile;

    if updated_profile.id is null then
        raise exception 'profile not found';
    end if;

    return updated_profile;
end;
$$;

create or replace function public.admin_assign_sheet_guild(target_sheet_id text, new_guild_id text)
returns public.sheets
language plpgsql
security definer
set search_path = public
as $$
declare
    guild_name text;
    updated_sheet public.sheets;
begin
    if public.current_app_role() <> 'admin' then
        raise exception 'admin role required';
    end if;

    select name into guild_name
    from public.guilds
    where id = new_guild_id;

    if guild_name is null then
        raise exception 'invalid guild';
    end if;

    update public.sheets
    set guild_id = new_guild_id,
        data = jsonb_set(coalesce(data::jsonb, '{}'::jsonb), '{guild_name}', to_jsonb(guild_name), true)
    where id = target_sheet_id
    returning * into updated_sheet;

    if updated_sheet.id is null then
        raise exception 'sheet not found';
    end if;

    return updated_sheet;
end;
$$;

grant execute on function public.current_mj_guild_id() to authenticated;
grant execute on function public.admin_set_user_role(uuid, text, text) to authenticated;
grant execute on function public.admin_assign_sheet_guild(text, text) to authenticated;
