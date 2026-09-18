/**
 * The welcome (§R, the reference's `vOnboarding`).
 *
 * Four pages: what this is, your business, your first task, and what happens
 * next. The flow itself is `features/onboarding/flow.ts` — pure, tested, and
 * deciding everything this file only renders.
 *
 * WHY IT EXISTS AT ALL. `/welcome` has been a route since Phase 2 and nothing
 * ever navigated to it: a person installing the app landed on Home with an
 * empty checklist and no explanation of what the four tiles were for. The
 * reference builds this screen in script, which is why it was never
 * transcribed with the rest.
 *
 * EVERY PAGE CAN BE LEFT. §R defers everything but a business name, and Rule
 * #1 forbids new required fields — so the first page offers "look around",
 * the second "skip for now", and the last "go to Home first". The only
 * refusal is an empty business name, in the same sentence Settings uses.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { HOME, newDocumentPath } from '../paths'
import { Icon, type IconName } from '../../ui'
import { TYPE_PALETTE } from '../../ui/tokens'
import { DOCUMENT_TYPES } from '../../domain/documents/types'
import { label as typeLabel, labelInSentence } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { countriesByName } from '../../domain/locale/data/countries'
import {
  type FlowState,
  FlowError,
  back,
  begin,
  pickType,
  saveBusiness,
  skipBusiness,
  startFlow,
  stepNumber,
  toReady,
} from '../../features/onboarding/flow'
import { dismissOnboarding } from '../../features/onboarding/dismissed'

/** Fixed to the step, like every other icon pairing in the app (§F). */
const STEP_ICONS: readonly IconName[] = ['settings', 'file-invoice', 'file-check']

export function OnboardingScreen() {
  const { profile, strings } = useCompany()
  const { company, actions } = useAppData()
  const navigate = useNavigate()

  const [state, setState] = useState<FlowState>(() => startFlow(company?.localeRegion ?? 'NG'))
  const [problem, setProblem] = useState<string | null>(null)
  // Built once: 240-odd names through a collator is not work to repeat on
  // every keystroke in the business-name field above it.
  const countries = useMemo(() => countriesByName(), [])

  // The country is pre-filled from the phone (§R), and the company is loaded
  // asynchronously — so it is seeded again once it arrives rather than
  // defaulting forever to the fallback.
  useEffect(() => {
    if (company?.localeRegion !== undefined) {
      setState((current) => ({ ...current, region: company.localeRegion }))
    }
  }, [company?.localeRegion])

  /*
   * Each page starts at its own top.
   *
   * The four pages are one route, so the browser keeps the scroll position
   * across them — and page two opened scrolled down by exactly the height of
   * the demo banner, with its Back button underneath it. A person could not
   * see the way back from the first screen they were asked to fill in.
   *
   * Guarded: `scrollTo` is not implemented in jsdom, and a component test
   * should not fall over on a nicety.
   */
  useEffect(() => {
    if (typeof globalThis.scrollTo === 'function') globalThis.scrollTo(0, 0)
  }, [state.page])

  /**
   * Leaving, by any of the three doors.
   *
   * The dismissal is recorded first and awaited nowhere: a person tapping
   * "look around" should not wait on a write, and the worst case of it
   * failing is being asked once more.
   */
  const leave = (to: string) => {
    dismissOnboarding()
    navigate(to, { replace: true })
  }

  const finish = async () => {
    if (state.businessName !== '') {
      // One write, the same one Settings makes: the name and the country
      // together, because §R asks for them in ONE confirmation.
      await actions.updateCompany({
        name: state.businessName,
        localeRegion: state.region,
      })
    }
    leave(state.page === 'ready' ? newDocumentPath(state.type) : HOME)
  }

  const w = strings.welcome

  if (state.page === 'welcome') {
    return (
      <div className="min-h-dvh pb-10">
        <header className="ob-head px-5 pb-6 pt-[max(1.7rem,env(safe-area-inset-top))]">
          <p className="mb-6 text-base font-semibold tracking-tight">{w.brand}</p>
          <h1 className="mb-3 text-[27px] font-semibold leading-[1.15] tracking-tight">
            {w.headline}
          </h1>
          <p className="ob-head-body text-xs leading-relaxed">{w.body}</p>
        </header>

        <div className="px-5 pt-5">
          <div className="glass mb-5 rounded-[18px] px-4">
            {[
              [w.step1, w.step1Body],
              [w.step2, w.step2Body],
              [w.step3, w.step3Body],
            ].map(([title, body], index) => (
              <Row key={title} icon={STEP_ICONS[index]!} title={title!} body={body!} />
            ))}
          </div>

          <button type="button" onClick={() => setState(begin(state))} className={PRIMARY}>
            {w.getStarted}
          </button>
          <button type="button" onClick={() => leave(HOME)} className={`${SECONDARY} mt-2.5`}>
            {w.explore}
          </button>

          {/* Rule #2, said before anything is asked for. */}
          <p className="mt-4 text-center text-[10.5px] leading-relaxed opacity-55">
            {w.offlineNote}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh px-5 pb-10 pt-[max(1.2rem,env(safe-area-inset-top))]">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setState(back(state))}
          className="min-h-tap text-[11px] font-semibold text-brand"
        >
          {w.back}
        </button>
        <span className="text-[11px] opacity-50">{w.setupTitle}</span>
      </div>

      <ol className="mb-5 flex gap-1.5" aria-label={w.progressLabel}>
        {[w.stepBusiness, w.stepTask, w.stepReady].map((name, index) => {
          const reached = index + 1 <= stepNumber(state.page)
          return (
            <li
              key={name}
              className="ob-step flex-1 pt-[7px] text-[10px]"
              data-current={reached}
              {...(index + 1 === stepNumber(state.page) ? { 'aria-current': 'step' as const } : {})}
              style={{ color: reached ? 'var(--ob-chosen)' : undefined }}
            >
              <span className={reached ? 'font-semibold' : 'opacity-60'}>{name}</span>
            </li>
          )
        })}
      </ol>

      {state.page === 'business' && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            try {
              setState(saveBusiness(state, state.businessName, state.region))
              setProblem(null)
            } catch (cause) {
              setProblem(cause instanceof FlowError ? cause.message : String(cause))
            }
          }}
        >
          <h1 className="mb-2 text-xl font-semibold tracking-tight">{w.businessTitle}</h1>
          <p className="mb-5 text-xs leading-relaxed opacity-60">{w.businessBody}</p>

          {/*
            `htmlFor`/`id` rather than relying on the wrapper.
            A label WRAPPING a control is valid, but the accessibility tree
            read both of these by their placeholder and their value instead —
            so the name field announced "e.g. Chidinma Building Supplies" and
            the country announced "NG". An explicit association cannot be
            resolved two ways.
          */}
          {/*
            Label, control and help as SIBLINGS, not nested.
            A wrapping label makes its whole text content the accessible
            name — so the help line was read as part of the field's name AND
            again as its description: "Business name This prints at the top of
            every document you make, edit text, This prints at the top…".
            `htmlFor` names it; `aria-describedby` describes it; neither does
            the other's job.
          */}
          <div className="mb-4">
            <label htmlFor="ob-name" className="block text-[11px] font-medium opacity-70">
              {w.nameLabel}
            </label>
            <input
              id="ob-name"
              aria-describedby="ob-name-help"
              value={state.businessName}
              onChange={(event) => setState({ ...state, businessName: event.target.value })}
              autoComplete="organization"
              maxLength={100}
              placeholder={w.namePlaceholder}
              className="glass-solid mt-1.5 block min-h-tap w-full rounded-xl px-3 py-3 text-[13px] text-ink"
            />
            <small id="ob-name-help" className="mt-1.5 block text-[10px] opacity-55">
              {w.nameHelp}
            </small>
          </div>

          <div className="mb-4">
            <label htmlFor="ob-country" className="block text-[11px] font-medium opacity-70">
              {w.countryLabel}
            </label>
            <select
              id="ob-country"
              aria-describedby="ob-country-help"
              value={state.region}
              onChange={(event) => setState({ ...state, region: event.target.value })}
              className="glass-solid mt-1.5 block min-h-tap w-full rounded-xl px-3 py-3 text-[13px] text-ink"
            >
              {/*
                FULL NAMES, sorted by name — the same list Settings and signup
                show, from the same function.

                The comment here used to say the codes were deliberate: "a
                country name this project has not had reviewed would be a new
                claim." That reasoning belongs to TERMINOLOGY, which §D really
                does gate on native-speaker review. A country's name in English
                is not terminology; `COUNTRY_NAMES` has carried all 243 since
                the list was widened, and Settings and signup have both printed
                them since.

                So this was the one screen left showing "NG" — and it is the
                FIRST screen anybody sees. A person setting up a business was
                asked to find themselves in an alphabetical list of two-letter
                codes, on the one screen where they have least idea what the
                app is doing.
              */}
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <small id="ob-country-help" className="mt-1.5 block text-[10px] opacity-55">
              {w.countryHelp}
            </small>
          </div>

          {problem !== null && (
            <p role="alert" className="mb-3 text-[11px] leading-relaxed text-status-bad">
              {problem}
            </p>
          )}

          <button type="submit" className={PRIMARY}>
            {w.saveContinue}
          </button>
          <button
            type="button"
            onClick={() => setState(skipBusiness(state))}
            className="mt-2.5 block min-h-tap w-full text-[11px] text-brand underline underline-offset-[3px]"
          >
            {w.skipBusiness}
          </button>
        </form>
      )}

      {state.page === 'task' && (
        <>
          <h1 className="mb-2 text-xl font-semibold tracking-tight">{w.taskTitle}</h1>
          <p className="mb-5 text-xs leading-relaxed opacity-60">{w.taskBody}</p>

          {DOCUMENT_TYPES.map((type) => {
            const chosen = state.type === type
            return (
              <button
                key={type}
                type="button"
                aria-pressed={chosen}
                onClick={() => setState(pickType(state, type))}
                className="ob-choice tap-scale mb-2.5 flex w-full items-center gap-3 rounded-[15px] p-3 text-start"
              >
                <span
                  aria-hidden="true"
                  className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px]"
                  style={{
                    backgroundColor: TYPE_PALETTE[type].tint,
                    color: TYPE_PALETTE[type].accent,
                  }}
                >
                  <Icon name={TYPE_PALETTE[type].icon} size={1.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[12.5px] font-semibold">
                    {typeLabel(profile, type)}
                  </strong>
                  <small className="block text-[11px] leading-snug opacity-60">
                    {w.hints[type]}
                  </small>
                </span>
                {/* A tick as well as the ring: never colour alone (§F, §V). */}
                <span aria-hidden="true" className="shrink-0 text-brand">
                  {chosen ? <Icon name="check" size={1} /> : null}
                </span>
              </button>
            )
          })}

          <button type="button" onClick={() => setState(toReady(state))} className={PRIMARY}>
            {w.continueOn}
          </button>
        </>
      )}

      {state.page === 'ready' && (
        <>
          <h1 className="mb-2 text-xl font-semibold tracking-tight">{w.readyTitle}</h1>
          <p className="mb-5 text-xs leading-relaxed opacity-60">
            {format(w.readyBody, { label: labelInSentence(profile, state.type) })}
          </p>

          <div className="glass mb-4 rounded-[18px] px-4">
            <Row icon="user" title={w.ready1} body={w.ready1Body} />
            <Row icon="package" title={w.ready2} body={w.ready2Body} />
            <Row icon="file-check" title={w.ready3} body={w.ready3Body} />
          </div>

          <div className="recessed mb-5 rounded-[14px] px-3.5 py-3 text-[10.5px] leading-[1.9]">
            <strong className="mb-1 block text-[11px]">{w.findYourWay}</strong>
            <span className="block opacity-70">{w.whereHome}</span>
            <span className="block opacity-70">{w.whereCustomers}</span>
            <span className="block opacity-70">{w.whereAnalytics}</span>
            <span className="block opacity-70">{w.whereSettings}</span>
          </div>

          <button type="button" onClick={() => void finish()} className={PRIMARY}>
            {format(w.startMine, { label: labelInSentence(profile, state.type) })}
          </button>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                if (state.businessName !== '') {
                  await actions.updateCompany({
                    name: state.businessName,
                    localeRegion: state.region,
                  })
                }
                leave(HOME)
              })()
            }}
            className={`${SECONDARY} mt-2.5`}
          >
            {w.homeFirst}
          </button>
        </>
      )}
    </div>
  )
}

const PRIMARY =
  'ob-primary tap-scale block min-h-tap w-full rounded-[15px] px-4 py-3 text-[12.5px] font-semibold'
const SECONDARY =
  'ob-secondary tap-scale block min-h-tap w-full rounded-[15px] px-4 py-3 text-[12.5px] font-semibold'

function Row({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="ob-row flex items-start gap-3 py-3.5">
      <span
        aria-hidden="true"
        className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px] bg-brand-tint text-brand"
      >
        <Icon name={icon} size={1.1} />
      </span>
      <div className="min-w-0">
        <strong className="mb-0.5 block text-xs font-semibold">{title}</strong>
        <p className="text-[11px] leading-snug opacity-60">{body}</p>
      </div>
    </div>
  )
}
