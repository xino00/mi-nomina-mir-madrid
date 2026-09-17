# Android: compilar, firmar e instalar

El APK incorpora los recursos web y el motor de cálculo. Requiere Android 8.0 (API 26) o posterior y Android System WebView/Chrome 119 o posterior. Compila y apunta a API 36. Capacitor sirve los recursos incluidos en el APK desde un origen local; no abre una web remota para calcular.

## Entorno

Instala Node 22.13 o posterior, JDK 21, Android SDK Platform 36, Build Tools 35.0.0, Platform Tools, Python 3 y las herramientas habituales de una shell Bash 4 o posterior. Configura `JAVA_HOME` y `ANDROID_HOME` con sus rutas de instalación. El proyecto incluye el Gradle Wrapper y fija las dependencias en `package-lock.json`.

Estos requisitos corresponden al proyecto y al flujo de [Capacitor 8](https://capacitorjs.com/docs/updating/8-0). La primera instalación y compilación necesitan conexión para descargar dependencias; usar la app ya instalada no la necesita para calcular.

Desde la raíz del repositorio:

```sh
npm ci
npm test
npm run build
npx cap sync android
npm run android:build
```

El modo predeterminado genera un APK **debug** en `releases/MiNomina-1.0.1-debug.apk`. Es útil para desarrollo; utiliza la clave de depuración del entorno y no debe confundirse con una distribución firmada por el mantenedor.

`npx cap sync android` se debe repetir después de cambiar dependencias nativas o los recursos web que se quieren empaquetar. `npm run android:build` ejecuta la construcción necesaria; no publica el APK ni instala aplicaciones automáticamente.

## Firma de distribución

La copia pública no incluye claves ni contraseñas. Cada distribuidor debe generar y custodiar su propia firma. Conserva el mismo certificado para poder actualizar sus instalaciones.

Crea una carpeta privada **fuera del repositorio** y genera allí el keystore. `keytool` pedirá la contraseña y los datos del certificado de forma interactiva; los datos públicos del certificado pueden consultarse desde el APK:

```sh
keytool -genkeypair -keystore /ruta/privada/mi-nomina-release.p12 \
  -storetype PKCS12 -alias mi-nomina -keyalg RSA -keysize 3072 -validity 10000
```

En esa misma ubicación privada, crea `release.properties` con esta estructura, sustituyendo los marcadores por tus valores. No lo copies al repositorio:

```properties
storeFile=/ruta/privada/mi-nomina-release.p12
storePassword=CONTRASENA_DEL_ALMACEN
keyAlias=mi-nomina
keyPassword=CONTRASENA_DE_LA_CLAVE
```

Restringe el acceso a ambos archivos y guarda una copia segura. En sistemas Unix se pueden aplicar permisos 700 a la carpeta y 600 a los archivos. Compila indicando la ruta del archivo de propiedades:

```sh
NOMINA_SIGNING_PROPERTIES=/ruta/privada/release.properties npm run android:build -- release
```

El APK de distribución se deposita en `releases/`. La comprobación de firma y de alineación se realiza sobre el artefacto generado. Ningún archivo de firma debe acompañar al APK, al ZIP de código ni a un commit. Consulta la documentación de [firma de Android](https://developer.android.com/studio/publish/app-signing).

Para una versión nueva, incrementa `versionCode` y `versionName` en `android/app/build.gradle` y actualiza la versión de `package.json` y `package-lock.json`. Mantén la clave anterior. Un APK firmado con otra clave no puede sustituir una instalación con el mismo identificador.

## Instalar y actualizar

Abre el APK en el teléfono y autoriza la instalación desde la aplicación que lo abrió cuando Android lo solicite. Para un dispositivo con depuración USB autorizada:

```sh
adb devices -l
adb install -r releases/MiNomina-1.0.1-debug.apk
```

Utiliza la ruta del APK de distribución cuando corresponda. Para actualizar conservando datos se necesitan el mismo identificador, la misma firma y una versión admitida por Android. Exporta antes una copia JSON. **No desinstales como paso de actualización:** desinstalar elimina los datos internos.

## Verificar en Android

El proyecto incluye pruebas instrumentadas. Con un emulador de prueba conectado, sin datos personales:

```sh
npm run build
npx cap sync android
cd android
./gradlew :app:connectedDebugAndroidTest
```

Que las pruebas instrumentadas compilen no significa que se hayan ejecutado. Los resultados concretos de esta copia se registran en [VERIFICACION.md](VERIFICACION.md).

Antes de distribuir una versión, comprueba en el dispositivo: inicio en modo avión; guardado tras forzar cierre; selectores reales de importación y exportación; PDF sintético; teclado decimal y coma; botón atrás; tamaño de texto ampliado; reconexión iCal; actualización con la misma firma; restauración JSON. La alineación estática de bibliotecas no sustituye ejecutar el APK en un sistema Android con páginas de memoria de 16 KB. [Requisitos Android de 16 KB](https://developer.android.com/guide/practices/page-sizes).

## Componentes nativos

El puente Android usa el [selector de documentos del sistema](https://developer.android.com/training/data-storage/shared/documents-files) para abrir y guardar archivos, y [Android Keystore](https://developer.android.com/privacy-and-security/keystore) para proteger el enlace de calendario. La base de datos y sus límites de privacidad se describen en [PRIVACIDAD.md](PRIVACIDAD.md).
