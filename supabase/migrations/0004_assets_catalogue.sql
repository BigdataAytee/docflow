-- DocFlow §E — assets, the saved catalogue, and logo projects.

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  -- Documents reference stable asset IDs, never bare remote URLs (§E).
  local_path text,
  remote_storage_key text,
  hash text,
  mime text,
  bytes bigint,
  upload_state text not null default 'pending'
    check (upload_state in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

create index assets_company_id_idx on public.assets (company_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  last_price_minor bigint,
  currency char(3),
  unit text,
  times_used integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index items_company_id_idx on public.items (company_id);

create table public.logo_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name_snapshot text not null,
  description_snapshot text not null,
  engine text not null,
  model_or_grammar_version text,
  created_at timestamptz not null default now()
);

create index logo_projects_company_id_idx on public.logo_projects (company_id);

create table public.logo_concepts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.logo_projects(id) on delete cascade,
  seed text,
  asset_id uuid references public.assets(id) on delete set null,
  concept_type text not null check (concept_type in ('named', 'symbol')),
  selected boolean not null default false,
  -- Concepts survive restarts (§E, §O).
  generation_state text not null default 'pending'
    check (generation_state in ('pending', 'generating', 'complete', 'failed')),
  created_at timestamptz not null default now()
);

create index logo_concepts_company_id_idx on public.logo_concepts (company_id);
create index logo_concepts_project_id_idx on public.logo_concepts (project_id);
