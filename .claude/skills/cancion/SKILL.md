---
name: cancion
description: Crea una canción (o un ejercicio a medida) para Piano Coach a partir de una petición en lenguaje natural. Investiga fuentes, escribe canciones/<id>.json con el esquema de la app y lo valida. Úsalo cuando el usuario pida aprender una canción o quiera un ejercicio personalizado.
argument-hint: "<canción, artista, nivel y lo que quieres> (p. ej. Someone Like You de Adele, soy principiante)"
---

# /cancion — crear una canción para Piano Coach

Petición del usuario: **$ARGUMENTS**

Tu trabajo: convertir esa petición en un archivo `canciones/<id>.json` válido que la app carga sola (en `npm run dev` la página se recarga al guardarlo). El teclado es un **Casio CT-S300**: 61 teclas, **C2–C7** (MIDI 36–96), Do central = **C4**.

Si la petición está vacía o no identifica la obra, pregunta qué canción y qué nivel quiere antes de seguir.

## 1. Investigar (en este orden, sin saltarte pasos)

Usa WebSearch / WebFetch.

1. **Fuentes oficiales o autorizadas**: partitura o arreglo oficial del artista o la editorial, MIDI autorizado, distribuidores con licencia (Musicnotes, Hal Leonard, Sheet Music Direct…). Solo para **citarlas**: no descargues material de pago ni eludas restricciones. Si existe, dile al usuario que puede comprarla e importar el MIDI en la app para tener la versión exacta.
2. **Dominio público**: si la obra lo es (compositor fallecido hace más de 70 años o melodía tradicional), cita una fuente (IMSLP, Mutopia, Wikipedia…). En ese caso puedes escribir la melodía.
3. **Información musical verificable**: tonalidad, tempo (BPM), compás, progresión de acordes por sección, estructura y rasgos melódicos. Anota la fuente de cada dato. Si las fuentes discrepan, dilo.

No inventes datos. Lo que salga de tu conocimiento y no esté en una fuente va con `kind: "model-knowledge"` y baja la confianza.

## 2. Decidir el tipo de arreglo y los derechos

- `arrangementType: "didactic-adaptation"` **solo** si el arreglo se basa en una fuente musical real citada con URL (dominio público, oficial o con licencia). En cualquier otro caso: `"ai-generated"`. El validador degrada automáticamente una "adaptación" sin fuente.
- **Obra protegida por derechos de autor**: NO reproduzcas la melodía completa nota por nota. Escribe el acompañamiento a partir de la progresión de acordes y, en la mano derecha, una guía melódica breve, simplificada y aproximada (o patrones de acordes). Marca `melodyIncluded: false` y añade en `limitations` que, para la versión exacta, puede importar un MIDI comprado o autorizado.
- Nunca afirmes que es una transcripción oficial.
- Confianza (0–1): `confidenceHarmony` según lo respaldados que estén la tonalidad y los acordes. `confidenceMelody` es 0 si no incluyes la melodía. Sin fuentes con URL, la app limita la confianza a 0,35.

## 3. Escribir el archivo

Ruta: `canciones/<id>.json`, donde `id` usa minúsculas, números y guiones (p. ej. `someone-like-you-adele`) y es igual al nombre del archivo. Esquema completo: `canciones/esquema/cancion.schema.json` (la referencia es `src/core/songs/songFile.ts`).

### Notación de cada mano (por sección)

- Tokens separados por espacios: `Nota[alteración]Octava[:duración en negras]`. Ejemplos: `E4`, `F#3:0.5`, `Bb4:1.5`. Sin duración = 1 negra.
- Silencio: `r:2`. Notas simultáneas en una mano: `C3+E3+G3:4`. Las barras `|` son opcionales y no cuentan.
- Cada mano **y** la cadena de acordes deben sumar exactamente `bars × numerador × 4/denominador` negras (4/4 → 4 por compás; 3/4 → 3; 6/8 → 3).
- Acordes: `"C:4 G:2 Am:2"`, con cifrado americano (C, Cm, C7, Cmaj7, Cm7, Cdim, Caug, Csus4, Cadd9, C/E…).

### Reglas musicales y de tocabilidad

- Todas las notas entre C2 y C7. Mano derecha normalmente C4–C6; izquierda C2–C4.
- Como máximo 5 notas simultáneas por mano, con una extensión máxima de una octava por mano.
- Escribe la versión **completa (avanzada)**. La app genera sola las versiones principiante e intermedia: melodía simplificada, una mano y tempo reducido.
- `recommendedStartLevel`: el nivel que pidió el usuario o el que mejor le encaje.
- Máximo ~32 compases en total; repite secciones solo si aporta. Usa secciones con nombres claros (Intro, Estrofa, Estribillo…) para poder practicarlas por separado.
- `adaptations`: explica transposiciones o simplificaciones (p. ej. "Transportado una octava abajo para caber en 61 teclas").
- `teachingNotes`: 2–4 consejos concretos para aprender la pieza (digitación, patrón de mano izquierda, dónde suele fallarse).

### Plantilla

```json
{
  "$schema": "./esquema/cancion.schema.json",
  "format": "piano-coach-song/1",
  "id": "ejemplo-cancion",
  "title": "Título",
  "artist": "Artista",
  "request": "petición original del usuario",
  "createdAt": "2026-01-01",
  "key": "C major",
  "bpm": 80,
  "timeSignature": [4, 4],
  "arrangementType": "ai-generated",
  "isPublicDomain": false,
  "melodyIncluded": false,
  "confidenceHarmony": 0.7,
  "confidenceMelody": 0,
  "sources": [
    { "title": "Página consultada", "url": "https://…", "kind": "reference-info", "usedFor": "Tonalidad y acordes" },
    { "title": "Conocimiento del modelo", "url": "", "kind": "model-knowledge", "usedFor": "Patrón de acompañamiento" }
  ],
  "limitations": ["…"],
  "adaptations": ["…"],
  "recommendedStartLevel": "beginner",
  "teachingNotes": "…",
  "sections": [
    { "name": "Estrofa", "bars": 2, "chords": "C:4 G:4", "rightHand": "E4 D4 C4:2 | D4:4", "leftHand": "C3+E3+G3:4 | B2+D3+G3:4" }
  ]
}
```

Valores de `kind` en las fuentes: `official`, `licensed`, `public-domain`, `reference-info`, `model-knowledge`.

## 4. Validar y corregir (obligatorio)

```
npm run cancion:validar -- canciones/<id>.json
```

Corrige todas las líneas marcadas con ✖ (errores y duraciones que no cuadran) y vuelve a validar hasta que diga **✔ VÁLIDO**. Revisa también los avisos ⚠. No des la tarea por terminada sin un "✔ VÁLIDO".

## 5. Informar al usuario (breve, en español)

- Que la canción ya está en la app: sección **Canciones → Creadas con Claude Code**, o el enlace que imprime el validador (`http://localhost:5180/#/songs/cancion-<id>`).
- Tipo de arreglo, confianza y si incluye o no la melodía original.
- Fuentes usadas (con URL) y qué se tomó de cada una.
- Limitaciones, y la fuente oficial donde conseguir la versión exacta si existe.
- Cómo empezar: el nivel recomendado y la sección con la que conviene empezar.

## Ejercicios a medida

Si el usuario pide un ejercicio (p. ej. "cambios C–Am–F–G en negras a 70 BPM con la izquierda"), usa el mismo formato con `id` del tipo `ejercicio-…`, `artist: "Ejercicio"`, `arrangementType: "ai-generated"`, una fuente `model-knowledge` y `confidenceHarmony: 1`. La confianza queda limitada a 0,35 por no tener fuente externa; está bien. Una sección por variante del ejercicio.
