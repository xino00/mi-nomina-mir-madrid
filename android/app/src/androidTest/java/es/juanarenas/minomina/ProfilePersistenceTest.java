package es.juanarenas.minomina;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Native JSON storage contract; uses its own database, never the payroll database. */
@RunWith(AndroidJUnit4.class)
public class ProfilePersistenceTest {
    private ActivityScenario<MainActivity> scenario;

    @Test public void fiscalCalendarAndPreviousPayloadSurviveReopening() throws Exception {
        String name = "nomina_profile_test_" + System.currentTimeMillis();
        JSONObject db = new JSONObject().put("database", name);
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            scenario = activity;
            for (int i = 0; i < 100; i++) {
                if ("true".equals(evaluate("Boolean(window.Capacitor && window.Capacitor.nativePromise)"))) break;
                Thread.sleep(100);
            }
            call("createConnection", new JSONObject(db.toString()).put("version", 1)
                .put("encrypted", false).put("mode", "no-encryption").put("readonly", false));
            try {
                call("open", db);
                call("execute", new JSONObject(db.toString()).put("statements",
                    "CREATE TABLE payroll_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL);\n"
                    + "CREATE TABLE payroll_history (revision INTEGER PRIMARY KEY, payload TEXT NOT NULL);"));
                // Synthetic storage payloads. Full schema/migration is tested in TypeScript.
                String old = new JSONObject().put("settings", new JSONObject().put("taxMode", "manual")
                    .put("manualTaxPercent", 18)).put("recordedWithholding", 450).toString();
                JSONObject settings = new JSONObject().put("fiscalPreset", "madrid-single-employee")
                    .put("activeWorkProfileId", "mfyc-fjd").put("municipality", "Cercedilla")
                    .put("holidayMunicipality", "Madrid").put("localHolidays", new org.json.JSONArray()
                        .put("2026-05-15").put("2026-11-09"));
                String updated = new JSONObject().put("settings", settings).put("recordedWithholding", 450).toString();
                run(db, "INSERT INTO payroll_state VALUES (1,?,7)", new org.json.JSONArray().put(old));
                call("beginTransaction", db);
                run(db, "INSERT INTO payroll_history VALUES (7,?)", new org.json.JSONArray().put(old));
                run(db, "UPDATE payroll_state SET payload=?, revision=8 WHERE id=1", new org.json.JSONArray().put(updated));
                call("commitTransaction", db);
                call("close", db);
                call("open", db);
                assertEquals(updated, payload(db, "SELECT payload FROM payroll_state WHERE id=1"));
                assertEquals(old, payload(db, "SELECT payload FROM payroll_history WHERE revision=7"));
                assertEquals("Madrid", new JSONObject(payload(db, "SELECT payload FROM payroll_state WHERE id=1"))
                    .getJSONObject("settings").getString("holidayMunicipality"));
            } finally {
                call("deleteDatabase", db);
                call("closeConnection", db);
            }
        }
    }

    private void run(JSONObject db, String sql, org.json.JSONArray values) throws Exception {
        call("run", new JSONObject(db.toString()).put("statement", sql).put("values", values).put("transaction", false));
    }

    private String payload(JSONObject db, String sql) throws Exception {
        return call("query", new JSONObject(db.toString()).put("statement", sql).put("values", new org.json.JSONArray()))
            .getJSONArray("values").getJSONObject(0).getString("payload");
    }

    private JSONObject call(String method, JSONObject options) throws Exception {
        evaluate("window.__nominaProfileTest=null;window.Capacitor.nativePromise('CapacitorSQLite','" + method + "',"
            + options + ").then(value=>window.__nominaProfileTest={value:value||{}})"
            + ".catch(error=>window.__nominaProfileTest={error:error.message});true");
        for (int i = 0; i < 100; i++) {
            Object value = new JSONTokener(evaluate("JSON.stringify(window.__nominaProfileTest)")).nextValue();
            if (value instanceof String && !"null".equals(value)) {
                JSONObject result = new JSONObject((String) value);
                assertFalse(result.optString("error"), result.has("error"));
                return result.getJSONObject("value");
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Native callback timed out: " + method);
    }

    private String evaluate(String script) throws Exception {
        AtomicReference<String> value = new AtomicReference<>();
        CountDownLatch ready = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(script,
            result -> { value.set(result); ready.countDown(); }));
        assertTrue(ready.await(5, TimeUnit.SECONDS));
        return value.get();
    }
}
