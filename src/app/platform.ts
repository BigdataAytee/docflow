/**
 * Whether this is running inside the native shell.
 *
 * `native/boot` answers the same question asynchronously, by importing
 * Capacitor. This is the synchronous form, for the places that must answer
 * while building a value rather than while awaiting one — picking the redirect
 * an email should come back to, for instance.
 *
 * The class is set by `app/start.ts` the moment the platform is known, which
 * is before any screen renders and long before anybody can press a button.
 */
export const isNative = (): boolean =>
  globalThis.document?.documentElement?.classList?.contains('native') === true
