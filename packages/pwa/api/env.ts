export interface ApiEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  EMAIL: SendEmail;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;
  APPLE_CLIENT_SECRET?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  APPLE_SERVICE_ID?: string;
  APPLE_TEAM_ID?: string;
  AUTH_EMAIL_FROM?: string;
  AUTH_REQUIRE_EMAIL_VERIFICATION?: string;
  BETTER_AUTH_ALLOWED_HOSTS?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_URL?: string;
  CF_VERSION_METADATA?: WorkerVersionMetadata;
  GOOGLE_ANDROID_APK_CLIENT_ID?: string;
  GOOGLE_ANDROID_CLIENT_ID?: string;
  GOOGLE_ANDROID_GOOGLE_PLAY_CLIENT_ID?: string;
  GOOGLE_CLIENT_IDS?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
  GOOGLE_WEB_CLIENT_ID?: string;
}

export interface ApiHonoEnv {
  Bindings: ApiEnv;
  Variables: {
    session: unknown;
    user: {
      email: string;
      emailVerified: boolean;
      id: string;
      image?: string | null;
      name: string;
    };
  };
}
