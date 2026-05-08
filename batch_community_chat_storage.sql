-- Batch Community Chat attachments storage bucket + basic policies
-- Bucket preference (per request): PUBLIC

begin;

-- Create bucket (if not already created)
insert into storage.buckets (id, name, public)
values ('batch-community-chat', 'batch-community-chat', true)
on conflict (id) do nothing;

-- Ensure RLS is on for objects table (Supabase storage defaults usually enable this)
alter table storage.objects enable row level security;

-- Allow everyone to read public bucket files
drop policy if exists batch_community_chat_objects_select_public on storage.objects;
create policy batch_community_chat_objects_select_public
on storage.objects
for select
to public
using (bucket_id = 'batch-community-chat');

-- Allow authenticated users to upload into the bucket
drop policy if exists batch_community_chat_objects_insert_authenticated on storage.objects;
create policy batch_community_chat_objects_insert_authenticated
on storage.objects
for insert
to authenticated
with check (bucket_id = 'batch-community-chat');

commit;

