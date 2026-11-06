import { testAdMobListenerRollback } from "./adMobSdkNativeTest.ts";

// Keep Android registration isolated from the iOS plugin proxies.
testAdMobListenerRollback("android");
