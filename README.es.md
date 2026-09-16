# Why Graph

*Español · [Read in English](README.md)*

**Mira tu vault como una red neuronal por capas, y lee *por qué* cada nota se conecta
con la siguiente.**

El grafo de Obsidian te muestra *que* dos notas están enlazadas. Nunca te dice *por qué*.
Con unos cientos de notas es una madeja: bonita, e inútil para pensar.

Why Graph ordena tus notas en capas, de izquierda a derecha, como la información se
mueve de verdad en una base de conocimiento: lo que entra → de qué se trata → lo que
aprendiste → en qué se sintetiza. Toca cualquier nota y obtienes la frase en la que se
escribió el enlace. No una suposición: la línea real de tu propia nota.

![El mapa: cuatro capas, de izquierda a derecha, en un vault de ejemplo](docs/imagenes/01-mapa.webp)

## Qué espera de tu vault

El mapa dibuja la estructura que ya tienes. **Si tus notas viven en una sola carpeta plana,
sin temas y sin motivos escritos, vas a ver una columna y poco más** — no es un defecto: es
el retrato honesto de un vault que todavía no tiene capas.

Rinde cuando tu vault tiene, o va hacia:

- **Carpetas que significan algo.** No `notas/`, sino algo como fuentes, proyectos y
  personas, ideas, temas. El asistente del primer uso lee tus carpetas y propone una capa
  para cada una; entre tres y cinco capas es lo que mejor funciona.
- **Una propiedad que agrupa las notas** (`tema` por defecto, o el nombre que quieras). Es
  lo que le da color a cada nota y permite colapsar temas. Es opcional: sin ella el mapa
  funciona igual, en un solo color.
- **La costumbre de decir por qué enlazas.** Cuando una nota lleva
  `- [[otra-nota]] — el motivo`, el panel muestra tus palabras. Cuando no, muestra la frase
  real donde aparece el enlace — y la IA puede proponer el motivo que falta, para que lo apruebes.

Este plugin creció dentro de un vault armado con el patrón **LLM wiki** — el
[diseño original de Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
fuentes crudas e inmutables por un lado, un wiki curado que mantiene el LLM por el otro, y un
contrato escrito entre los dos. No exige ese patrón y no impone ninguna carpeta propia — pero
esa es la forma para la que fue diseñado. Cualquier vault con una estructura deliberada (PARA,
Zettelkasten con MOCs, un jardín digital con centros temáticos) recibe el mismo beneficio.

Si llevas un LLM wiki, el mapa hace algo concreto por ti: la capa cruda se vuelve la primera
columna, el wiki curado las del medio y las síntesis la última — así ves de un vistazo si tus
fuentes se están destilando de verdad, o solo acumulando.

Si tu vault es plano hoy, el mapa sirve igual como diagnóstico: te muestra exactamente cuánto
de tu pensamiento está en un montón sin diferenciar.

## Cómo funciona

![Arquitectura: del vault al mapa, y cómo se aprueba un motivo](docs/imagenes/arquitectura.png)

Todo lo que está dentro del recuadro pasa en tu computador, sin una sola llamada de red.
A la IA se la llama solo cuando pides una sugerencia, con tu llave; y lo que proponga
tiene que sobrevivir la verificación de sus citas por código y tu aprobación antes de que
se escriba una línea en tu nota. La versión interactiva del diagrama está en
[`docs/diagramas/mapa-neuronal.html`](docs/diagramas/mapa-neuronal.html): descárgalo y
ábrelo en un navegador.

## Qué hace

- **Capas, no una madeja.** Tú decides qué carpetas van en cada capa (un asistente
  propone una en el primer uso). Dentro de cada capa las notas se ordenan para que se
  cruce la menor cantidad de líneas, así los caminos que ves son los que existen.
- **Cada enlace lleva su motivo.** Toca un enlace y el panel muestra el motivo que
  curaste (`- [[nota]] — motivo`) o la frase real de la nota donde aparece el enlace.
  Nada se inventa.
- **Caminos.** Eliges dos notas y dibuja la cadena más corta entre ellas, paso a paso,
  con el motivo de cada salto. Así te enteras de que dos proyectos que creías
  relacionados están a cuatro saltos.
- **Vacíos.** Compara los enlaces que existen contra los que cabría esperar entre dos
  temas (vecinos comunes, densidad) y nombra los pares que deberían estar conectados y
  no lo están. En mi propio vault encontró dos temas con 0 enlaces donde se esperaban ~26.
- **Vista radial.** Centra una nota y mira su mundo en anillos: vecinos directos, luego
  los de ellos. La animación viaja hacia fuera, anillo por anillo.

  ![Vista radial: una nota al centro y su mundo en anillos](docs/imagenes/05-radial.webp)
- **Motivos con *tu* IA (opcional).** Si conectas un proveedor, propone un motivo para
  los enlaces que no lo tienen — siempre con una cita literal de las dos notas, siempre
  verificada por código, y nunca escrita en tus notas hasta que la apruebas.
- **Inglés y español.** La interfaz sigue el idioma configurado en Obsidian.
- **Funciona en el teléfono.** El mismo mapa, las mismas proporciones, gestos táctiles.
- **Exportar.** PNG para presentaciones, un Canvas de Obsidian que puedes seguir
  editando, o una página HTML independiente.

## Instalación

### Desde el directorio de la comunidad

Complementos de la comunidad → Explorar → buscar "Why Graph" → Instalar → Activar.
*(En revisión al momento de escribir esto — mientras tanto, cualquiera de las dos formas de abajo.)*

### Con BRAT — se instala y se actualiza solo

Es la forma habitual de instalar un plugin directo desde GitHub:

1. Instala **Obsidian42 - BRAT** desde los complementos de la comunidad.
2. Paleta de comandos → **BRAT: Add a beta plugin for testing**.
3. Pega `DBB-FC/mapa-neuronal`.

BRAT lo instala, lo activa y lo actualiza con cada release nueva.

### A mano

Baja `main.js`, `manifest.json` y `styles.css` de la
[última release](https://github.com/DBB-FC/mapa-neuronal/releases/latest) a
`<vault>/.obsidian/plugins/mapa-neuronal/` y actívalo en Complementos de la comunidad.
No hace falta nada más: esos tres archivos son todo el plugin.

Se abre con el comando **Abrir mapa neuronal** (`Cmd/Ctrl+P`) o el ícono de cerebro en
la barra izquierda.

## Primer uso, en un minuto

1. Abre el mapa. Un asistente lista tus carpetas con una capa propuesta para cada una
   (Entrada / Entidades / Conocimiento / Temas / No mostrar). Corrige lo que se vea mal
   y presiona Aplicar.

   ![El asistente del primer uso: cada carpeta con una capa propuesta](docs/imagenes/02-asistente.webp)

2. Toca cualquier nota. El panel lateral nombra su capa, su tema, un resumen de dos
   líneas y todos sus enlaces con su motivo.

   ![Una nota enfocada, con el panel mostrando cada enlace y su motivo](docs/imagenes/02-panel.webp)

3. `···` → **Camino entre dos notas**, eliges dos, y lees la cadena.

   ![Un camino entre dos notas, con el motivo de cada salto](docs/imagenes/03-camino.webp)

4. `···` → **Vacíos entre temas**, para ver lo que debería estar conectado y no lo está.

   ![El panel de vacíos: pares de temas que deberían estar conectados](docs/imagenes/04-vacios.webp)

Eso es todo. No hay que configurar nada más, y nada de lo anterior necesita una llave de IA.

El resto vive en el menú de herramientas — la ficha `⋯ herramientas` del mapa, o el `···`
de la pestaña:

![El menú de herramientas: caminos, radial, vacíos, modo salud, colapsar temas, actividad reciente y exportar](docs/imagenes/07-herramientas.webp)

## Ajustes que vale la pena conocer

| Ajuste | Qué cambia |
|---|---|
| **Capas** | Una línea por capa: `Nombre \| descripción`. Tres a cinco funciona mejor. |
| **Carpetas** | Qué carpeta va en qué capa. El asistente lo escribe por ti. |
| **Propiedad de tema** | La propiedad del frontmatter que agrupa y colorea (por defecto `tema`). Vacío = sin temas. |
| **Notas visibles por capa** | En vaults grandes cada capa muestra sus notas más conectadas; el resto aparece al buscarlas. Por defecto 150. |
| **Sección de conexiones** | El título al final de cada nota donde se escriben los motivos aprobados. |
| **Propiedad de enlaces externos** | Propiedades del frontmatter con enlaces web (`Título \| https://…`, `https://…`, `usuario/repo`). Vacío = la sección no aparece. Solo abre `http` y `https`. |
| **Propiedad de fecha** | Si la llenas, al aprobar un motivo también se escribe la fecha de hoy en esa propiedad. Vacía por defecto: el plugin no toca tu frontmatter. |
| **Animación** | Pulsos de luz por los enlaces. Solo con el mapa visible, y apagada si el sistema pide reducir movimiento. |

## Conecta tu propia IA (opcional)

El mapa funciona sin IA. Si conectas una, puede proponer motivos para los enlaces que no
lo tienen y resúmenes cortos para las notas sin descripción.

Compatibles: **Anthropic (Claude)**, **OpenAI**, **Google (Gemini)** y cualquier
**servidor local compatible con OpenAI** (Ollama, LM Studio, LocalAI) — el local no
necesita llave ni internet.

Los motivos y los resúmenes se escriben **en el idioma de tus notas**, no en el idioma de
la interfaz.

![La sección de IA en los ajustes: proveedor, llave y el botón de probar](docs/imagenes/06-ia.webp)

### ¿Funciona con mi suscripción de Claude o de ChatGPT?

**No, y ningún plugin puede.** Las suscripciones (Claude Pro/Max, ChatGPT Plus) pagan las apps
del proveedor; no existe una API pública que se autentique con una suscripción. La API es otro
producto, y se cobra por token con crédito prepagado.

Tres formas de resolverlo:

- **IA local — gratis.** Ollama o LM Studio en tu propia máquina: sin llave, sin costo, y tus
  notas nunca salen del computador. Es la respuesta si no quieres pagar por uso.
- **Tu propia llave.** Unos centavos por sugerencia: **≈0,04 USD** con Claude Opus 5 (las dos
  notas más la revisión). Las cuentas nuevas de la API reciben crédito gratis para probar.
- **Sin IA.** El mapa completo funciona sin ella. La IA solo propone motivos para los enlaces
  que no tienen uno; todo lo demás —capas, caminos, vacíos, radial, exportar— no hace ninguna
  llamada de red.

Los plugins que parecen funcionar "con una sola suscripción" hacen una de dos cosas: usan un
modelo local (gratis, como la opción de arriba), o pagan la API con la llave del desarrollador
y te cobran una suscripción por eso — lo que significa que **tus notas pasan por su servidor**.
Este plugin no tiene servidor, así que ese canje no está sobre la mesa.

### Cómo se configura

Cuatro campos: eliges el proveedor, pegas tu llave, eliges el modelo y
aprietas **Probar la conexión** — una llamada mínima que te dice si responde, sin enviar
ninguna nota. La llave queda solo en ese dispositivo.

Tres reglas que el plugin impone con cualquier proveedor:

1. **Las citas las verifica el código.** El modelo tiene que devolver una cita literal de
   cada una de las dos notas. El plugin busca esas citas en los archivos. Si una no
   está, la propuesta queda marcada como no verificable y no se puede aprobar. Eso es lo
   que frena la invención con tono seguro.
2. **Una segunda pasada revisa a la primera.** Otra llamada compara el motivo con las
   citas buscando negaciones, estados y pendientes ("decidimos no usar X" no puede
   volverse "usamos X"). Se puede apagar; cuesta el doble y atrapa los errores de matiz.
3. **Nada se escribe sin ti.** Aprobar es un clic. Solo entonces el motivo entra en tu
   nota, bajo el título que configuraste, y solo como una línea nueva — el plugin nunca
   reescribe texto existente.

Cada aprobación queda registrada (fecha, modelo, citas, texto final) en una nota dentro
de la carpeta de auditoría.

### Precisión medida

En un vault real de 254 notas y 916 enlaces, sobre una muestra reproducible de 44
enlaces revisados a ciegas contra las notas fuente:

| | Correctos | Erróneos o inventados | No verificables (bloqueados) |
|---|---|---|---|
| Primer intento: modelo pequeño, solo la frase del enlace | 48 % | 16 % | — |
| Método actual: notas completas + citas verificadas + segunda pasada | **97,7 %** | **0 %** | 2,3 % |

Se midió con **Claude Opus 5**. Con otros modelos los candados siguen puestos — una
propuesta sin citas verificables sigue sin poder aprobarse — pero la tasa de acierto no
está medida: trátala como desconocida hasta que la midas en tu propio vault.

### Costo y privacidad

- Tus notas van al proveedor que **tú** eliges, con **tu** llave, a **tu** costo. El
  plugin no tiene servidor. El autor nunca ve tus notas, tus llaves ni tus consultas.
- Las llaves se guardan por dispositivo en el almacenamiento local de Obsidian — nunca
  en `data.json`, así que no viajan por git, Obsidian Sync ni un respaldo.
- No se envía nada hasta que pides una sugerencia. Abrir el mapa, navegar, caminos y
  vacíos no hacen ninguna llamada de red.
- Costo aproximado por sugerencia con Claude Opus 5: dos notas de contexto más la
  revisión. Un vault con cien enlaces sin motivo cuesta unidades de dólar recorrerlo
  completo — y no hay que hacerlo de una sola vez.
- El proveedor local (Ollama) no manda nada a ninguna parte: sin llave, sin internet,
  sin costo.

## Lo que ahorra un motivo escrito

![Costo medido en tokens con y sin la estructura: 115x, 45x y 9x](docs/imagenes/ahorro-es.svg)

El plugin no ahorra tokens por sí solo — los ahorra la estructura, y el plugin es lo que hace
imposible ignorar lo que falta. Su propia función de IA **gasta**: unos 3.900 tokens de entrada
por sugerencia, alrededor de **0,04 USD** con Claude Opus 5.

Lo que rinde es la otra dirección. Un motivo se escribe una vez y se lee muchas: por ti, y por
cualquier agente que trabaje contra tu vault. Las tres filas de arriba se midieron en el vault
del autor —254 notas, 916 enlaces, ~147.800 tokens de wiki— contando caracteres ÷ 3,7 y
comparando lo que cuesta responder cada pregunta con y sin la estructura escrita. Tus números
van a ser distintos; lo que viaja son las proporciones.

La advertencia honesta está en el propio gráfico: nadie vuelca el wiki entero en cada pregunta
—un agente hace grep—. La comparación defendible es la primera fila, **leer el motivo en vez de
abrir las dos notas**, y esa es de 115×.

## Vaults grandes

Probado con 5.043 notas y 17.526 enlaces. Cada capa dibuja sus notas más conectadas (150
por defecto) y revela el resto a pedido, así el mapa sigue siendo navegable en vez de
dibujar un rectángulo gris. En radial cada anillo se limita a 80.

## ¿Modifica mis notas?

Solo cuando presionas **Aprobar** en una sugerencia de IA, y solo como una línea agregada
en la sección de conexiones de esa nota. El texto que ya estaba nunca se reescribe ni se
reordena, y tu frontmatter no se toca salvo que llenes el ajuste *Propiedad de fecha*,
que viene vacío.

Todo lo demás — capas, colores, caminos, vacíos — es de solo lectura. La otra escritura
posible es exportar: un PNG en la carpeta que elijas.

No hay telemetría, ni analítica, ni servidor: el plugin no hace ninguna llamada de red
salvo la de la IA que tú pides, al proveedor que configuraste.

Sí lee la lista de todas tus notas —un mapa no se puede dibujar con una parte—, y los
archivos de cada release llevan [atestación de GitHub](https://github.com/DBB-FC/mapa-neuronal/attestations),
así que puedes comprobar que se construyeron desde este código:

```bash
gh attestation verify main.js --repo DBB-FC/mapa-neuronal
```

## Cómo se ve

El mapa se dibuja sobre un lienzo oscuro con tema claro y con tema oscuro — como un cielo
de noche, para que los colores de los temas y los pulsos de luz de los enlaces se lean.
El panel, las fichas y los ajustes siguen tu tema.

## Construir desde el código

Todo sale de `src/`; el release es una sola pasada de esbuild, sin minificar.

```bash
npm install
npm test        # construye src/main.js → main.js y revisa las traducciones
npx eslint src/ # el linter oficial de plugins de Obsidian
./instalar-en-vault.sh /ruta/a/tu/vault
```

`src/main.js` es el código fuente. El `main.js` de la raíz es el resultado del build y no
se versiona: viaja en los releases. El build es una sola pasada de esbuild, sin minificar,
así que el archivo publicado sigue siendo legible.

## Licencia

[MIT](LICENSE). Gratis para cualquier uso —personal o comercial— y puedes forkearlo,
modificarlo y redistribuirlo, conservando el aviso de autoría.

El plugin no cobra nada y no tiene versión de pago. El directorio de Obsidian igual lo
etiqueta como **pagos opcionales**, porque puede conectarse a servicios de IA que te
cobran a ti con tu propia llave; el proveedor local (Ollama, LM Studio) no cuesta nada.

## Soporte

Errores e ideas: issues de GitHub. Incluye tu versión de Obsidian, tu plataforma y la
cantidad de notas y enlaces que muestra el encabezado del mapa.

---

<a href="https://dontbuybuild.cl">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/imagenes/dbb-labs-oscuro.svg">
    <img alt="DBB Labs" src="docs/imagenes/dbb-labs-claro.svg" height="24">
  </picture>
</a>

Hecho por **Felipe Córdova** · Powered by [DBB Labs](https://dontbuybuild.cl) — *No compres. Construye.*
