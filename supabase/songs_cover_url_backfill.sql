update public.songs
set cover_url = cover_art_url
where cover_url is null
  and cover_art_url is not null;
