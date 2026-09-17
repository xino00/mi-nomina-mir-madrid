package es.juanarenas.minomina;

import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Run on a disposable emulator; these are native bridge contracts, not physical-device acceptance. */
@RunWith(AndroidJUnit4.class)
public class DeviceContractTest {
    private ActivityScenario<MainActivity> scenario;

    @Before public void launch() throws Exception {
        scenario = ActivityScenario.launch(MainActivity.class);
        awaitBridge();
    }

    @After public void close() { if (scenario != null) scenario.close(); }

    @Test public void packagedAppUsesOnlyLocalWebViewAndNoStoragePermissions() throws Exception {
        assertEquals("\"https://localhost\"", evaluate("window.location.origin"));
        var context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("es.juanarenas.minomina", context.getPackageName());
        assertEquals(0, context.getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), PackageManager.GET_PERMISSIONS);
        assertFalse(Arrays.asList(info.requestedPermissions).contains("android.permission.READ_EXTERNAL_STORAGE"));
        assertFalse(Arrays.asList(info.requestedPermissions).contains("android.permission.MANAGE_EXTERNAL_STORAGE"));
    }

    @Test public void calendarSecretSurvivesActivityRecreationAndIsEncrypted() throws Exception {
        JSONObject previous = nativeResult("NominaDevice", "getCalendarSecret", "{}");
        assumeTrue("Run on an emulator without a configured calendar", previous.isNull("url"));
        String url = "https://calendar.google.com/calendar/ical/fixture%40example.invalid/private-test/basic.ics";
        try {
            nativeResult("NominaDevice", "setCalendarSecret", new JSONObject().put("url", url).toString());
            File secret = new File(InstrumentationRegistry.getInstrumentation().getTargetContext()
                .getNoBackupFilesDir(), "calendar-secret-v1.json");
            String stored = new String(Files.readAllBytes(secret.toPath()), StandardCharsets.UTF_8);
            assertFalse(stored.contains("calendar.google.com"));
            assertTrue(new JSONObject(stored).has("ciphertext"));
            scenario.recreate();
            awaitBridge();
            assertEquals(url, nativeResult("NominaDevice", "getCalendarSecret", "{}").getString("url"));
        } finally {
            nativeResult("NominaDevice", "clearCalendarSecret", "{}");
        }
        assertTrue(nativeResult("NominaDevice", "getCalendarSecret", "{}").isNull("url"));
    }

    @Test public void cancelDocumentPickerReturnsWithoutReadingOrWriting() throws Exception {
        Intents.init();
        try {
            intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null));
            assertTrue(nativeResult("NominaDevice", "openDocument", "{mimeTypes:['application/pdf']}").getBoolean("cancelled"));
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null));
            assertTrue(nativeResult("NominaDevice", "saveDocument", "{name:'fixture.json',mimeType:'application/json',data:'e30='}").getBoolean("cancelled"));
        } finally { Intents.release(); }
    }

    @Test public void sqlitePersistsCommittedDataAndRollsBackIncompleteWrites() throws Exception {
        String database = "nomina_device_test_" + System.currentTimeMillis();
        String db = "{database:'" + database + "'}";
        nativeResult("CapacitorSQLite", "createConnection", "{database:'" + database + "',version:1,encrypted:false,mode:'no-encryption',readonly:false}");
        try {
            nativeResult("CapacitorSQLite", "open", db);
            nativeResult("CapacitorSQLite", "execute", "{database:'" + database + "',statements:'CREATE TABLE check_state (value INTEGER NOT NULL); INSERT INTO check_state VALUES (7);'}");
            nativeResult("CapacitorSQLite", "beginTransaction", db);
            nativeResult("CapacitorSQLite", "execute", "{database:'" + database + "',statements:'UPDATE check_state SET value=99;',transaction:false}");
            nativeResult("CapacitorSQLite", "rollbackTransaction", db);
            nativeResult("CapacitorSQLite", "close", db);
            nativeResult("CapacitorSQLite", "open", db);
            JSONObject result = nativeResult("CapacitorSQLite", "query", "{database:'" + database + "',statement:'SELECT value FROM check_state;',values:[]}");
            assertEquals(7, result.getJSONArray("values").getJSONObject(0).getInt("value"));
        } finally {
            nativeResult("CapacitorSQLite", "deleteDatabase", db);
            nativeResult("CapacitorSQLite", "closeConnection", db);
        }
    }

    @Test public void calendarValidatorRejectsOtherOrigins() {
        assertTrue(NominaDevicePlugin.isCalendarUrl("https://calendar.google.com/calendar/ical/a/private-123/basic.ics"));
        assertFalse(NominaDevicePlugin.isCalendarUrl("http://calendar.google.com/calendar/ical/a/basic.ics"));
        assertFalse(NominaDevicePlugin.isCalendarUrl("https://calendar.google.com.attacker.invalid/calendar/ical/a/basic.ics"));
        assertFalse(NominaDevicePlugin.isCalendarUrl("https://user:pass@calendar.google.com/calendar/ical/a/basic.ics"));
        assertFalse(NominaDevicePlugin.isCalendarUrl("file:///calendar.ics"));
    }

    private void awaitBridge() throws Exception {
        for (int i = 0; i < 100; i++) {
            if ("true".equals(evaluate("Boolean(window.Capacitor && window.Capacitor.nativePromise)"))) return;
            Thread.sleep(100);
        }
        fail("The packaged Capacitor bridge did not load");
    }

    private JSONObject nativeResult(String plugin, String method, String options) throws Exception {
        evaluate("window.__nominaTestResult=null;window.Capacitor.nativePromise('" + plugin + "','" + method + "'," + options
            + ").then(value=>{window.__nominaTestResult={value:value||{}}}).catch(error=>{window.__nominaTestResult={error:error.message}});true");
        for (int i = 0; i < 100; i++) {
            String encoded = evaluate("JSON.stringify(window.__nominaTestResult)");
            Object decoded = new JSONTokener(encoded).nextValue();
            if (decoded instanceof String && !decoded.equals("null")) {
                JSONObject result = new JSONObject((String) decoded);
                assertFalse("Native bridge error: " + result.optString("error"), result.has("error"));
                return result.getJSONObject("value");
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Native bridge callback timed out: " + method);
    }

    private String evaluate(String script) throws Exception {
        AtomicReference<String> value = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(script, result -> {
            value.set(result); latch.countDown();
        }));
        assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS));
        return value.get();
    }
}
