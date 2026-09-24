begin;

-- Remove the old MVP write policies if they exist.
drop policy if exists "Allow anonymous chama inserts" on public.chamas;
drop policy if exists "Allow anonymous chama updates" on public.chamas;
drop policy if exists "Allow signed-in chama inserts" on public.chamas;

create policy "Allow signed-in chama inserts"
  on public.chamas for insert
  to authenticated
  with check (owner_id = auth.uid());

commit;