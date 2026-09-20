# Privacidad y datos locales

La aplicación se distribuye sin perfil personal, nóminas, guardias ni calendarios precargados. El código de prueba utiliza datos sintéticos y las tablas retributivas son públicas. No necesita una cuenta.

## Qué se guarda

En Android, una base SQLite en el directorio privado de la app conserva la configuración, guardias, cantidades confirmadas, referencias de importación y hasta veinte versiones anteriores del estado. Las escrituras del estado y su historial se hacen dentro de una transacción. **La base SQLite no tiene cifrado propio activado**; utiliza el aislamiento del almacenamiento de Android.

En la WebApp, IndexedDB del navegador conserva la configuración, guardias, cantidades confirmadas, referencias de importación y hasta veinte versiones anteriores del estado. No comparte almacenamiento con Android ni sincroniza datos entre navegadores o dispositivos. La aplicación no añade cifrado propio a IndexedDB. Las copias JSON permiten trasladar los datos de forma manual entre versiones compatibles. Las copias nuevas v3, que incluyen perfiles, requieren una aplicación que admita esta versión; la app Android anterior solo admite v1/v2.

El enlace privado iCal tiene un tratamiento separado. En Android se cifra con AES-GCM y una clave Android Keystore y se guarda en una ubicación excluida de copias. En web solo se conserva en memoria durante la sesión: se pierde al recargar o cerrar la página. No se incorpora al JSON exportado en ninguna de las dos versiones.

La importación PDF se procesa dentro del dispositivo. Se guardan únicamente los campos estructurados revisados y el hash para detectar duplicados. No se conserva el PDF original ni su texto identificativo. El lector admite un recibo por archivo, hasta diez páginas y 15 MB; no realiza OCR.

Los eventos importados sí pueden conservar título, centro, fecha, notas y otros metadatos útiles para la conciliación. No incluyas información de pacientes ni de terceras personas en los títulos o notas de guardias.

Los perfiles propios de condiciones (nombre, centros, alias, horarios y calendarios locales) forman parte de tus datos locales y copias JSON. No se publican en GitHub. El perfil predefinido MFyC · FJD contiene condiciones de trabajo y fiestas locales públicas, sin fechas personales, recibos, calendario privado ni datos fiscales del usuario.

## Cuándo se utiliza la red

GitHub Pages sirve los archivos públicos de la WebApp y recibe las peticiones normales necesarias para abrirla y buscar actualizaciones. La aplicación no sube a GitHub las nóminas, guardias, documentos importados ni copias JSON. Su service worker conserva los recursos de la aplicación, incluido el lector PDF, para permitir el uso sin conexión después de una primera carga completa. Esa caché de recursos es distinta del almacenamiento de tus datos en IndexedDB.

El cálculo, edición e importación de archivos funcionan sin conexión una vez disponibles los recursos locales; Android los incluye en el APK. Si configuras un enlace iCal, la app solicita directamente el calendario a `calendar.google.com` mediante HTTPS. Google recibe esa solicitud; el contenido descargado se trata localmente. En web, la lectura puede ser bloqueada por las restricciones entre sitios (CORS); recomendamos importar un archivo ICS. No se envían nóminas ni recibos a un servicio de extracción.

No hay analítica, publicidad, servidor propio de datos ni conexión de cálculo con ChatGPT, Sites o Cloudflare. Al abrir una fuente oficial, el navegador del dispositivo se conecta al sitio elegido. Las dependencias necesarias para compilar se descargan durante la instalación del entorno de desarrollo, no durante el cálculo de una nómina.

## Copias y eliminación

- La copia JSON y el CSV exportados **contienen información personal y salarial introducida por quien usa la app**. No están cifrados por la aplicación. Elige una ubicación privada y no los añadas al repositorio.
- El JSON no contiene el enlace privado iCal ni los PDF originales; después de restaurarlo hay que conectar el calendario aparte.
- El historial interno es una recuperación local, no una copia externa. Al restaurar un estado se conserva una versión recuperable del anterior.
- En web, borrar los datos del sitio elimina IndexedDB y su historial. La navegación privada y la limpieza de almacenamiento del navegador pueden impedir conservarlos. Exporta periódicamente un JSON y evita usar navegación privada para tus registros.
- Cambiar de navegador, perfil o dispositivo abre un almacenamiento distinto. Para trasladar los datos, exporta el JSON en el origen y restáuralo en el destino; no se trata de una sincronización.
- Las copias automáticas de Android y la transferencia automática de datos están desactivadas. Desinstalar o borrar el almacenamiento elimina los datos de la app; los archivos exportados permanecen donde se guardaron.
- Los selectores de documentos de Android permiten elegir cada archivo. La app no solicita acceso general al almacenamiento ni conserva permisos persistentes sobre los documentos elegidos.

## Compartir un error o contribuir

Publica solo ejemplos sintéticos. No adjuntes recibos reales, copias JSON de uso personal, bases de datos, enlaces secretos de calendario, capturas con datos de pacientes o claves de firma. Un hash no convierte el resto del documento o del ejemplo en anónimo.

La revisión automática `npm run check:public` es una ayuda para detectar archivos y patrones no publicables. No sustituye la lectura del cambio y de sus anexos antes de subirlos.
