-- Profiles, pseudos and application roles.
-- Apply this migration in the Supabase SQL editor or through the Supabase CLI.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    pseudo text,
    email text,
    role text not null default 'user',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_role_check check (role in ('user', 'mj', 'admin')),
    constraint profiles_pseudo_length_check check (pseudo is null or char_length(btrim(pseudo)) between 2 and 32)
);

create unique index if not exists profiles_pseudo_unique_ci
    on public.profiles (lower(pseudo))
    where pseudo is not null;

alter table public.profiles enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select role from public.profiles where id = auth.uid()),
        'user'
    );
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    requested_pseudo text;
begin
    requested_pseudo := nullif(btrim(new.raw_user_meta_data ->> 'pseudo'), '');

    insert into public.profiles (id, pseudo, email, role)
    values (new.id, requested_pseudo, new.email, 'user')
    on conflict (id) do update
        set email = excluded.email,
            pseudo = coalesce(public.profiles.pseudo, excluded.pseudo);

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, pseudo, email, role)
select users.id, null, users.email, 'user'
from auth.users users
on conflict (id) do nothing;

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

create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
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

    update public.profiles
    set role = new_role
    where id = target_user_id
    returning * into updated_profile;

    if updated_profile.id is null then
        raise exception 'profile not found';
    end if;

    return updated_profile;
end;
$$;

drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff"
on public.profiles for select
using (id = auth.uid() or public.current_app_role() in ('mj', 'admin'));

-- Profile writes are intentionally handled by security-definer RPCs.
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;

alter table public.sheets enable row level security;

drop policy if exists "sheets_select_own" on public.sheets;
drop policy if exists "sheets_insert_own" on public.sheets;
drop policy if exists "sheets_update_own" on public.sheets;
drop policy if exists "sheets_delete_own" on public.sheets;
drop policy if exists "sheets_select_owner_or_staff" on public.sheets;
drop policy if exists "sheets_insert_owner" on public.sheets;
drop policy if exists "sheets_update_owner" on public.sheets;
drop policy if exists "sheets_delete_owner" on public.sheets;

create policy "sheets_select_owner_or_staff"
on public.sheets for select
using (user_id = auth.uid() or public.current_app_role() in ('mj', 'admin'));

create policy "sheets_insert_owner"
on public.sheets for insert
with check (user_id = auth.uid());

create policy "sheets_update_owner"
on public.sheets for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "sheets_delete_owner"
on public.sheets for delete
using (user_id = auth.uid());

grant execute on function public.complete_profile(text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.current_app_role() to authenticated;

-- Bootstrap the first admin manually after applying the migration:
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
