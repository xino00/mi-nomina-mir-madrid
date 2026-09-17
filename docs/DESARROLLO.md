# Desarrollo

React, TypeScript y Vite; Capacitor 8 para Android; SQLite, PDF.js con worker local y una tipografía incluida en el paquete. **Node 22.13 o posterior** y npm. El empaquetado del ZIP también necesita Python 3. Ejecuta los comandos desde la raíz de este repositorio:

```sh
npm ci
npm run dev
```

La vista de navegador facilita el desarrollo, pero usa un almacenamiento separado y no sustituye la prueba de los selectores de documentos, Keystore o SQLite de Android.

```sh
npm test
npm run build
npm run test:e2e
npm run check:public
```

Las pruebas de navegador usan Chrome en `/usr/bin/google-chrome`; si está instalado en otro lugar, define `NOMINA_CHROME_PATH`. `test:e2e` necesita la compilación de `npm run build`. El worker PDF también puede probarse desde `/tests/pdf-integration.html?legacy=1` con el servidor de desarrollo activo.

Para Android instala **JDK 21, Android SDK Platform 36, Build Tools 35.0.0 y Platform Tools**. Configura `JAVA_HOME` y `ANDROID_HOME`:

```sh
npm run build
npx cap sync android
npm run android:build
```

El último comando genera un APK de depuración. La firma de distribución se configura aparte y permanece fuera del repositorio: [compilación, firma e instalación](ANDROID.md).

## Organización

```text
src/domain/     Cálculo, calendario, reglas, recibos y migración
src/services/   Operaciones locales, documentos e historial
src/platform/   Persistencia Android y navegador
src/           Pantallas y estilos
android/       Proyecto nativo y puente de documentos/Keystore
tests/         Casos sintéticos y recorridos de navegador
scripts/       Compilación y comprobaciones de distribución
docs/          Fuentes, privacidad y documentación Android
```
