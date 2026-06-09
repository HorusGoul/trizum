package app.trizum.capacitor;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeUpdateEnvironmentPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
