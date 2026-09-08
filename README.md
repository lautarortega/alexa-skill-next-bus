# Mi bus de Múnich

Skill privada de Alexa en español para saber en cuántos minutos llega el próximo autobús a una parada fija de Múnich. Está preparada para **Alexa-hosted (Node.js)**: Amazon aloja la función Lambda, los registros y los recursos de la skill.

## Fuente de salidas

La fuente por defecto es el endpoint público de salidas de MVG. Expone salidas planificadas y previsiones en tiempo real. No está documentado como API pública estable por MVV/MVG, por lo que puede cambiar sin aviso.

El código concentra esa integración en [lambda/index.js](lambda/index.js), por lo que puede sustituirse cuando MVV facilite una API oficial en tiempo real. No se almacenan datos de ubicación ni datos personales.

## Configurar la parada

1. Busca la parada mediante `https://www.mvg.de/api/bgw-pt/v3/locations?query=NOMBRE_DE_LA_PARADA` en el navegador. Sustituye los espacios del nombre por `%20`.
2. Localiza la parada correcta y copia su campo `globalId`.
3. Para desarrollo local, copia [lambda/config.local.example.js](lambda/config.local.example.js) como `lambda/config.local.js` y completa la parada. Este archivo está excluido por [`.gitignore`](.gitignore), por lo que nunca se sube a GitHub.
4. Opcionalmente, deja `allowedProducts: ['bus']` para solo autobuses; usa `[]` para incluir todos los transportes. `allowedLines` permite limitar la respuesta a líneas concretas.

La configuración pública de [lambda/config.js](lambda/config.js) contiene únicamente valores de marcador de posición. No añadas tu parada allí si el repositorio es público.

Ejemplo de configuración:

```js
homeStop: {
  id: 'de:09162:1234',
  name: 'Nombre de tu parada'
},
allowedProducts: ['bus'],
allowedLines: ['54', '153']
```

## Desplegar como Alexa-hosted

1. Publica este repositorio sin `lambda/config.local.js`. Puedes comprobarlo con `git check-ignore lambda/config.local.js`; debe mostrar la ruta del archivo.
2. En la Alexa Developer Console, crea una skill **Custom**, idioma **Spanish (ES)** y hosting **Alexa-Hosted (Node.js)**. En la pantalla de plantillas, selecciona **Import skill** e indica la URL `.git` de tu repositorio público.
3. Al terminar la importación, abre **Code** y edita [lambda/config.js](lambda/config.js) dentro de la consola Alexa. Sustituye el ID y nombre de marcador en `homeStop` por tu parada real. Esos cambios quedan en los recursos privados de Alexa-hosted, no en el repositorio GitHub público.
4. En **Build > Interaction Model > JSON Editor**, verifica el modelo de [skill-package/interactionModels/custom/es-ES.json](skill-package/interactionModels/custom/es-ES.json) y pulsa **Build Model** si hiciste cambios.
5. Pulsa **Deploy** y prueba desde la pestaña **Test** con: “abre mi bus de munich” y después “decime cuándo pasa el próximo bondi”.

Para mantenerla privada, úsala solo en la fase de desarrollo con la misma cuenta de Amazon que usas en tus dispositivos Alexa. No la envíes a certificación ni la publiques.

El archivo [skill-package/skill.json](skill-package/skill.json) es una plantilla para una futura importación con ASK CLI. Las URLs de iconos son marcadores de posición; antes de publicar la skill habría que reemplazarlas por URLs HTTPS reales y completar los requisitos de publicación.

## Ejecutar pruebas locales

Desde [lambda](lambda), instala las dependencias y ejecuta `npm test`. Las pruebas no hacen llamadas de red.

## Comportamiento

La respuesta incluye línea, destino, tiempo estimado, hora local de Berlín y retraso cuando la fuente lo informa. Si no hay una fuente disponible, Alexa informa del problema sin inventar una salida.
