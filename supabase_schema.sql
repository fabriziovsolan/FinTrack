-- ══════════════════════════════════════════════════════════
-- FinTrack — Schema SQL para Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════

-- ── Tarjetas ──────────────────────────────────────────────
create table public.cards (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  bank_name    text not null,
  name         text not null,
  limit_amount numeric(15,2) not null default 0,
  created_at   timestamptz default now()
);

-- ── Gastos ────────────────────────────────────────────────
create table public.expenses (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  card_id      bigint references public.cards(id) on delete set null,
  description  text not null,
  amount       numeric(15,2) not null,
  installments integer not null default 1,
  date         date not null,
  month        text not null,
  created_at   timestamptz default now()
);

-- ── Ingresos ──────────────────────────────────────────────
create table public.income (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  description  text not null,
  amount       numeric(15,2) not null,
  date         date not null,
  month        text not null,
  created_at   timestamptz default now()
);

-- ── Préstamos ─────────────────────────────────────────────
create table public.loans (
  id               bigint generated always as identity primary key,
  user_id          uuid references auth.users(id) on delete cascade not null,
  bank_name        text not null,
  description      text not null,
  total_amount     numeric(15,2) not null,
  remaining_amount numeric(15,2) not null,
  monthly_payment  numeric(15,2) not null,
  start_date       date,
  end_date         date,
  interest_rate    numeric(6,2) default 0,
  created_at       timestamptz default now()
);

-- ══════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- Cada usuario solo puede ver y modificar SUS propios datos
-- ══════════════════════════════════════════════════════════

alter table public.cards    enable row level security;
alter table public.expenses enable row level security;
alter table public.income   enable row level security;
alter table public.loans    enable row level security;

-- Cards
create policy "users manage own cards"    on public.cards    for all using (auth.uid() = user_id);
-- Expenses
create policy "users manage own expenses" on public.expenses for all using (auth.uid() = user_id);
-- Income
create policy "users manage own income"   on public.income   for all using (auth.uid() = user_id);
-- Loans
create policy "users manage own loans"    on public.loans    for all using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════
-- Índices para mejorar performance
-- ══════════════════════════════════════════════════════════
create index on public.cards    (user_id);
create index on public.expenses (user_id, month);
create index on public.income   (user_id, month);
create index on public.loans    (user_id);
