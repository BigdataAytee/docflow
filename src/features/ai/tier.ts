/**
 * Which rung of the §N ladder this device is on.
 *
 * §N: "Tier detection runs locally (RAM, SoC allowlist, a micro-benchmark on
 * first use) and is re-checkable in Settings → Offline tools. An unsupported
 * device is described as unsupported — never relabelled 'needs internet.'"
 *
 * That last sentence is the whole reason this is a separate, pure module. The
 * temptation is to collapse "this phone cannot" into "you are offline",
 * because the second sounds fixable. It is a lie, and §N names it. So the
 * result carries a REASON, and the reason is about the device.
 *
 * The facts come from a device; deciding what they mean does not. Everything
 * here is a pure function of the facts, so the ladder can be tested at every
 * boundary without a phone — which is the only part of §N that can be.
 */

export type Tier = 'A' | 'B' | 'C'

export interface DeviceFacts {
  /** Total RAM in gigabytes, as the platform reports it. */
  readonly ramGb?: number
  /** The SoC identifier, matched against the allowlist. */
  readonly soc?: string
  /** The first-use micro-benchmark, in milliseconds. Lower is faster. */
  readonly benchmarkMs?: number
  /** Whether the user declined or an install failed — §N's Tier C trigger. */
  readonly installDeclined?: boolean
  /** Free storage, for the 1GB+ extraction model. */
  readonly freeStorageGb?: number
}

export interface TierResult {
  readonly tier: Tier
  /**
   * Why, in terms of the DEVICE. Never "needs internet" — §N forbids
   * relabelling an unsupported phone as a disconnected one.
   */
  readonly reason: string
}

/**
 * §N's thresholds. Tier A is "≥6GB RAM, recent SoC, passes spike thresholds";
 * Tier B is "3–4GB RAM (the realistic market phone)".
 *
 * The benchmark ceiling is NOT a measured figure — the Phase-0 spike sets it,
 * and that spike needs devices. It is named here so the number has one home
 * and so a later measurement replaces a constant rather than hunting through
 * conditionals.
 */
export const TIER_A_MIN_RAM_GB = 6
export const TIER_B_MIN_RAM_GB = 3
/** TODO(Phase 0 spike): replace with the measured threshold from real phones. */
export const TIER_A_MAX_BENCHMARK_MS = 400

/** SoC families the spike has cleared for Tier A. Empty until it has run. */
export const TIER_A_SOC_ALLOWLIST: readonly string[] = []

export function classify(facts: DeviceFacts): TierResult {
  // An explicit decline or a failed install is Tier C whatever the hardware
  // says: §N lists "install failed/declined" as a Tier C trigger in its own
  // right, and overriding someone's choice because their phone is fast would
  // be the app deciding for them.
  if (facts.installDeclined === true) {
    // Deliberately NOT "offline tools are not installed", even though that is
    // §N's own name for the feature: the word "offline" in a reason reads as a
    // claim about connectivity, which is the exact confusion §N forbids. The
    // feature keeps its name in Settings; the reason talks about the phone.
    return { tier: 'C', reason: 'these tools have not been installed on this phone' }
  }

  const ram = facts.ramGb
  if (ram === undefined) {
    // Unknown is not "assume the best". Claiming Tier A on a phone that
    // cannot load a 1GB model means a download that fails after the bytes.
    return { tier: 'C', reason: 'this phone did not report how much memory it has' }
  }

  if (ram < TIER_B_MIN_RAM_GB) {
    return { tier: 'C', reason: `this phone has ${ram}GB of memory, below the ${TIER_B_MIN_RAM_GB}GB needed` }
  }

  if (ram < TIER_A_MIN_RAM_GB) {
    return { tier: 'B', reason: `this phone has ${ram}GB of memory; the larger model needs ${TIER_A_MIN_RAM_GB}GB` }
  }

  // Enough memory. Now the two spike-gated conditions.
  const soc = facts.soc
  if (TIER_A_SOC_ALLOWLIST.length > 0 && (soc === undefined || !TIER_A_SOC_ALLOWLIST.includes(soc))) {
    return { tier: 'B', reason: 'this phone processor has not been tested for the larger model' }
  }

  const benchmark = facts.benchmarkMs
  if (benchmark === undefined) {
    // Not yet measured. Tier B is the honest answer until it has been: §N
    // runs the benchmark "on first use", so before then nothing is known.
    return { tier: 'B', reason: 'this phone has not been measured yet' }
  }
  if (benchmark > TIER_A_MAX_BENCHMARK_MS) {
    return { tier: 'B', reason: 'this phone was too slow in the speed check for the larger model' }
  }

  return { tier: 'A', reason: 'this phone can run the larger model' }
}

/** What each tier can actually do (§N's ladder table), for the UI to state. */
export interface TierCapabilities {
  readonly voice: boolean
  readonly scan: boolean
  /** Tier A uses a model; Tier B the deterministic extractor; Tier C neither. */
  readonly extraction: 'model' | 'rules' | 'manual'
  /** Tier A answers free-form questions; B and C offer chips only. */
  readonly freeFormAsk: boolean
  /** The 1GB+ download only Tier A needs. */
  readonly needsModelDownload: boolean
}

export function capabilitiesOf(tier: Tier): TierCapabilities {
  switch (tier) {
    case 'A':
      return { voice: true, scan: true, extraction: 'model', freeFormAsk: true, needsModelDownload: true }
    case 'B':
      // "No model download needed" — the whole point of the deterministic
      // extractor is that the realistic market phone gets extraction without
      // a gigabyte of anything.
      return { voice: true, scan: true, extraction: 'rules', freeFormAsk: false, needsModelDownload: false }
    case 'C':
      return { voice: false, scan: false, extraction: 'manual', freeFormAsk: false, needsModelDownload: false }
  }
}

/** §N: the extraction model is "a separate, clearly-sized, opt-in download". */
export const MODEL_DOWNLOAD_GB = 1.2

export function canInstallModel(facts: DeviceFacts): boolean {
  const free = facts.freeStorageGb
  // Headroom, not the bare size: a download that fills the last byte of a
  // phone breaks everything else on it.
  return free !== undefined && free >= MODEL_DOWNLOAD_GB * 1.5
}
