# OAuth Setup

This document covers the manual provider setup for Google and Apple sign-in in
the Cloudflare Worker Better Auth deployment.

Public OAuth identifiers are configured in [`../wrangler.jsonc`](../wrangler.jsonc)
for the Worker and [`../src/lib/authConfig.ts`](../src/lib/authConfig.ts) for
client/native code.

## Runtime URLs

Production auth runs under the PWA Worker on the production domain configured
in `wrangler.jsonc`.

Use these callback URL paths in provider consoles:

- Google: `/api/auth/callback/google`
- Apple: `/api/auth/callback/apple`

For local Google testing, also allow the local Vite origin with the Google
callback path. Apple Sign in requires HTTPS callback URLs, so use production or
a Cloudflare preview URL for Apple testing.

## Google

1. Open Google Cloud Console.
2. Create or select a project for trizum.
3. Configure the OAuth consent screen.
4. Create an OAuth client for the web app.
5. Add the authorized redirect URIs from the runtime URL section.
6. Store the client secret in Cloudflare:

```bash
vp exec wrangler secret put GOOGLE_CLIENT_SECRET
```

The web, iOS, Android Google Play, and Android APK client IDs are public values.
Keep them in `wrangler.jsonc` and `authConfig.ts`.

## Apple

1. Open Apple Developer.
2. Enable Sign in with Apple for the app identifier.
3. Create a Services ID for web auth.
4. Add the production domain from `wrangler.jsonc`.
5. Add the Apple callback URL from the runtime URL section.
6. Create a Sign in with Apple private key.
7. Store the secret configuration in Cloudflare:

```bash
vp exec wrangler secret put APPLE_TEAM_ID
vp exec wrangler secret put APPLE_KEY_ID
vp exec wrangler secret put APPLE_PRIVATE_KEY
```

Alternatively, generate the Apple client secret yourself and store:

```bash
vp exec wrangler secret put APPLE_CLIENT_SECRET
```

The Apple Services ID and app bundle identifier are public values. Keep them in
`wrangler.jsonc` and `authConfig.ts`.

## Account Linking

Users can keep multiple sign-in methods on the same trizum account:

- A password account is stored as Better Auth provider `credential`.
- Google and Apple identities can be linked from the cloud-sync settings page
  while signed in.
- Email addresses must match between linked providers.
- Users cannot unlink their last remaining sign-in method.

Social-only users can add a password by requesting a password setup link from
the cloud-sync settings page. The reset flow creates a credential account if
one does not already exist.

## Capacitor

Capacitor builds use native Google/Apple sign-in and pass provider ID tokens to
Better Auth. This avoids running OAuth inside the app WebView and avoids browser
cookie handoff problems.

The native Android and iOS projects declare universal/app links for the
production domain. Verify the site association files are deployed:

- `/.well-known/assetlinks.json`
- `/.well-known/apple-app-site-association`

### Google for Capacitor

The Capawesome Google Sign-In plugin requires the Google web client ID even on
Android and iOS. Better Auth accepts ID tokens for every Google client ID listed
in `wrangler.jsonc` and `authConfig.ts`.

For Android, create Android OAuth clients in Google Cloud Console with:

- Package name from the native app configuration.
- SHA-1 certificate fingerprints for each signing certificate used by debug,
  direct APK, Google Play, internal testing, and production builds.

For iOS, create an iOS OAuth client with the bundle ID from native app
configuration, then keep the corresponding `GIDClientID` and reversed URL scheme
in `packages/mobile/ios/App/App/Info.plist`.

### Apple for Capacitor

Better Auth verifies web and native Apple tokens. In Apple Developer, enable
Sign in with Apple for the iOS app identifier and web Services ID configured in
`wrangler.jsonc` and `authConfig.ts`.

The iOS entitlements file declares the Sign in with Apple entitlement, and the
Xcode project records the capability for the app target. CI signing still needs
a provisioning profile generated from an Apple Developer app identifier with
that capability enabled.

On Android, the Apple plugin uses the web Services ID and the HTTPS redirect URL
configured above.
