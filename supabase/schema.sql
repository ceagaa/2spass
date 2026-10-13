-- =============================================================================
--  2sPass · Cofre de senhas
--  Supabase schema + Row Level Security
--  Run this in the Supabase SQL editor (Dashboard → SQL → New query).
--
--  IDEMPOTENT — safe to re-run on a fresh or an already-provisioned database.
-- =============================================================================
--
--  The server stores CIPHERTEXT ONLY. There is no column for a master password,
--  a derived key, or any plaintext secret. `salt` and `kdf_salt` are public
--  (non-secret) KDF salting values; `encrypted_data` is an AES-256-GCM blob
--  produced exclusively in the user's browser.
-- =============================================================================

-- gen_random_uuid() lives in core since PostgreSQL 13; pgcrypto is kept for
-- portability to older/self-hosted setups. Already installed → no-op.
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
--  Table: public.vaults
--  One encrypted vault per user (the whole vault is a single ciphertext blob).
-- -----------------------------------------------------------------------------
create table if not exists public.vaults (
  id              uuid primary key default gen_random_uuid(),
  -- One row per user: enforces the "single vault" invariant at the DB level.
  user_id         uuid not null unique references auth.users (id) on delete cascade,
  -- Random per-user salt (base64) mixed into the vault encryption key (HKDF).
  salt            text not null
                    constraint vaults_salt_len check (length(salt) between 8 and 512),
  -- Public KDF salt used to derive the auth credential (normalized e-mail).
  -- Non-secret by design; never read back by the app.
  kdf_salt        text not null
                    constraint vaults_kdf_salt_len check (length(kdf_salt) between 1 and 320),
  -- `v1.<iv-b64>.<ciphertext-b64>` — AES-256-GCM. NULL until first unlock.
  -- The format check mirrors src/lib/crypto.ts::encryptJSON (btoa → standard
  -- base64, 12-byte IV → exactly 16 unpadded chars) and makes it impossible to
  -- persist plaintext or an arbitrary blob by accident.
  encrypted_data  text
                    constraint vaults_encrypted_data_fmt check (
                      encrypted_data is null
                      or (
                        encrypted_data ~ '^v1\.[A-Za-z0-9+/]{16}\.[A-Za-z0-9+/]+={0,2}$'
                        and length(encrypted_data) <= 16777216   -- 16 MB ceiling
                      )
                    ),
  data_version    integer not null default 1
                    constraint vaults_data_version_min check (data_version >= 1),
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint vaults_updated_not_before_created check (updated_at >= created_at)
);

comment on table public.vaults is
  'Vaults hold ciphertext only. The server can never decrypt them.';
comment on column public.vaults.encrypted_data is
  'v1.<iv>.<ciphertext> — AES-256-GCM, produced and consumed only in the browser.';

-- `user_id` is already indexed by the UNIQUE constraint above; the extra index
-- created by older versions of this script was a pure duplicate.
drop index if exists public.vaults_user_id_idx;

-- -----------------------------------------------------------------------------
--  Upgrade shim. CREATE TABLE IF NOT EXISTS never alters an existing table, so
--  a database provisioned by a previous version of this script would miss the
--  CHECKs. If this block fails, a legacy row violates the format — fix the data
--  first: the whole script rolls back and nothing is applied.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vaults'::regclass and conname = 'vaults_salt_len'
  ) then
    alter table public.vaults
      add constraint vaults_salt_len check (length(salt) between 8 and 512);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vaults'::regclass and conname = 'vaults_kdf_salt_len'
  ) then
    alter table public.vaults
      add constraint vaults_kdf_salt_len check (length(kdf_salt) between 1 and 320);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vaults'::regclass and conname = 'vaults_encrypted_data_fmt'
  ) then
    alter table public.vaults
      add constraint vaults_encrypted_data_fmt check (
        encrypted_data is null
        or (
          encrypted_data ~ '^v1\.[A-Za-z0-9+/]{16}\.[A-Za-z0-9+/]+={0,2}$'
          and length(encrypted_data) <= 16777216
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vaults'::regclass and conname = 'vaults_data_version_min'
  ) then
    alter table public.vaults
      add constraint vaults_data_version_min check (data_version >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vaults'::regclass and conname = 'vaults_updated_not_before_created'
  ) then
    alter table public.vaults
      add constraint vaults_updated_not_before_created check (updated_at >= created_at);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
--  Row guard: timestamps belong to the database and the identity columns are
--  immutable. Applies to every role — including BYPASSRLS ones, which is what
--  makes this stricter than RLS alone for `user_id` swaps.
-- -----------------------------------------------------------------------------
drop trigger if exists vaults_set_updated_at on public.vaults;
drop function if exists public.touch_updated_at();   -- legacy, no longer referenced

create or replace function public.vaults_guard_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'vaults.id is immutable';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'vaults.user_id is immutable';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'vaults.created_at is immutable';
    end if;
    new.updated_at := now();
  else
    new.created_at := now();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger vaults_set_updated_at
  before insert or update on public.vaults
  for each row execute function public.vaults_guard_row();

-- Postgres checks EXECUTE on a trigger function only when the trigger is
-- CREATED, never when it fires, so this cannot break inserts or updates. The
-- body performs no table access, so there is nothing else to gate.
revoke execute on function public.vaults_guard_row() from PUBLIC, anon, authenticated;

-- =============================================================================
--  Row Level Security — enforced at the DB layer.
--  A user can only ever select / insert / update / delete rows they own.
--
--  FORCE also subjects the table owner to the policies. That does not break
--  maintenance: `postgres` (SQL editor, pg_dump) and `service_role` both carry
--  BYPASSRLS, which outranks FORCE.
-- =============================================================================
alter table public.vaults enable row level security;
alter table public.vaults force row level security;

-- -----------------------------------------------------------------------------
--  Least privilege: revoke first, then grant only what the app uses, so the
--  outcome does not depend on the project's default privileges (Supabase
--  stops applying them to new projects on 2026-10-30).
--
--  `anon` gets nothing at all. `service_role` keeps its access by design — it
--  holds BYPASSRLS, its key must never reach the browser, and the app only
--  uses the publishable anon key.
-- -----------------------------------------------------------------------------
revoke all on table public.vaults from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.vaults to authenticated;

-- -----------------------------------------------------------------------------
--  One policy per operation, scoped to a role with `to authenticated` (an
--  unscoped policy would also be evaluated for `anon`). `auth.uid()` is wrapped
--  in a scalar subquery so it is evaluated once per statement, not per row.
-- -----------------------------------------------------------------------------
drop policy if exists "vaults_select_own" on public.vaults;
create policy "vaults_select_own"
  on public.vaults
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "vaults_insert_own" on public.vaults;
create policy "vaults_insert_own"
  on public.vaults
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "vaults_update_own" on public.vaults;
create policy "vaults_update_own"
  on public.vaults
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "vaults_delete_own" on public.vaults;
create policy "vaults_delete_own"
  on public.vaults
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
--  Realtime is opt-in per table — make sure `vaults` is never streamed.
--  Change events would leak ciphertext metadata (write timing and size) to
--  anyone holding an authenticated session.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vaults'
  ) then
    execute 'alter publication supabase_realtime drop table public.vaults';
  end if;
end;
$$;

-- =============================================================================
--  Operator checklist (Dashboard, outside this script)
-- =============================================================================
--  Authentication → Providers → Email
--    * "Confirm email" — recommended ON for a real deployment. supabaseBackend
--      .signUp() returns null when Supabase answers without a `session`, so the
--      app stops at the "Confirme seu e-mail…" notice instead of attempting the
--      vault insert as `anon` (RLS would reject it with 42501). With it OFF,
--      signup returns a session and the row is created immediately.
--    * "Leaked password protection" ON plus a strict password policy is safe
--      here: the client sends a 43-char Argon2id-derived credential, never the
--      master password.
--    * Enable MFA and rate limits where available.
--
--  Secrets
--    * Only VITE_SUPABASE_URL + the publishable anon key belong in the client.
--      `service_role` bypasses RLS entirely: server-side only, never shipped.
--
--  Notes
--    * The client NEVER sends the master password. It sends an HKDF-derived
--      auth credential that Supabase hashes with bcrypt. That credential cannot
--      decrypt the vault (different HKDF domain + separate vault salt).
--    * `encrypted_data` tampering is detectable: AES-GCM authentication fails
--      and the client refuses to load the vault.
--    * Backups of this table are useless to an attacker without the user's
--      master password.
--    * If you ever need to migrate `user_id` (account merge), disable the
--      guard trigger for the maintenance window:
--        alter table public.vaults disable trigger vaults_set_updated_at;
--      ... then re-enable it.
-- =============================================================================
