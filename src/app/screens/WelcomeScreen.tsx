/**
 * First run (§R, §L8).
 *
 * "Create any of the four (under their local names), or view a sample — sample
 * records are visually labelled and excluded from balances, counts and
 * analytics."
 *
 * The sample is shown, not seeded: nothing is written to the company's records,
 * so the prototype's money can never enter a real account even by accident.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCompany } from '../context'
import { newDocumentPath } from '../paths'
import { FirstRun } from '../../features/onboarding/FirstRun'
import { SampleBadge } from '../../ui'
import { sampleRecords } from '../../features/onboarding/sampleData'
import { formatMoney } from '../../features/customers/formatMoney'

export function WelcomeScreen() {
  const { companyId, strings } = useCompany()
  const navigate = useNavigate()
  const [showSample, setShowSample] = useState(false)

  const sample = sampleRecords(companyId)

  /*
   * A FULL-SCREEN ROUTE, outside the shell — so there has never been a nav
   * under this page, and the 7rem held open for one was always a blank band at
   * the foot of it. The gesture area is all this needs.
   */
  return (
    <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <FirstRun
        suggestedType="invoice"
        onCreate={(type) => navigate(newDocumentPath(type))}
        onViewSample={() => setShowSample(true)}
      />

      {showSample && (
        <section className="glass mx-4 mt-4 rounded-2xl p-4" aria-label={strings.firstRun.sampleBadge}>
          <SampleBadge label={strings.firstRun.sampleBadge} />
          <p className="mt-2 text-sm font-semibold">{sample.customer.name}</p>
          <p className="text-xs opacity-70">{sample.document.reference}</p>
          <p className="mt-2 text-base font-bold tabular-nums">
            {formatMoney(sample.document.total)}
          </p>
          <p className="mt-3 text-xs opacity-70">{strings.firstRun.sampleNotice}</p>
        </section>
      )}
    </div>
  )
}
