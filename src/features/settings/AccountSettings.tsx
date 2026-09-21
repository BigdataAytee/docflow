/**
 * Settings → Your account (§P, §R, and the reference's `settings-vacc`).
 *
 * The reference has four things here: an identity card, name and email
 * fields, a Change password row, and Log out. Three of them are real in this
 * build and one is not, so three of them are here.
 *
 * SIGN OUT MOVED HERE, or rather arrived here. It existed only on Home's
 * header, which is where §F puts it — but an owner looking for it looks in
 * Settings, under the heading with their own name on it, and finding nothing
 * there reads as "this app will not let me out". It is in both places now and
 * opens the same confirmation sheet.
 *
 * CHANGE PASSWORD is a reset sent to the address that signs in, not a form
 * that collects the old password and the new one twice. The provider owns the
 * credential; a three-field form in the app would be a second place for a
 * password to be typed, logged or got wrong, for no gain (§P). It needs a
 * connection and says so when it has none — never a queued promise with no
 * visible state (§N).
 *
 * WHAT IS NOT HERE, and why rather than quietly: the reference's "Your name"
 * field. §E's `users` row carries `display_name` and nothing in this build
 * reads or writes that row — there is no users repository, no local column
 * and no sync for one. An input with nowhere to save is the exact bug this
 * codebase keeps finding, so the field waits for the record rather than
 * arriving ahead of it.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { Icon } from '../../ui'

export interface AccountSettingsProps {
  /** Absent on a build with no account behind it — see `SessionActions`. */
  readonly email?: string
  readonly onSignOut: () => void
  readonly onChangePassword: () => Promise<void>
}

/** The letter in the avatar. The address is all this build knows them by. */
const initialOf = (email: string | undefined): string =>
  (email ?? '').trim().charAt(0).toLocaleUpperCase() || '?'

export function AccountSettings({ email, onSignOut, onChangePassword }: AccountSettingsProps) {
  const { strings } = useCompany()
  const a = strings.account

  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  return (
    <section className="space-y-3 px-4 py-4">
      <h1 className="text-lg font-bold">{a.title}</h1>

      {/* ------------------------------------------------ who you are */}
      <section className="glass-solid rounded-2xl p-4 text-center">
        {/*
          The initial where there is somebody to have one, and a plain mark
          where there is not. A "?" in an avatar reads as a person the app
          has lost track of; there is no person here to lose.
        */}
        <span
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-[18px] bg-brand-tint text-xl font-bold text-brand-ink"
        >
          {email === undefined ? <Icon name="user" size={1.1} /> : initialOf(email)}
        </span>
        <p className="mt-2 break-all text-sm font-semibold">{email ?? a.noSession}</p>
        <p className="mt-0.5 text-xs opacity-70">{email === undefined ? a.noSessionBody : a.signedIn}</p>
      </section>

      {/* -------------------------------------------- change password */}
      {email !== undefined && (
        <section className="glass-solid overflow-hidden rounded-2xl">
          <button
            type="button"
            disabled={state === 'sending'}
            onClick={() => {
              setState('sending')
              void onChangePassword()
                .then(() => setState('sent'))
                .catch(() => setState('failed'))
            }}
            className="flex min-h-tap w-full items-center gap-3 px-3.5 py-3 text-start disabled:opacity-70"
          >
            <span
              aria-hidden="true"
              className="grid size-[26px] shrink-0 place-items-center rounded-[9px] bg-brand-tint text-brand-ink"
            >
              <Icon name="shield" size={0.85} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium">{a.changePassword}</span>
              <span className="mt-0.5 block text-[10px] opacity-70">{a.changePasswordHint}</span>
            </span>
            <span aria-hidden="true" className="shrink-0 opacity-35">
              <Icon name="chevron-right" size={0.9} />
            </span>
          </button>
        </section>
      )}

      {/*
        The outcome, said once and in full. `role="status"` rather than a
        toast: an owner who looked away must still be able to find out
        whether the email was sent (§K).
      */}
      {state !== 'idle' && state !== 'sending' && (
        <p
          role="status"
          className={`rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
            state === 'sent'
              ? 'bg-status-info-tint text-status-info'
              : 'bg-status-warn-tint text-status-warn'
          }`}
        >
          {state === 'sent' ? a.resetSentToYou : a.resetFailed}
        </p>
      )}

      {/* ---------------------------------------------------- log out */}
      {email !== undefined && (
        <button
          type="button"
          onClick={onSignOut}
          className="tap-scale min-h-tap w-full rounded-[15px] border border-status-bad/25 bg-surface px-4 py-3 text-[12.5px] font-semibold text-status-bad"
        >
          {a.signOut}
        </button>
      )}
    </section>
  )
}
