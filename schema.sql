-- ============================================================
-- Nazrul Nazir & Co - Sistem Pengurusan Kes
-- Jalankan fail ni dalam Supabase Dashboard > SQL Editor > New Query
-- Copy semua, paste, klik RUN
-- ============================================================

-- 1. PROFILES (staff/pemilik firma)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'staff' check (role in ('owner','lawyer','staff')),
  created_at timestamptz default now()
);

-- 2. MATTERS (perkara/kes)
create table if not exists matters (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  case_title text not null,
  court_name text,
  category text,
  status text not null default 'active' check (status in ('active','closed','archived')),
  client_name text,
  we_act_for text,
  client_role text check (client_role in ('Plaintiff','Defendant','Applicant','Respondent','Appellant','Claimant','Accused','Complainant','Other')),
  next_court_date date,
  next_court_time time,
  proceeding_type text,
  next_action text,
  deadline date,
  responsible_staff uuid references profiles(id),
  fee_agreed numeric(12,2) default 0,
  amount_paid numeric(12,2) default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. CASE MANAGEMENT / KRONOLOGI
create table if not exists case_management_records (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references matters(id) on delete cascade,
  record_type text not null default 'case_management', -- case_management | payment | hearing | correspondence
  cm_date date,
  attendance text,
  what_happened text,
  court_directions text,
  orders_given text,
  documents_to_file text,
  deadline date,
  new_date date,
  new_time time,
  new_date_type text, -- Case Management/Hearing/Continued Hearing/Trial/e-Review/Decision/Filing deadline/Internal deadline
  next_action text,
  amount numeric(12,2), -- untuk record_type = payment
  recorded_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 4. TASKS
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date,
  priority text default 'normal' check (priority in ('low','normal','high','urgent')),
  matter_id uuid references matters(id) on delete set null,
  notes text,
  status text not null default 'pending' check (status in ('pending','completed')),
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- 5. DOCUMENTS
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references matters(id) on delete cascade,
  category text not null check (category in ('cause_paper','correspondence')),
  doc_type text, -- Writ, Summons, Affidavit, Surat kepada mahkamah, dll
  file_path text not null, -- path dalam storage bucket
  file_name text not null,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now()
);

-- 6. PAYMENTS / ACCOUNTS
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references matters(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_type text default 'payment' check (payment_type in ('payment','disbursement')),
  payment_date date default current_date,
  notes text,
  recorded_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Semua staff yang login (ada dalam profiles) boleh access semua rekod firma.
-- ============================================================
alter table profiles enable row level security;
alter table matters enable row level security;
alter table case_management_records enable row level security;
alter table tasks enable row level security;
alter table documents enable row level security;
alter table payments enable row level security;

create policy "staff_read_own_profile" on profiles for select using (auth.uid() = id);
create policy "staff_read_all_profiles" on profiles for select using (auth.uid() is not null);
create policy "staff_update_own_profile" on profiles for update using (auth.uid() = id);

create policy "staff_all_matters" on matters for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "staff_all_cm_records" on case_management_records for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "staff_all_tasks" on tasks for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "staff_all_documents" on documents for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "staff_all_payments" on payments for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- AUTO-CREATE PROFILE bila user baru sign up
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- STORAGE BUCKET untuk dokumen (jalankan lepas create bucket 'documents' di Storage)
-- ============================================================
-- Pergi Storage > New Bucket > nama: documents > Public: OFF (private)
-- Lepas tu jalankan policy ni:
-- create policy "staff_access_documents_storage" on storage.objects for all
--   using (bucket_id = 'documents' and auth.uid() is not null)
--   with check (bucket_id = 'documents' and auth.uid() is not null);
