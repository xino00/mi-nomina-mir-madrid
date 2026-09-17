# Privacidad y datos locales

La aplicación se distribuye sin perfil personal, nóminas, guardias ni calendarios precargados. El código de prueba utiliza datos sintéticos y las tablas retributivas son públicas. No necesita una cuenta.

## Qué se guarda

En Android, una base SQLite en el directorio privado de la app conserva la configuración, guardias, cantidades confirmadas, referencias de importación y hasta veinte versiones anteriores del estado. Las escrituras del estado y su historial se hacen dentro de una transacción. **La base SQLite no tiene cifrado propio activado**; utiliza el aislamiento del almacenamiento de Android.

El enlace privado iCal tiene un tratamiento separado: se cifra con AES-GCM y una clave Android Keystore, y se guarda en una ubicación excluida de copias. No se incorpora al JSON exportado. En la vista de navegador la dirección solo se conserva en la sesión; el resto de datos usa IndexedDB y no comparte almacenamiento con Android.

La importación PDF se procesa dentro del dispositivo. Se guardan únicamente los campos estructurados revisados y el hash para detectar duplicados. No se conserva el PDF original ni su texto identificativo. El lector admite un recibo por archivo, hasta diez páginas y 15 MB; no realiza OCR.

Los eventos importados sí pueden conservar título, centro, fecha, notas y otros metadatos útiles para la conciliación. No incluyas información de pacientes ni de terceras personas en los títulos o notas de guardias.

## Cuándo se utiliza la red

El cálculo, edición e importación de archivos funcionan sin conexión. Si configuras un enlace iCal, la app solicita directamente el calendario a `calendar.google.com` mediante HTTPS. Google recibe esa solicitud; el contenido descargado se trata localmente. No se envían nóminas ni recibos a un servicio de extracción.

No hay analítica, publicidad, servidor propio ni conexión de cálculo con ChatGPT, Sites o Cloudflare. Al abrir una fuente oficial, el navegador del dispositivo se conecta al sitio elegido. Las dependencias necesarias para compilar se descargan durante la instalación del entorno de desarrollo, no durante el cálculo de una nómina.

## Copias y eliminación

- La copia JSON y el CSV exportados **contienen información personal y salarial introducida por quien usa la app**. No están cifrados por la aplicación. Elige una ubicación privada y no los añadas al repositorio.
- El JSON no contiene el enlace privado iCal ni los PDF originales; después de restaurarlo hay que conectar el calendario aparte.
- El historial interno es una recuperación local, no una copia externa. Al restaurar un estado se conserva una versión recuperable del anterior.
- Las copias automáticas de Android y la transferencia automática de datos están desactivadas. Desinstalar o borrar el almacenamiento elimina los datos de la app; los archivos exportados permanecen donde se guardaron.
- Los selectores de documentos de Android permiten elegir cada archivo. La app no solicita acceso general al almacenamiento ni conserva permisos persistentes sobre los documentos elegidos.

## Compartir un error o contribuir

Publica solo ejemplos sintéticos. No adjuntes recibos reales, copias JSON de uso personal, bases de datos, enlaces secretos de calendario, capturas con datos de pacientes o claves de firma. Un hash no convierte el resto del documento o del ejemplo en anónimo.

La revisión automática `npm run check:public` es una ayuda para detectar archivos y patrones no publicables. No sustituye la lectura del cambio y de sus anexos antes de subirlos.
