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

import { Navigate, NavLink, useParams } from 'react-router-dom'

import { useCompany } from '../context'
import { useAppData } from '../store'
import { SETTINGS_PANELS, type SettingsPanel, settingsPath } from '../paths'
import { PageHeader, SkeletonList } from '../../ui'
import { CompanySettings } from '../../features/settings/CompanySettings'
import { PaymentSettings } from '../../features/settings/PaymentSettings'
import { RegionSettings } from '../../features/settings/RegionSettings'
import { SavedItems } from '../../features/settings/SavedItems'
import { TaxSettings } from '../../features/settings/TaxSettings'
import { DataAndSync } from '../../features/settings/DataAndSync'
import { applyLabelOverride, applyRegion, regionProfile } from '../../features/settings/region'
import { PPM, percentToPpm } from '../../domain/money/money'
import type { UiStrings } from '../../domain/locale/data/strings'
import { ALWAYS_AVAILABLE, methodName } from '../../features/payments/methods'

const isPanel = (value: string | undefined): value is SettingsPanel =>
  value !== undefined && (SETTINGS_PANELS as readonly string[]).includes(value)

export function SettingsIndexScreen() {
  const { strings } = useCompany()

  const rows: { panel: SettingsPanel; label: string }[] = [
    { panel: 'region', label: strings.settings.regionAndLanguage },
    { panel: 'company', label: strings.settings.company },
    { panel: 'tax', label: strings.settings.tax },
    { panel: 'payment', label: strings.settings.howYouGetPaid },
    { panel: 'items', label: strings.settings.savedItems },
    { panel: 'data', label: strings.dataSync.title },
  ]

  return (
    <div className="pb-28">
      <PageHeader title={strings.nav.settings} />
      <ul className="mt-4 space-y-2 px-4">
        {rows.map((row) => (
          <li key={row.panel}>
            <NavLink
              to={settingsPath(row.panel)}
              className="flex min-h-tap items-center rounded-2xl bg-white/70 px-4 text-sm font-medium"
            >
              {row.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SettingsPanelScreen() {
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

    case 'data':
      return <DataAndSync pendingCount={0} failedCount={0} />
  }
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
