begin;

-- Deletes the currently authenticated user and all related app data.
-- NOTE: This only removes rows from Postgres; it does not delete Supabase Storage objects.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete user-owned workout data (cascades to exercises/sets/media/milestones).
  delete from public.workout_sessions where user_id = v_user_id;

  -- Delete split templates (cascades to split exercises + sets).
  delete from public.splits where user_id = v_user_id;

  -- Delete user-scoped preferences and goals (these tables may not exist on older schemas).
  if to_regclass('public.user_exercise_goals') is not null then
    execute 'delete from public.user_exercise_goals where user_id = $1' using v_user_id;
  end if;

  if to_regclass('public.user_exercise_prefs') is not null then
    execute 'delete from public.user_exercise_prefs where user_id = $1' using v_user_id;
  end if;

  if to_regclass('public.user_favorite_exercises') is not null then
    execute 'delete from public.user_favorite_exercises where user_id = $1' using v_user_id;
  end if;

  if to_regclass('public.user_settings') is not null then
    execute 'delete from public.user_settings where user_id = $1' using v_user_id;
  end if;

  -- Delete any user-owned custom exercises. This cannot rely on FK cascade because
  -- exercise_catalog.owner_user_id does not specify ON DELETE CASCADE.
  delete from public.exercise_catalog where owner_user_id = v_user_id;

  -- Finally delete the auth user (FK cascades handle remaining user-owned rows).
  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

commit;
