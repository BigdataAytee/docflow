/**
 * Admin: permissions enforced where they cannot be bypassed (§P, §Q Phase 7).
 *
 * §P: "Staff permissions enforced **server-side**." The word doing the work is
 * server-side, and the way to test it is to act as a staff account and try —
 * a UI test proves only that a button is hidden.
 *
 * §Q's Phase 7 gate: "a staff account cannot exceed its permissions via direct
 * API; a revoked device cannot sync."
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, connectionString, supabaseClaims } from './apply'

const ACME = '11111111-1111-1111-1111-111111111111'
const RIVAL = '22222222-2222-2222-2222-222222222222'
const OWNER = 'aaaa0000-0000-0000-0000-0000000000a1'
const STAFF = 'aaaa0000-0000-0000-0000-0000000000a2'
const RIVAL_OWNER = 'bbbb0000-0000-0000-0000-0000000000b1'

let db: Client

/** Signed in as a real person of a real company, the way PostgREST arrives. */
async function as<T>(userId: string, companyId: string, run: () => Promise<T>): Promise<T> {
  await db.query('begin')
  try {
    await db.query('set local role authenticated')
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      supabaseClaims(companyId, userId),
    ])
    return await run()
  } finally {
    await db.query('rollback')
  }
}

beforeAll(async () => {
  db = new Client({ connectionString: connectionString() })
  await db.connect()
  await applyMigrations(db)
}, 60_000)

beforeEach(async () => {
  await db.query('set role service_role')
  await db.query('delete from public.audit_log')
  await db.query('delete from public.devices')
  await db.query('delete from public.users')
  await db.query('delete from public.companies')
  await db.query(
    `insert into public.companies (id, name, currency, locale_region)
     values ($1, 'Sola Ventures', 'NGN', 'NG'), ($2, 'Rival Traders', 'NGN', 'NG')`,
    [ACME, RIVAL],
  )
  await db.query(
    `insert into public.users (id, company_id, role, display_name, permissions) values
       ($1, $3, 'owner', 'Ada', '{}'::jsonb),
       ($2, $3, 'staff', 'Bola', '{}'::jsonb),
       ($4, $5, 'owner', 'Chidi', '{}'::jsonb)`,
    [OWNER, STAFF, ACME, RIVAL_OWNER, RIVAL],
  )
  await db.query(
    `insert into public.devices (id, company_id, user_id, label) values
       ('dev-owner', $1, $2, 'Ada phone'),
       ('dev-staff', $1, $3, 'Bola phone')`,
    [ACME, OWNER, STAFF],
  )
  await db.query('reset role')
})

afterAll(async () => {
  await db?.end()
})

describe('A staff account cannot exceed its permissions via direct API (§Q gate)', () => {
  it('refuses a staff account revoking a device', async () => {
    await as(STAFF, ACME, async () => {
      // Not a hidden button — a refusal. The same token and `curl` gets the
      // same answer.
      const result = await db.query(
        `update public.devices set revoked_at = now() where id = 'dev-owner' and company_id = $1`,
        [ACME],
      )
      expect(result.rowCount).toBe(0)
    })
  })

  it('refuses a staff account promoting itself', async () => {
    await as(STAFF, ACME, async () => {
      await db.query('savepoint before_promote')
      // Refused by a trigger, not a policy: the rule is about the DIFFERENCE
      // between the old row and the new one, and no policy sees both.
      await expect(
        db.query(`update public.users set role = 'owner' where id = $1`, [STAFF]),
      ).rejects.toThrow(/permission to change staff roles/)
      await db.query('rollback to savepoint before_promote')
    })

    await db.query('set role service_role')
    const { rows } = await db.query(`select role from public.users where id = $1`, [STAFF])
    await db.query('reset role')
    expect(rows[0]!.role).toBe('staff')
  })

  it('refuses a staff account granting itself a permission', async () => {
    await as(STAFF, ACME, async () => {
      await db.query('savepoint before_grant')
      await expect(
        db.query(
          `update public.users set permissions = '{"manage_devices":true}'::jsonb where id = $1`,
          [STAFF],
        ),
      ).rejects.toThrow(/permission to change staff roles/)
      await db.query('rollback to savepoint before_grant')
    })
  })

  it('lets an owner do both', async () => {
    await as(OWNER, ACME, async () => {
      const revoked = await db.query(
        `update public.devices set revoked_at = now() where id = 'dev-staff' and company_id = $1`,
        [ACME],
      )
      expect(revoked.rowCount).toBe(1)

      const promoted = await db.query(
        `update public.users set permissions = '{"manage_devices":true}'::jsonb where id = $1`,
        [STAFF],
      )
      expect(promoted.rowCount).toBe(1)
    })
  })

  it('lets a staff account with the permission revoke, and not otherwise', async () => {
    await db.query('set role service_role')
    await db.query(
      `update public.users set permissions = '{"manage_devices":true}'::jsonb where id = $1`,
      [STAFF],
    )
    await db.query('reset role')

    await as(STAFF, ACME, async () => {
      const result = await db.query(
        `update public.devices set revoked_at = now() where id = 'dev-owner' and company_id = $1`,
        [ACME],
      )
      // The permission is the thing that decides, and it is read server-side
      // from the row rather than trusted from the request.
      expect(result.rowCount).toBe(1)
    })
  })

  it('an owner is never missing a permission, so the last owner cannot be locked out', async () => {
    await as(OWNER, ACME, async () => {
      const { rows } = await db.query(
        `select public.current_user_can('anything_at_all') as allowed,
                public.current_user_role() as role`,
      )
      expect(rows[0]!.allowed).toBe(true)
      expect(rows[0]!.role).toBe('owner')
    })
  })
})

describe('The boundary still holds for admin (§P)', () => {
  it('shows one company only its own staff and devices', async () => {
    await as(OWNER, ACME, async () => {
      const users = await db.query('select display_name from public.users order by display_name')
      expect(users.rows.map((r) => r.display_name)).toEqual(['Ada', 'Bola'])
      const devices = await db.query('select id from public.devices order by id')
      expect(devices.rows.map((r) => r.id)).toEqual(['dev-owner', 'dev-staff'])
    })
  })

  it('lets a person edit their own name, which is not a privilege', async () => {
    await as(STAFF, ACME, async () => {
      const result = await db.query(
        `update public.users set display_name = 'Bola A.' where id = $1`,
        [STAFF],
      )
      // The guard is scoped to role and permissions, so self-service profile
      // edits are untouched (§S).
      expect(result.rowCount).toBe(1)
    })
  })

  it('refuses an owner reaching into another company staff', async () => {
    await as(OWNER, ACME, async () => {
      const result = await db.query(`update public.users set role = 'staff' where id = $1`, [
        RIVAL_OWNER,
      ])
      expect(result.rowCount).toBe(0)
    })
  })

  it('refuses enrolling a device in somebody else name', async () => {
    await as(STAFF, ACME, async () => {
      await db.query('savepoint before_enrol')
      await expect(
        db.query(
          `insert into public.devices (id, company_id, user_id) values ('smuggled', $1, $2)`,
          [ACME, OWNER],
        ),
      ).rejects.toThrow(/row-level security/i)
      await db.query('rollback to savepoint before_enrol')
    })
  })

  it('lets anyone enrol the device they are actually on', async () => {
    await as(STAFF, ACME, async () => {
      const result = await db.query(
        `insert into public.devices (id, company_id, user_id, label) values ('dev-new', $1, $2, 'Bola tablet')`,
        [ACME, STAFF],
      )
      expect(result.rowCount).toBe(1)
    })
  })
})

describe('Revoking keeps the record (§M)', () => {
  it('stamps a time rather than deleting the row', async () => {
    await db.query('set role service_role')
    await db.query(`update public.devices set revoked_at = now() where id = 'dev-staff'`)
    const { rows } = await db.query(`select id, revoked_at from public.devices where id = 'dev-staff'`)
    await db.query('reset role')

    // §M: a credential problem never destroys local work, and an audit log
    // that loses the device it is about answers fewer questions than it was
    // kept for.
    expect(rows).toHaveLength(1)
    expect(rows[0]!.revoked_at).not.toBeNull()
  })
})

describe('The activity feed is a read, not a second copy (§P)', () => {
  beforeEach(async () => {
    await db.query('set role service_role')
    await db.query(
      `insert into public.audit_log (company_id, user_id, device_id, action, entity) values
         ($1, $2, 'dev-owner', 'issue', 'document'),
         ($3, $4, 'dev-rival', 'issue', 'document')`,
      [ACME, OWNER, RIVAL, RIVAL_OWNER],
    )
    await db.query('reset role')
  })

  it('shows a company only its own activity', async () => {
    await as(OWNER, ACME, async () => {
      const { rows } = await db.query('select company_id, display_name from public.activity_feed')
      // A view owned by the migration role would hand every company's
      // activity to every caller — the classic way a view leaks past RLS.
      // `security_invoker` is what stops it.
      expect(rows).toHaveLength(1)
      expect(rows[0]!.company_id).toBe(ACME)
      expect(rows[0]!.display_name).toBe('Ada')
    })
  })

  it('says whether the device behind an entry has since been revoked', async () => {
    await db.query('set role service_role')
    await db.query(`update public.devices set revoked_at = now() where id = 'dev-owner'`)
    await db.query('reset role')

    await as(OWNER, ACME, async () => {
      const { rows } = await db.query('select device_revoked from public.activity_feed')
      expect(rows[0]!.device_revoked).toBe(true)
    })
  })

  it('cannot be written through', async () => {
    await as(OWNER, ACME, async () => {
      await db.query('savepoint before_write')
      await expect(
        db.query(`update public.activity_feed set action = 'tampered'`),
      ).rejects.toThrow()
      await db.query('rollback to savepoint before_write')
    })
  })
})
