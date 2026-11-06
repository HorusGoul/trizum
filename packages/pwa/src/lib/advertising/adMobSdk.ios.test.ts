import { testAdMobListenerRollback } from "./adMobSdkNativeTest.ts";

// Capacitor captures the platform and native plugin headers at registration time.
testAdMobListenerRollback("ios");
