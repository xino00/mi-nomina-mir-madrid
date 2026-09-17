# Contribuir

El alcance actual es **Medicina: MIR R1–R5 del SERMAS, Comunidad de Madrid, en residencia ordinaria a jornada completa**. Una ampliación a otras titulaciones, territorios o situaciones requiere definir y verificar sus reglas; no basta con renombrar las pantallas.

## Comunicar un fallo

Describe la versión, pasos para reproducirlo, resultado esperado y resultado observado. Usa importes, fechas y eventos inventados. No subas PDFs reales, copias de datos personales, enlaces privados iCal ni capturas con identificadores o información de pacientes. Para explicar un error de PDF, prepara un archivo sintético que reproduzca su estructura.

## Cambiar reglas de cálculo

1. Cita la publicación oficial, página o artículo, colectivo y fecha de efectos.
2. Distingue lo expresamente publicado de cualquier aproximación del cálculo.
3. Actualiza las reglas de dominio y sus metadatos de vigencia en `src/domain/rules.ts`.
4. Añade un caso sintético que compruebe el comportamiento relevante, incluidos cambios de fecha o de grado cuando afecten.
5. Mantén separado el recibo confirmado de la previsión; una actualización normativa no debe reescribir cantidades cobradas.

Las fuentes retributivas se documentan en [FUENTES.md](docs/FUENTES.md). Los datos personales no son la referencia normativa del proyecto.

## Comprobaciones

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm run check:public
```

Revisa el diff completo y los archivos adjuntos antes de enviar el cambio. No añadas `node_modules`, compilaciones, bases de datos, exportaciones personales, claves o contraseñas. Si cambia una función nativa, prueba también el flujo en Android e indica dispositivo, versión y resultado. Señala expresamente cualquier prueba no ejecutada.

## Publicar la carpeta en GitHub

Usa esta carpeta como raíz de un repositorio nuevo. Antes del primer commit:

```sh
npm run check:public
git status --short
git diff --cached --stat
git diff --cached
```

Inspecciona lo que se va a publicar, incluidas imágenes y otros archivos binarios. Después puedes crear un repositorio vacío en GitHub y seguir sus instrucciones para conectar el remoto y subir la rama. No hace falta incluir dependencias instaladas ni claves para que otra persona compile el proyecto.

Para compartir el código como archivo ejecuta `npm run package:public`; el ZIP se genera en `releases/`. Los APK se comparten como artefactos de una versión, indicando cómo se han firmado y probado. El identificador Android no es una credencial; conservarlo evita alterar innecesariamente la identidad técnica de la aplicación.

El código propio se distribuye bajo la [licencia MIT](LICENSE). Al aportar código propio al proyecto, lo haces bajo esa misma licencia. Las dependencias conservan sus licencias y avisos.
