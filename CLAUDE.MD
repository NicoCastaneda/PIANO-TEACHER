# PROYECTO: PERSONAL PIANO COACH — ENTORNO INTELIGENTE DE APRENDIZAJE MUSICAL

Actúa como un equipo especializado compuesto por un ingeniero de software senior, un diseñador UX/UI, un desarrollador de aplicaciones musicales y un profesor de piano con experiencia en pedagogía musical.

Tu objetivo es investigar, diseñar y desarrollar una aplicación web personalizada de aprendizaje de piano y teclado. La aplicación estará conectada a un teclado físico **Casio CT-S300 mediante USB-MIDI** y deberá convertirse en un entorno integral de aprendizaje, práctica, evaluación y exploración musical.

No quiero un simple piano virtual ni una página con lecciones estáticas. Quiero una herramienta interactiva que me permita comenzar desde cero, desarrollar habilidades progresivamente hasta un nivel avanzado, practicar ejercicios, aprender acordes y patrones, interpretar canciones que yo elija y recibir retroalimentación objetiva sobre lo que realmente estoy tocando en mi teclado.

La prioridad es crear una experiencia visual, intuitiva, atractiva y funcional.

---

# 1. CONTEXTO Y OBJETIVO DEL PROYECTO

## Hardware disponible

Mi instrumento es un **Casio CT-S300**:

- 61 teclas.
- Conexión USB mediante puerto Micro-B.
- Capacidad de comunicación MIDI con el computador.
- Respuesta táctil.
- Sonidos internos y funciones propias del teclado.

El entorno principal será un computador Windows con un navegador moderno, preferiblemente Google Chrome o Microsoft Edge.

La conexión prevista es:

Casio CT-S300 → Cable USB-A a Micro-B con transferencia de datos → Computador → Aplicación web.

Antes de desarrollar el sistema de conexión, investiga la documentación oficial del fabricante y verifica las características reales del instrumento.

Fuentes prioritarias:
- Página oficial del Casio CT-S300.
- Manual oficial del usuario.
- Documento oficial MIDI Implementation.
- Documentación actual de Web MIDI API.
- Documentación de las librerías que finalmente se utilicen.

No inventes capacidades del teclado.

## Qué información debe recibir la aplicación

A través de MIDI, la aplicación debe poder identificar:

- Qué nota presioné.
- En qué momento la presioné.
- En qué momento la solté.
- La velocidad o intensidad MIDI recibida, cuando esté disponible.
- Las notas simultáneas cuando toque acordes.
- Eventos adicionales de control que sean compatibles y relevantes.

El sistema debe evaluar mi interpretación utilizando los eventos MIDI reales del teclado.

**No quiero que el sistema dependa de reconocimiento de audio mediante micrófono para identificar las notas.** MIDI debe ser el mecanismo principal de evaluación porque proporciona información estructurada y precisa.

Diferencia claramente entre:
- MIDI de entrada: información de lo que estoy tocando.
- MIDI de salida: notas que la aplicación puede enviar al Casio para que las reproduzca con sus sonidos.
- Audio generado por la aplicación: sonido producido mediante un motor de audio propio.

No confundas la transmisión de MIDI con la transmisión del audio físico del teclado.

---

# 2. METODOLOGÍA DE INVESTIGACIÓN Y TOMA DE DECISIONES

Antes de implementar, investiga las opciones tecnológicas y define la arquitectura.

No quiero decisiones arbitrarias ni tecnologías elegidas únicamente por popularidad.

Evalúa brevemente las alternativas y justifica la elección de cada tecnología según las necesidades reales del proyecto.

Considera especialmente:

- Aplicaciones musicales interactivas en navegador.
- Procesamiento de eventos MIDI en tiempo real.
- Sincronización precisa entre notas esperadas y notas interpretadas.
- Síntesis y reproducción de sonidos.
- Representación visual de teclados y secuencias musicales.
- Almacenamiento de progreso.
- Integración de inteligencia artificial.
- Rendimiento y mantenibilidad.

Para cada decisión importante, explica brevemente:
1. Qué tecnología o solución elegiste.
2. Por qué es adecuada para este proyecto.
3. Qué alternativa consideraste y por qué no la elegiste.

No desarrolles documentos excesivamente extensos de arquitectura ni investigues alternativas sin un beneficio concreto. Quiero decisiones técnicamente sólidas y justificadas, pero sin sobreingeniería ni consumo innecesario de tokens.

No expongas razonamientos internos extensos: presenta conclusiones técnicas y justificaciones breves y verificables.

## Stack tecnológico

Evalúa como punto de partida:

- React + TypeScript + Vite para la aplicación.
- Tailwind CSS para estilos.
- shadcn/ui para componentes de interfaz cuando aporte valor.
- Web MIDI API para comunicación MIDI.
- Tone.js para programación, sincronización y reproducción de audio.
- Un motor de sonidos basado en muestras o SoundFont con licencia apropiada para conseguir sonidos musicales convincentes.
- Una librería mantenida y compatible para importar y procesar archivos MIDI.
- IndexedDB para persistencia local de información y progreso.

No utilices tecnologías adicionales por el simple hecho de utilizarlas.

La aplicación es fundamentalmente interactiva y cliente-side, por lo que no necesitas implementar renderizado del servidor si no aporta una ventaja real.

Para las funciones de inteligencia artificial e investigación de canciones, utiliza una capa de servicios independiente. Si necesitas un backend, implementa una solución ligera y justifica su necesidad.

Nunca expongas claves API privadas en el frontend.

Verifica que las dependencias estén mantenidas, sean compatibles y tengan licencias adecuadas antes de incorporarlas.

---

# 3. DISEÑO Y EXPERIENCIA DE USUARIO

Esta es una de las prioridades del proyecto.

Quiero una aplicación visualmente excelente, moderna y profesional, con una interfaz que invite a aprender y practicar.

No debe parecer una página educativa genérica ni un dashboard administrativo.

## Dirección visual

- Diseño moderno y cuidado.
- Preferiblemente tema oscuro, con opción de cambiar a claro.
- Paleta de colores agradable y con buen contraste.
- Tipografía legible.
- Animaciones fluidas y útiles.
- Transiciones naturales.
- Componentes visuales consistentes.
- Jerarquía visual clara.
- Diseño responsive, priorizando computador de escritorio.
- Sin elementos decorativos que dificulten la concentración.

La experiencia debe recordar a una combinación entre una aplicación moderna de aprendizaje musical, un instrumento digital interactivo y un entorno de práctica gamificado.

## Estructura general de navegación

Propón una estructura organizada con las siguientes secciones:

1. **Inicio:** resumen de progreso, actividades recientes y acceso rápido a practicar.
2. **Aprender:** ruta de aprendizaje estructurada desde cero hasta avanzado.
3. **Practicar:** ejercicios de técnica, ritmo, notas, acordes y patrones.
4. **Canciones:** búsqueda, creación de lecciones y biblioteca personal.
5. **Teclado:** instrumento virtual interactivo y exploración musical.
6. **Progreso:** estadísticas, historial, habilidades desarrolladas y resultados.
7. **Configuración:** conexión MIDI, sonido, calibración y preferencias.

La navegación debe ser sencilla. Evita sobrecargar la pantalla principal.

---

# 4. TECLADO VIRTUAL Y VISUALIZACIÓN MUSICAL

El teclado virtual será uno de los componentes centrales de toda la aplicación.

## Requisitos

Construye un teclado virtual de 61 teclas, correspondiente al Casio CT-S300.

Debe mostrar:

- Teclas blancas y negras.
- Nombre de cada nota.
- Octava correspondiente.
- Identificación visual de C, D, E, F, G, A, B.
- Notas activadas físicamente desde el Casio.
- Notas que debería tocar durante un ejercicio.
- Notas incorrectas.
- Notas correctas.
- Acordes completos.
- Posición de ambas manos, cuando corresponda.

El teclado virtual debe responder inmediatamente a los eventos MIDI reales.

También debe poder tocarse con el mouse para explorar y escuchar las notas, incluso cuando el Casio no esté conectado.

Implementa un sistema robusto de correspondencia entre números de nota MIDI y nombres de notas. Ten en cuenta las diferencias de nomenclatura de octavas utilizadas por distintos programas.

La aplicación no debe asumir una numeración de octavas universal sin permitir su configuración.

## Piano roll y notas descendentes

Quiero una visualización musical inspirada en los sistemas de aprendizaje de piano mediante notas descendentes.

La pantalla de práctica debe poder mostrar:

- Las notas que se aproximan.
- Su posición en el teclado.
- Su duración.
- El momento exacto en que deben tocarse.
- La simultaneidad de las notas de un acorde.
- Las notas correspondientes a la mano izquierda y derecha.

Utiliza colores consistentes para distinguir manos, acordes, notas esperadas y errores.

Cuando una nota se aproxime al momento de ejecución, debe ser visualmente evidente qué tecla tengo que presionar.

Permite alternar entre:
- Vista de notas descendentes.
- Vista de piano roll horizontal.
- Vista de teclado con notas resaltadas.
- Vista de acordes y progresiones.

Estas representaciones deben estar sincronizadas entre sí.

No conviertas las partituras tradicionales en la interfaz principal. No quiero depender de pentagramas, claves, lectura musical convencional ni notación demasiado técnica para aprender.

Utiliza nombres de notas, posiciones en el teclado, patrones visuales, intervalos y símbolos de acordes fáciles de comprender.

---

# 5. SISTEMA DE CONEXIÓN MIDI

Desarrolla un sistema real de comunicación entre el Casio CT-S300 y la aplicación.

No simules la conexión.

## Detección del dispositivo

La aplicación deberá:

- Solicitar permisos MIDI de forma adecuada.
- Detectar dispositivos MIDI disponibles.
- Identificar el Casio cuando esté conectado.
- Permitir seleccionar el dispositivo de entrada.
- Detectar desconexiones.
- Recuperar la conexión cuando sea posible.
- Mostrar el estado de conexión.
- Proporcionar instrucciones cuando no encuentre el teclado.

Si el navegador no soporta Web MIDI, mostrar un mensaje comprensible y explicar cómo utilizar un navegador compatible.

Evalúa la compatibilidad actual de Chrome y Edge en Windows.

Ten en cuenta que Web MIDI puede requerir permisos explícitos y un contexto seguro. La versión local de desarrollo debe funcionar desde localhost y la versión desplegada utilizar HTTPS.

## Prueba de conexión

Crea una pantalla de diagnóstico MIDI.

Debe permitir:

1. Conectar el Casio.
2. Mostrar el dispositivo detectado.
3. Presionar cualquier tecla física.
4. Identificar instantáneamente la nota recibida.
5. Mostrar su número MIDI.
6. Mostrar el evento de inicio y finalización.
7. Mostrar la velocidad recibida.
8. Comprobar la recepción de acordes.

Debe incluir un indicador visual que se active cada vez que presione una tecla.

## Calibración

Implementa un procedimiento para medir y ajustar la latencia del sistema.

El usuario debe poder realizar una prueba sencilla de sincronización y ajustar la compensación temporal si fuera necesario.

No utilices una tolerancia arbitraria e invariable para todas las canciones y ejercicios.

La calibración y las tolerancias deben permitir que el scoring sea justo, incluso cuando el computador, navegador o dispositivo presenten distintas latencias.

---

# 6. SISTEMA DE EVALUACIÓN Y SCORING

Esta funcionalidad es crítica y debe ser una implementación real.

La aplicación debe comparar lo que debería tocarse contra los eventos MIDI recibidos desde el teclado físico.

No basta con comprobar si presioné una tecla correcta: también debe evaluar cuándo la presioné y cuánto tiempo la mantuve.

## Dimensiones de evaluación

### A. Precisión de notas

Detectar:

- Notas correctas.
- Notas incorrectas.
- Notas omitidas.
- Notas adicionales.
- Notas en la octava equivocada.
- Acordes incompletos.
- Acordes con notas adicionales.

### B. Precisión rítmica

Evaluar:

- Anticipación de notas.
- Retraso.
- Precisión del inicio.
- Consistencia del ritmo.
- Simultaneidad de acordes.
- Cumplimiento de los tiempos previstos.

### C. Duración

Cuando los eventos MIDI permitan determinarlo, evaluar:

- Tiempo que se mantuvo presionada una tecla.
- Liberación anticipada.
- Liberación tardía.
- Duración relativa de las notas.

### D. Dinámica

Cuando sea posible obtener información útil de velocidad MIDI, permitir ejercicios de control de intensidad.

No penalices diferencias de velocidad que no puedan medirse de forma fiable con el hardware.

## Resultado final

Al terminar un ejercicio, muestra:

- Puntuación total sobre 100.
- Porcentaje de notas correctas.
- Precisión rítmica.
- Precisión de duración, cuando aplique.
- Cantidad de errores.
- Notas omitidas.
- Notas adicionales.
- Acordes correctos.
- Mejor racha de aciertos.
- Comparación entre ejecución esperada y ejecución real.

El resultado debe permitir identificar visualmente dónde se cometieron los errores.

Por ejemplo, mostrar una secuencia en la que las notas correctas aparecen en verde, las incorrectas en rojo y las notas omitidas en otro color claramente distinguible.

No quiero una puntuación arbitraria. Define una fórmula transparente y configurable que diferencie los distintos aspectos de la ejecución.

Los ejercicios sencillos no deben penalizar errores de duración o dinámica cuando esas variables no formen parte del objetivo.

## Sistema adaptable de dificultad

Permite configurar la tolerancia de evaluación:

- Principiante: tolerancia amplia.
- Intermedio: tolerancia moderada.
- Avanzado: mayor precisión.
- Personalizado: tolerancias configurables.

La evaluación debe utilizar información temporal real de los eventos MIDI y sincronizarse con el reloj de reproducción de audio.

Implementa una lógica de emparejamiento robusta para evitar que una misma nota interpretada se contabilice varias veces o que notas repetidas se confundan entre sí.

Considera especialmente la evaluación de acordes, notas simultáneas y secuencias con notas repetidas.

---

# 7. PROGRAMA DE APRENDIZAJE: DESDE CERO HASTA AVANZADO

La aplicación debe disponer de una ruta de aprendizaje estructurada y progresiva.

No quiero un simple catálogo de conceptos. Quiero un verdadero programa didáctico en el que cada aprendizaje tenga una explicación visual, una demostración sonora y ejercicios prácticos.

## Filosofía pedagógica

Enseñar principalmente mediante:

1. Ver.
2. Escuchar.
3. Comprender intuitivamente.
4. Practicar.
5. Recibir retroalimentación.
6. Repetir y avanzar.

La teoría musical debe estar presente, pero siempre al servicio de tocar mejor.

Evita explicaciones académicas excesivas, terminología innecesariamente técnica y ejercicios basados en memorizar definiciones.

## Nivel 1: Fundamentos

Debe incluir:

- Conocer el teclado.
- Identificar las notas.
- Diferenciar teclas blancas y negras.
- Reconocer octavas.
- Identificar patrones de notas.
- Coordinación inicial.
- Postura y digitación básica.
- Ritmo y pulso.
- Melodías muy sencillas.
- Primeros ejercicios con ambas manos.

## Nivel 2: Primeras herramientas musicales

- Escalas mayores.
- Escalas menores.
- Tonos y semitonos.
- Intervalos.
- Construcción de acordes.
- Acordes mayores y menores.
- Progresiones sencillas.
- Arpegios.
- Patrones de acompañamiento.
- Coordinación de manos.

## Nivel 3: Desarrollo musical

- Inversiones de acordes.
- Acordes de séptima.
- Progresiones armónicas habituales.
- Ritmos y subdivisiones.
- Síncopas.
- Patrones de mano izquierda.
- Melodías más elaboradas.
- Uso de ambas manos.
- Cambios de acordes fluidos.
- Control de tempo.

## Nivel 4: Intermedio-avanzado

- Armonía funcional.
- Relación entre tonalidades.
- Progresiones más complejas.
- Escalas menores y modos relevantes.
- Acordes extendidos.
- Variaciones rítmicas.
- Independencia de manos.
- Arpegios complejos.
- Acompañamientos musicales.
- Interpretación de canciones de dificultad media.

## Nivel 5: Avanzado

- Armonización.
- Rearmonización básica.
- Improvisación.
- Variaciones melódicas.
- Inversiones y conducción de voces.
- Ritmos complejos.
- Independencia avanzada de manos.
- Acompañamientos elaborados.
- Interpretación de canciones complejas.
- Exploración de diferentes estilos musicales.

Adapta el contenido a una progresión pedagógica coherente. No es necesario que el usuario complete absolutamente todos los ejercicios en orden si demuestra dominar una habilidad.

## Estructura de las lecciones

Cada lección debe contener:

- Objetivo.
- Explicación sencilla.
- Demostración visual en el teclado.
- Demostración sonora.
- Ejercicio interactivo.
- Evaluación mediante MIDI.
- Retroalimentación.
- Criterios para desbloquear o recomendar el siguiente contenido.

La aplicación debe poder identificar las áreas en las que el usuario tiene dificultades y recomendar ejercicios adecuados.

---

# 8. ACORDES, ESCALAS, PATRONES Y EXPLORACIÓN

Incluye un módulo independiente para explorar música y entender cómo funciona el teclado.

Debe ser altamente visual e interactivo.

## Acordes

Permitir explorar:

- Mayores.
- Menores.
- Disminuidos.
- Aumentados.
- Séptimas.
- Inversiones.
- Acordes extendidos.
- Posiciones posibles en el teclado.

Al seleccionar un acorde, mostrar sus notas resaltadas en el teclado virtual y reproducirlo.

También debe permitir tocarlo en el Casio y comprobar si fue ejecutado correctamente.

## Escalas

Permitir seleccionar tonalidades y visualizar:

- Escalas mayores.
- Escalas menores naturales.
- Escalas menores armónicas y melódicas.
- Otras escalas relevantes para niveles avanzados.

Mostrar sus notas en el teclado, reproducirlas y ofrecer ejercicios para aprenderlas.

## Patrones y acompañamientos

Incluye ejercicios prácticos de:

- Acordes bloqueados.
- Arpegios.
- Bajo y acorde.
- Patrones de mano izquierda.
- Acompañamientos rítmicos.
- Progresiones.
- Coordinación entre melodía y acompañamiento.

Permite ajustar el tempo y practicar progresivamente.

## Exploración interactiva

Quiero poder seleccionar una nota, acorde, intervalo o escala y escuchar cómo suena.

Debe existir una forma sencilla de experimentar sin necesidad de entrar siempre en una lección.

---

# 9. APRENDIZAJE DE CANCIONES MEDIANTE PROMPTS

Esta es una de las funciones más importantes.

Quiero poder escribir solicitudes en lenguaje natural para aprender canciones específicas.

Ejemplo:

"Quiero aprender Someone Like You de Adele. Soy principiante. Quiero comenzar con una versión sencilla y después aprender la interpretación más completa."

La aplicación debe interpretar la solicitud, investigar la canción y crear una experiencia de aprendizaje.

## Flujo de investigación de canciones

Utiliza el siguiente orden:

### Primera prioridad: fuentes oficiales y autorizadas

Busca primero una fuente musical fiable, priorizando:

1. Partituras o arreglos oficiales publicados por el artista o editorial.
2. Archivos MIDI autorizados.
3. Recursos de editoriales musicales o distribuidores con licencia.
4. Archivos de dominio público o con licencias abiertas apropiadas.

No debes asumir que un recurso encontrado en Internet está autorizado para descargarse o utilizarse.

No eludas sistemas de pago, no descargues material protegido sin autorización y respeta las condiciones de uso de las fuentes.

Aunque encuentres una partitura, la interfaz de aprendizaje no debe depender de que el usuario sepa leerla.

Cuando exista un archivo MIDI fiable y se pueda utilizar legalmente, úsalo como base de la canción.

### Segunda prioridad: información musical verificable

Si no encuentras una fuente musical oficial o autorizada utilizable, busca información fiable sobre:

- Tonalidad.
- Acordes.
- Progresión armónica.
- Escala.
- Tempo.
- Estructura.
- Secciones.
- Características melódicas disponibles.

Utiliza esta información como referencia para crear un arreglo didáctico.

### Tercera prioridad: recreación didáctica mediante IA

Si no existe una fuente musical suficiente, utiliza el modelo de IA para generar un arreglo de aprendizaje a partir de la información musical disponible.

Debe poder generar:

- Una progresión de acordes coherente.
- Una línea de acompañamiento.
- Una melodía didáctica cuando exista información suficiente.
- Patrones rítmicos.
- Partes separadas para mano izquierda y derecha.
- Una estructura de secciones.
- Una secuencia de notas con duración y posición temporal.

Importante:

**No presentes una recreación generada como si fuera una transcripción oficial o exacta de la grabación original.**

Diferencia claramente entre:
- Transcripción o arreglo de fuente autorizada.
- Adaptación didáctica de una fuente musical.
- Arreglo generado por IA a partir de información parcial.

Muestra las fuentes consultadas, su procedencia, la información utilizada y el grado de confianza del resultado.

No inventes acordes, tonalidades ni datos y los presentes como hechos verificados.

Cuando la información sea insuficiente, indica las limitaciones y permite que el usuario aporte un archivo MIDI propio o autorizado.

## Adaptación al nivel

Una vez obtenida la información musical, la aplicación debe crear distintas versiones de aprendizaje.

Por ejemplo:

**Versión principiante**
- Melodía simplificada.
- Una mano inicialmente.
- Pocos acordes.
- Ritmo sencillo.
- Tempo reducido.
- Notas fáciles de identificar.

**Versión intermedia**
- Melodía más completa.
- Introducción progresiva de la segunda mano.
- Acordes y acompañamientos.
- Cambios de ritmo.
- Mayor precisión.

**Versión avanzada**
- Arreglo más elaborado.
- Ambas manos.
- Acordes completos.
- Inversiones.
- Patrones de acompañamiento.
- Mayor similitud musical con la versión de referencia, dentro de lo que permitan las fuentes.

Permite solicitar la dificultad mediante un prompt o seleccionarla desde la interfaz.

La IA también debe poder recomendar una dificultad según los resultados de los ejercicios anteriores.

## Restricciones del instrumento

Todo arreglo debe adaptarse al rango real de 61 teclas del CT-S300.

Cuando alguna nota esté fuera de rango, transpón o reestructura la parte de manera musicalmente coherente, explicando la adaptación cuando sea relevante.

No generes arreglos que sean imposibles de interpretar con el teclado disponible.

---

# 10. SISTEMA DE PRÁCTICA DE CANCIONES

Cada canción debe convertirse en una experiencia interactiva.

Incluye:

- Reproducción de referencia.
- Visualización de notas.
- Piano roll.
- Teclado virtual sincronizado.
- Tempo ajustable.
- Pausa.
- Retroceso.
- Repetición de secciones.
- Práctica por fragmentos.
- Práctica de mano derecha.
- Práctica de mano izquierda.
- Práctica de ambas manos.
- Modo de notas guiadas.
- Modo de interpretación sin ayudas.
- Evaluación al terminar.

Permite seleccionar una sección específica y repetirla hasta dominarla.

Incluye un sistema para reducir progresivamente las ayudas visuales a medida que el usuario mejora.

La aplicación debe poder recomendar practicar exclusivamente los fragmentos en los que se cometen errores.

No obligues a repetir una canción completa para mejorar una sección pequeña.

---

# 11. MOTOR DE AUDIO Y SONIDOS

Quiero que la aplicación tenga un sistema sonoro agradable y útil para aprender.

El teclado virtual debe reproducir sonidos musicales convincentes.

No utilices simples ondas sinusoidales como sonido principal de piano.

Investiga la mejor opción entre:

- SoundFonts.
- Muestras de instrumentos.
- Síntesis mediante Web Audio.
- Tone.js y sus posibilidades de reproducción y programación.

Utiliza muestras de audio con licencias apropiadas y verifica su procedencia.

## Funcionalidades

- Sonido de piano como instrumento predeterminado.
- Posibilidad de seleccionar otros timbres útiles.
- Reproducción de notas individuales.
- Acordes.
- Arpegios.
- Melodías.
- Ejercicios.
- Reproducción sincronizada con el piano roll.
- Control de volumen.
- Metrónomo.
- Tempo configurable.

Distingue entre el sonido generado por la aplicación y el sonido que reproduce el Casio.

Cuando sea posible, implementa la posibilidad de enviar notas MIDI al CT-S300 para utilizar sus propios sonidos.

Permite seleccionar el destino de audio para evitar reproducir simultáneamente el mismo ejercicio por dos salidas y generar duplicación o eco.

---

# 12. INTELIGENCIA ARTIFICIAL Y GENERACIÓN DE CONTENIDO

La IA debe cumplir una función concreta: mejorar la enseñanza y permitir crear experiencias musicales personalizadas.

No quiero introducir inteligencia artificial en partes que puedan funcionar mejor con algoritmos deterministas.

Utilízala principalmente para:

- Interpretar solicitudes de canciones.
- Investigar y resumir fuentes musicales.
- Proponer arreglos didácticos.
- Ajustar ejercicios al nivel del usuario.
- Explicar acordes, progresiones y conceptos musicales.
- Recomendar rutas de aprendizaje.
- Generar ejercicios personalizados.
- Dar consejos sobre errores recurrentes.

El scoring MIDI no debe depender de una opinión de un modelo de lenguaje. Debe calcularse con una lógica determinista.

## Generación estructurada

La IA debe generar contenido en un formato estructurado que la aplicación pueda validar.

Define un esquema que permita representar:

- Notas MIDI.
- Inicio de cada nota.
- Duración.
- Velocidad.
- Compás.
- Tempo.
- Acordes.
- Secciones.
- Mano correspondiente.
- Dificultad.
- Fuente de información.
- Tipo de arreglo.
- Grado de confianza.

No permitas que la aplicación interprete directamente texto libre como si fuera una secuencia musical válida.

Implementa validaciones para detectar:
- Notas fuera del rango del teclado.
- Duraciones inválidas.
- Acordes incoherentes.
- Eventos desordenados.
- Estructuras incompletas.
- Errores temporales.

La IA debe generar contenido musical que pueda reproducirse y evaluarse realmente.

---

# 13. PROGRESO Y PERSONALIZACIÓN

La aplicación debe recordar mi evolución.

No quiero que cada sesión empiece desde cero.

Guarda localmente:

- Nivel actual.
- Lecciones completadas.
- Ejercicios realizados.
- Puntuaciones.
- Canciones aprendidas.
- Dificultades recurrentes.
- Acordes dominados.
- Escalas practicadas.
- Tiempo de práctica.
- Evolución de precisión.

## Panel de progreso

Incluye visualizaciones de:

- Evolución de puntuaciones.
- Precisión de notas.
- Precisión rítmica.
- Habilidades dominadas.
- Áreas que requieren práctica.
- Racha de aprendizaje.
- Canciones trabajadas.

## Personalización

El sistema debe recomendar ejercicios según las dificultades detectadas.

Por ejemplo:

Si el usuario tiene buena precisión de notas, pero se retrasa frecuentemente en los cambios de acordes, recomienda ejercicios de cambios de acordes con énfasis rítmico.

La personalización debe estar respaldada por los resultados registrados, no por recomendaciones genéricas de IA.

Permite exportar e importar los datos de progreso para evitar perderlos.

---

# 14. EXPERIENCIA DE USUARIO Y MODOS DE APRENDIZAJE

Crea experiencias diferentes según la actividad.

### Modo aprender
Explicaciones, demostraciones y ayudas visuales constantes.

### Modo practicar
Ejercicios repetitivos, tempo ajustable y retroalimentación inmediata.

### Modo canción
Aprendizaje progresivo de una canción mediante secciones.

### Modo desafío
Interpretación con menos ayudas y evaluación más exigente.

### Modo exploración
Libertad para experimentar con notas, acordes y escalas sin puntuación.

Cada modo debe tener una interfaz adaptada a su finalidad.

---

# 15. ARQUITECTURA Y ORGANIZACIÓN DEL CÓDIGO

Mantén el proyecto modular y fácil de ampliar.

Separa claramente:

- Interfaz.
- Navegación.
- Sistema MIDI.
- Motor de audio.
- Teclado virtual.
- Piano roll.
- Motor de evaluación.
- Sistema de ejercicios.
- Programa didáctico.
- Sistema de canciones.
- Servicios de IA.
- Almacenamiento.
- Progreso.
- Configuración.

Evita concentrar toda la lógica en componentes gigantes.

Utiliza TypeScript con tipos claros para notas, acordes, eventos MIDI, ejercicios y canciones.

Implementa un modelo de datos coherente que permita ampliar posteriormente el catálogo de ejercicios y contenidos.

Evita dependencias innecesarias y abstracciones que no aporten valor.

La aplicación debe poder funcionar en modo local para practicar y consultar contenido previamente descargado, aunque no haya conexión a Internet. Las búsquedas externas y la generación con IA podrán requerir conexión.

---

# 16. VALIDACIÓN Y PRUEBAS

No consideres terminado el proyecto simplemente porque la interfaz se vea bien.

Prueba el funcionamiento real de sus componentes.

Incluye pruebas para:

- Conversión de notas MIDI.
- Eventos Note On y Note Off.
- Detección de acordes.
- Emparejamiento de notas esperadas y ejecutadas.
- Cálculo del scoring.
- Precisión temporal.
- Cálculo de duración.
- Secuenciación y reproducción.
- Validación de arreglos generados.
- Guardado y recuperación del progreso.

Utiliza pruebas unitarias y pruebas de interfaz cuando aporten valor.

Implementa un modo de diagnóstico que permita simular eventos MIDI para verificar el motor de evaluación sin tener el teclado conectado.

Importante: los eventos simulados deben identificarse como simulados. Nunca los presentes como si procedieran del Casio.

Realiza también una prueba de conexión física cuando el hardware esté disponible. No declares que la integración MIDI real está validada si únicamente has probado eventos simulados.

---

# 17. ORDEN DE DESARROLLO

Desarrolla el proyecto en etapas para asegurar que los fundamentos funcionen antes de construir funcionalidades complejas.

## Fase 1: Fundación

- Investigación técnica.
- Arquitectura.
- Configuración del proyecto.
- Sistema visual.
- Navegación.
- Teclado virtual.
- Motor de audio inicial.

## Fase 2: MIDI

- Conexión USB-MIDI.
- Detección del Casio.
- Recepción de eventos.
- Diagnóstico.
- Calibración.

Esta fase debe quedar funcional antes de construir el sistema de puntuación.

## Fase 3: Scoring

- Sistema de notas esperadas.
- Comparación con eventos MIDI.
- Detección de errores.
- Evaluación rítmica.
- Duración.
- Resultados y retroalimentación.

## Fase 4: Aprendizaje

- Estructura curricular.
- Lecciones.
- Ejercicios.
- Acordes.
- Escalas.
- Patrones.
- Dificultad progresiva.

## Fase 5: Canciones e IA

- Investigación de canciones.
- Fuentes y trazabilidad.
- Importación MIDI.
- Generación de arreglos.
- Adaptación por nivel.
- Práctica por secciones.

## Fase 6: Progreso y refinamiento

- Historial.
- Estadísticas.
- Recomendaciones.
- Persistencia.
- Mejoras visuales.
- Pruebas finales.

Puedes reorganizar las fases si existe una razón técnica concreta, pero no omitas sus objetivos.

---

# 18. ENTREGABLE FINAL Y CRITERIOS DE CALIDAD

Quiero que desarrolles la aplicación real dentro del proyecto, no solamente que me presentes una propuesta.

Comienza inspeccionando el entorno de trabajo y determina si existe un proyecto previo que deba respetarse.

Después:

1. Presenta brevemente la arquitectura y las decisiones principales.
2. Implementa el proyecto.
3. Instala las dependencias necesarias.
4. Ejecuta la aplicación.
5. Soluciona los errores encontrados.
6. Ejecuta las pruebas disponibles.
7. Documenta cómo conectar y configurar el Casio CT-S300.
8. Explica cómo configurar las credenciales necesarias para servicios de IA.
9. Incluye instrucciones claras para ejecutar la aplicación desde Windows mediante PowerShell.
10. Entrega un README completo pero fácil de seguir.

## Criterios irrenunciables

- No inventar funciones del Casio.
- No simular integraciones que no estén implementadas.
- No inventar fuentes musicales.
- No presentar arreglos generados como transcripciones oficiales.
- No crear estadísticas falsas.
- No sacrificar la precisión del scoring por una interfaz atractiva.
- No depender de partituras tradicionales para la experiencia principal.
- No utilizar librerías obsoletas sin justificarlo.
- No exponer claves API.
- No construir una arquitectura innecesariamente compleja.
- No limitar el producto a un prototipo visual sin funcionalidad.

Si alguna funcionalidad no puede implementarse por limitaciones técnicas, de compatibilidad, acceso a fuentes o licencias, explícalo y desarrolla la alternativa viable más cercana.

## RESULTADO ESPERADO

Una aplicación web personal, visualmente excelente y técnicamente sólida, conectada al Casio CT-S300, que funcione como un profesor de piano interactivo.

Debe permitirme:

- Aprender a tocar desde cero.
- Comprender notas, escalas y acordes de forma visual.
- Practicar ejercicios con el teclado real.
- Ver en pantalla qué notas debo tocar.
- Recibir puntuaciones sobre mi interpretación real.
- Identificar y corregir errores.
- Aprender canciones que solicite mediante prompts.
- Adaptar esas canciones a diferentes dificultades.
- Practicar ambas manos.
- Mejorar progresivamente hasta alcanzar un nivel avanzado.
- Consultar mi evolución y recibir recomendaciones.

Piensa en el producto como un **entrenador musical personal que combina un instrumento físico, un piano virtual, un profesor interactivo y un sistema inteligente de evaluación**.

La calidad de la experiencia y la precisión técnica son más importantes que acumular funcionalidades innecesarias.