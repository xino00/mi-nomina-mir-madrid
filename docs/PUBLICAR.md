# Publicar en GitHub

Utiliza **esta carpeta como raíz del repositorio**. El ZIP contiene el código, los recursos locales, las pruebas sintéticas y la documentación; no contiene dependencias instaladas, claves de distribución ni datos de uso.

Nombre sugerido: `mi-nomina-mir-madrid`.

Descripción sugerida: «Calculadora Android local para médicos residentes MIR del SERMAS, Madrid. Tablas del BOCM, guardias, recibos y previsión anual».

## Comprobar y crear el primer commit

Necesitas Git y Node 22.13 o posterior. Ejecuta desde la carpeta que contiene `package.json`:

```sh
npm ci
npm run check:public
npm test
npm run build
git init -b main
git add .
git diff --cached --stat
git diff --cached
```

Revisa el contenido preparado. Git utiliza el nombre y correo configurados para el autor del commit: compruébalos y utiliza el correo privado de GitHub si no quieres publicar tu correo personal.

```sh
git config user.name
git config user.email
git commit -m "Publicar calculadora MIR Madrid"
```

## Crear y subir el repositorio

Con [GitHub CLI](https://cli.github.com/manual/gh_repo_create) instalado, este comando crea un repositorio **público** en tu cuenta y sube el commit:

```sh
gh auth login
gh repo create mi-nomina-mir-madrid --public --source=. --remote=origin --push
```

Si prefieres la web, crea un repositorio vacío en GitHub y sigue los comandos que muestra para conectar y subir un repositorio existente. Esta preparación local no crea ni publica ningún repositorio remoto automáticamente.

El flujo de GitHub Actions comprobará el código, los ejemplos, los recorridos de navegador y la compilación Android de depuración. Su primera ejecución en GitHub debe revisarse después de subir el repositorio; no se da por ejecutada durante la preparación local.

## Compartir versiones

`npm run package:public` genera el ZIP del código dentro de `releases/`. Para distribuir una app instalable, compila un APK de tipo `release` con tu firma y compártelo en una versión de GitHub, según [ANDROID.md](ANDROID.md). Conserva esa firma fuera del repositorio para futuras actualizaciones.

Mantén actualizados `docs/FUENTES.md`, las vigencias y el registro de comprobaciones al publicar una nueva versión. Incluye siempre la [licencia MIT](../LICENSE) y conserva los avisos de las dependencias al distribuir el código.
