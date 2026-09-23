package app.trizum.capacitor;

import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.appopen.AppOpenAd;

@CapacitorPlugin(name = "NativeAppOpenAd")
public class NativeAppOpenAdPlugin extends Plugin {

    private static final long MAX_AD_AGE_MILLISECONDS = 4 * 60 * 60 * 1000L;

    private AppOpenAd appOpenAd;
    private long loadedAt;
    private boolean loading;
    private boolean showing;

    @PluginMethod
    public void load(PluginCall call) {
        String adId = call.getString("adId");
        if (adId == null || adId.isBlank()) {
            call.reject("adId is required");
            return;
        }

        getActivity().runOnUiThread(() -> loadOnMainThread(call, adId));
    }

    @PluginMethod
    public void isLoaded(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject result = new JSObject();
            result.put("value", hasFreshAd());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> showOnMainThread(call));
    }

    private void loadOnMainThread(PluginCall call, String adId) {
        if (hasFreshAd()) {
            call.resolve();
            return;
        }
        clearExpiredAd();

        if (loading) {
            call.reject("An App Open ad is already loading");
            return;
        }

        loading = true;
        AppOpenAd.load(
            getContext(),
            adId,
            new AdRequest.Builder().build(),
            new AppOpenAd.AppOpenAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull AppOpenAd loadedAd) {
                    appOpenAd = loadedAd;
                    loadedAt = System.currentTimeMillis();
                    loading = false;
                    call.resolve();
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    appOpenAd = null;
                    loadedAt = 0;
                    loading = false;
                    call.reject(error.getMessage());
                }
            }
        );
    }

    private void showOnMainThread(PluginCall call) {
        if (!hasFreshAd() || showing) {
            clearExpiredAd();
            call.reject("App Open ad is not ready");
            return;
        }

        AppOpenAd ad = appOpenAd;
        if (ad == null) {
            call.reject("App Open ad is not ready");
            return;
        }

        showing = true;
        ad.setFullScreenContentCallback(
            new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    notifyListeners("nativeAppOpenAdShown", new JSObject());
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    clearAd();
                    notifyListeners("nativeAppOpenAdDismissed", new JSObject());
                    call.resolve();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                    clearAd();
                    notifyListeners("nativeAppOpenAdFailedToShow", toError(error));
                    call.reject(error.getMessage());
                }
            }
        );
        ad.show(getActivity());
    }

    private boolean hasFreshAd() {
        return appOpenAd != null && System.currentTimeMillis() - loadedAt < MAX_AD_AGE_MILLISECONDS;
    }

    private void clearExpiredAd() {
        if (!hasFreshAd()) {
            clearAd();
        }
    }

    private void clearAd() {
        appOpenAd = null;
        loadedAt = 0;
        showing = false;
    }

    private JSObject toError(AdError error) {
        JSObject result = new JSObject();
        result.put("code", error.getCode());
        return result;
    }
}
