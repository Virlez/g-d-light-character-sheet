-- Lightweight columns for sheet lists.
-- Keeps full sheet JSON in data, but avoids loading it for home/list cards.

alter table public.sheets
add column if not exists image_data text;

update public.sheets
set
    name = coalesce(nullif(name, ''), nullif(data ->> 'char_name', ''), 'Sans nom'),
    image_data = nullif(data ->> 'char_image_data', '')
where data is not null
  and (
      image_data is null
      or name is null
      or name = ''
  );

create index if not exists sheets_saved_at_desc_idx
on public.sheets (saved_at desc);

create index if not exists sheets_user_saved_at_desc_idx
on public.sheets (user_id, saved_at desc);

create index if not exists sheets_guild_saved_at_desc_idx
on public.sheets (guild_id, saved_at desc)
where guild_id is not null;

create index if not exists sheets_unguilded_saved_at_desc_idx
on public.sheets (saved_at desc)
where guild_id is null;
