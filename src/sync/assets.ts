/**
 * Asset transfer (§M).
 *
 * "Asset uploads resume and verify hashes." "Pending local photos remain
 * visible before upload."
 *
 * The hash is checked after transfer, not before: a file that arrived corrupt
 * is worse than one that never arrived, because the document will happily
 * reference it forever.
 */

export type UploadState = 'pending' | 'uploading' | 'uploaded' | 'failed'

export interface Asset {
  readonly id: string
  readonly localPath: string
  readonly remoteStorageKey?: string
  readonly hash: string
  readonly bytes: number
  readonly uploadState: UploadState
  /** How much has already transferred, so a resume does not restart (§M). */
  readonly uploadedBytes: number
}

export class AssetError extends Error {}

/** Where a resumed upload should continue from. */
export const resumeOffset = (asset: Asset): number =>
  asset.uploadState === 'uploaded' ? asset.bytes : Math.max(0, Math.min(asset.uploadedBytes, asset.bytes))

/**
 * Verify what arrived. A mismatch fails the upload rather than recording it,
 * because a document referencing a corrupt asset is a silent, permanent fault.
 */
export function verifyUpload(asset: Asset, reportedHash: string, reportedBytes: number): Asset {
  if (reportedBytes !== asset.bytes) {
    return {
      ...asset,
      uploadState: 'failed',
      uploadedBytes: Math.min(reportedBytes, asset.bytes),
    }
  }
  if (reportedHash !== asset.hash) {
    // Start over: a partial resume would rebuild the same corrupt file.
    return { ...asset, uploadState: 'failed', uploadedBytes: 0 }
  }
  return { ...asset, uploadState: 'uploaded', uploadedBytes: asset.bytes }
}

/**
 * §M: "pending local photos remain visible before upload." The UI reads the
 * local path until a remote key exists, so a photo never blinks out of a
 * document while it is being uploaded.
 */
export function displayPath(asset: Asset): string {
  return asset.uploadState === 'uploaded' && asset.remoteStorageKey !== undefined
    ? asset.remoteStorageKey
    : asset.localPath
}

/** A document may not become externally visible before its assets land (§M). */
export function assetsReady(assets: readonly Asset[]): boolean {
  return assets.every((asset) => asset.uploadState === 'uploaded')
}
