> 语言 / Language: [简体中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md)

# Twisty Atlas · Atlas de Fórmulas de Cubos

Biblioteca de fórmulas para múltiples tipos de cubos + reproductor de movimientos **tridimensional real** + **cronómetro estilo csTimer**.
Las fórmulas, el resaltado de pasos y la imagen tridimensional están estrictamente sincronizados; incluye **37 conjuntos de fórmulas (2433 casos / 13667 fórmulas)**;
los datos se almacenan localmente y pueden utilizarse sin conexión. Las versiones de escritorio y Android tienen interfaces de interacción independientes (no es la misma página escalada).

No es una imagen de ejemplo ni un vídeo: el cubo / tetraedro / dodecaedro se renderiza en tiempo real con WebGL, y cada giro de capa se calcula mediante el modelo de estado de
`cubing.js`; las pruebas verifican la corrección a partir del estado del motor, no de capturas de pantalla.

---

## Funciones

### Reproductor tridimensional
- **Reproducción tridimensional real**: tercer orden, órdenes 2 a 7, pyraminx, skewb y megaminx, un total de 9 tipos son tridimensionales reales;
  Square-1 se renderiza en 2D (limitación del motor, indicada honestamente).
- **Reproducción paso a paso**: contador 0 / N, barra de progreso arrastrable, paso anterior / siguiente, ir al inicio / al final, velocidad variable de 0,5× a 2×.
  Hacer clic en el paso k siempre detiene la imagen al finalizar el paso k (la posición se basa en la línea de tiempo del motor, no en un temporizador).
- **Tres estados iniciales**: comenzar desde el estado resuelto / usar la fórmula inversa como estado inicial / configuración personalizada (setup) para casos como OLL, PLL y F2L.
- **Cara inferior de demostración opcional**: amarillo (predeterminado) / blanco / azul / verde / rojo / naranja. El método no es «girar la cámara»,
  sino aplicar una conjugación `R·A·R⁻¹` a la fórmula junto con el estado inicial; el estado final sigue siendo el resuelto, solo cambia la orientación global;
  la selección se guarda de forma persistente y, al cambiarla, se recarga inmediatamente la fórmula actual.
- **Cámara y ángulo de visión**: arrastrar para girar, rueda para acercar / alejar, restablecer con un clic. **Mover la cámara no cambia el estado del cubo** (existe un caso de prueba específico).

### Conjuntos de fórmulas integrados (37 / 2433 casos / 13667 fórmulas)
| Categoría | Contenido |
|---|---|
| 3×3 · línea principal CFOP | OLL 57, PLL 21, 2-Look OLL 10, 2-Look PLL 6, F2L 41 |
| 3×3 · sistema avanzado | COLL 40, WV 26, ZBLL/1LLL 472, **VLS 189**, ZBLS 291, OLLCP 342, CLS 97, SBLS 65, SV 27, CMLL 42, ELL 25, Advanced F2L 54, Pseudo F2L 33 |
| 2×2 | CLL 42, EG-1 40, EG-2 40, Ortega OLL 7, Ortega PBL 9 |
| 4×4 / 5×5 | 4×4 OLL Parity 9, 4×4 PLL Parity 52, 5×5 L2E 31 |
| Pyraminx / Megaminx / SQ-1 | Pyraminx L4E 49; Megaminx CO/CP/EO/EP/PLL 16/15/3/5/151; SQ-1 CO/CP/EO/EP/Parity 7/8/7/99/5 |

Cada fórmula se ha validado estructuralmente con KPuzzle real (9357 pasaron la validación completa de estado y 4310 la validación de sintaxis + analizabilidad),
el panel de detalles muestra la procedencia y el nivel de validación; las 399 fórmulas descartadas se registran en `data/verified/rejected.json`.
Consultar los detalles en [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

### Cronómetro (estilo csTimer)
- Barra de scramble en la parte superior (estado aleatorio real WCA) + obtener otro (`N`); el texto del scramble se ajusta completamente en móvil, sin truncarse.
- Mantener pulsada la barra espaciadora (o la zona del número grande) ≥ 300 ms hasta que se ponga verde → soltar para iniciar; pulsar de nuevo para detener.
- Observación WCA: iniciar en 15 s, de 15 a 17 s se penaliza con `+2`, más de 17 s se marca como `DNF` (activable / desactivable).
- Estadísticas: actual / mejor / peor / promedio / mo3 / ao5 / ao12 / **ao50 / ao100** / mejor ao5 / ao12 / ao50,
  promedio recortando extremos y reglas DNF correctas.
- **Los tiempos se pueden editar uno por uno**: clic en `+2` / `DNF` para alternar la penalización, clic para eliminar un registro individual; tecla `Delete` para borrar el último registro; vaciar la sesión.
- **Exportación**: CSV (se abre directamente en Excel, incluye penalizaciones, scramble y marca de tiempo) / JSON (campos completos) / texto plano (tabla alineada).
- Columna derecha: vista previa real de `TwistyPlayer` de «cómo se ve este scramble» (no es una imagen).
- La pantalla de siete segmentos son polígonos SVG puros (trazos sesgados + `skewX(-6)`), sin dependencias de fuentes; el ancho se adapta automáticamente,
  y al cronometrar números largos como `1:23.456` se reduce de tamaño automáticamente para no recortarse en pantallas estrechas.

### Gestión de la biblioteca de fórmulas
- Búsqueda (título / fórmula / etiquetas), filtrado por categoría y etiquetas, favoritos, ordenación, crear / editar / duplicar / eliminar / deshacer eliminación.
- Importación y exportación en doble formato JSON y CSV; vista previa antes de importar y marcado de duplicados; transacción global, se revierte todo en caso de error.
- Tres columnas en escritorio; en móvil ya no se muestran «lista + detalle» en paralelo: al tocar un registro se entra directamente a la página de detalle individual (con reproductor).

### Dos interfaces, escritorio / móvil
| | Escritorio (> 760 px) | Móvil (≤ 760 px) |
|---|---|---|
| Navegación | Navegación horizontal superior (incluye la vista de tres columnas «Espacio de trabajo») | **4 pestañas inferiores**: cronómetro / conjuntos / biblioteca / ajustes (al alcance del pulgar, evitando la zona de gestos de pantalla completa) |
| Diseño | Tres columnas en paralelo | Una sola columna, las zonas grandes (reproductor / cronómetro grande) tienen altura fija, la lista se desplaza dentro de su contenedor, **la página completa no se desplaza verticalmente** |
| Entrada | Espacio de trabajo `#/` | Va automáticamente a `#/sets` (el espacio de trabajo es una vista exclusiva de escritorio que combina tres columnas) |
| Densidad de información | Todos los campos | Se eliminan títulos repetidos, contadores repetidos y explicaciones largas, conservando las operaciones esenciales |

### Interfaz en seis idiomas
- La interfaz admite 简体中文 / English / 日本語 / Русский / Español / Português (BR) y se cambia al instante en «Ajustes → Idioma», conservándose de forma persistente; la opción «Seguir el sistema» se resuelve según el idioma preferido del navegador.
- Las capas inferiores (`domain` / `application` / `infrastructure`) no contienen textos de interfaz; las traducciones se concentran en la capa de presentación `src/presentation/i18n/`. Las claves del diccionario se derivan del idioma de referencia; tanto las claves faltantes como las sobrantes generan un error de tipos, y hay pruebas unitarias que verifican que el conjunto de claves y los marcadores de interpolación coincidan en los seis idiomas.
- El propio README también está disponible en seis idiomas y se puede cambiar con una sola línea en la parte superior.

### Atajos de teclado (reproductor)
| Tecla | Acción |
|---|---|
| `Space` | Reproducir / pausar (en la página del cronómetro: cronometrar) |
| `←` / `→` | Paso anterior / siguiente |
| `Home` / `End` | Ir al inicio / al final |
| `Delete` | En la página del cronómetro, borrar el último tiempo |
| `Esc` | Cerrar cuadro de diálogo / cancelar el cronometraje |

---

## Inicio rápido

```bash
npm install
npm run dev          # http://localhost:5173
```

### Todos los comandos

```bash
npm run dev            # servidor de desarrollo
npm run build          # comprobación de tipos + compilación de producción (vue-tsc --noEmit && vite build)
npm run preview        # previsualizar los artefactos de compilación
npm run check          # comprobación de tipos + comprobación de arquitectura + 115 pruebas unitarias
npm run test           # ejecutar solo Vitest
npm run test:e2e       # Playwright (44 ejecuciones: 38 en el proyecto de escritorio + 6 en el móvil)
npm run data:build     # regenerar los conjuntos de fórmulas integrados (los resultados de la captura están en data/raw/)
npm run desktop:build  # empaquetar escritorio → out/TwistyAtlas/TwistyAtlas.exe
npm run android:apk    # empaquetar Android → out/TwistyAtlas-1.3.0-android-debug.apk
```

---

## Dos esquemas de empaquetado

| Objetivo | Tecnología | Artefacto |
|---|---|---|
| Ordenador (Windows x64) | Electron 45 (`contextIsolation` + `sandbox`) | `out/TwistyAtlas/TwistyAtlas.exe` (367 MB, sin instalación) |
| Teléfono Android | Capacitor 8 + Gradle (minSdk 24 / targetSdk 36, JDK 21) | `out/TwistyAtlas-1.3.0-android-debug.apk` (5,1 MB) |

Los pasos, los requisitos del entorno, los problemas encontrados y las conclusiones de las pruebas reales están en [`docs/PACKAGING.md`](docs/PACKAGING.md).

---

## Arquitectura

Se divide en capas (`domain / application / infrastructure / presentation / data`) y la dirección de las dependencias se protege estáticamente mediante
`scripts/check-arch.mjs` (67 archivos); `cubing/*` solo puede aparecer en `infrastructure/cubing`:

```
src/
  domain/                  # lógica pura, cero dependencias de frameworks
    model/                 #   fórmula, cubo, tiempo, ajustes, orientación de demostración (orientation)
    timer/                 #   máquina de estados del cronómetro (funciones puras), estadísticas, formato
  application/
    sets/                  #   carga y clasificación de los conjuntos integrados
    timer/                 #   exportación de tiempos (CSV / JSON / texto, funciones puras)
  infrastructure/
    cubing/                #   único lugar que interactúa con cubing.js (incluye adapters/)
    persistence/           #   Dexie: fórmulas, tiempos, ajustes
  presentation/            # componentes Vue / vistas / store Pinia / rutas / composables / i18n
  data/algsets.json        # conjuntos generados en tiempo de compilación (chunk independiente, no se carga en la primera pantalla)
e2e/                       # Playwright (escritorio + móvil)
scripts/                   # canalización de datos, comprobación de arquitectura, empaquetado, verificación y capturas
docs/                      # arquitectura, datos, empaquetado, evidencia de aceptación
```

Los detalles están en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Pruebas y evidencia

```
Pruebas unitarias   115 (Vitest)  —— límites del cronómetro/estadísticas/validación de fórmulas/importación-exportación/posicionamiento de reproducción/formato de exportación/conjugación de la cara inferior/diccionario de seis idiomas
Pruebas de extremo a extremo  44 ejecuciones (Playwright) —— WebGL real, consistencia de estado, persistencia, sin desplazamiento de página completa en móvil, pestañas accesibles, cambio de idioma
Comprobación de arquitectura  67 archivos, sin dependencias fuera de límite
Validación de datos   2433 casos / 13667 fórmulas verificadas una a una con el motor (399 rechazadas)
```

```bash
# Verificar renderizado y estado cubo por cubo (reescribirá docs/capability-raw.md y docs/screenshots/puzzle-*.png)
node scripts/verify-puzzles.mjs

# Prueba de humo del artefacto de producción (ejecutar antes npx vite preview --port 4173)
node scripts/verify-dist.mjs

# Verificación página por página del artefacto de escritorio (ejecutar antes out/TwistyAtlas/TwistyAtlas.exe --remote-debugging-port=9222)
node scripts/verify-desktop.mjs

# Archivo de capturas de escritorio; capturas de las cuatro páginas del móvil + inspección cuantitativa de «sin desplazamiento de página / sin desbordamiento horizontal / pestañas dentro del viewport»
node scripts/shots.mjs
node scripts/shot-mobile.mjs
```

---

## Documentación

| Archivo | Contenido |
|---|---|
| `docs/ARCHITECTURE.md` | Capas, reglas de dependencia, módulos clave, flujo de datos, puntos de extensión, estrategia de rutas en móvil |
| `docs/PACKAGING.md` | Comandos, entorno, problemas y conclusiones de pruebas reales de los dos esquemas de empaquetado |
| `docs/DATA_SOURCES.md` | Procedencia de los 37 conjuntos, criterios estructurales, entradas rechazadas, lagunas conocidas |
| `docs/API_VERIFICATION.md` | Verificación punto por punto de la API de cubing.js (versiones, firmas, salidas en tiempo de ejecución, hipótesis descartadas) |
| `docs/CUBING_CAPABILITY_MATRIX.md` | Conclusiones de pruebas reales de 10 tipos de cubos (incluido por qué Square-1 solo puede ser 2D) |
| `docs/TECH_DECISIONS.md` | Decisiones técnicas: opciones elegidas y descartadas, razones y costes |
| `docs/ACCEPTANCE_REPORT.md` | Informes de aceptación de las fases A–H + adendas de v1.2 / v1.3 |
| `docs/screenshots/` | Capturas reales de escritorio y móvil (390×844 / 360×800), de cada cubo, del cronómetro y de los conjuntos de fórmulas |
| `README.{en,ja,ru,es,pt-BR}.md` | README en seis idiomas, con cambio mutuo mediante una línea en la parte superior |

---

## Datos y privacidad

- Todos los datos están en IndexedDB del navegador (nombre de la base de datos `TwistyAtlasDB`), **sin carga al servidor, sin cuentas y sin backend**.
- Borrar los datos del sitio hará perder fórmulas y tiempos; se recomienda exportar JSON periódicamente como copia de seguridad.
- La importación solo acepta campos de lista blanca y el HTML se renderiza como texto plano (existe un caso de prueba específico que verifica que no se ejecutan scripts).

---

## Limitaciones conocidas

1. **Square-1 solo tiene renderizado 2D**: se comprobó que `visualizationStrategy` de `cubing@0.66.1` para Square-1 es `2D` en pruebas reales,
   y no existe un modelo de deformación tridimensional real. El área de reproducción muestra una insignia de «renderizado 2D», **sin hacerse pasar por 3D**.
2. **Los cubos reproducibles se limitan a 10**: el motor incluye 21, pero los que no se han validado estado por estado no aparecen en el selector.
3. **El paquete de Android no se ha probado en un dispositivo real**: compila correctamente y pasa la verificación de estructura del paquete, pero no hay AVD/dispositivo disponible y no se ha verificado su instalación y ejecución.
4. **La versión de escritorio no está firmada ni tiene icono propio**: la primera ejecución puede mostrar un aviso de «editor desconocido».
5. **La actualización automática de PWA puede interrumpir la edición**: `registerType: 'autoUpdate'`, no se ha implementado «retrasar la actualización cuando hay cambios sin guardar».
6. **Sin sincronización en la nube**: para usar varios dispositivos, exporta / importa.
7. **El móvil no admite un diseño de reproducción de nivel profesional en horizontal**: en horizontal sigue siendo utilizable, pero la altura del reproductor se calcula con `vh`, por lo que el área visible es relativamente pequeña.

---

## Requisitos del navegador

WebGL2 + IndexedDB + ES2022. Verificado en Chromium (canal `chromium` incluido en Playwright,
renderizado por software con SwiftShader) y en Electron 45.

---

## Licencia

[MIT](LICENSE) © 2026 yiqing1218

Las bibliotecas de terceros utilizadas (Vue, Vite, cubing.js, Dexie, Electron, Capacitor, etc.) conservan sus respectivas licencias originales,
la lista completa se encuentra en el repositorio de cada dependencia. Los datos de fórmulas integrados proceden de sitios públicos de cubing;
las fuentes y los créditos por conjunto están en [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).
