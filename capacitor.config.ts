import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The native shell (§C, §Q Phase 4).
 *
 * Everything here is chosen against one of the six rules, so each setting has
 * a reason that is not "the template had it".
 *
 * `webDir: 'dist'` — the same bundle the web build produces. One UI, two
 * shells (§C). If the phone needed its own build of the screens, "switch
 * region and every label changes everywhere at once" would be a claim about
 * two codebases rather than one.
 *
 * **No `server.url`.** A dev-server URL here would make the app load its own
 * screens over the network, and Rule #2 says every core journey passes in
 * airplane mode. It is not set even for development: an offline-first app
 * whose development loop needs a network trains everyone to stop noticing.
 */
const config: CapacitorConfig = {
  appId: 'com.docflow.app',
  appName: 'DocFlow',
  webDir: 'dist',

  android: {
    // The bundle is served from the app's own assets over https rather than
    // file:// — required for crypto.subtle and IndexedDB to be available at
    // all, and it keeps the origin stable across upgrades so nothing stored
    // against it is orphaned.
    androidScheme: 'https',
  },

  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: true,
      // The passphrase is NEVER here. It is minted on first run and kept in
      // Android's EncryptedSharedPreferences, behind the Keystore (§P: "keys
      // in Capacitor secure storage, no secrets in the JS bundle"). A value
      // in this file would ship in the APK, which is the same as no
      // encryption at all with extra steps. See `src/data/sqlite/key.ts`.
      androidBiometric: {
        // Biometrics gate the APP (§Q Phase 4: "optional biometric/PIN lock,
        // default off"), not the database key. Tying the key to a fingerprint
        // would mean a failed sensor — wet hands, a cracked reader — locks an
        // owner out of records that are already on their own phone, and Rule
        // #6 says documents are never hostage.
        biometricAuth: false,
        biometricTitle: 'Unlock DocFlow',
      },
    },
    SplashScreen: {
      // §Q Phase 4 asks for cold start under two seconds to an interactive
      // dashboard. A splash with a duration ADDS to that number while looking
      // like it helps, so it is dismissed by the app the moment the first
      // screen has data — see `src/native/boot.ts`.
      launchAutoHide: false,
      backgroundColor: '#0B1F4B',
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      // The builder is a form. Resizing the body rather than panning keeps the
      // line-item row being typed into on screen above the keyboard.
      resize: 'body',
    },
  },
}

export default config
