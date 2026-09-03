-- Storage: recipe-photos bucket
-- Public read; authenticated users may write only under their own <uid>/ prefix.
-- Path convention: recipe-photos/<user-uid>/<recipe-id>/<file>
-- recipes.image_url stores the public object URL for an object in this bucket.

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

drop policy if exists "recipe-photos public read" on storage.objects;
create policy "recipe-photos public read" on storage.objects
  for select using (bucket_id = 'recipe-photos');

drop policy if exists "recipe-photos owner insert" on storage.objects;
create policy "recipe-photos owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recipe-photos owner update" on storage.objects;
create policy "recipe-photos owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recipe-photos owner delete" on storage.objects;
create policy "recipe-photos owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
