package app.trizum.capacitor;

import static android.app.Activity.RESULT_CANCELED;
import static android.app.Activity.RESULT_OK;
import static com.google.android.play.core.install.model.ActivityResult.RESULT_IN_APP_UPDATE_FAILED;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.tasks.Task;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeUpdateEnvironment")
public class NativeUpdateEnvironmentPlugin extends Plugin {

    private static final String TAG = "NativeUpdateEnvironment";
    private static final String GOOGLE_PLAY_SERVICES_PACKAGE = "com.google.android.gms";
    private static final String GOOGLE_PLAY_STORE_PACKAGE = "com.android.vending";
    private static final int UPDATE_OK = 0;
    private static final int UPDATE_CANCELED = 1;
    private static final int UPDATE_FAILED = 2;
    private static final int UPDATE_NOT_AVAILABLE = 3;
    private static final int UPDATE_NOT_ALLOWED = 4;

    private AppUpdateManager appUpdateManager;
    private ActivityResultLauncher<IntentSenderRequest> immediateUpdateLauncher;
    private PluginCall savedImmediateUpdateCall;

    @Override
    public void load() {
        this.appUpdateManager = AppUpdateManagerFactory.create(this.getContext());
        this.immediateUpdateLauncher = bridge.registerForActivityResult(
                new ActivityResultContracts.StartIntentSenderForResult(),
                result -> this.handleImmediateUpdateResult(result)
            );
    }

    @PluginMethod
    public void getAndroidUpdateSupport(PluginCall call) {
        AndroidUpdateSupport support = this.getAndroidUpdateSupport();

        JSObject ret = new JSObject();
        ret.put("hasGooglePlayServices", support.hasGooglePlayServices);
        ret.put("hasAvailableGooglePlayServices", support.hasAvailableGooglePlayServices);
        ret.put("hasGooglePlayStore", support.hasGooglePlayStore);
        ret.put("wasInstalledByGooglePlayStore", support.wasInstalledByGooglePlayStore);
        ret.put("supportsGooglePlayInAppUpdates", support.supportsGooglePlayInAppUpdates);
        call.resolve(ret);
    }

    @PluginMethod
    public void getAndroidAppUpdateInfo(PluginCall call) {
        try {
            AndroidUpdateSupport support = this.getAndroidUpdateSupport();
            if (!support.supportsGooglePlayInAppUpdates) {
                this.resolveUnavailableAppUpdateInfo(call);
                return;
            }

            Task<AppUpdateInfo> appUpdateInfoTask = this.appUpdateManager.getAppUpdateInfo();
            appUpdateInfoTask.addOnSuccessListener(appUpdateInfo -> this.resolveAppUpdateInfo(call, appUpdateInfo));
            appUpdateInfoTask.addOnFailureListener(failure -> call.reject(failure.getMessage()));
        } catch (Exception exception) {
            Logger.error(TAG, exception.getMessage(), exception);
            call.reject(exception.getMessage());
        }
    }

    @PluginMethod
    public void performAndroidImmediateUpdate(PluginCall call) {
        try {
            if (this.savedImmediateUpdateCall != null) {
                this.resolveUpdateResult(call, UPDATE_NOT_ALLOWED);
                return;
            }

            AndroidUpdateSupport support = this.getAndroidUpdateSupport();
            if (!support.supportsGooglePlayInAppUpdates) {
                this.resolveUpdateResult(call, UPDATE_NOT_AVAILABLE);
                return;
            }

            Task<AppUpdateInfo> appUpdateInfoTask = this.appUpdateManager.getAppUpdateInfo();
            appUpdateInfoTask.addOnSuccessListener(appUpdateInfo -> this.performAndroidImmediateUpdate(call, appUpdateInfo));
            appUpdateInfoTask.addOnFailureListener(failure -> call.reject(failure.getMessage()));
        } catch (Exception exception) {
            Logger.error(TAG, exception.getMessage(), exception);
            call.reject(exception.getMessage());
        }
    }

    private void performAndroidImmediateUpdate(PluginCall call, AppUpdateInfo appUpdateInfo) {
        try {
            int updateAvailability = appUpdateInfo.updateAvailability();
            if (updateAvailability != UpdateAvailability.UPDATE_AVAILABLE && updateAvailability != UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                this.resolveUpdateResult(call, UPDATE_NOT_AVAILABLE);
                return;
            }

            if (
                updateAvailability == UpdateAvailability.UPDATE_AVAILABLE &&
                !appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
            ) {
                this.resolveUpdateResult(call, UPDATE_NOT_ALLOWED);
                return;
            }

            if (this.savedImmediateUpdateCall != null) {
                this.resolveUpdateResult(call, UPDATE_NOT_ALLOWED);
                return;
            }

            this.savedImmediateUpdateCall = call;
            AppUpdateOptions appUpdateOptions = AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build();
            boolean started = this.appUpdateManager.startUpdateFlowForResult(
                    appUpdateInfo,
                    this.immediateUpdateLauncher,
                    appUpdateOptions
                );
            if (!started) {
                this.savedImmediateUpdateCall = null;
                this.resolveUpdateResult(call, UPDATE_FAILED);
            }
        } catch (Exception exception) {
            Logger.error(TAG, exception.getMessage(), exception);
            this.savedImmediateUpdateCall = null;
            call.reject(exception.getMessage());
        }
    }

    private void handleImmediateUpdateResult(ActivityResult result) {
        try {
            if (this.savedImmediateUpdateCall == null) {
                return;
            }

            int resultCode = result.getResultCode();
            if (resultCode == RESULT_OK) {
                this.resolveUpdateResult(this.savedImmediateUpdateCall, UPDATE_OK);
            } else if (resultCode == RESULT_CANCELED) {
                this.resolveUpdateResult(this.savedImmediateUpdateCall, UPDATE_CANCELED);
            } else if (resultCode == RESULT_IN_APP_UPDATE_FAILED) {
                this.resolveUpdateResult(this.savedImmediateUpdateCall, UPDATE_FAILED);
            } else {
                this.resolveUpdateResult(this.savedImmediateUpdateCall, UPDATE_FAILED);
            }
            this.savedImmediateUpdateCall = null;
        } catch (Exception exception) {
            Logger.error(TAG, exception.getMessage(), exception);
            if (this.savedImmediateUpdateCall != null) {
                this.savedImmediateUpdateCall.reject(exception.getMessage());
                this.savedImmediateUpdateCall = null;
            }
        }
    }

    private void resolveAppUpdateInfo(PluginCall call, AppUpdateInfo appUpdateInfo) {
        try {
            PackageInfo packageInfo = this.getPackageInfo();
            JSObject ret = new JSObject();
            ret.put("currentVersionName", packageInfo.versionName);
            ret.put("currentVersionCode", this.getVersionCode(packageInfo));
            ret.put("availableVersionCode", String.valueOf(appUpdateInfo.availableVersionCode()));
            ret.put("updateAvailability", appUpdateInfo.updateAvailability());
            ret.put("updatePriority", appUpdateInfo.updatePriority());
            ret.put("immediateUpdateAllowed", appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
            ret.put("flexibleUpdateAllowed", appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE));
            Integer clientVersionStalenessDays = appUpdateInfo.clientVersionStalenessDays();
            if (clientVersionStalenessDays != null) {
                ret.put("clientVersionStalenessDays", clientVersionStalenessDays);
            }
            ret.put("installStatus", appUpdateInfo.installStatus());
            call.resolve(ret);
        } catch (PackageManager.NameNotFoundException exception) {
            call.reject("Unable to get app info.");
        }
    }

    private void resolveUnavailableAppUpdateInfo(PluginCall call) {
        try {
            PackageInfo packageInfo = this.getPackageInfo();
            JSObject ret = new JSObject();
            ret.put("currentVersionName", packageInfo.versionName);
            ret.put("currentVersionCode", this.getVersionCode(packageInfo));
            ret.put("updateAvailability", UpdateAvailability.UPDATE_NOT_AVAILABLE);
            ret.put("immediateUpdateAllowed", false);
            ret.put("flexibleUpdateAllowed", false);
            call.resolve(ret);
        } catch (PackageManager.NameNotFoundException exception) {
            call.reject("Unable to get app info.");
        }
    }

    private void resolveUpdateResult(PluginCall call, int code) {
        JSObject ret = new JSObject();
        ret.put("code", code);
        call.resolve(ret);
    }

    private AndroidUpdateSupport getAndroidUpdateSupport() {
        boolean hasGooglePlayServices = this.isPackageAvailable(GOOGLE_PLAY_SERVICES_PACKAGE);
        boolean hasGooglePlayStore = this.isPackageAvailable(GOOGLE_PLAY_STORE_PACKAGE);
        boolean wasInstalledByGooglePlayStore = this.wasInstalledByGooglePlayStore();
        boolean hasAvailableGooglePlayServices =
            hasGooglePlayServices &&
            hasGooglePlayStore &&
            wasInstalledByGooglePlayStore &&
            this.isGooglePlayServicesAvailable();

        return new AndroidUpdateSupport(
            hasGooglePlayServices,
            hasAvailableGooglePlayServices,
            hasGooglePlayStore,
            wasInstalledByGooglePlayStore
        );
    }

    private boolean isPackageAvailable(String packageName) {
        try {
            PackageInfo packageInfo = this.getContext().getPackageManager().getPackageInfo(packageName, 0);
            return packageInfo.applicationInfo != null && packageInfo.applicationInfo.enabled;
        } catch (PackageManager.NameNotFoundException exception) {
            return false;
        }
    }

    private boolean isGooglePlayServicesAvailable() {
        return (
            GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(this.getContext()) ==
            ConnectionResult.SUCCESS
        );
    }

    private boolean wasInstalledByGooglePlayStore() {
        String installerPackageName = this.getInstallerPackageName();
        return GOOGLE_PLAY_STORE_PACKAGE.equals(installerPackageName);
    }

    @SuppressWarnings("deprecation")
    private String getInstallerPackageName() {
        PackageManager packageManager = this.getContext().getPackageManager();
        String packageName = this.getContext().getPackageName();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                return packageManager.getInstallSourceInfo(packageName).getInstallingPackageName();
            } catch (PackageManager.NameNotFoundException exception) {
                return null;
            }
        }

        return packageManager.getInstallerPackageName(packageName);
    }

    private PackageInfo getPackageInfo() throws PackageManager.NameNotFoundException {
        String packageName = this.getContext().getPackageName();
        PackageManager packageManager = this.getContext().getPackageManager();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0));
        }

        return packageManager.getPackageInfo(packageName, 0);
    }

    @SuppressWarnings("deprecation")
    private String getVersionCode(PackageInfo packageInfo) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return String.valueOf(packageInfo.getLongVersionCode());
        }

        return String.valueOf(packageInfo.versionCode);
    }

    private static class AndroidUpdateSupport {

        private final boolean hasGooglePlayServices;
        private final boolean hasAvailableGooglePlayServices;
        private final boolean hasGooglePlayStore;
        private final boolean wasInstalledByGooglePlayStore;
        private final boolean supportsGooglePlayInAppUpdates;

        private AndroidUpdateSupport(
            boolean hasGooglePlayServices,
            boolean hasAvailableGooglePlayServices,
            boolean hasGooglePlayStore,
            boolean wasInstalledByGooglePlayStore
        ) {
            this.hasGooglePlayServices = hasGooglePlayServices;
            this.hasAvailableGooglePlayServices = hasAvailableGooglePlayServices;
            this.hasGooglePlayStore = hasGooglePlayStore;
            this.wasInstalledByGooglePlayStore = wasInstalledByGooglePlayStore;
            this.supportsGooglePlayInAppUpdates =
                hasAvailableGooglePlayServices && hasGooglePlayStore && wasInstalledByGooglePlayStore;
        }
    }
}
