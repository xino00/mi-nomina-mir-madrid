package es.juanarenas.minomina;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** SAF document access and a private iCal secret; never logs document contents or URLs. */
@CapacitorPlugin(name = "NominaDevice")
public final class NominaDevicePlugin extends Plugin {
    private static final int MAX_BYTES = 30 * 1024 * 1024;
    private static final String KEY_ALIAS = "nomina.calendar.v1";
    private final AtomicBoolean documentPending = new AtomicBoolean(false);
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void openDocument(PluginCall call) {
        if (!documentPending.compareAndSet(false, true)) {
            call.reject("Ya hay un selector de documentos abierto.");
            return;
        }
        try {
            JSArray supplied = call.getArray("mimeTypes", new JSArray());
            String[] types = new String[supplied.length()];
            for (int i = 0; i < supplied.length(); i++) types[i] = supplied.getString(i);
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(types.length == 1 ? types[0] : "*/*");
            if (types.length > 1) intent.putExtra(Intent.EXTRA_MIME_TYPES, types);
            startActivityForResult(call, intent, "documentOpened");
        } catch (Exception exception) {
            documentPending.set(false);
            call.reject("No se pudo abrir el selector de documentos.");
        }
    }

    @ActivityCallback
    private void documentOpened(PluginCall call, ActivityResult result) {
        documentPending.set(false);
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }
        worker.execute(() -> {
            try {
                String name = "documento";
                try (Cursor cursor = getContext().getContentResolver().query(uri,
                        new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                        if (sizeIndex >= 0 && !cursor.isNull(sizeIndex) && cursor.getLong(sizeIndex) > MAX_BYTES) {
                            call.reject("El documento supera el límite de 30 MB.");
                            return;
                        }
                        int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (nameIndex >= 0 && !cursor.isNull(nameIndex)) name = cursor.getString(nameIndex);
                    }
                }
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
                    if (input == null) throw new IllegalStateException();
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        if (bytes.size() + count > MAX_BYTES) {
                            call.reject("El documento supera el límite de 30 MB.");
                            return;
                        }
                        bytes.write(buffer, 0, count);
                    }
                }
                String type = getContext().getContentResolver().getType(uri);
                call.resolve(new JSObject().put("name", name)
                    .put("mimeType", type == null ? "application/octet-stream" : type)
                    .put("data", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)));
            } catch (Exception exception) {
                call.reject("No se pudo leer el documento. Vuelve a seleccionarlo.");
            }
        });
    }

    @PluginMethod
    public void saveDocument(PluginCall call) {
        String data = call.getString("data");
        String name = call.getString("name", "mi-nomina.json");
        if (data == null || data.length() > ((long) MAX_BYTES * 4 / 3 + 4)) {
            call.reject("El documento está vacío o supera el límite de 30 MB.");
            return;
        }
        // Validate before creating any destination file.
        try { Base64.decode(data, Base64.DEFAULT); }
        catch (IllegalArgumentException exception) {
            call.reject("El contenido del documento no es válido.");
            return;
        }
        if (!documentPending.compareAndSet(false, true)) {
            call.reject("Ya hay un selector de documentos abierto.");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(call.getString("mimeType", "application/octet-stream"));
            intent.putExtra(Intent.EXTRA_TITLE, new File(name).getName());
            startActivityForResult(call, intent, "documentSaved");
        } catch (Exception exception) {
            documentPending.set(false);
            call.reject("No se pudo abrir el selector para guardar.");
        }
    }

    @ActivityCallback
    private void documentSaved(PluginCall call, ActivityResult result) {
        documentPending.set(false);
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }
        worker.execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IllegalStateException();
                String encoded = call.getString("data");
                if (encoded == null) throw new IllegalStateException();
                output.write(Base64.decode(encoded, Base64.DEFAULT));
                output.flush();
                call.resolve(new JSObject().put("cancelled", false));
            } catch (Exception exception) {
                call.reject("No se pudo guardar el documento. Repite la exportación.");
            }
        });
    }

    @PluginMethod
    public void setCalendarSecret(PluginCall call) {
        String url = call.getString("url", "").trim();
        if (!isCalendarUrl(url)) {
            call.reject("Introduce un enlace iCal HTTPS válido de Google Calendar.");
            return;
        }
        worker.execute(() -> {
            AtomicFile file = secretFile();
            FileOutputStream output = null;
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, calendarKey());
                byte[] ciphertext = cipher.doFinal(url.getBytes(StandardCharsets.UTF_8));
                JSONObject secret = new JSONObject()
                    .put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                    .put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
                output = file.startWrite();
                output.write(secret.toString().getBytes(StandardCharsets.UTF_8));
                file.finishWrite(output);
                call.resolve();
            } catch (Exception exception) {
                if (output != null) file.failWrite(output);
                call.reject("No se pudo proteger el enlace del calendario.");
            }
        });
    }

    @PluginMethod
    public void getCalendarSecret(PluginCall call) {
        worker.execute(() -> {
            try {
                AtomicFile file = secretFile();
                JSONObject secret = new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, calendarKey(),
                    new GCMParameterSpec(128, Base64.decode(secret.getString("iv"), Base64.NO_WRAP)));
                String url = new String(cipher.doFinal(Base64.decode(secret.getString("ciphertext"), Base64.NO_WRAP)),
                    StandardCharsets.UTF_8);
                call.resolve(new JSObject().put("url", url));
            } catch (FileNotFoundException exception) {
                call.resolve(new JSObject().put("url", JSONObject.NULL));
            } catch (Exception exception) {
                call.reject("No se pudo recuperar el enlace protegido. Vuelve a conectar el calendario.");
            }
        });
    }

    @PluginMethod
    public void clearCalendarSecret(PluginCall call) {
        worker.execute(() -> {
            try {
                secretFile().delete();
                KeyStore store = KeyStore.getInstance("AndroidKeyStore");
                store.load(null);
                store.deleteEntry(KEY_ALIAS);
                call.resolve();
            } catch (Exception exception) {
                call.reject("No se pudo desconectar el calendario. Inténtalo de nuevo.");
            }
        });
    }

    static boolean isCalendarUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            return value.length() <= 4096 && "https".equalsIgnoreCase(uri.getScheme())
                && "calendar.google.com".equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getEncodedPath() != null
                && uri.getEncodedPath().matches("^/calendar/ical/[^/]+/(private-[^/]+|public)/basic\\.ics$")
                && (uri.getQuery() == null || uri.getQuery().isEmpty())
                && (uri.getFragment() == null || uri.getFragment().isEmpty());
        } catch (Exception exception) { return false; }
    }

    private AtomicFile secretFile() {
        return new AtomicFile(new File(getContext().getNoBackupFilesDir(), "calendar-secret-v1.json"));
    }

    private SecretKey calendarKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return generator.generateKey();
    }

    @Override
    public Boolean shouldOverrideLoad(Uri uri) {
        if ("https".equals(uri.getScheme()) && "localhost".equals(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)) return false;
        // Bibliography opens outside the privileged local WebView.
        if ("https".equals(uri.getScheme())) {
            try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
            catch (Exception ignored) { /* No compatible browser; keep the local app. */ }
        }
        return true;
    }

    @Override
    protected void handleOnDestroy() {
        worker.shutdown();
    }
}
