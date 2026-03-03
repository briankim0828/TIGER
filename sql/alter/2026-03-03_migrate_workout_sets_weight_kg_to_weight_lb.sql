-- Remote migration: switch workout set storage from kg int to lb decimal (1dp)
-- Run against Supabase/Postgres.

begin;

alter table public.workout_sets
  add column if not exists weight_lb numeric(8,1);

-- Convert existing kg values to lb with 1 decimal precision.
update public.workout_sets
set weight_lb = round((weight_kg::numeric * 2.2046226218), 1)
where weight_kg is not null
  and (weight_lb is null);

-- Optional: enforce one-decimal scale by rewriting values that exceed it.
update public.workout_sets
set weight_lb = round(weight_lb, 1)
where weight_lb is not null;

alter table public.workout_sets
  drop column if exists weight_kg;

commit;
