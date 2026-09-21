/**
 * Settings — the index and the six panels §Q Phase 2 calls "essentials" plus
 * §L7's demo (§G).
 *
 * Every change writes straight through to the company record, so §D's
 * "effective immediately, offline, everywhere at once" is literal: the region
 * change updates the company, the store re-reads, and the locale profile the
 * whole app hangs off is recomputed at the root. Nothing has to be told.
 *
 * Issued documents do not move, because their labels are frozen (§D.2, §M) and
 * nothing here touches them.
 */

import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'

import { countryName } from '../../domain/locale/data/countries'
import { useCompany } from '../context'
import { useAppData } from '../store'
import { ONBOARDING, SETTINGS, SETTINGS_PANELS, type SettingsPanel, settingsPath } from '../paths'
import { settingsDestinations, settingsGroups } from '../destinations'
import { DeleteAccount } from '../../features/account/DeleteAccount'
import { ProSettings } from '../../features/billing/ProSettings'
import { standing } from '../../domain/billing/entitlement'
import type { Lifecycle, Refusal } from '../../domain/account/deletion'
import { Icon, type IconName, PageHeader, SkeletonList } from '../../ui'
import { useGoBack } from '../useGoBack'
import { CompanySettings } from '../../features/settings/CompanySettings'
import { PaymentSettings } from '../../features/settings/PaymentSettings'
import { RegionSettings } from '../../features/settings/RegionSettings'
import { SavedItems } from '../../features/settings/SavedItems'
import { SignatureSettings } from '../../features/settings/SignatureSettings'
import { TaxSettings } from '../../features/settings/TaxSettings'
import { AccountSettings } from '../../features/settings/AccountSettings'
import { DataAndSync } from '../../features/settings/DataAndSync'
import { ReturnBand } from '../../features/settings/ReturnBand'
import { dataUrlBytes } from '../../features/settings/storage'
import { HelpSettings } from '../../features/settings/HelpSettings'
import { LegalSettings } from '../../features/settings/LegalSettings'
import { SignOutSheet } from '../../features/auth/SignOutSheet'
import { useSessionActions } from '../session-context'
import { ThemeSettings } from '../../features/theme/ThemeSettings'
import { useThemeChoice } from '../../features/theme/ThemeContext'
import { runExport } from '../../features/export/action'
import { createWebSharePort } from '../../share/web'
import { applyRegion, regionProfile } from '../../features/settings/region'
import { ACCOUNT_COUNTRY_KEY } from '../../domain/locale/bank-fields'
import { PPM, percentToPpm } from '../../domain/money/money'
import { type UiStrings, format } from '../../domain/locale/data/strings'
import { ALWAYS_AVAILABLE, methodName } from '../../features/payments/methods'

const isPanel = (value: string | undefined): value is SettingsPanel =>
  value !== undefined && (SETTINGS_PANELS as readonly string[]).includes(value)

/** Fixed to the row, like every other icon pairing in the app (§F). */
const PANEL_ICONS: Readonly<Record<SettingsPanel, IconName>> = {
  company: 'building',
  tax: 'percentage',
  payment: 'credit-card',
  items: 'package',
  signature: 'signature',
  region: 'language',
  appearance: 'moon',
  data: 'refresh',
  pro: 'shield',
  account: 'user',
  help: 'help',
  legal: 'file-check',
  delete: 'trash',
}

export function SettingsIndexScreen() {
  const { strings } = useCompany()
  const { company, items, documents } = useAppData()
  // Null where this build has no account behind it, which is the row's
  // sublabel rather than a reason to hide it: Your account still says so.
  const session = useSessionActions()

  // One list, shared with the command palette. Two copies of this drifted
  // apart the moment a panel was added — which is exactly what happened to
  // `appearance` before the palette existed to notice.
  const rows = settingsDestinations(strings)
  const byPanel = new Map(rows.map((row) => [row.id.replace('settings:', ''), row]))

  /**
   * What each row says UNDER its name: the current value, not a restatement.
   *
   * Derived every render from the thing it describes, like the Home
   * checklist — so a row cannot claim a logo is set after one is removed.
   * Absent where there is nothing true to say; a row with no sublabel is
   * quieter than one with a guess.
   */
  const sublabelFor = (panel: SettingsPanel): string | undefined => {
    switch (panel) {
      case 'company':
        return company?.logoAssetId === undefined ? strings.settings.notSet : undefined
      case 'payment':
        return (company?.enabledPaymentMethods.length ?? 0) === 0
          ? strings.settings.notSetUpYet
          : undefined
      case 'items':
        return format(strings.settings.itemCount, { count: items.length })
      case 'signature':
        return company?.defaultSignatureAssetId == null ? strings.settings.notSet : undefined
      case 'region':
        /*
         * The NAME, not the stored code. This row read "NG" — the third place
         * in the app to show a person an ISO code as though it were a country,
         * after both dropdowns. The value a row summarises should read the way
         * the screen behind it reads.
         */
        return company === undefined || company === null
          ? undefined
          : countryName(company.localeRegion)
      case 'account':
        return session?.email ?? strings.account.noSession
      default:
        return undefined
    }
  }

  return (
    <div className="pb-28">
      <PageHeader title={strings.nav.settings} />

      {settingsGroups(strings).map((group) => (
        <section key={group.id} className="mt-4 px-4">
          <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
            {group.title}
          </h2>
          {/* One card per group, its rows divided — not a row per card (§F). */}
          <ul className="glass overflow-hidden rounded-[18px]">
            {group.panels.map((panel) => {
              const row = byPanel.get(panel)
              if (row === undefined) return null
              const sublabel = sublabelFor(panel)
              return (
                <li key={panel} className="border-b border-edge/[0.07] last:border-0">
                  <NavLink
                    to={row.path}
                    className="flex min-h-tap items-center gap-3 px-3.5 py-3 text-start"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[9px] bg-brand-tint text-brand-ink"
                    >
                      <Icon name={PANEL_ICONS[panel]} size={0.85} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">{row.label}</span>
                      {sublabel !== undefined && (
                        <span className="mt-0.5 block truncate text-[10px] opacity-70">
                          {sublabel}
                        </span>
                      )}
                    </span>
                    <span aria-hidden="true" className="shrink-0 opacity-70">
                      <Icon name="chevron-right" size={0.9} />
                    </span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {/* Documents are counted nowhere else on this screen; §R's checklist
          reads the same list, so this stays a read rather than a store. */}
      <p className="sr-only">{documents.length}</p>
    </div>
  )
}

/**
 * The tab bar is fixed to the bottom of every page, so a panel that runs to
 * the foot of the screen puts its last control underneath it — visible, and
 * untappable. The index already cleared it; the panels did not, which nobody
 * noticed until one of them ended in a primary action. Cleared here, once,
 * so a panel cannot forget.
 *
 * The TOP is the same story at the other edge. A panel has no coloured band
 * of its own — it opens straight onto its own `<h1>` — so nothing was pushing
 * that title clear of the status bar, and "Company & logo" rendered underneath
 * the clock. Cleared here for the same reason: once, where a panel cannot
 * forget it.
 */
export function SettingsPanelScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const { strings } = useCompany()

  // §G's detour: a panel reached from a draft says so, and offers the way
  // back. Carried in the navigation rather than stored — the draft itself is
  // already on the device, so there is no state here worth persisting.
  // A panel opened cold — from a deep link — falls back to the settings index.
  const goBack = useGoBack(SETTINGS)
  const errand = location.state as { returnTo?: string; errand?: string } | null

  /*
   * NO NAV BELOW THIS PAGE, so no room reserved for one.
   *
   * `pb-28` was 7rem of empty space held open for a floating pill that this
   * screen no longer draws — a blank band under the last control, which is the
   * gap that makes a removed element look like a bug. What stays is the gesture
   * area, which is a property of the DEVICE and does not care which route is on
   * screen.
   */
  return (
    <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.25rem,env(safe-area-inset-top))]">
      {errand?.returnTo !== undefined && errand.errand === 'payment' && (
        <ReturnBand
          errand={strings.details.settingUpPayment}
          onBack={() => navigate(errand.returnTo!)}
        />
      )}

      {/*
        ONE BACK FOR EVERY PANEL, here rather than in each of them.

        No panel had one — the nav pill was the only way out of Company & logo,
        How you get paid, Region & language and the rest. Six screens would
        have needed six copies of this and one of them would have been
        forgotten; the wrapper every panel already renders through is the
        place it belongs.

        Not drawn when an errand band is showing: that band is already a way
        back, to a more specific place, and two back controls stacked is a
        question about which one returns where.
      */}
      {errand?.returnTo === undefined && (
        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={goBack}
            className="tap-scale -ms-1 flex min-h-tap items-center gap-1 text-[13px] font-semibold text-brand-ink"
          >
            <span aria-hidden="true">←</span>
            {strings.common.back}
          </button>
        </div>
      )}

      <SettingsPanelBody />
    </div>
  )
}

function SettingsPanelBody() {
  const { panel } = useParams<{ panel: string }>()
  const { strings } = useCompany()
  const { company, assets, loading, actions } = useAppData()

  if (!isPanel(panel)) return <Navigate to={settingsPath('region')} replace />
  if (loading || company === null) return <SkeletonList rows={4} label={strings.common.loading} />

  const region = company.localeRegion
  const logoUrl = assets.find((asset) => asset.id === company.logoAssetId)?.dataUrl

  switch (panel) {
    case 'region':
      return (
        <RegionSettings
          settings={{ region, language: company.localeLanguage }}
          onRegion={(next) => {
            const { settings, profile } = applyRegion(
              { region, language: company.localeLanguage },
              next,
            )
            // §D: terminology, currency default, bank fields, tax label and
            // date format move together or not at all.
            void actions.updateCompany({
              localeRegion: settings.region,
              currency: profile.currency,
            })
          }}
          onLanguage={(next) => {
            // §D.4: the language moves on its own. Region drives terminology,
            // currency and bank fields; this drives the surrounding words,
            // and App re-reads the catalogue from the company record.
            void actions.updateCompany({ localeLanguage: next })
          }}
        />
      )

    case 'company':
      return (
        <CompanySettings
          businessName={company.name}
          businessAddress={company.address ?? ''}
          businessPhone={company.phone ?? ''}
          businessEmail={company.email ?? ''}
          businessWebsite={company.website ?? ''}
          nameStyle={company.nameStyle ?? 'classic'}
          logoSize={company.logoSize ?? 'M'}
          prefixes={company.numberingPrefixes}
          {...(logoUrl === undefined ? {} : { logoUrl })}
          onBusinessName={(value) => actions.updateCompany({ name: value })}
          onBusinessAddress={(value) => actions.updateCompany({ address: value })}
          onBusinessPhone={(value) => actions.updateCompany({ phone: value })}
          onBusinessEmail={(value) => actions.updateCompany({ email: value })}
          onBusinessWebsite={(value) => actions.updateCompany({ website: value })}
          onLogo={async (dataUrl) => {
            // Stored first, then referenced: the company may only name an
            // asset the repository accepted — the same order a delivery
            // photo and a signature follow (§P).
            const asset = await actions.storeAsset('logo', dataUrl)
            await actions.updateCompany({ logoAssetId: asset.id })
          }}
          onNameStyle={(style) => void actions.updateCompany({ nameStyle: style })}
          onLogoSize={(size) => void actions.updateCompany({ logoSize: size })}
          onPrefix={(type, value) =>
            void actions.updateCompany({
              numberingPrefixes: { ...company.numberingPrefixes, [type]: value },
            })
          }
        />
      )

    case 'tax':
      return (
        <TaxSettings
          taxLabel={safeTaxLabel(region, strings.settings.tax)}
          currency={company.currency}
          taxPercent={((company.taxRatePpm ?? 0) / PPM) * 100}
          whtPercent={((company.whtRatePpm ?? 0) / PPM) * 100}
          // Rates are stored in parts per million, so 7.5% is exact (§K).
          onTaxPercent={(value) => void actions.updateCompany({ taxRatePpm: percentToPpm(value) })}
          onWhtPercent={(value) => void actions.updateCompany({ whtRatePpm: percentToPpm(value) })}
        />
      )

    case 'payment':
      return (
        <PaymentSettings
          currency={company.currency}
          region={region}
          {...(company.bankFields[ACCOUNT_COUNTRY_KEY] === undefined
            ? {}
            : { accountCountry: company.bankFields[ACCOUNT_COUNTRY_KEY] })}
          bankValues={company.bankFields}
          methods={paymentMethods(company, strings)}
          onBankValue={(kind, value) =>
            void actions.updateCompany({ bankFields: { ...company.bankFields, [kind]: value } })
          }
          /*
           * §J: the account's country chooses the field set, so a change to
           * it is a change to which fields exist. Stored beside them, under
           * the reserved key, so it travels with the account it describes.
           */
          onAccountCountry={(country) =>
            void actions.updateCompany({
              bankFields: { ...company.bankFields, [ACCOUNT_COUNTRY_KEY]: country },
            })
          }
          {...(company.paymentLinks === undefined ? {} : { paymentLinks: company.paymentLinks })}
          enabledMethodIds={company.enabledPaymentMethods}
          /* §J's links are the business's DEFAULTS; a document may differ. */
          onPaymentLinks={(paymentLinks) => void actions.updateCompany({ paymentLinks })}
          onToggleMethod={(methodId, next) =>
            void actions.updateCompany({
              enabledPaymentMethods: next
                ? [...new Set([...company.enabledPaymentMethods, methodId])]
                : company.enabledPaymentMethods.filter((id) => id !== methodId),
            })
          }
        />
      )

    case 'items':
      return <SavedItems />

    case 'signature':
      return <DefaultSignature />

    case 'appearance':
      return <AppearancePanel />

    case 'data':
      return <DataAndSyncPanel />
    case 'pro':
      return <ProPanel />
    case 'account':
      return <AccountPanel />

    case 'help':
      return <HelpPanel />

    case 'legal':
      return <LegalSettings />

    case 'delete':
      return <DeleteAccountPanel />
  }
}

/**
 * Settings → Help & support (§G, §R).
 *
 * Its own component only for the route: §R's welcome was reachable exactly
 * once, on a first run, and somebody who tapped past it had no way back to
 * the explanation of what the four document types are.
 */
function HelpPanel() {
  const navigate = useNavigate()
  return <HelpSettings onGettingStarted={() => navigate(ONBOARDING)} />
}

/**
 * Settings → Your account (§P).
 *
 * The sheet is the SAME one Home opens, not a second confirmation written to
 * look like it. Two dialogs asking the same question drift, and the one that
 * drifts is always the one nobody is looking at.
 */
function AccountPanel() {
  const session = useSessionActions()
  const [signingOut, setSigningOut] = useState(false)

  return (
    <>
      <AccountSettings
        {...(session?.email === undefined ? {} : { email: session.email })}
        onSignOut={() => setSigningOut(true)}
        onChangePassword={async () => {
          if (session === null) throw new Error('No session to reset a password for.')
          await session.sendPasswordReset(window.location.origin)
        }}
      />
      {signingOut && session !== null && (
        <SignOutSheet
          onConfirm={() => void session.signOut()}
          onCancel={() => setSigningOut(false)}
        />
      )}
    </>
  )
}

/**
 * Settings → DocFlow Pro (§U).
 *
 * The entitlement comes from the cache the server signed, read through the
 * domain rules — this panel decides nothing about what was bought, which is
 * §U's first rule about billing. `billingAvailable` is false because Phase 4
 * has not wired StoreKit or Play, and the buttons say so rather than
 * pretending (§N).
 */
function ProPanel() {
  return (
    <ProSettings
      standing={standing(null, new Date())}
      billingAvailable={false}
      onManage={() => undefined}
      onRestore={() => undefined}
    />
  )
}

/**
 * Settings → Delete this business (§S; Apple 5.1.1(v)).
 *
 * The role comes from the signed-in user. In the demo and the dev store there
 * is one user and they are the owner, which is why the panel is reachable at
 * all there — the SERVER is the thing that decides in a deployed app, and it
 * decides again regardless of what this passes.
 */
function DeleteAccountPanel() {
  const { companyId, repositories, strings } = useCompany()
  const { company } = useAppData()
  const port = useMemo(() => createWebSharePort(), [])

  const [lifecycle, setLifecycle] = useState<Lifecycle>({ state: 'active' })
  const [exported, setExported] = useState(false)
  const [refusal, setRefusal] = useState<Refusal | undefined>(undefined)

  useEffect(() => {
    void repositories.account.lifecycle(companyId).then(setLifecycle)
  }, [repositories, companyId])

  if (company === null) return <SkeletonList rows={3} label={strings.common.loading} />

  return (
    <DeleteAccount
      lifecycle={lifecycle}
      companyName={company.name}
      role="owner"
      now={new Date()}
      exported={exported}
      onExport={() => {
        void runExport(repositories, companyId, port).then((outcome) => {
          // "Exported" means the archive left the app, not that a button was
          // pressed: an incomplete or failed export must not tick the box a
          // person is relying on before they end the account.
          setExported(outcome.kind === 'shared' || outcome.kind === 'copied')
        })
      }}
      onRequest={(typedName) => {
        void repositories.account
          .request({
            companyId,
            companyName: company.name,
            requestedBy: companyId,
            role: 'owner',
            typedName,
            exported,
          })
          .then((outcome) => {
            setRefusal(outcome.ok ? undefined : outcome.why)
            if (outcome.ok) setLifecycle({ state: 'scheduled', request: outcome.value })
          })
      }}
      onCancel={() => {
        void repositories.account.cancel(companyId, 'owner').then((outcome) => {
          if (outcome.ok) setLifecycle({ state: 'active' })
        })
      }}
      {...(refusal === undefined ? {} : { refusal })}
    />
  )
}

/**
 * Settings → Dark mode (§G).
 *
 * The choice comes from the provider at the app root: `.dark` belongs to the
 * document, so applying it from a panel would give a dark mode that worked
 * only on the screen where it was chosen.
 */
function AppearancePanel() {
  const { choice, setChoice } = useThemeChoice()
  return <ThemeSettings choice={choice} onChoice={setChoice} />
}

/**
 * Settings → Data & sync, with the export actually connected.
 *
 * Its own component so the share port is built once per mount rather than on
 * every render of the switch above, and so the panel that owns the Rule #6
 * promise owns the thing that keeps it.
 */
function DataAndSyncPanel() {
  const { companyId, repositories } = useCompany()
  const { documents, assets } = useAppData()
  const port = useMemo(() => createWebSharePort(), [])

  // §G's "storage used", counted from what the company actually holds. Every
  // asset is a data URL, so the bytes are in hand rather than estimated.
  const assetBytes = assets.reduce((total, asset) => total + dataUrlBytes(asset.dataUrl), 0)

  return (
    <DataAndSync
      pendingCount={0}
      failedCount={0}
      documentCount={documents.length}
      assetBytes={assetBytes}
      onExport={() => runExport(repositories, companyId, port)}
    />
  )
}

/** An unknown region must not crash Settings — it is the screen that fixes it. */
function safeTaxLabel(region: string, fallback: string): string {
  try {
    return regionProfile(region).taxLabel
  } catch {
    return fallback
  }
}

/**
 * §J's methods, with bank transfer always offered because its fields are what
 * the panel above collects. Cards and wallets arrive with the providers in
 * Phase 5; an unavailable method is absent rather than a dead toggle (§N's
 * rule applied to §U).
 */
function paymentMethods(
  company: NonNullable<ReturnType<typeof useAppData>['company']>,
  strings: UiStrings,
) {
  return ALWAYS_AVAILABLE.map((id) => ({
    id,
    // One source for the wording, so the toggle here and the picker on a
    // payment can never disagree about what a method is called.
    name: methodName(strings, id),
    enabled: company.enabledPaymentMethods.includes(id),
  }))
}

/**
 * §G: "Default signature — signs new documents unless you draw a different
 * one." Removing it clears the DEFAULT only: the asset stays, because
 * documents already signed with it hold its id and an issued page's mark
 * cannot change under it (Rule #5).
 */
function DefaultSignature() {
  const { strings } = useCompany()
  const { company, assets, actions } = useAppData()
  const [problem, setProblem] = useState<string | null>(null)

  const saved = assets.find((asset) => asset.id === company?.defaultSignatureAssetId)

  return (
    <SignatureSettings
      {...(saved === undefined ? {} : { signatureUrl: saved.dataUrl })}
      {...(problem === null ? {} : { error: problem })}
      onDraw={(drawn) => {
        setProblem(null)
        void actions
          .storeAsset('signature', drawn.dataUrl)
          .then((asset) => actions.updateCompany({ defaultSignatureAssetId: asset.id }))
          .catch((cause: unknown) => {
            setProblem(
              format(strings.signature.failed, {
                reason: cause instanceof Error ? cause.message : String(cause),
              }),
            )
          })
      }}
      onRemove={() => {
        setProblem(null)
        void actions.updateCompany({ defaultSignatureAssetId: null })
      }}
    />
  )
}
