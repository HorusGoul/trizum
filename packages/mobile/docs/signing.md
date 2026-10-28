# Native signing and CI secrets

[Back to package overview](../README.md). Read when configuring certificates, provisioning, or store upload credentials.

### Required Secrets

Configure these secrets in your GitHub repository settings (**Settings → Secrets and variables → Actions**):

#### Android Secrets

| Secret                        | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`     | Base64-encoded release keystore                 |
| `ANDROID_KEYSTORE_PASSWORD`   | Keystore password                               |
| `ANDROID_KEY_ALIAS`           | Key alias                                       |
| `ANDROID_KEY_PASSWORD`        | Key password                                    |
| `GOOGLE_PLAY_JSON_KEY_BASE64` | Base64-encoded Google Play service account JSON |

**How to get Android secrets:**

```bash
# Encode your keystore file
base64 -i your-release.keystore | tr -d '\n'
```

#### iOS Secrets

| Secret                                     | Description                                           |
| ------------------------------------------ | ----------------------------------------------------- |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64`      | Base64-encoded distribution certificate (.p12)        |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`    | Password used when exporting the .p12                 |
| `IOS_APPSTORE_PROVISIONING_PROFILE_BASE64` | Optional fallback App Store provisioning profile      |
| `IOS_ADHOC_PROVISIONING_PROFILE_BASE64`    | Base64-encoded Ad Hoc provisioning profile (optional) |
| `APP_STORE_CONNECT_API_KEY_ID`             | App Store Connect API Key ID                          |
| `APP_STORE_CONNECT_API_ISSUER_ID`          | App Store Connect API Issuer ID                       |
| `APP_STORE_CONNECT_API_KEY_CONTENT`        | Base64-encoded API Key content (.p8 file)             |

### How to Get iOS Secrets

#### 1. Export Distribution Certificate (.p12)

The distribution certificate is used to sign your app for App Store or Ad Hoc distribution.

1. Open **Keychain Access** on your Mac
2. In the sidebar, select **login** keychain and **My Certificates** category
3. Find your **Apple Distribution** certificate (or **iPhone Distribution** for older certs)
4. Right-click → **Export** → Save as `.p12` file
5. Set a password when prompted (this becomes `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`)
6. Encode the certificate:

```bash
base64 -i Certificates.p12 | tr -d '\n'
```

> **Note:** If you don't have a distribution certificate, create one in [Apple Developer Portal → Certificates](https://developer.apple.com/account/resources/certificates/list).

#### 2. Provisioning Profiles

Provisioning profiles link your app ID, certificate, and (for Ad Hoc) device UDIDs.
The App Store and TestFlight workflows refresh the App Store provisioning
profile in CI with the App Store Connect API key so the profile stays aligned
with native entitlements such as Associated Domains and Sign in with Apple.

1. Go to [Apple Developer Portal → Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Find (or create) your **Ad Hoc** provisioning profile, or an **App Store**
   profile only when using `IOS_APPSTORE_PROVISIONING_PROFILE_BASE64` as a
   manual fallback
3. Click **Download** to get the `.mobileprovision` file
4. Encode the profile:

```bash
base64 -i YourProfile.mobileprovision | tr -d '\n'
```

> **Tip:** You can also find downloaded profiles at `~/Library/MobileDevice/Provisioning Profiles/`

#### 3. Create App Store Connect API Key

The API key is used for uploading to TestFlight/App Store and accessing Apple services without 2FA.

1. Go to [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. Click **Generate API Key**
3. Name it (e.g., "CI/CD") and select **Admin** or **App Manager** role
4. Note the **Key ID** (e.g., `ABC123XYZ`) → `APP_STORE_CONNECT_API_KEY_ID`
5. Note the **Issuer ID** at the top of the page → `APP_STORE_CONNECT_API_ISSUER_ID`
6. Click **Download API Key** to get the `.p8` file (⚠️ you can only download this once!)
7. Encode the `.p8` file:

```bash
base64 -i AuthKey_ABC123XYZ.p8 | tr -d '\n'
```

### Local Development vs CI

| Environment             | Signing Method                                                      |
| ----------------------- | ------------------------------------------------------------------- |
| **Local (Xcode)**       | Automatic signing - Xcode manages everything with your Apple ID     |
| **CI (GitHub Actions)** | Manual signing - uses exported certificate and provisioning profile |

For local development, just open the project in Xcode and ensure **"Automatically manage signing"** is enabled in the Signing & Capabilities tab.
