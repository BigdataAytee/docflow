-- Rate limiting with shared state (§Q Phase 7 "rate-limit verification", §P).
--
-- §P: "rate limiting on auth and public endpoints."
--
-- What this replaces was not a rate limiter. `public-link` kept a `Map` in
-- module scope: in memory, per instance, reset on every cold start, counting
-- nothing across the instances a deployment actually runs. Its own comment
-- said so. The counter has to live where every instance can see it, and the
-- database is already there.
--
-- **A sliding window, not a fixed one.** A fixed window lets twice the limit
-- through across a boundary — twenty at 11:59:59 and twenty more at 12:00:00 —
-- and shipping that while claiming the item was done would repeat the mistake
-- this migration exists to correct. Two counters and a weight cost one extra
-- read and remove the cliff.

create table public.rate_limit_windows (
  -- Which endpoint. Separate buckets never share a budget.
  bucket text not null,
  -- What is being limited. NEVER a secret: `public-link` passes the token's
  -- HASH, because §P's rule that the token itself never reaches the database
  -- outranks the convenience of a readable key.
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key, window_start)
);

alter table public.rate_limit_windows enable row level security;
alter table public.rate_limit_windows force row level security;
-- No grant to `authenticated` and no policy: a counter a caller can read is a
-- counter a caller can plan around, and one they can write is not a limit.
grant all on public.rate_limit_windows to service_role;

create index rate_limit_windows_sweep_idx on public.rate_limit_windows (window_start);

-- ------------------------------------------------------------------ the ask
create function public.check_rate_limit(
  p_bucket text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
  language plpgsql volatile security definer
  set search_path = public, pg_temp
as $$
declare
  v_now        double precision := extract(epoch from clock_timestamp());
  v_start      timestamptz;
  v_previous   timestamptz;
  v_this       integer;
  v_last       integer;
  v_weight     double precision;
  v_estimate   double precision;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'a limit and a window are both required' using errcode = '22023';
  end if;

  v_start := to_timestamp(floor(v_now / p_window_seconds) * p_window_seconds);
  v_previous := v_start - make_interval(secs => p_window_seconds);

  -- Counted BEFORE the decision, in one statement, so two requests racing
  -- each other cannot both read "nineteen" and both be allowed. The row lock
  -- the upsert takes is the whole of the concurrency argument.
  insert into public.rate_limit_windows (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_start, 1)
  on conflict (bucket, key, window_start)
    do update set hits = public.rate_limit_windows.hits + 1
  returning hits into v_this;

  select coalesce(hits, 0) into v_last
    from public.rate_limit_windows
   where bucket = p_bucket and key = p_key and window_start = v_previous;

  -- How much of the previous window is still inside the last `window` seconds.
  v_weight := 1 - ((v_now - extract(epoch from v_start)) / p_window_seconds);
  v_estimate := v_this + coalesce(v_last, 0) * greatest(v_weight, 0);

  -- Cheap, occasional housekeeping instead of a cron nobody remembers to
  -- create. Two windows back is already unreachable by the arithmetic above.
  if random() < 0.01 then
    delete from public.rate_limit_windows
     where window_start < clock_timestamp() - make_interval(secs => p_window_seconds * 3);
  end if;

  return jsonb_build_object(
    'allowed', v_estimate <= p_limit,
    'estimate', v_estimate,
    -- What to tell a caller to wait, when anybody wants to say it.
    'retry_after', ceil(p_window_seconds - (v_now - extract(epoch from v_start)))
  );
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer)
  from public, authenticated, anon;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;

comment on function public.check_rate_limit(text, text, integer, integer) is
  'Service-role only. Sliding-window counter shared across edge-function '
  'instances. The key must never be a secret: pass a hash.';
