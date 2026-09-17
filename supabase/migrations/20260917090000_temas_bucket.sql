-- Miniaturas dos temas do Studio: bucket público, escrita só pelo servidor.
insert into storage.buckets (id, name, public)
values ('temas', 'temas', true)
on conflict (id) do update set public = true;

drop policy if exists "temas_public_read" on storage.objects;
create policy "temas_public_read"
  on storage.objects for select
  using (bucket_id = 'temas');
