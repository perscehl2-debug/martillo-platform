# Siniestros — Finiquitización SOAP (piloto)

Módulo interno para una compañía liquidadora: recepción del denuncio → checklist dinámico → carga de antecedentes → extracción con IA → validaciones cruzadas → cálculo art. 26 en UF → informe de liquidación → finiquito, con control de plazos legales y revisión humana obligatoria. Especificación completa en [`SPEC.md`](./SPEC.md).

Vive dentro de la app Next.js de Martillo pero es independiente del marketplace de remates: rutas `/siniestros/*` y `/api/siniestros/*`, tablas propias y bucket privado propio.

## Puesta en marcha

1. Ejecutar `supabase/migrations/002_siniestros.sql` en el SQL Editor (no depende de `001`).
2. Variables en `.env.local` / Vercel (ver `.env.example`): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (cuenta de organización con no entrenamiento/ZDR), `CRON_SECRET`, opcional `ANTHROPIC_MODEL` (por defecto `claude-opus-5`).
3. Dar rol a los usuarios (registrados antes en `/auth/register`):
   ```sql
   INSERT INTO public.usuarios (id, nombre, email, rol)
   SELECT id, 'Nombre Apellido', email, 'supervisor' FROM auth.users WHERE email = 'persona@empresa.cl';
   ```
   Roles: `liquidador`, `supervisor`, `administrativo`. El primer supervisor se crea por SQL; después administra usuarios desde la BD con su propio rol.
4. Cargar valores UF: `POST /api/siniestros/uf` como supervisor (o esperar el cron diario de `vercel.json`, que llama `GET` con `Authorization: Bearer $CRON_SECRET`).

## Arquitectura

| Capa | Dónde | Notas |
|---|---|---|
| Reglas por producto | `lib/siniestros/reglas/*.json` + `schema.json` | Coberturas, regímenes de topes, plazos, catálogo de documentos con campos a extraer, fórmulas. Validadas con Ajv + chequeos de coherencia. Versiones nuevas se publican en `reglas_producto`; cada caso congela la versión con que se abrió. |
| Núcleo determinístico | `lib/siniestros/{calculo,plazos,beneficiarios,validaciones,checklist,analisis}.ts` | Funciones puras con tests. **Los montos siempre los calcula este código, nunca el LLM.** |
| IA | `lib/siniestros/ia/` | Claude con salida estructurada (`output_config.format = json_schema`), esquema generado desde el catálogo del JSON. Extracción por documento (PDF/imagen) con valor + confianza + página + evidencia; análisis de caso = resumen, observaciones y recomendaciones sobre el resultado determinístico. Fallback de servidor ante rechazos (`fallbacks: "default"`). |
| Datos y seguridad | `supabase/migrations/002_siniestros.sql` | RLS por rol y asignación, bucket privado `siniestros-documentos` (URLs firmadas de 60 s), auditoría append-only por trigger, informes inmutables una vez emitidos, aprobación con cuatro ojos. |
| API | `app/api/siniestros/**` | Autoriza con el cliente del usuario (RLS). El `service_role` sólo se usa en el servidor para: escribir extracciones, contar casos vinculados, subir el PDF emitido y sincronizar la UF. |
| UI | `app/siniestros/**`, `components/siniestros/**` | Bandeja por urgencia de plazo, nuevo denuncio (régimen y checklist en vivo), detalle del caso, tablero de plazos, panel de reglas. |
| PDF | `lib/siniestros/pdf/informe.ts` | pdf-lib. Preinforme, informe de liquidación y finiquito con trazabilidad (quién, cuándo, reglas, valor UF). |

### Flujo de un caso

1. **Denuncio** (`POST /api/siniestros/casos`): se resuelve el régimen por **fecha de contratación de la póliza**, se genera el checklist desde las reglas, se crean coberturas y plazos.
2. **Antecedentes** (`POST …/casos/:id/documentos`): SHA-256, bucket privado, el requisito pasa a *recibido*; el liquidador dispara la extracción IA (`POST …/documentos/:id/extraer`). Si la confianza promedio es ≥ 0,8 y no hay signos de alteración, el requisito queda *validado*; si no, queda *recibido* para revisión manual.
3. **Auto-análisis** (`POST …/casos/:id/analisis`): validaciones cruzadas, banderas rojas, indicios de exclusión, beneficiarios (art. 31), cálculo art. 26 con la UF del día (registrada) y resumen IA. Queda como **propuesta** hasta que el liquidador lo marca *revisado*.
4. **Informe** (`POST …/casos/:id/informes`): exige análisis revisado; queda *pendiente de aprobación*. El finiquito exige un informe de liquidación emitido.
5. **Aprobación** (`POST …/informes/:id/aprobar`): sólo supervisor y distinto del redactor (lo impone la BD). Genera el PDF definitivo con hash, lo emite (inmutable) y actualiza el caso y sus plazos.

## Pruebas

```bash
npm test          # vitest: reglas, régimen, art. 26, plazos, beneficiarios, validaciones, esquemas IA, flujo completo, PDF
npm run test:rls  # Postgres temporal + stub de Supabase + migración + 50 aserciones de RLS por rol
```
`test:rls` requiere PostgreSQL ≥ 15 local (`PG_BIN` para indicar la ruta de binarios).

## Supuestos a confirmar con la compañía

Todos están parametrizados en `soap.json`; cambiarlos es publicar una nueva versión de reglas.

- **IPP proporcional**: `grado × tope IPT`, con tope `ipp_max` (600 × 50 % = 300 UF; 66 % ≈ 396 UF). Referencia `base_proporcion_ref`.
- **Tope conjunto IPP + gastos médicos**: se usa el tope IPT (`cap_con_gastos_medicos_ref: "ipt"`); el spec dice "la suma asegurada".
- **Muerte con IPP/IPT previa del mismo accidente**: se paga el remanente y, además, se deducen los gastos médicos pagados.
- **Cómputo de días**: aviso, pago general e impugnación en días corridos; pago en muerte post Ley Jacinta en 7 días **hábiles** (según la CMF); comunicación/oposición en días hábiles. Ver `computo_plazos`.
- **Feriados** para días hábiles: `lib/siniestros/feriados-cl.json` (2026-2027); verificar contra el calendario oficial y agregar feriados electorales.
- **Beneficiarios de la misma clase**: se reparte por partes iguales.
- **Comprobantes** a nombre de otra persona o anteriores al accidente: se proponen excluidos (visible en los pasos del cálculo).
- **Texto del finiquito**: referencial; debe revisarlo el área legal.
- **Desgravamen** (`desgravamen.json`) es un ejemplo de extensibilidad (Fase 5) con tope ilustrativo; el producto queda inactivo por defecto.

## Cumplimiento (Ley 19.628 / Ley 21.719)

- Datos de salud como datos sensibles: el administrativo no ve extracciones, análisis, montos ni informes, y de los documentos sólo ve los que él mismo subió.
- `personas.base_licitud` / `consentimiento_at` registran la base de licitud; `solicitudes_titulares` registra el ejercicio de derechos (acceso, rectificación, supresión, oposición, portabilidad, bloqueo).
- Auditoría de todas las tablas del caso con usuario, acción y diff (append-only).
- Al análisis de caso con IA se envían datos minimizados (sin RUT ni contacto). La extracción necesariamente envía el documento: usar sólo una cuenta de organización con acuerdo de no entrenamiento y, si es posible, retención cero.

## Pendiente (fuera del MVP o siguiente iteración)

- OCR dedicado de respaldo (Tesseract/OCRmyPDF) para escaneos de baja calidad; hoy se usa el modo documento/visión de Claude.
- Pagos previos de **otros** casos del mismo accidente en el cálculo (la función ya acepta `pagos_previos_uf`).
- UI para administrar usuarios, solicitudes de titulares y políticas de retención; notificación de brechas.
- Firma electrónica avanzada e integración con aseguradoras (excluidas del MVP en el spec).
- Notificaciones (correo) de alertas de plazo.
