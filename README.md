# 🎹 Piano Coach — entrenador de piano para el Casio CT-S300

Aplicación web personal para aprender piano desde cero hasta nivel avanzado con un **Casio CT-S300 conectado por USB-MIDI**.
Evalúa lo que tocas a partir de los **eventos MIDI reales** del teclado (nota, momento de pulsar y soltar, velocidad), sin micrófono.

- **Aprender**: programa de 5 niveles y 47 lecciones. Cada lección tiene objetivo, explicación, demostración visual y sonora, ejercicio evaluado y criterio de avance.
- **Entrenador de acordes** (en Aprender): tarjetas de memoria por grupos pequeños (fundamentales, útiles, ocasionales), inversiones, **modo examen** («toca Do mayor en 1.ª inversión»), consejos y progresiones de pop, jazz, blues, flamenco y más con inversiones.
- **Practicar**: escalas, acordes, arpegios, progresiones, ritmo y lectura de notas, con tempo ajustable y **modo desafío**.
- **Canciones**: pide una canción en lenguaje natural a **Claude Code** con el comando `/cancion` (sin clave de API), importa un MIDI o usa la biblioteca de dominio público. Cada canción tiene versiones principiante, intermedia y avanzada y se puede practicar por secciones.
- **Teclado**: piano virtual de 61 teclas con detección de acordes y explorador de acordes, escalas e intervalos.
- **Progreso**: estadísticas reales, evolución, habilidades, recomendaciones basadas en tus datos y exportación/importación.
- **Configuración**: conexión MIDI, diagnóstico, calibración de latencia, sonido, evaluación, preferencias y simulador.

---

## 1. Requisitos

| | |
|---|---|
| Sistema | Windows 10/11 |
| Navegador | **Google Chrome** o **Microsoft Edge**, versiones actuales (Web MIDI) |
| Node.js | 20 o superior (probado con Node 24) |
| Teclado | Casio CT-S300 + cable **USB-A a Micro-B que transmita datos** |

## 2. Instalación y ejecución (PowerShell)

```powershell
cd "C:\Users\<tu-usuario>\Desktop\CASIOCTS300 0-PRO"
npm install
npm run dev
```

Abre **http://localhost:5180** en Chrome o Edge.

La app funciona entera en el navegador: no hay servidor propio ni claves que configurar.

Otros comandos:

```powershell
npm test                  # pruebas unitarias e integración (incluye validar canciones/*.json)
npm run typecheck         # comprobación de tipos (app + scripts)
npm run build             # compila la app en dist/
npm start                 # sirve la versión compilada en http://localhost:5180
npm run cancion:validar   # valida los archivos de canciones/ (lo usa /cancion)
npm run progreso:resumen -- <exportación.json>   # resumen de progreso (lo usa /coach)
npm run test:e2e          # pruebas de interfaz con Playwright (requiere `npm run dev` en marcha
                          # y una vez: npx playwright install chromium)
```

> El puerto 5180 se eligió porque el 5173 suele estar ocupado por otros proyectos de Vite. Puedes cambiarlo en `vite.config.ts`.

## 3. Conectar el Casio CT-S300

1. Conecta el cable USB al puerto **USB (Micro-B)** del CT-S300 y al ordenador. Muchos cables de carga **no** transmiten datos.
2. Enciende el teclado. Windows instala el controlador automáticamente la primera vez. Según el manual, el dispositivo aparece como **«CASIO USB-MIDI»**.
3. Abre la app y pulsa **«Conectar teclado MIDI»** (arriba a la derecha o en *Configuración → Conexión MIDI*). Acepta el aviso del navegador: desde Chrome 124, cualquier acceso MIDI pide permiso.
4. Ve a **Configuración → Diagnóstico** y toca una tecla. Verás al instante la nota, el número MIDI, la velocidad, el canal y los eventos Note On/Off. Toca un acorde para comprobar la simultaneidad.
5. Ve a **Configuración → Calibración** y haz la prueba de 12 pulsaciones al ritmo de los clics. Pulsa **«Aplicar»**. Esto compensa la latencia de tu equipo en la evaluación rítmica.

### Datos del instrumento usados por la app

Fuente: manual oficial del CT-S300 y su tabla de implementación MIDI.

| Dato | Valor |
|---|---|
| Teclas | 61, de **C2 a C7**. Con Do central = C4 equivale a MIDI 36–96 (rango por defecto de la app) |
| Transmisión de notas | Note On con velocidad 1–127; **Note Off como 8nH con velocidad 64** (no envía velocidad de liberación) |
| Canal por defecto | 1 (ajuste «MIDI Out Channel») |
| También transmite | Pedal de sostenido (CC64), sostenuto (CC66) y suave (CC67) según el ajuste del pedal; pitch bend; cambio de programa |
| Recibe | GM nivel 1, 16 partes multitímbricas, polifonía máxima 48. La app puede tocar notas con los sonidos del Casio |
| Audio por USB | **No**. El USB solo transmite MIDI; el sonido del Casio sale por sus altavoces o por la salida de auriculares |

### Ajustes del teclado que conviene conocer (botón FUNCTION)

- **MIDI Out Octave Shift** (−3 a +3): cambia los números de nota que envía el teclado. Si lo usas, compénsalo en *Preferencias → Desplazamiento de entrada*.
- **Touch Response / MIDI Out Velocity**: si fijas la velocidad, la app no evalúa la dinámica, porque no hay información fiable.
- **Local Control**: no se puede cambiar por MIDI. Si haces que el Casio reproduzca los ejercicios (*Sonido → Destino: Casio*), elige un único destino de audio para evitar eco.
- Según el manual, el teclado no envía ni recibe MIDI mientras reproduce una canción incorporada.

> **Pendiente de confirmar con el hardware real**: que las teclas por defecto envían exactamente MIDI 36–96. El manual lo indica de forma indirecta (C2–C7). La pantalla de Diagnóstico muestra el número MIDI de cada tecla para comprobarlo en un minuto.

## 4. IA con Claude Code (sin clave de API)

La app **no llama a ningún servicio de IA**. Las funciones de IA se usan desde **Claude Code** (esta consola o la extensión de VS Code) abierto en la carpeta del proyecto, con dos comandos preparados en `.claude/skills/`. La puntuación nunca depende de la IA.

### `/cancion` — aprender una canción (o crear un ejercicio a medida)

```
/cancion Quiero aprender Someone Like You de Adele. Soy principiante: empezar con una versión sencilla y después la más completa.
```

Claude Code hace lo siguiente:

1. **Investiga con búsqueda web**, por este orden: (1) partituras o MIDI oficiales y autorizados (solo se citan; no se descargan ni se eluden pagos), (2) dominio público, (3) información musical verificable: tonalidad, tempo, acordes y estructura.
2. **Escribe `canciones/<id>.json`** con el esquema fijo de la app (`canciones/esquema/cancion.schema.json`; referencia en `src/core/songs/songFile.ts`). Las notas de cada sección van en una notación compacta (`E4 F#3:0.5 C3+E3+G3:4 r:1`) que la app analiza **estrictamente**: un token inválido es un error, nunca se interpreta texto libre.
3. **Lo valida** con `npm run cancion:validar`, el mismo validador de la app: esquema, rango C2–C7, duraciones, suma de compases por mano, acordes reconocibles, secciones y que cada mano pueda tocarlo (polifonía y extensión). Corrige hasta que diga «✔ VÁLIDO».
4. Con `npm run dev` en marcha, la canción **aparece sola** en *Canciones → Creadas con Claude Code*. Si un archivo tiene errores, se muestra ahí con sus problemas en vez de romper la app.

Reglas que aplica siempre la app, no solo Claude:

- **Etiquetado honesto.** Un arreglo se marca como «Arreglo generado por IA (no es transcripción oficial)». Solo se acepta «Adaptación didáctica» si cita con URL una fuente musical real (dominio público, oficial o con licencia); si no, se degrada a arreglo de IA. Siempre se muestran las fuentes, qué se tomó de cada una, la confianza y las limitaciones. Sin fuentes con URL, la confianza se limita a 35 %.
- **Derechos.** En obras protegidas no se reproduce la melodía completa nota a nota: se genera el acompañamiento y una guía melódica aproximada, y se recomienda importar un MIDI autorizado para la versión exacta.
- **Niveles.** A partir del arreglo completo, la app genera de forma determinista las versiones **principiante** (solo melodía, ritmo simplificado, 70 % de tempo), **intermedia** (melodía y bajo, 85 %) y **avanzada**. La dificultad inicial combina tu petición y tus resultados.

Los `.json` también se pueden importar desde *Canciones → Importar archivo* (útil con la versión compilada o en otro equipo).

### `/coach` — consejos a partir de tu progreso

1. En *Progreso*, pulsa **Exportar datos** (se descarga `piano-coach-AAAA-MM-DD.json`).
2. En Claude Code: `/coach C:\Users\<tu-usuario>\Downloads\piano-coach-AAAA-MM-DD.json`. Sin ruta, busca la exportación más reciente en Descargas.

Claude calcula el resumen con `npm run progreso:resumen` (el mismo código que la página de Progreso) y da consejos que citan tus cifras, sin inventar estadísticas.

Para dudas de teoría o sobre una lección, pregúntale directamente a Claude Code.

### Entrenador de acordes

- **Grupos**: 18 grupos de 2–4 acordes en tres categorías. *Fundamentales*: C F G, Am Dm Em, D E A, Cm Fm Gm, Bb Eb. *Útiles*: dominantes, maj7, m7, suspendidos y tonalidades con sostenidos o bemoles. *Ocasionales*: disminuidos, aumentados, semidisminuidos, dim7, sextas, add9 y novenas.
- **Mano**: *izquierda* (acorde completo por debajo del Do central, lo típico mientras la derecha toca la melodía), *derecha* (acorde alrededor del Do central) o *ambas* (la izquierda toca solo el bajo que pide la inversión y la derecha el acorde completo, como se acompaña en pop y baladas). La mano cambia la evaluación, la disposición de referencia, la digitación y los consejos.
- **Evaluación**: vale cualquier octava y se pueden duplicar notas, pero el conjunto de notas debe ser exactamente el del acorde y la nota más grave debe ser la de la inversión pedida. Con *ambas*, además, lo que está por encima del bajo debe formar el acorde completo. Si las notas están bien y el bajo no, la app dice qué inversión tocaste. Si el acorde está fuera de la zona habitual de la mano elegida, lo sugiere sin restar puntos. Código: `src/core/chords/trainer.ts`.
- **Tarjetas con repaso espaciado (cajas de Leitner)**: un acierto sin ayuda en menos de 5 s sube la tarjeta una caja; un fallo o mirar la respuesta la devuelve a la 1. Las tarjetas menos dominadas salen más. Hay pistas (nota del bajo), respuesta en el teclado, sonido y consejos por acorde: notas, patrón de blancas y negras, receta en semitonos, cómo reconocer la inversión y digitación.
- **Examen**: preguntas sin ayudas de los grupos elegidos. Correcta = 1 punto, notas bien con otra inversión = 0,5, resto = 0. Se guarda en *Progreso* y permite repasar con tarjetas las que fallaste.
- **Progresiones**: 13 progresiones (pop, baladas, doo-wop, bajo descendente, Canon, flamenco, rock, blues, jazz, neo-soul, gospel) en cualquier tonalidad, con tres repartos de manos: *izquierda bajo + derecha acordes*, *acordes con la izquierda* (derecha libre para la melodía) o *acordes con la derecha*. La mano de los acordes usa la inversión que menos movimiento exige. Se practican con el reproductor (modo guiado o con tempo).

### Práctica de hoy (Inicio → *Práctica de hoy*, ruta `#/hoy`)

Una rutina guiada de unos 15 minutos en 5 pasos, elegidos **solo con tus resultados registrados** (código: `src/core/daily/plan.ts`):

1. **Repaso de acordes**: las tarjetas en cajas bajas del repaso espaciado (si hay pocas, se completan con el grupo recomendado).
2. **Punto débil**: el ejercicio que indican las mismas reglas de las recomendaciones (cambios de acorde si llegas tarde, ritmo si te adelantas o retrasas, modo guiado si fallas notas). Sin datos suficientes, un calentamiento de escalas o arpegios.
3. **Canción**: la sección más floja de tus canciones. Si aún no has practicado ninguna, acompañar una canción tocando solo el bajo.
4. **Oído**: 5 preguntas de tocar de oído, del ejercicio en el que tienes peor precisión reciente.
5. **Algo nuevo**: una progresión que aún no has practicado.

Cada paso explica *por qué* está ahí y se puede saltar. El plan se fija al generarse (se guarda por fecha, así que puedes cerrar la app y retomarlo) y al final muestra un resumen. *Recalcular* lo vuelve a generar con tus datos de ese momento.

### Acompañar con cifrados (Canciones → *Acompañar*)

Solo ves los acordes de la canción (C – G/B – Am – F…), eliges un patrón para la mano izquierda (*solo el bajo*, *bloque*, *pop*, *balada 1-5-8-5*, *arpegio* o *bajo y acorde / vals*) y la app toca la melodía. Funciona con las canciones de la biblioteca, las creadas con `/cancion` y las importadas, siempre que tengan acordes.

- **Evaluación armónica** (`src/core/scoring/comping.ts`): vale **cualquier posición u octava** del acorde. Para cada acorde se mira qué parte de lo que tocas pertenece al acorde (*armonía*) y si la primera nota del acorde nuevo llega dentro de la ventana de tolerancia (*cambios a tiempo*, la del nivel × 1,25 × escala por tempo). Puntuación = 100 × (0,55 × armonía + 0,45 × cambios a tiempo). Que la nota más grave sea la del cifrado (en G/B, Si) se informa pero no resta. Un mismo acorde repetido seguido cuenta como uno solo.
- El patrón es la guía: *Escuchar* lo toca junto a la melodía y, con *Ayudas* y la vista *Notas*, lo ves caer. El retraso medio en los cambios alimenta las recomendaciones.

### Oído (Practicar → *Oído*, ruta `#/practice/oido`)

- **Reconocer** (respondes con botones o con las teclas 1…9): *mayor o menor* (y después disminuido, aumentado y séptimas), *¿qué inversión?* (el bajo siempre suena en la misma zona para que la altura no delate la respuesta) e *intervalos*. Si fallas, puedes escuchar tu respuesta y la correcta una detrás de otra.
- **Tocar de oído** (respondes en el teclado, evaluado con MIDI): *toca el acorde que oyes* (cualquier octava; la nota grave debe coincidir) y *repite la melodía*: frases de 3 a 6 notas; te damos la primera y sacas el resto. Solo avanza con la nota correcta y vale en otra octava.
- Niveles por ejercicio; con 8 de las últimas 10 bien, la app propone subir. Las respuestas tocadas con eventos simulados no se guardan. Código: `src/core/ear/ear.ts`.

## 5. Evaluación (scoring)

Todo el cálculo es determinista. Está en `src/core/scoring/evaluate.ts` y cubierto por pruebas.

1. **Ventana por nota** = tolerancia del nivel × escala por tempo (0,75–1,5, referencia 120 BPM). Nunca supera **la mitad del intervalo con la nota vecina de la misma altura**, así que las notas repetidas no comparten ventana.
2. **Emparejamiento óptimo por altura** con programación dinámica (alineamiento monótono). Maximiza los aciertos y minimiza el error temporal. Una nota tocada nunca cuenta dos veces y las repeticiones no se cruzan.
3. Las sobrantes que coinciden en el tiempo se emparejan como **incorrecta** o **octava equivocada**. El resto se clasifica como **omitida** o **adicional**.
4. **Acordes**: completos, incompletos, con notas extra y simultaneidad (dispersión entre la primera y la última nota).
5. **Puntuación**:

   ```
   N     = aciertos / (esperadas + λ × adicionales)
   Total = 100 × N × (w_n + w_r·R + w_d·D + w_v·V) / (suma de pesos activos)
   ```

   R, D y V son las medias de precisión rítmica, de duración y de dinámica de las notas acertadas. R vale 100 % dentro de la ventana «perfecta» y baja hasta 25 % en el borde. **Las dimensiones que un ejercicio no evalúa (duración, dinámica) se excluyen de la fórmula.**
6. Niveles **Principiante / Intermedio / Avanzado / Personalizado**, ajustables en *Configuración → Evaluación* (ventanas, simultaneidad, duración, velocidad, pesos y λ).
7. **Modo guiado (espera)**: la música se detiene hasta que tocas las notas correctas, así que solo cuentan las pulsaciones erróneas, no el ritmo. **Improvisación**: porcentaje de notas dentro de la escala × actividad. **Acompañar con cifrados**: evaluación armónica, independiente de la posición del acorde (ver arriba).

La compensación de latencia (calibración) se resta a la marca de tiempo de cada evento MIDI (`MIDIMessageEvent.timeStamp`). Ese reloj es el mismo `performance.now()` que se usa para programar el audio (convertido al reloj del `AudioContext`) y para dibujar las notas.

## 6. Arquitectura y decisiones

```
src/
  core/                    lógica sin interfaz (probada)
    music/                 notas MIDI ↔ nombres (convención de octava configurable), acordes, escalas, detección
    midi/                  parser MIDI, bus de entrada, servicio Web MIDI (conexión, reconexión, salida)
    audio/                 motor de audio (Tone.js + muestras), metrónomo, destino app/Casio
    scoring/               evaluación determinista, tolerancias
    songs/                 esquema (Zod), validación, adaptación (rango y niveles), importación MIDI, archivo de canción, biblioteca
    practice/              sesión de práctica (reloj, cuenta previa, espera, acompañamiento), generadores de ejercicios
    curriculum/            programa didáctico de 5 niveles
    storage/               IndexedDB (intentos, lecciones, canciones, ajustes) + exportar/importar
    progress/              estadísticas, racha, habilidades, recomendaciones
    chords/                entrenador de acordes y progresiones con inversiones
    ear/                   entrenamiento auditivo (preguntas, evaluación, niveles)
    daily/                 plan de «Práctica de hoy»
  state/                   estado global (Zustand): ajustes, biblioteca, progreso
  ui/                      componentes (teclado, notas descendentes, piano roll, acordes, resultados) y páginas
canciones/                 canciones creadas con /cancion (+ esquema JSON)
scripts/                   validador de canciones y resumen de progreso (consola)
.claude/skills/            comandos /cancion y /coach para Claude Code
e2e/                       pruebas de interfaz (Playwright)
public/samples/salamander  muestras de piano (CC-BY 3.0)
```

| Decisión | Por qué | Alternativa descartada |
|---|---|---|
| **React + TypeScript + Vite** | App muy interactiva y solo de cliente; tipos claros para notas, eventos y arreglos | Next.js: el renderizado en servidor no aporta nada aquí |
| **Web MIDI API** directa | Nativa en Chrome/Edge, con marcas de tiempo precisas; sin capas extra | WebMidi.js: añade una dependencia para algo que son ~200 líneas |
| **Tone.js** (Sampler + síntesis) | Carga y afinación de muestras multinota, sintetizadores y contexto de audio robusto | Web Audio a mano: mucho código para lo mismo |
| **Programador propio** (lookahead sobre `performance.now`) | Necesita pausar, saltar, esperar en modo guiado y compartir reloj con MIDI de entrada y salida | `Tone.Transport`: difícil de sincronizar con las marcas de tiempo MIDI y con el modo espera |
| **Salamander Grand Piano** (local) | Piano muestreado real con licencia CC-BY; funciona sin conexión | SoundFonts GM: más pesados y de calidad irregular; ondas sinusoidales: descartadas |
| **@tonejs/midi** | Parser MIT de MIDI estándar; el formato SMF es estable desde hace décadas | `midi-file`: más bajo nivel; sin ventajas |
| **Zod** | Valida los archivos de canción y lo que se importa; del mismo esquema sale el JSON Schema del formato | Validación manual: más propensa a errores |
| **IndexedDB (idb)** | Persistencia local robusta; exportable | localStorage: límites de tamaño y sin consultas |
| **Zustand** | Estado global mínimo | Redux: sobredimensionado |
| **Tailwind CSS v4** + componentes propios | Sistema visual consistente con tokens de tema (oscuro y claro) | shadcn/ui: añade Radix y más dependencias sin necesidad real aquí |
| **Canvas** para notas descendentes y piano roll | 60 fps con cientos de notas | DOM o SVG: demasiados nodos animados |
| **Enrutador por hash propio** | 7 secciones; sin dependencia y funciona desde `dist/` | react-router |
| **IA vía Claude Code + archivos** | Sin clave de API ni backend: Claude investiga y escribe un archivo con esquema fijo que la app valida y carga | Servidor con el SDK de Anthropic: exige una clave de API y un backend |

## 7. Pruebas

- **Unitarias e integración (Vitest)**: conversión de notas y convenciones de octava, Note On/Off (incluido 8nH con velocidad 64 y Note On con velocidad 0), bus de entrada, detección de acordes, emparejamiento con notas repetidas y acordes, ventanas, ritmo, duración, fórmula, modo espera, sesión con reloj simulado (latencia, tempo, retroceso, eventos simulados), validación de arreglos, adaptación de rango y niveles, **validación de los 47 ejercicios y las canciones incluidas**, conversión y validación de archivos de canción (tipo de arreglo, confianza, rango, notación), validación de todos los `canciones/*.json` del proyecto, IndexedDB y exportación, estadísticas y recomendaciones, entrenador de acordes, evaluación de acompañamiento (posiciones, cambios tarde, notas fuera del acorde, acordes repetidos), patrones de mano izquierda, preguntas de oído y plan diario.
- **Interfaz (Playwright, `e2e/`)**: recorre todas las secciones sin errores de consola, detecta un acorde tocado, ejecuta el simulador, completa una lección guiada con el ratón y una escala con tempo con el teclado del ordenador (con una nota tarde y otra omitida a propósito), comprueba que el historial se guarda y que una canción de `canciones/` aparece y se abre. En el entrenador de acordes responde tarjetas y un examen con el teclado del ordenador, con una inversión equivocada a propósito (se espera 90/100), y comprueba que el examen queda en Progreso. En oído responde una pregunta y repite una melodía; acompaña Estrellita con un acorde mal y otro omitido a propósito (se espera 71/100); completa el paso de tarjetas de *Práctica de hoy*, salta el resto y comprueba el resumen y que el plan se conserva al recargar.
- **Simulador** (*Configuración → Simulador*): genera eventos y perfiles de error para verificar el motor sin el teclado. **Todo lo simulado se marca como SIMULADO y nunca se guarda en el progreso.**

## 8. Estado de validación y limitaciones

- ⚠️ **La integración con el CT-S300 físico no se ha probado en este entorno.** El código usa la API Web MIDI real (no hay simulación de la conexión), pero solo se validó con eventos simulados, ratón y teclado del ordenador. Primera prueba recomendada: *Diagnóstico* (notas, velocidad, Note Off, acordes, pedal) y después *Calibración*.
- El comando `/cancion` depende de la investigación que haga Claude en cada caso; la calidad del arreglo varía según las fuentes disponibles. El validador garantiza que el archivo se puede tocar y evaluar, no que sea fiel a la grabación.
- Las canciones incluidas son de dominio público. Su mano izquierda es un arreglo didáctico de la app y así se indica.
- Importación MIDI: si el archivo cambia de tempo, se usa un tempo constante (se avisa en las limitaciones). Con una sola pista, las manos se separan en Do central.
- La dinámica solo se evalúa en ejercicios que la incluyen y si el teclado envía velocidad variable.
- El modo guiado no evalúa el ritmo (por diseño).
- Los datos viven en el navegador (IndexedDB): exporta copias desde *Progreso*.

## 9. Despliegue

Web MIDI exige un **contexto seguro**: `http://localhost` en local o **HTTPS** en un servidor. Para desplegar: `npm run build` y sirve la carpeta `dist/` (es estática) detrás de HTTPS (Caddy, nginx, IIS…). Las canciones de `canciones/` se incluyen en la compilación.

## 10. Créditos y licencias

- Muestras de piano: **Salamander Grand Piano**, Alexander Holm, **CC-BY 3.0**. Copia tomada de `github.com/Tonejs/audio`; ver `public/samples/salamander/LICENSE.txt`.
- Dependencias: React, Vite, Tone.js, @tonejs/midi, Zod, Zustand, idb, lucide-react y Tailwind CSS (MIT/ISC).
- Melodías incluidas: obras de dominio público (Beethoven, canciones tradicionales).
