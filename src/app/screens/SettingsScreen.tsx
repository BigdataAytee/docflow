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
import { Navigate, NavLink, useParams } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { SETTINGS_PANELS, type SettingsPanel, settingsPath } from '../paths'
import { settingsDestinations } from '../destinations'
import { DeleteAccount } from '../../features/account/DeleteAccount'
import { ProSettings } from '../../features/billing/ProSettings'
import { standing } from '../../domain/billing/entitlement'
import type { Lifecycle, Refusal } from '../../domain/account/deletion'
import { PageHeader, SkeletonList } from '../../ui'
import { CompanySettings } from '../../features/settings/CompanySettings'
import { PaymentSettings } from '../../features/settings/PaymentSettings'
import { RegionSettings } from '../../features/settings/RegionSettings'
import { SavedItems } from '../../features/settings/SavedItems'
import { SignatureSettings } from '../../features/settings/SignatureSettings'
import { TaxSettings } from '../../features/settings/TaxSettings'
import { DataAndSync } from '../../features/settings/DataAndSync'
import { ThemeSettings } from '../../features/theme/ThemeSettings'
import { useThemeChoice } from '../../features/theme/ThemeContext'
import { runExport } from '../../features/export/action'
import { createWebSharePort } from '../../share/web'
import { applyLabelOverride, applyRegion, regionProfile } from '../../features/settings/region'
import { PPM, percentToPpm } from '../../domain/money/money'
import { type UiStrings, format } from '../../domain/locale/data/strings'
import { ALWAYS_AVAILABLE, methodName } from '../../features/payments/methods'

const isPanel = (value: string | undefined): value is SettingsPanel =>
  value !== undefined && (SETTINGS_PANELS as readonly string[]).includes(value)

export function SettingsIndexScreen() {
  const { strings } = useCompany()

  // One list, shared with the command palette. Two copies of this drifted
  // apart the moment a panel was added — which is exactly what happened to
  // `appearance` before the palette existed to notice.
  const rows = settingsDestinations(strings)

  return (
    <div className="pb-28">
      <PageHeader title={strings.nav.settings} />
      <ul className="mt-4 space-y-2 px-4">
        {rows.map((row) => (
          <li key={row.id}>
            <NavLink
              to={row.path}
              className="flex min-h-tap items-center rounded-2xl bg-surface/70 px-4 text-sm font-medium"
            >
              {row.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The tab bar is fixed to the bottom of every page, so a panel that runs to
 * the foot of the screen puts its last control underneath it — visible, and
 * untappable. The index already cleared it; the panels did not, which nobody
 * noticed until one of them ended in a primary action. Cleared here, once,
 * so a panel cannot forget.
 */
export function SettingsPanelScreen() {
  return (
    <div className="pb-28">
      <SettingsPanelBody />
    </div>
  )
}

function SettingsPanelBody() {
  const { panel } = useParams<{ panel: string }>()
  const { strings } = useCompany()
  const { company, loading, actions } = useAppData()

  if (!isPanel(panel)) return <Navigate to={settingsPath('region')} replace />
  if (loading || company === null) return <SkeletonList rows={4} label={strings.common.loading} />

  const region = company.localeRegion

  switch (panel) {
    case 'region':
      return (
        <RegionSettings
          settings={{
            region,
            language: company.localeLanguage,
            labelOverrides: company.labelOverrides,
          }}
          onRegion={(next) => {
            const { settings, profile } = applyRegion(
              { region, language: company.localeLanguage, labelOverrides: company.labelOverrides },
              next,
            )
            // §D: terminology, currency default, bank fields, tax label and
            // date format move together or not at all.
            void actions.updateCompany({
              localeRegion: settings.region,
              currency: profile.currency,
            })
          }}
          onOverride={(type, label) => {
            const settings = applyLabelOverride(
              { region, language: company.localeLanguage, labelOverrides: company.labelOverrides },
              type,
              label,
            )
            void actions.updateCompany({ labelOverrides: settings.labelOverrides })
          }}
        />
      )

    case 'company':
      return (
        <CompanySettings
          businessName={company.name}
          nameStyle={company.nameStyle ?? 'classic'}
          logoSize={company.logoSize ?? 'M'}
          prefixes={company.numberingPrefixes}
          onBusinessName={(value) => void actions.updateCompany({ name: value })}
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
          bankValues={company.bankFields}
          methods={paymentMethods(company, strings)}
          onBankValue={(kind, value) =>
            void actions.updateCompany({ bankFields: { ...company.bankFields, [kind]: value } })
          }
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
    case 'delete':
      return <DeleteAccountPanel />
  }
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
  const port = useMemo(() => createWebSharePort(), [])

  return (
    <DataAndSync
      pendingCount={0}
      failedCount={0}
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
