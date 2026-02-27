-- ============================================================
-- 002 — Dedicated Crew Auth Accounts
--
-- Gives each crew/rig a real Supabase Auth user so they get
-- a JWT → RLS works → Realtime sync works bidirectionally
-- between admin (office) and crew (field rigs).
-- ============================================================

-- 1. Add crew_email column so admin can track which email is
--    linked to each crew member.
alter table public.company_members
  add column if not exists crew_email text;

-- 2. Replace the signup trigger to handle crew vs admin signups.
--    Admin signup → create company + membership (existing behavior).
--    Crew signup  → link to existing company_members row via member_id
--                   in user metadata (admin pre-creates the row).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  company_name text;
  user_role text;
  target_company_id uuid;
  target_member_id uuid;
begin
  user_role := coalesce(new.raw_user_meta_data ->> 'role', 'admin');

  -- ── Crew signup: link auth user to existing company_members row ──
  if user_role = 'crew' then
    target_company_id := (new.raw_user_meta_data ->> 'company_id')::uuid;
    target_member_id  := (new.raw_user_meta_data ->> 'member_id')::uuid;

    if target_company_id is null or target_member_id is null then
      raise exception 'Crew signup missing company_id or member_id in metadata';
    end if;

    -- Set user_id and email on the pre-created company_members row
    update public.company_members
    set user_id    = new.id,
        crew_email = new.email
    where id         = target_member_id
      and company_id = target_company_id
      and user_id is null;

    return new;
  end if;

  -- ── Admin signup: create company + membership (unchanged) ──
  company_name := coalesce(
    new.raw_user_meta_data ->> 'company_name',
    split_part(new.email, '@', 1)
  );

  insert into public.companies (name, profile)
  values (
    company_name,
    jsonb_build_object('companyName', company_name)
  )
  returning id into new_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (new_company_id, new.id, 'admin');

  return new;
end;
$$;

-- 3. Allow crew members to read companies (they need it for auth lookup).
--    The existing RLS policy already covers authenticated users via
--    get_my_company_id(), which works once user_id is set on their row.
--    No additional policy needed.

-- 4. Add a partial index for crew login lookups (email on company_members).
create index if not exists company_members_crew_email_idx
  on public.company_members(crew_email)
  where crew_email is not null;
