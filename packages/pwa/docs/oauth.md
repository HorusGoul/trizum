# OAuth Setup

This document covers the manual provider setup for Google and Apple sign-in in
the Cloudflare Worker Better Auth deployment.

## Runtime URLs

Production auth runs under the PWA Worker on `https://trizum.app`.

Use these callback URLs in provider consoles:

- Google: `https://trizum.app/api/auth/callback/google`
- Apple: `https://trizum.app/api/auth/callback/apple`

For local Google testing, also allow:

- `http://localhost:5173/api/auth/callback/google`

Apple Sign in requires HTTPS callback URLs, so use production or a Cloudflare
preview URL for Apple testing.

## Google

1. Open Google Cloud Console.
2. Create or select a project for trizum.
3. Configure the OAuth consent screen.
4. Create an OAuth client for the web app.
5. Add the authorized redirect URIs listed above.
6. Store the credentials in Cloudflare:

```bash
vp exec wrangler secret put GOOGLE_CLIENT_SECRET
```

The web client ID is public and checked into
`packages/pwa/src/lib/authConfig.ts` and mirrored in `wrangler.jsonc`.

## Apple

1. Open Apple Developer.
2. Enable Sign in with Apple for the app identifier.
3. Create a Services ID for web auth.
4. Add `trizum.app` as a domain.
5. Add `https://trizum.app/api/auth/callback/apple` as the return URL.
6. Create a Sign in with Apple private key.
7. Store the configuration in Cloudflare:

```bash
vp exec wrangler secret put APPLE_TEAM_ID
vp exec wrangler secret put APPLE_KEY_ID
vp exec wrangler secret put APPLE_PRIVATE_KEY
```

The Apple Services ID is public and checked into
`packages/pwa/src/lib/authConfig.ts`.

Alternatively, generate the Apple client secret yourself and store:

```bash
vp exec wrangler secret put APPLE_CLIENT_SECRET
```

## Account Linking

Users can keep multiple sign-in methods on the same trizum account:

- A password account is stored as Better Auth provider `credential`.
- Google and Apple identities can be linked from Settings while signed in.
- Email addresses must match between linked providers.
- Users cannot unlink their last remaining sign-in method.

Social-only users can add a password by requesting a password setup link from
Settings. The reset flow creates a credential account if one does not already
exist.

## Capacitor

Capacitor builds use native Google/Apple sign-in and pass provider ID tokens to
Better Auth. This avoids running OAuth inside the app WebView and avoids browser
cookie handoff problems.

The native Android and iOS projects declare universal/app links for
`https://trizum.app`. Verify the site association files are deployed:

- `https://trizum.app/.well-known/assetlinks.json`
- `https://trizum.app/.well-known/apple-app-site-association`

### Google for Capacitor

The Google web client ID used by the Capacitor Google plugin is checked into
`packages/pwa/src/lib/authConfig.ts`.

Better Auth accepts ID tokens issued for the checked-in Google web client ID,
iOS client ID, Android Google Play client ID, and Android APK client ID. The
same IDs are mirrored in `wrangler.jsonc`.

For Android, create an Android OAuth client in Google Cloud Console with:

- Package name: `app.trizum.capacitor`
- SHA-1 certificate fingerprint for each signing certificate used by debug,
  internal testing, and production builds.

For iOS, create an iOS OAuth client with:

- Bundle ID: `app.trizum.capacitor`

Then add the iOS client ID and reversed URL scheme to
`packages/mobile/ios/App/App/Info.plist`. This is already configured for the
current iOS client ID:

```xml
<key>GIDClientID</key>
<string>554871818976-adac4tobqolhrgp7e64siieslsc2jf84.apps.googleusercontent.com</string>
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.554871818976-adac4tobqolhrgp7e64siieslsc2jf84</string>
    </array>
  </dict>
</array>
```

### Apple for Capacitor

Better Auth verifies web and native Apple tokens. The Apple Services ID and iOS
bundle identifier are checked into `packages/pwa/src/lib/authConfig.ts`.

In Apple Developer, enable Sign in with Apple for:

- The iOS app identifier: `app.trizum.capacitor`
- The web Services ID: `app.trizum.capacitor.si`

The iOS entitlements file already declares the Sign in with Apple entitlement.
The Xcode project also records the Sign in with Apple capability for the app
target. CI signing still needs a provisioning profile generated from an Apple
Developer app identifier with that capability enabled.

On Android, the Apple plugin uses the web Services ID and the HTTPS redirect URL
configured above.
