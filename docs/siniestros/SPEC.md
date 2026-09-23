# SPEC.md — Sistema de Finiquitización de Siniestros de Seguros (Chile) — Piloto SOAP

## TL;DR
- Este documento es una especificación técnica lista para entregar a Claude Code/Codex: define un sistema que gestiona la liquidación y pago ("finiquitización") de siniestros para una **compañía liquidadora de seguros chilena**, con **SOAP (Ley 18.490)** como piloto y arquitectura **extensible por motor de reglas JSON** a otros ramos (vida, salud, vehículos/casco, hogar, desgravamen).
- El núcleo funcional son cuatro capacidades: (1) **gestión de casos/siniestros** con control de plazos legales del DS 1.055/2012; (2) **carga de documentos** con **checklist dinámico** por cobertura; (3) **auto-análisis IA** (OCR+LLM) con validación cruzada, detección de inconsistencias y recomendación de monto en UF; y (4) **generación del informe de liquidación y finiquito**, siempre con **revisión humana** (human-in-the-loop).
- Stack recomendado: **Next.js + Supabase (Postgres, Auth, Storage, RLS) + API de Claude** para extracción/análisis, con cumplimiento de la **Ley 19.628** y su reforma la **Ley 21.719** (datos de salud = sensibles), que entra en plena vigencia el **1 de diciembre de 2026**.

## Key Findings (contexto normativo que condiciona el diseño)

### Coberturas SOAP vigentes (Ley 18.490, art. 25, modificado por Ley N° 21.797 "Ley Jacinta")
La Ley N° 21.797 ("Ley Jacinta") fue publicada en el Diario Oficial el **sábado 7 de febrero de 2026** y, según el comunicado de la CMF del 9 de febrero de 2026, sus nuevos montos aplican a todos los SOAP y SOAPEX que se contraten **a partir del 9 de febrero de 2026** (fecha en que la CMF incorporó la nueva póliza y normativa). Para esas pólizas:
- **Muerte: 600 UF** (antes 300 UF)
- **Incapacidad permanente total: 600 UF** (antes 300 UF)
- **Incapacidad permanente parcial: hasta 400 UF** proporcional según grado (antes 200 UF)
- **Gastos médicos/hospitalarios: hasta 600 UF** (nivel 03 M.L.E. Fonasa) (antes 300 UF)

Para pólizas contratadas **antes del 9 de febrero de 2026**, rigen los montos antiguos (300/300/200/300 UF). El sistema **DEBE soportar ambos regímenes en paralelo**: según la CMF, hasta **marzo de 2027 coexistirán pólizas con las coberturas antiguas y las nuevas**. La regla de negocio clave es que **la fecha de contratación de la póliza —no la del siniestro— determina el tope aplicable**.

Referencia de conversión (contexto operativo, no fijar en código): el valor de la UF al 22 de septiembre de 2026 rondaba los $40.991 CLP (Banco Central vía mindicador.cl), por lo que 600 UF equivalían a aproximadamente $24,6 millones. El valor UF debe consultarse dinámicamente en cada cálculo.

### Reglas de acumulación y deducción (art. 26)
- Las indemnizaciones por muerte, incapacidad permanente total e incapacidad permanente parcial **NO son acumulables**. Si se pagó una incapacidad parcial y la víctima luego fallece o queda en incapacidad total por el mismo accidente, sólo se paga el **remanente** hasta el tope (600 UF en régimen nuevo).
- En **incapacidad permanente total NO se deducen** los gastos médicos ya pagados.
- En **incapacidad permanente parcial** no se deducen los gastos médicos, pero su suma con la indemnización de incapacidad **no puede exceder la suma asegurada** (tope de la cobertura).
- En **muerte**, la indemnización se paga **previa deducción** de los gastos médicos ya pagados.

### Definición de incapacidad y certificación (arts. 27 y 28)
- **Incapacidad permanente total**: pérdida de **al menos dos tercios (≈66,6%)** de la capacidad de trabajo por debilitamiento de fuerzas físicas o intelectuales.
- **Incapacidad permanente parcial**: pérdida **igual o superior al 30% pero inferior a dos tercios**.
- La naturaleza y grado los determina el **médico tratante**; si la compañía discrepa vía su propio médico, resuelve la **COMPIN** (Comisión de Medicina Preventiva e Invalidez) del domicilio del asegurado; la compañía debe pagar lo no disputado.

### Beneficiarios en caso de muerte y orden de prelación (art. 31)
1. Cónyuge sobreviviente; 2. Hijos menores de edad; 3. Hijos mayores de edad; 4. Padres; 5. La madre de los hijos de filiación no matrimonial del fallecido; 6. A falta de los anteriores, quien acredite calidad de heredero (posesión efectiva). El **conviviente civil** sólo cobra como heredero, si no existe ninguno de los cuatro primeros beneficiarios.

### Plazos legales (Ley 18.490 y DS 1.055/2012)
- **Aviso del accidente** a la aseguradora: **30 días** desde que se tuvo noticia (art. 8), salvo impedimento justificado.
- **Prescripción**: **1 año** desde el accidente o la muerte (art. 13). En incapacidad permanente el certificado médico no puede presentarse después de **2 años** del accidente (condición de póliza CMF, no del texto legal).
- **Pago de la indemnización**: **10 días** desde presentados los antecedentes (art. 30); **reducido a 7 días hábiles en caso de muerte** para pólizas contratadas desde el 9 de febrero de 2026 (la CMF describe la reducción como "desde 10 a 7 días hábiles el pago de indemnizaciones en caso de fallecimiento").
- **Plazo de liquidación** (DS 1.055, art. 23): el liquidador debe emitir su informe en el plazo más breve, **no pudiendo exceder 45 días corridos** contados desde la fecha del denuncio, **prorrogable por igual período** por motivos fundados con gestiones concretas comunicadas al asegurado y a la CMF. Excepciones: 90 días corridos para seguros del primer grupo con prima anual > 100 UF; 180 días para marítimos de cascos/avería gruesa. No procede prórroga por antecedentes previsibles ni en siniestros sin gestión del liquidador. En SOAP la liquidación no puede dilatar el pago más allá del plazo del art. 30.
- **Impugnación del informe** (DS 1.055, arts. 25-26): **10 días** para impugnar; **6 días** del liquidador para responder; **5 días** de la aseguradora; **pago dentro de 6 días** desde la resolución de procedencia.
- **Liquidación directa vs. liquidador registrado** (arts. 20-21): la aseguradora comunica su decisión al asegurado **dentro de 3 días hábiles** desde la denuncia; el asegurado puede oponerse a la liquidación directa **dentro de 5 días hábiles**, tras lo cual la compañía designa liquidador **en 2 días hábiles**.

### Exclusiones (art. 34) y pago directo a prestadores (arts. 32-33)
- **Exclusiones**: carreras/competencias de vehículos motorizados; hechos fuera del territorio nacional; guerra, sismos y otros casos fortuitos ajenos a la circulación del vehículo; suicidio y lesiones autoinferidas.
- El **propietario de un vehículo sin SOAP** no tiene derecho a las coberturas; el asegurador tiene **derecho de repetición** contra el tomador o el propietario sin seguro vigente (arts. 11 y 16), y contra el conductor por dolo o infracción gravísima causa del accidente.
- **Pago directo**: los gastos médicos pueden pagarse **directamente al Servicio de Salud o entidad hospitalaria/previsional** que acredite haber prestado el servicio, **con preferencia** sobre cualquier otro seguro o previsión (art. 32). El SOAP se paga **con preferencia frente a Fonasa/Isapre** y frente a la **Ley 16.744** de accidentes del trabajo, que concurre sólo por la parte no cubierta (art. 33).

### SOAPEX
Vehículos con matrícula extranjera que ingresan temporalmente no contratan SOAP sino **SOAPEX** (base en art. 1 Ley 18.490, art. 60 Ley 18.290 y DS 151/2011), con coberturas equivalentes ya actualizadas a los nuevos topes (póliza CMF POL320260029; la póliza SOAP nueva es POL320260028). El sistema debe modelarlo como una **variante de producto**.

## Details — Especificación técnica del sistema

### 1. Objetivos
Construir una plataforma web interna para una compañía liquidadora que digitalice el ciclo completo de liquidación de siniestros: recepción del denuncio, asignación, recopilación de antecedentes vía checklist dinámico, auto-análisis asistido por IA, análisis de cobertura, cálculo de indemnización en UF, generación del informe de liquidación y del finiquito, y control de los plazos legales con alertas. El MVP cubre SOAP; el diseño debe permitir agregar otros ramos **sin reescribir el núcleo, sólo agregando definiciones de reglas**.

### 2. Alcance del MVP (SOAP)
Incluye: gestión de casos SOAP con las cuatro coberturas; checklist configurable por cobertura; carga de PDF/imágenes; OCR+extracción con Claude; validaciones cruzadas (RUT, patente, fechas, nombres, beneficiarios); cálculo de montos en UF con valor UF del día; control de plazos (45 días liquidación, 10/7 días pago, prescripción 1 año); generación de informe de liquidación y finiquito en PDF; roles liquidador/supervisor/administrativo; bitácora de auditoría. **Excluye del MVP**: integración directa con sistemas de aseguradoras, firma electrónica avanzada (fase posterior) y pago efectivo (sólo se genera la orden de pago/finiquito).

### 3. Arquitectura
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.
- **Backend/BaaS**: Supabase (Postgres, Auth, Storage con buckets privados, Row-Level Security).
- **Motor de reglas**: definiciones JSON versionadas por tipo de seguro/cobertura, validadas con **JSON Schema**; interpretadas en runtime para generar el checklist y las validaciones.
- **IA**: API de Claude con **salida estructurada** (JSON Schema / strict tool use) para extracción documental y análisis; OCR de respaldo (Tesseract/OCRmyPDF) para documentos escaneados de baja calidad. Nota técnica: para PDFs de texto conviene extraer texto primero (pdfplumber/pypdf) y enviar texto plano; para escaneos y formularios manuscritos, usar el modo documento/visión de Claude.
- **Integración UF**: consumo diario de la API pública **mindicador.cl** (espejo del Banco Central) con almacenamiento histórico local de valores UF (`GET https://mindicador.cl/api/uf`).
- **PDFs**: generación de informe/finiquito con @react-pdf/renderer o similar.
- **Despliegue**: Vercel (frontend) + Supabase gestionado, considerando residencia y protección de datos sensibles (evaluar autohospedaje de Supabase para datos de salud).

### 4. Motor de reglas y checklist dinámico
Cada producto de seguro se describe con un archivo de reglas JSON que define coberturas, requisitos documentales (obligatorios/opcionales), campos a extraer, validaciones cruzadas, fórmulas de cálculo y plazos. El sistema genera el checklist a partir de este archivo. El frontend construye el formulario de carga desde la configuración: un requisito nuevo aparece sin tocar código. Ejemplo para SOAP:

```json
{
  "producto": "SOAP",
  "ley": "18.490",
  "version_reglas": "2026.1",
  "regimenes_cobertura": [
    {
      "id": "post_ley_jacinta",
      "vigente_desde": "2026-02-09",
      "topes_uf": { "muerte": 600, "ipt": 600, "ipp_max": 400, "gastos_medicos": 600 },
      "pago_dias_muerte": 7
    },
    {
      "id": "pre_ley_jacinta",
      "vigente_hasta": "2026-02-08",
      "topes_uf": { "muerte": 300, "ipt": 300, "ipp_max": 200, "gastos_medicos": 300 },
      "pago_dias_muerte": 10
    }
  ],
  "plazos": {
    "aviso_dias": 30,
    "liquidacion_dias_corridos": 45,
    "pago_dias": 10,
    "prescripcion_meses": 12,
    "impugnacion_dias": 10,
    "comunicacion_tipo_liquidacion_dias_habiles": 3,
    "oposicion_liquidacion_directa_dias_habiles": 5
  },
  "coberturas": [
    {
      "id": "muerte",
      "nombre": "Fallecimiento accidental",
      "tope_uf_ref": "muerte",
      "documentos": [
        { "id": "cert_accidente", "nombre": "Certificado de accidente (Carabineros/Fiscalía/JPL)", "obligatorio": true },
        { "id": "parte_policial", "nombre": "Copia parte policial completo (relato)", "obligatorio": true },
        { "id": "cert_defuncion", "nombre": "Certificado de defunción", "obligatorio": true },
        { "id": "acredita_beneficiario", "nombre": "Documento que acredita beneficiario (matrimonio/nacimiento/posesión efectiva)", "obligatorio": true },
        { "id": "cedula_beneficiario", "nombre": "Cédula de identidad del beneficiario", "obligatorio": true },
        { "id": "certificado_soap", "nombre": "Copia del certificado SOAP", "obligatorio": false },
        { "id": "cert_autopsia", "nombre": "Certificado de autopsia", "obligatorio": false }
      ],
      "reglas_calculo": { "tipo": "monto_fijo", "deducir_gastos_medicos": true }
    },
    {
      "id": "ipt",
      "nombre": "Incapacidad permanente total",
      "tope_uf_ref": "ipt",
      "documentos": [
        { "id": "cert_accidente", "obligatorio": true },
        { "id": "cert_medico_incapacidad", "nombre": "Certificado médico de naturaleza y grado (>66%)", "obligatorio": true },
        { "id": "epicrisis", "nombre": "Epicrisis/informe médico tratante", "obligatorio": false },
        { "id": "cert_compin", "nombre": "Resolución COMPIN (si hay discrepancia)", "obligatorio": false },
        { "id": "cedula_victima", "obligatorio": true }
      ],
      "reglas_calculo": { "tipo": "monto_fijo", "deducir_gastos_medicos": false }
    },
    {
      "id": "ipp",
      "nombre": "Incapacidad permanente parcial",
      "tope_uf_ref": "ipp_max",
      "documentos": [
        { "id": "cert_accidente", "obligatorio": true },
        { "id": "cert_medico_incapacidad", "nombre": "Certificado médico con grado 30%-66%", "obligatorio": true },
        { "id": "cedula_victima", "obligatorio": true }
      ],
      "reglas_calculo": { "tipo": "proporcional_grado", "cap_con_gastos_medicos": true }
    },
    {
      "id": "gastos_medicos",
      "nombre": "Gastos médicos, hospitalarios y farmacéuticos",
      "tope_uf_ref": "gastos_medicos",
      "documentos": [
        { "id": "cert_accidente", "obligatorio": true },
        { "id": "boletas_facturas", "nombre": "Boletas/facturas/bonos originales a nombre de la víctima", "obligatorio": true },
        { "id": "ordenes_recetas", "nombre": "Órdenes de exámenes y recetas", "obligatorio": false },
        { "id": "cedula_victima", "obligatorio": true }
      ],
      "reglas_calculo": { "tipo": "suma_comprobantes", "tope_uf_ref": "gastos_medicos" }
    }
  ],
  "exclusiones": ["carreras", "fuera_territorio", "guerra_sismo_caso_fortuito", "suicidio", "lesion_autoinferida", "vehiculo_sin_soap_propietario"],
  "validaciones_cruzadas": ["rut_valido", "patente_coincide", "fecha_accidente_dentro_vigencia", "fecha_dentro_prescripcion", "nombre_victima_consistente", "beneficiario_orden_prelacion", "boletas_a_nombre_victima"]
}
```

### 5. Auto-análisis con IA
Pipeline por documento: subida → almacenamiento en bucket privado → hash SHA256 → conversión/normalización → **extracción con Claude** (salida estructurada según JSON Schema por tipo de documento, con valor + nivel de confianza + evidencia de página) → **validaciones cruzadas** → asignación de estado al requisito → **resumen del caso y recomendación**. Toda recomendación es **asistida y requiere revisión humana**; la cobertura, liquidación y pago quedan bajo decisión del liquidador (patrón alineado con la práctica del mercado: la IA agiliza el análisis preliminar, prioriza casos y detecta patrones, mientras cobertura/liquidación/pago permanecen bajo supervisión profesional).

**Validaciones cruzadas mínimas**: dígito verificador de RUT; coincidencia de patente entre certificado SOAP, parte policial y denuncia; fecha del accidente dentro de la vigencia de la póliza y dentro del plazo de prescripción (1 año); consistencia de nombres entre documentos; verificación del orden de prelación de beneficiarios; boletas emitidas a nombre de la víctima; suma de comprobantes vs. tope de cobertura.

**Banderas rojas de fraude** a señalar (no bloqueantes, para revisión humana): denuncio tardío no justificado, inconsistencias de fechas/montos entre documentos, boletas no emitidas a nombre de la víctima, patente que no coincide, múltiples siniestros vinculados, alteración aparente de documentos, contratación de la póliza muy próxima al accidente. La existencia de una bandera roja no implica fraude: indica que el caso requiere atención adicional.

**Ejemplo de prompt de extracción (system):**
"Eres un asistente de un liquidador de seguros en Chile. Extrae del documento los campos solicitados en el esquema. No inventes datos: si un campo no aparece, devuélvelo como null y baja el nivel de confianza. Devuelve para cada campo el valor, el nivel de confianza (0-1) y la ubicación/evidencia (página). No emitas juicios de cobertura; sólo extrae datos."

**Ejemplo de prompt de análisis de caso (system):**
"Con los datos extraídos y las reglas del producto SOAP, genera: (1) checklist de requisitos con estado; (2) inconsistencias detectadas; (3) posibles banderas rojas de fraude; (4) cálculo de indemnización propuesto en UF y su conversión a pesos con el valor UF indicado, aplicando reglas de acumulación/deducción del art. 26; (5) un resumen ejecutivo del caso. Marca todo como propuesta sujeta a revisión humana."

Recomendación de implementación: usar `output_format: json_schema` (Structured Outputs, beta desde nov-2025) o `strict tool use` para garantizar respuestas conformes al esquema y evitar parsing frágil.

### 6. Modelo de datos (entidades principales)
- `usuarios` (perfil vinculado a Supabase Auth): id, nombre, rol (liquidador/supervisor/administrativo), activo.
- `productos_seguro`: id, nombre, ley, activo.
- `reglas_producto`: id, producto_id, version, json_reglas, vigente_desde, vigente_hasta.
- `casos_siniestro`: id, numero, producto_id, regimen_cobertura, estado, fecha_accidente, fecha_denuncio, fecha_aviso, patente, poliza_numero, poliza_fecha_contratacion, liquidador_id, supervisor_id, tipo_liquidacion (directa/registrada), created_at.
- `personas`: id, caso_id, rol (victima/beneficiario/conductor/propietario), nombre, rut, parentesco, orden_prelacion.
- `coberturas_caso`: id, caso_id, cobertura (muerte/ipt/ipp/gastos_medicos), estado, monto_uf_propuesto, monto_uf_aprobado, grado_incapacidad, valor_uf_referencia, fecha_calculo.
- `requisitos_caso`: id, caso_id, cobertura, documento_id, obligatorio, estado (pendiente/recibido/validado/rechazado), motivo_rechazo.
- `documentos`: id, caso_id, requisito_id, tipo, storage_path, hash_sha256, mime, subido_por, subido_at.
- `extracciones`: id, documento_id, json_datos, confianza, modelo, created_at.
- `analisis_caso`: id, caso_id, json_inconsistencias, json_banderas_rojas, resumen, recomendacion_uf, revisado_por, created_at.
- `plazos_caso`: id, caso_id, tipo_plazo, fecha_inicio, fecha_limite, estado, prorroga.
- `informes`: id, caso_id, tipo (preinforme/informe_liquidacion/finiquito), pdf_path, emitido_por, emitido_at, estado.
- `valores_uf`: fecha (PK), valor.
- `auditoria`: id, usuario_id, entidad, entidad_id, accion, payload, created_at.

### 7. Roles y seguridad
- **Liquidador**: gestiona sus casos, sube documentos, revisa análisis IA, propone montos, redacta informe.
- **Supervisor**: revisa/aprueba informes y finiquitos, reasigna casos, ve todos los casos, gestiona prórrogas.
- **Administrativo**: recepción de denuncios, carga inicial de documentos, gestión de datos de contacto.
- **RLS en Postgres** para aislar el acceso por rol y por asignación de caso (patrón recomendado: RLS como piso de seguridad + lógica de aplicación para reglas de negocio complejas). El `service_role` sólo se usa en el backend y nunca llega al navegador. Buckets de Storage privados con **URLs firmadas de corta duración**. Tests de integración que prueben que las políticas RLS bloquean lecturas entre roles.

### 8. Cumplimiento de datos personales (Ley 19.628 / Ley 21.719)
Los datos de salud (epicrisis, certificados médicos, grados de incapacidad) son **datos sensibles** bajo la Ley 21.719, que moderniza la Ley 19.628, fue publicada el 13 de diciembre de 2024 y entra en **plena vigencia el 1 de diciembre de 2026**, creando la **Agencia de Protección de Datos Personales (APDP)** con facultades sancionatorias. El régimen de sanciones contempla multas de **hasta 20.000 UTM** para infracciones gravísimas (del orden de $1.430 millones CLP), con reincidencia de hasta el 4% de los ingresos anuales. El sistema debe: cifrar datos en tránsito y en reposo; minimizar datos; registrar la base de licitud/consentimiento; llevar registro de actividades de tratamiento; controlar accesos y auditoría; permitir el ejercicio de derechos de titulares (acceso, rectificación, cancelación, portabilidad); definir políticas de retención; y notificar brechas. El uso de la API de Claude debe hacerse por **canal empresarial con acuerdo de no uso de datos para entrenamiento** (retención cero cuando sea posible); no usar interfaces de consumo (chat público) para documentos confidenciales.

### 9. Pantallas / flujos
- **Bandeja de casos** (filtros por estado, plazo, liquidador, alertas de vencimiento).
- **Detalle de caso**: datos del siniestro, personas, checklist por cobertura, visor de documentos, panel de análisis IA, cálculo de montos en UF, línea de tiempo de plazos.
- **Carga de documentos** con formulario dinámico generado desde las reglas.
- **Editor/vista del informe de liquidación y finiquito** con previsualización PDF.
- **Panel de administración de reglas** (subir/versionar JSON, validar contra JSON Schema).
- **Tablero de plazos y alertas** (45 días liquidación, 10/7 días pago, prescripción 1 año).

**Flujo de trabajo del liquidador (mapeado a la ley):** recepción del denuncio → registro del caso y determinación del tipo de liquidación (comunicación en 3 días hábiles; oposición del asegurado en 5 días hábiles) → generación del checklist según cobertura y régimen (pre/post Ley Jacinta según fecha de contratación) → recopilación de antecedentes → extracción y validación IA → análisis de cobertura (exclusiones art. 34, prescripción art. 13, régimen de cobertura) → cálculo de indemnización en UF (reglas art. 26) → preinforme (observaciones 5 días) → **informe de liquidación (≤45 días corridos)** → impugnación (10 días; respuesta liquidador 6 días; aseguradora 5 días) → **finiquito y orden de pago (10 días general / 7 días hábiles muerte)**.

## Recommendations (plan de fases y criterios de aceptación)

### Fase 0 — Fundaciones (semana 1-2)
Setup Next.js + Supabase, Auth y roles, RLS base, esquema de datos, bucket privado, integración UF diaria (mindicador.cl) con job programado y tabla `valores_uf`.
**Criterio de aceptación**: un usuario autenticado con rol ve sólo lo permitido (probado con tests de RLS); el valor UF del día se almacena y consulta.

### Fase 1 — Motor de reglas + checklist SOAP (semana 3-4)
Cargar reglas SOAP JSON, validación con JSON Schema, generación del checklist dinámico por cobertura, estados de requisito.
**Criterio de aceptación**: crear un caso SOAP genera el checklist correcto según la cobertura y el régimen (pre/post Ley Jacinta) determinado por la fecha de contratación de la póliza.

### Fase 2 — Documentos + extracción IA (semana 5-7)
Carga PDF/imagen, hash, visor, extracción con Claude (salida estructurada), OCR de respaldo, validaciones cruzadas (RUT, patente, fechas, nombres), estados automáticos de requisitos.
**Criterio de aceptación**: al subir un parte policial y un certificado de defunción, el sistema extrae los campos, valida RUT/patente/fechas y marca requisitos como recibido/validado, con nivel de confianza y evidencia.

### Fase 3 — Análisis, cálculo y plazos (semana 8-9)
Análisis de cobertura y exclusiones, banderas rojas, cálculo de indemnización en UF con reglas de acumulación/deducción (art. 26), control de plazos con alertas.
**Criterio de aceptación**: para un caso de muerte con gastos médicos, el sistema propone el monto correcto en UF (con deducción de gastos médicos), lo convierte a pesos con la UF del día y alerta a 45/10/7 días.

### Fase 4 — Informe y finiquito (semana 10-11)
Generación de preinforme, informe de liquidación y finiquito en PDF, flujo de aprobación supervisor, bitácora de auditoría.
**Criterio de aceptación**: el supervisor aprueba y el sistema emite el finiquito PDF con los montos y la trazabilidad completa (quién, cuándo, con qué valor UF).

### Fase 5 — Extensibilidad (semana 12+)
Agregar un segundo producto (ej. desgravamen o vida) sólo con un nuevo archivo de reglas JSON, sin cambios en el núcleo.
**Criterio de aceptación**: alta de un nuevo producto por configuración, generando su checklist propio y sus validaciones.

**Umbrales que cambian las decisiones**: si la precisión de extracción IA cae por debajo de un nivel aceptable en documentos escaneados, priorizar OCR dedicado antes del LLM; si el volumen de casos supera la capacidad de revisión, introducir auto-aprobación **sólo** para gastos médicos de bajo monto bajo umbral definido, manteniendo revisión humana obligatoria en muerte e incapacidad.

## Caveats
- **Régimen de cobertura por póliza**: durante 2026-2027 coexisten los regímenes de 300 y 600 UF; el sistema debe determinar el tope aplicable **por la fecha de contratación de la póliza, no por la fecha del siniestro**. La CMF fija la vigencia de los nuevos montos en el **9 de febrero de 2026**.
- **Plazo de pago en muerte (7 días)**: aplica sólo a pólizas contratadas desde el 9 de febrero de 2026. El texto legal del art. 30 dice "siete días" mientras la CMF los describe como **días hábiles**; parametrizar y confirmar con la compañía el cómputo exacto.
- **Numeración de artículos**: verificada contra el texto de la Ley 18.490 (coberturas art. 25; deducción/acumulación art. 26; incapacidad art. 27; certificación art. 28; pago art. 30; beneficiarios art. 31; pago directo/preferencia arts. 32-33; exclusiones art. 34; prescripción art. 13; aviso art. 8; repetición arts. 11 y 16). La Ley 21.797 sólo modificó los arts. 25 y 30.
- **Liquidación directa vs. registrada**: el usuario del sistema es la compañía liquidadora, por lo que el flujo por defecto es el de **liquidador registrado**; los plazos de impugnación difieren levemente en liquidación directa (sólo el asegurado impugna).
- **Protección de datos**: la Ley 21.719 entra en plena vigencia el 1 de diciembre de 2026; el diseño debe ser conforme desde el inicio por tratar datos de salud (sensibles). El uso de LLM sobre estos documentos exige canal empresarial con no retención, y la recomendación de IA es siempre asistida, sin sustituir la decisión del liquidador.
- **Valor UF**: obtener siempre de fuente oficial (Banco Central) o su espejo (mindicador.cl) y **registrar el valor usado en cada cálculo** para trazabilidad y defensa ante impugnaciones.
- **Fuentes secundarias**: los detalles operativos de documentos por cobertura provienen en parte de sitios de aseguradoras (Mapfre, BCI, Zurich, Santander, Sura) y deben validarse contra la práctica interna de la compañía liquidadora, ya que pueden variar entre aseguradoras aunque la póliza SOAP sea única (elaborada por la CMF).