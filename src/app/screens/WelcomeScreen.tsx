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

  return (
    <div className="pb-28">
      <FirstRun
        suggestedType="invoice"
        onCreate={(type) => navigate(newDocumentPath(type))}
        onViewSample={() => setShowSample(true)}
      />

      {showSample && (
        <section className="mx-4 mt-4 rounded-2xl bg-white/80 p-4" aria-label={strings.firstRun.sampleBadge}>
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
