create extension if not exists pgcrypto;

create table if not exists public.chamas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  city text default '',
  goal jsonb not null,
  members jsonb not null default '[]'::jsonb,
  contributions jsonb not null default '[]'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chamas add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.chamas add column if not exists achievements jsonb not null default '[]'::jsonb;

create table if not exists public.chama_join_requests (
  id uuid primary key default gen_random_uuid(),
  chama_id uuid not null references public.chamas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null default 'New member',
  requester_email text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  unique (chama_id, user_id)
);

alter table public.chama_join_requests add column if not exists requester_name text not null default 'New member';
alter table public.chama_join_requests add column if not exists requester_email text not null default '';
alter table public.chama_join_requests add column if not exists requester_phone_number text not null default '';
alter table public.chama_join_requests add column if not exists requester_id_number text not null default '';

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  chama_id uuid not null references public.chamas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  member_name text not null,
  initials text not null default 'CH',
  member_tone text not null default 'sage',
  purpose text not null,
  method text not null check (method in ('M-Pesa', 'Bank transfer')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payer_phone_number text,
  bank_reference text,
  merchant_request_id text,
  checkout_request_id text unique,
  receipt_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index if not exists payments_bank_reference_unique
  on public.payments (chama_id, bank_reference)
  where method = 'Bank transfer' and bank_reference is not null;

create unique index if not exists payments_receipt_number_unique
  on public.payments (receipt_number)
  where receipt_number is not null;

alter table public.payments enable row level security;
drop policy if exists "Members and chama owners can read payments" on public.payments;
create policy "Members and chama owners can read payments"
  on public.payments for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.chamas
      where chamas.id = payments.chama_id
        and chamas.owner_id = auth.uid()
    )
  );
grant select on public.payments to authenticated;

create or replace function public.confirm_chama_payment(p_payment_id uuid, p_receipt text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_goal jsonb;
  v_next_goal jsonb;
  v_achievements jsonb;
  v_goal_target numeric;
  v_goal_saved numeric;
  v_contribution jsonb;
  v_achievement jsonb;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found or v_payment.status <> 'pending' then
    return false;
  end if;

  select goal, achievements into v_goal, v_achievements
  from public.chamas
  where id = v_payment.chama_id
  for update;

  v_goal_target := coalesce((v_goal->>'target')::numeric, 0);
  v_goal_saved := coalesce((v_goal->>'saved')::numeric, 0);
  v_next_goal := coalesce(v_goal, '{}'::jsonb);

  if v_goal_target > 0 then
    v_next_goal := jsonb_set(
      v_next_goal,
      '{saved}',
      to_jsonb(least(v_goal_target, v_goal_saved + v_payment.amount))
    );
    if least(v_goal_target, v_goal_saved + v_payment.amount) >= v_goal_target then
      v_achievement := v_next_goal || jsonb_build_object(
        'id', coalesce(v_next_goal->>'id', gen_random_uuid()::text),
        'achieved_at', now()
      );
      v_achievements := coalesce(v_achievements, '[]'::jsonb) || jsonb_build_array(v_achievement);
      v_next_goal := jsonb_build_object('name', 'No shared goal yet', 'target', 0, 'saved', 0);
    end if;
  end if;

  v_contribution := jsonb_build_object(
    'member', v_payment.member_name,
    'initials', v_payment.initials,
    'date', to_char(now() at time zone 'Africa/Nairobi', 'DD Mon, HH24:MI'),
    'amount', 'KES ' || to_char(v_payment.amount, 'FM999,999,999,999'),
    'tone', v_payment.member_tone,
    'method', v_payment.method,
    'purpose', v_payment.purpose,
    'receipt', p_receipt
  );

  update public.chamas
  set balance = balance + v_payment.amount,
      contributions = jsonb_build_array(v_contribution) || coalesce(contributions, '[]'::jsonb),
      members = coalesce(
        (
          select jsonb_agg(
            case
              when member_rows.member->>'name' = v_payment.member_name
                then jsonb_set(member_rows.member, '{status}', to_jsonb('Paid this month'::text), true)
              else member_rows.member
            end
            order by member_rows.position
          )
          from jsonb_array_elements(coalesce(public.chamas.members, '[]'::jsonb))
            with ordinality as member_rows(member, position)
        ),
        '[]'::jsonb
      ),
      goal = v_next_goal,
      achievements = coalesce(v_achievements, '[]'::jsonb),
      updated_at = now()
  where id = v_payment.chama_id;

  update public.payments
  set status = 'paid',
      receipt_number = p_receipt,
      confirmed_at = now(),
      updated_at = now()
  where id = v_payment.id;

  return true;
end;
$$;

revoke all on function public.confirm_chama_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_chama_payment(uuid, text) to service_role;

alter table public.chamas enable row level security;
alter table public.chama_join_requests enable row level security;

-- Chamas can be searched by signed-in users, but only their chairman can
-- create or update the chama record.
create policy "Allow anonymous chama reads"
  on public.chamas for select
  to anon
  using (true);

create policy "Allow signed-in chama reads"
  on public.chamas for select
  to authenticated
  using (true);

create policy "Allow signed-in chama inserts"
  on public.chamas for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Allow signed-in chama updates"
  on public.chamas for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Allow signed-in join request inserts"
  on public.chama_join_requests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Allow signed-in join request reads"
  on public.chama_join_requests for select
  to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.chamas where id = chama_id and owner_id = auth.uid()));

create policy "Allow chama owners to update join requests"
  on public.chama_join_requests for update
  to authenticated
  using (exists (select 1 from public.chamas where id = chama_id and owner_id = auth.uid()))
  with check (exists (select 1 from public.chamas where id = chama_id and owner_id = auth.uid()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chamas'
  ) then
    alter publication supabase_realtime add table public.chamas;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chama_join_requests'
  ) then
    alter publication supabase_realtime add table public.chama_join_requests;
  end if;
end $$;
