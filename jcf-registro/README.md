# JCF Registro v1.0.0-beta

Aplicación web móvil para registrar tutores y beneficiarios de la Fundación Juventud Cristiana por el Futuro. La fotografía se procesa dentro del navegador con Canvas y Tesseract.js; no se incluye en los registros ni se envía a un servicio de reconocimiento.

## Estado anterior y refactorización

La versión anterior cargaba once scripts clásicos. `ocr.js`, `ocr-v07.js`, `ocr-v08.js`, `ocr-v081.js`, `debug-extra.js`, `lab-v08.js` y `lab-v08-fix.js` reasignaban las mismas funciones globales. El recorte terminaba en 1586 × 1000, pero solo escalaba un rectángulo y no corregía perspectiva. El detector ligero, las regiones OCR, parsers y métricas útiles se migraron a módulos con una sola implementación por responsabilidad.

La estructura actual separa `ui/`, `image/`, `ocr/`, `debug/` y `storage/`. `src/version.js` es la única fuente de la versión visible. Vite genera nombres de assets con hash y el botón **Buscar actualización** elimina los caches/service workers antiguos antes de recargar.

## Desarrollo

```bash
npm ci
npm test
npm run dev
npm run build
```

La salida publicable queda en `dist/`. GitHub Actions ejecuta pruebas y build antes de desplegar Pages.

## Flujo de imagen y privacidad

1. Cámara y Fotos usan inputs separados.
2. La imagen se reduce en memoria a un máximo de 2600 px.
3. El detector Canvas/Sobel tiene un límite de 5 segundos; al fallar mantiene cuatro esquinas manuales.
4. Una homografía produce siempre 1586 × 1000 px.
5. Las regiones fijas se extraen exclusivamente de esa imagen normalizada.
6. Cada pase OCR tiene reloj de seguridad y el análisis completo puede cancelarse.
7. IndexedDB guarda solo texto. Al guardar un registro se limpian los canvases y se revocan los object URLs.
8. El ZIP técnico se genera únicamente después de una acción explícita y una advertencia de datos personales.

## Pruebas manuales

Lista para validar en Safari de iPhone y Android antes de promover la beta:

- [ ] Elegir imagen desde Fotos en iPhone.
- [ ] Tomar foto desde cámara.
- [ ] Detección automática correcta.
- [ ] Detección fallida y ajuste manual de las cuatro esquinas.
- [ ] Cancelar y repetir el análisis.
- [ ] Cambiar de imagen y confirmar que el canvas anterior se limpia.
- [ ] Exportar CSV y abrirlo en Excel.
- [ ] Generar/compartir diagnóstico con Web Share.
- [ ] Descargar diagnóstico cuando Web Share no existe.
- [ ] Simular conexión lenta y fallo de carga de Tesseract.
- [ ] Recargar durante un análisis.
- [ ] Revisar IndexedDB y confirmar que no hay blobs/imágenes.

Las pruebas unitarias cubren formato y verificador de cédula, fechas, sexo, sangre, estado civil, lugar, ocupación, consenso de nombres, ruido y no reutilización de nombres como apellidos. Los fixtures son texto sintético y no contienen fotografías ni datos personales reales.

### Validación ejecutada para esta beta

- `npm test`: 17 pruebas aprobadas en 4 archivos, incluida la cancelación durante la carga del worker.
- `npm run build`: build de producción aprobado con JS y CSS con hash.
- Vista móvil de 375 px: sin desbordamiento horizontal; título, encabezado, estado y pie muestran `v1.0.0-beta`.
- Archivo gráfico sintético elegido desde el flujo de Fotos: detector automático terminado en 109 ms y cuatro puntos editables visibles.
- Transformación de perspectiva: canvas verificado en 1586 × 1000 px.
- Lectura OCR sintética: terminó sin bloqueo y marcó los campos dudosos para revisión.
- IndexedDB: registro sintético persistió tras recargar, mostró la cédula enmascarada y se eliminó después de la prueba.
- Limpieza: editor e imagen normalizada quedaron vacíos al pulsar **Eliminar fotografía**; consola sin errores.

Las pruebas con cámara física, Fotos de iOS, Web Share de Safari y apertura del CSV en Excel permanecen como verificación manual en hardware real; no se marcan como ejecutadas desde el navegador de escritorio.

## Publicación

URL estable: <https://ciperez10.github.io/AppFotos/jcf-registro/>

La rama beta también dispara el workflow de Pages para permitir pruebas del build exacto antes de integrar en `main`.
