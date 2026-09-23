-- ============================================================
-- SINIESTROS — Finiquitización de siniestros (piloto SOAP, Ley 18.490)
-- Módulo independiente del marketplace de remates. Ver docs/siniestros/.
--
-- Seguridad: RLS es el piso de seguridad; las reglas de negocio complejas
-- viven en la aplicación. El service_role sólo se usa en el backend.
-- Datos de salud = datos sensibles (Ley 19.628 / Ley 21.719).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USUARIOS DEL MÓDULO ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  email       TEXT,
  rol         TEXT NOT NULL CHECK (rol IN ('liquidador', 'supervisor', 'administrativo')),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PRODUCTOS Y REGLAS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.productos_seguro (
  id      TEXT PRIMARY KEY,               -- 'SOAP', 'DESGRAVAMEN', ...
  nombre  TEXT NOT NULL,
  ley     TEXT,
  activo  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.productos_seguro (id, nombre, ley) VALUES
  ('SOAP', 'Seguro Obligatorio de Accidentes Personales', '18.490'),
  ('DESGRAVAMEN', 'Seguro de Desgravamen', NULL)
ON CONFLICT (id) DO NOTHING;
UPDATE public.productos_seguro SET activo = FALSE WHERE id = 'DESGRAVAMEN';

-- Versiones publicadas de reglas. Si no hay filas para un producto, la app
-- usa las reglas incluidas en lib/siniestros/reglas/*.json.
CREATE TABLE IF NOT EXISTS public.reglas_producto (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id    TEXT NOT NULL REFERENCES public.productos_seguro(id),
  version        TEXT NOT NULL,
  json_reglas    JSONB NOT NULL,
  vigente_desde  DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta  DATE,
  publicado_por  UUID REFERENCES public.usuarios(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (producto_id, version)
);

-- ─── CASOS ─────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.casos_siniestro_numero_seq;

CREATE TABLE IF NOT EXISTS public.casos_siniestro (
  id                                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                               TEXT UNIQUE,
  producto_id                          TEXT NOT NULL REFERENCES public.productos_seguro(id),
  variante                             TEXT,                       -- SOAP / SOAPEX
  reglas_version                       TEXT NOT NULL,
  regimen_cobertura                    TEXT NOT NULL,              -- pre_ley_jacinta / post_ley_jacinta
  coberturas                           TEXT[] NOT NULL CHECK (cardinality(coberturas) > 0),
  estado                               TEXT NOT NULL DEFAULT 'recepcion' CHECK (estado IN (
                                         'recepcion', 'en_analisis', 'preinforme', 'informe_emitido',
                                         'impugnado', 'finiquito', 'pagado', 'rechazado', 'cerrado')),
  fecha_accidente                      DATE NOT NULL,
  fecha_fallecimiento                  DATE,
  fecha_denuncio                       DATE NOT NULL,
  fecha_aviso                          DATE,
  lugar_accidente                      TEXT,
  relato                               TEXT,
  patente                              TEXT,
  poliza_numero                        TEXT,
  poliza_fecha_contratacion            DATE NOT NULL,
  poliza_vigencia_desde                DATE,
  poliza_vigencia_hasta                DATE,
  tipo_liquidacion                     TEXT NOT NULL DEFAULT 'registrada' CHECK (tipo_liquidacion IN ('directa', 'registrada')),
  fecha_comunicacion_tipo_liquidacion  DATE,
  prorroga_liquidacion                 BOOLEAN NOT NULL DEFAULT FALSE,
  prorroga_fundamento                  TEXT,
  fecha_antecedentes_completos         DATE,
  fecha_certificado_incapacidad        DATE,
  fecha_informe_liquidacion            DATE,
  fecha_impugnacion                    DATE,
  fecha_pago                           DATE,
  exclusion_confirmada                 TEXT,
  liquidador_id                        UUID REFERENCES public.usuarios(id),
  supervisor_id                        UUID REFERENCES public.usuarios(id),
  creado_por                           UUID REFERENCES public.usuarios(id) DEFAULT auth.uid(),
  created_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (prorroga_liquidacion = FALSE OR prorroga_fundamento IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS casos_siniestro_liquidador_idx ON public.casos_siniestro (liquidador_id);
CREATE INDEX IF NOT EXISTS casos_siniestro_estado_idx ON public.casos_siniestro (estado);
CREATE INDEX IF NOT EXISTS casos_siniestro_patente_idx ON public.casos_siniestro (patente);

CREATE OR REPLACE FUNCTION public.casos_siniestro_antes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.numero IS NULL THEN
    NEW.numero := NEW.producto_id || '-' || to_char(NEW.fecha_denuncio, 'YYYY') || '-' ||
                  lpad(nextval('public.casos_siniestro_numero_seq')::TEXT, 6, '0');
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
    -- Sólo un supervisor (o el backend) reasigna casos o concede prórrogas.
    IF auth.uid() IS NOT NULL AND public.siniestros_rol() IS DISTINCT FROM 'supervisor' THEN
      IF NEW.liquidador_id IS DISTINCT FROM OLD.liquidador_id
         OR NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id THEN
        RAISE EXCEPTION 'Sólo un supervisor puede reasignar el caso';
      END IF;
      IF NEW.prorroga_liquidacion IS DISTINCT FROM OLD.prorroga_liquidacion THEN
        RAISE EXCEPTION 'Sólo un supervisor puede gestionar prórrogas';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ─── PERSONAS (víctima, beneficiarios, conductor, propietario) ─
CREATE TABLE IF NOT EXISTS public.personas (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                     UUID NOT NULL REFERENCES public.casos_siniestro(id) ON DELETE CASCADE,
  rol                         TEXT NOT NULL CHECK (rol IN ('victima', 'beneficiario', 'conductor', 'propietario', 'tomador')),
  nombre                      TEXT NOT NULL,
  rut                         TEXT,
  parentesco                  TEXT CHECK (parentesco IN ('conyuge', 'hijo', 'padre', 'madre', 'madre_hijos_no_matrimoniales',
                                                         'conviviente_civil', 'heredero', 'otro')),
  fecha_nacimiento            DATE,
  acredita_posesion_efectiva  BOOLEAN NOT NULL DEFAULT FALSE,
  orden_prelacion             SMALLINT,
  email                       TEXT,
  telefono                    TEXT,
  -- Ley 21.719: base de licitud del tratamiento de sus datos.
  base_licitud                TEXT NOT NULL DEFAULT 'obligacion_legal' CHECK (base_licitud IN ('obligacion_legal', 'consentimiento', 'contrato', 'interes_legitimo')),
  consentimiento_at           TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS personas_caso_idx ON public.personas (caso_id);
CREATE INDEX IF NOT EXISTS personas_rut_idx ON public.personas (rut);

-- ─── COBERTURAS DEL CASO ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coberturas_caso (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id              UUID NOT NULL REFERENCES public.casos_siniestro(id) ON DELETE CASCADE,
  cobertura            TEXT NOT NULL,
  estado               TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'propuesta', 'aprobada', 'rechazada')),
  grado_incapacidad    NUMERIC(5, 4) CHECK (grado_incapacidad IS NULL OR grado_incapacidad BETWEEN 0 AND 1),
  monto_uf_propuesto   NUMERIC(12, 2),
  monto_uf_aprobado    NUMERIC(12, 2),
  valor_uf_referencia  NUMERIC(12, 2),
  fecha_valor_uf       DATE,
  fecha_calculo        TIMESTAMPTZ,
  json_calculo         JSONB,
  aprobado_por         UUID REFERENCES public.usuarios(id),
  aprobado_at          TIMESTAMPTZ,
  UNIQUE (caso_id, cobertura)
);

-- ─── CHECKLIST ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.requisitos_caso (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id         UUID NOT NULL REFERENCES public.casos_siniestro(id) ON DELETE CASCADE,
  documento_id    TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  coberturas      TEXT[] NOT NULL,
  obligatorio     BOOLEAN NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'recibido', 'validado', 'rechazado')),
  motivo_rechazo  TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (caso_id, documento_id)
);

-- ─── DOCUMENTOS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id         UUID NOT NULL REFERENCES public.casos_siniestro(id) ON DELETE CASCADE,
  requisito_id    UUID REFERENCES public.requisitos_caso(id) ON DELETE SET NULL,
  tipo            TEXT NOT NULL,                    -- documento_id del catálogo
  nombre_archivo  TEXT NOT NULL,
  storage_path    TEXT NOT NULL UNIQUE,
  hash_sha256     TEXT NOT NULL CHECK (hash_sha256 ~ '^[0-9a-f]{64}$'),
  mime            TEXT NOT NULL,
  tamano_bytes    BIGINT,
  subido_por      UUID REFERENCES public.usuarios(id) DEFAULT auth.uid(),
  subido_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS documentos_caso_idx ON public.documentos (caso_id);

CREATE TABLE IF NOT EXISTS public.extracciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id  UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  estado        TEXT NOT NULL DEFAULT 'ok' CHECK (estado IN ('ok', 'error')),
  json_datos    JSONB,
  confianza     NUMERIC(3, 2),
  modelo        TEXT,
  error         TEXT,
  revisado_por  UUID REFERENCES public.usuarios(id),
  revisado_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS extracciones_documento_idx ON public.extracciones (documento_id);

-- ─── ANÁLISIS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analisis_caso (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                UUID NOT NULL REFERENCES public.casos_siniestro(id) ON DELETE CASCADE,
  json_validaciones      JSONB NOT NULL DEFAULT '[]',
  json_inconsistencias   JSONB NOT NULL DEFAULT '[]',
  json_banderas_rojas    JSONB NOT NULL DEFAULT '[]',
  json_exclusiones       JSONB NOT NULL DEFAULT '[]',
  json_calculo           JSONB,
  json_ia                JSONB,
  resumen                TEXT,
  recomendacion_uf       NUMERIC(12, 2),
  valor_uf_referencia    NUMERIC(12, 2),
  fecha_valor_uf         DATE,
  modelo                 TEXT,
  estado                 TEXT NOT NULL DEFAULT 'propuesta' CHECK (estado IN ('propuesta', 'revisado')),
  revisado_por           UUID REFERENCES public.usuarios(id),
  revisado_at            TIMESTAMPTZ,
  created_por            UUID REFERENCES public.usuarios(id) DEFAULT auth.uid(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS analisis_caso_idx ON public.analisis_caso (caso_id, created_at DESC);

-- ─── PLAZOS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plazos_caso (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id       UUID NOT NULL REFERENCES public.casos_siniestro(id) ON DELETE CASCADE,
  tipo_plazo    TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  fundamento    TEXT,
  fecha_inicio  DATE NOT NULL,
  fecha_limite  DATE NOT NULL,
  computo       TEXT NOT NULL,
  cumplido_el   DATE,
  estado        TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cumplido', 'cumplido_fuera_plazo')),
  prorroga      BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (caso_id, tipo_plazo)
);
CREATE INDEX IF NOT EXISTS plazos_limite_idx ON public.plazos_caso (fecha_limite) WHERE cumplido_el IS NULL;

-- ─── INFORMES Y FINIQUITOS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.informes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id              UUID NOT NULL REFERENCES public.casos_siniestro(id) ON DELETE CASCADE,
  tipo                 TEXT NOT NULL CHECK (tipo IN ('preinforme', 'informe_liquidacion', 'finiquito')),
  estado               TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'pendiente_aprobacion', 'aprobado', 'emitido', 'anulado')),
  json_contenido       JSONB NOT NULL,
  monto_uf             NUMERIC(12, 2),
  monto_clp            BIGINT,
  valor_uf             NUMERIC(12, 2),
  fecha_valor_uf       DATE,
  pdf_path             TEXT,
  pdf_hash_sha256      TEXT,
  redactado_por        UUID REFERENCES public.usuarios(id) DEFAULT auth.uid(),
  aprobado_por         UUID REFERENCES public.usuarios(id),
  aprobado_at          TIMESTAMPTZ,
  emitido_por          UUID REFERENCES public.usuarios(id),
  emitido_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS informes_caso_idx ON public.informes (caso_id);

CREATE OR REPLACE FUNCTION public.informes_antes()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- backend (service_role)
  IF TG_OP = 'UPDATE' AND OLD.estado IN ('emitido', 'anulado') THEN
    RAISE EXCEPTION 'Un informe emitido o anulado no se modifica; emita uno nuevo';
  END IF;
  IF NEW.estado IN ('aprobado', 'emitido') AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado)
     AND public.siniestros_rol() IS DISTINCT FROM 'supervisor' THEN
    RAISE EXCEPTION 'Sólo un supervisor aprueba o emite informes';
  END IF;
  -- Human-in-the-loop: quien redacta no aprueba su propio informe.
  IF NEW.estado = 'aprobado' AND TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM 'aprobado'
     AND NEW.redactado_por = auth.uid() THEN
    RAISE EXCEPTION 'El redactor no puede aprobar su propio informe';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ─── VALORES UF ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.valores_uf (
  fecha       DATE PRIMARY KEY,
  valor       NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  fuente      TEXT NOT NULL DEFAULT 'mindicador.cl',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── DERECHOS DE TITULARES (Ley 21.719) ────────────────────
CREATE TABLE IF NOT EXISTS public.solicitudes_titulares (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    UUID REFERENCES public.personas(id) ON DELETE SET NULL,
  rut_titular   TEXT NOT NULL,
  derecho       TEXT NOT NULL CHECK (derecho IN ('acceso', 'rectificacion', 'supresion', 'oposicion', 'portabilidad', 'bloqueo')),
  detalle       TEXT,
  estado        TEXT NOT NULL DEFAULT 'recibida' CHECK (estado IN ('recibida', 'en_proceso', 'respondida', 'rechazada')),
  respuesta     TEXT,
  recibida_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondida_at TIMESTAMPTZ,
  gestionada_por UUID REFERENCES public.usuarios(id)
);

-- ─── AUDITORÍA ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auditoria (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  UUID,
  entidad     TEXT NOT NULL,
  entidad_id  TEXT,
  accion      TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auditoria_entidad_idx ON public.auditoria (entidad, entidad_id);

-- ============================================================
-- FUNCIONES DE AUTORIZACIÓN
-- SECURITY DEFINER para evitar recursión de RLS al consultar usuarios/casos.
-- ============================================================
CREATE OR REPLACE FUNCTION public.siniestros_rol()
RETURNS TEXT AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid() AND activo
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.puede_ver_caso(p_caso UUID)
RETURNS BOOLEAN AS $$
  SELECT CASE public.siniestros_rol()
    WHEN 'supervisor' THEN TRUE
    WHEN 'administrativo' THEN EXISTS (SELECT 1 FROM public.casos_siniestro WHERE id = p_caso)
    WHEN 'liquidador' THEN EXISTS (SELECT 1 FROM public.casos_siniestro WHERE id = p_caso AND liquidador_id = auth.uid())
    ELSE FALSE
  END
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Datos de análisis y salud: sólo liquidador asignado y supervisores.
CREATE OR REPLACE FUNCTION public.puede_ver_sensibles(p_caso UUID)
RETURNS BOOLEAN AS $$
  SELECT CASE public.siniestros_rol()
    WHEN 'supervisor' THEN TRUE
    WHEN 'liquidador' THEN EXISTS (SELECT 1 FROM public.casos_siniestro WHERE id = p_caso AND liquidador_id = auth.uid())
    ELSE FALSE
  END
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.puede_editar_caso(p_caso UUID)
RETURNS BOOLEAN AS $$
  SELECT CASE public.siniestros_rol()
    WHEN 'supervisor' THEN TRUE
    WHEN 'liquidador' THEN EXISTS (SELECT 1 FROM public.casos_siniestro WHERE id = p_caso AND liquidador_id = auth.uid())
    WHEN 'administrativo' THEN EXISTS (SELECT 1 FROM public.casos_siniestro WHERE id = p_caso AND estado = 'recepcion')
    ELSE FALSE
  END
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- El administrativo carga antecedentes en cualquier etapa.
CREATE OR REPLACE FUNCTION public.puede_cargar_documentos(p_caso UUID)
RETURNS BOOLEAN AS $$
  SELECT public.puede_editar_caso(p_caso)
      OR (public.siniestros_rol() = 'administrativo'
          AND EXISTS (SELECT 1 FROM public.casos_siniestro WHERE id = p_caso AND estado NOT IN ('cerrado', 'pagado')))
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- storage.objects.name = '<caso_id>/<archivo>'
CREATE OR REPLACE FUNCTION public.caso_de_ruta(p_name TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN split_part(p_name, '/', 1)::UUID;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- ─── TRIGGERS ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS casos_siniestro_antes ON public.casos_siniestro;
CREATE TRIGGER casos_siniestro_antes
  BEFORE INSERT OR UPDATE ON public.casos_siniestro
  FOR EACH ROW EXECUTE FUNCTION public.casos_siniestro_antes();

DROP TRIGGER IF EXISTS informes_antes ON public.informes;
CREATE TRIGGER informes_antes
  BEFORE INSERT OR UPDATE ON public.informes
  FOR EACH ROW EXECUTE FUNCTION public.informes_antes();

CREATE OR REPLACE FUNCTION public.auditar()
RETURNS TRIGGER AS $$
DECLARE
  v_old JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_payload JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Sólo las columnas que cambiaron.
    SELECT jsonb_object_agg(n.key, jsonb_build_object('antes', v_old -> n.key, 'despues', n.value))
      INTO v_payload
      FROM jsonb_each(v_new) n
     WHERE v_old -> n.key IS DISTINCT FROM n.value;
    IF v_payload IS NULL THEN RETURN NEW; END IF;
  ELSE
    v_payload := COALESCE(v_new, v_old);
  END IF;
  INSERT INTO public.auditoria (usuario_id, entidad, entidad_id, accion, payload)
  VALUES (auth.uid(), TG_TABLE_NAME, COALESCE(v_new ->> 'id', v_old ->> 'id', v_new ->> 'fecha'), lower(TG_OP), v_payload);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios', 'reglas_producto', 'casos_siniestro', 'personas', 'coberturas_caso',
                           'requisitos_caso', 'documentos', 'extracciones', 'analisis_caso', 'informes',
                           'solicitudes_titulares']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auditar ON public.%I', t);
    EXECUTE format('CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.auditar()', t);
  END LOOP;
END $$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.usuarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_seguro       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglas_producto        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casos_siniestro        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coberturas_caso        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisitos_caso        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analisis_caso          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plazos_caso            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valores_uf             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_titulares  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria              ENABLE ROW LEVEL SECURITY;

-- Nada de este módulo es público.
REVOKE ALL ON public.usuarios, public.productos_seguro, public.reglas_producto, public.casos_siniestro,
  public.personas, public.coberturas_caso, public.requisitos_caso, public.documentos, public.extracciones,
  public.analisis_caso, public.plazos_caso, public.informes, public.valores_uf, public.solicitudes_titulares,
  public.auditoria FROM anon;
-- La auditoría es append-only incluso para usuarios autenticados.
REVOKE UPDATE, DELETE, TRUNCATE ON public.auditoria FROM authenticated;

-- USUARIOS
CREATE POLICY "usuarios: módulo ve el directorio" ON public.usuarios
  FOR SELECT USING (id = auth.uid() OR public.siniestros_rol() IS NOT NULL);
CREATE POLICY "usuarios: supervisor administra" ON public.usuarios
  FOR ALL USING (public.siniestros_rol() = 'supervisor') WITH CHECK (public.siniestros_rol() = 'supervisor');

-- PRODUCTOS Y REGLAS
CREATE POLICY "productos: lectura módulo" ON public.productos_seguro
  FOR SELECT USING (public.siniestros_rol() IS NOT NULL);
CREATE POLICY "reglas: lectura módulo" ON public.reglas_producto
  FOR SELECT USING (public.siniestros_rol() IS NOT NULL);
CREATE POLICY "reglas: supervisor publica" ON public.reglas_producto
  FOR INSERT WITH CHECK (public.siniestros_rol() = 'supervisor');

-- CASOS
-- Políticas de casos con columnas en línea (no vía puede_ver_caso): una función
-- STABLE no ve la fila recién insertada en INSERT ... RETURNING.
CREATE POLICY "casos: lectura" ON public.casos_siniestro
  FOR SELECT USING (
    public.siniestros_rol() IN ('supervisor', 'administrativo')
    OR (public.siniestros_rol() = 'liquidador' AND liquidador_id = auth.uid())
  );
CREATE POLICY "casos: alta" ON public.casos_siniestro
  FOR INSERT WITH CHECK (
    public.siniestros_rol() IN ('administrativo', 'supervisor')
    OR (public.siniestros_rol() = 'liquidador' AND liquidador_id = auth.uid())
  );
CREATE POLICY "casos: edición" ON public.casos_siniestro
  FOR UPDATE USING (
    public.siniestros_rol() = 'supervisor'
    OR (public.siniestros_rol() = 'liquidador' AND liquidador_id = auth.uid())
    OR (public.siniestros_rol() = 'administrativo' AND estado = 'recepcion')
  ) WITH CHECK (public.siniestros_rol() IN ('supervisor', 'liquidador', 'administrativo'));

-- PERSONAS / REQUISITOS / PLAZOS
CREATE POLICY "personas: lectura" ON public.personas FOR SELECT USING (public.puede_ver_caso(caso_id));
CREATE POLICY "personas: escritura" ON public.personas FOR INSERT WITH CHECK (public.puede_editar_caso(caso_id));
CREATE POLICY "personas: edición" ON public.personas FOR UPDATE USING (public.puede_editar_caso(caso_id));
CREATE POLICY "personas: baja" ON public.personas FOR DELETE USING (public.puede_editar_caso(caso_id));

CREATE POLICY "requisitos: lectura" ON public.requisitos_caso FOR SELECT USING (public.puede_ver_caso(caso_id));
CREATE POLICY "requisitos: alta" ON public.requisitos_caso FOR INSERT WITH CHECK (public.puede_editar_caso(caso_id));
CREATE POLICY "requisitos: edición" ON public.requisitos_caso FOR UPDATE USING (public.puede_cargar_documentos(caso_id));

CREATE POLICY "plazos: lectura" ON public.plazos_caso FOR SELECT USING (public.puede_ver_caso(caso_id));
CREATE POLICY "plazos: alta" ON public.plazos_caso FOR INSERT WITH CHECK (public.puede_editar_caso(caso_id));
CREATE POLICY "plazos: edición" ON public.plazos_caso FOR UPDATE USING (public.puede_editar_caso(caso_id));
CREATE POLICY "plazos: baja" ON public.plazos_caso FOR DELETE USING (public.puede_editar_caso(caso_id));

-- DOCUMENTOS: el administrativo sólo ve lo que él mismo subió (minimización).
CREATE POLICY "documentos: lectura" ON public.documentos FOR SELECT USING (
  public.puede_ver_sensibles(caso_id) OR (public.puede_ver_caso(caso_id) AND subido_por = auth.uid())
);
CREATE POLICY "documentos: carga" ON public.documentos FOR INSERT WITH CHECK (
  public.puede_cargar_documentos(caso_id) AND subido_por = auth.uid()
);

-- DATOS SENSIBLES: extracciones, análisis, coberturas e informes.
CREATE POLICY "extracciones: lectura" ON public.extracciones FOR SELECT USING (
  public.puede_ver_sensibles((SELECT caso_id FROM public.documentos d WHERE d.id = documento_id))
);
CREATE POLICY "extracciones: revisión" ON public.extracciones FOR UPDATE USING (
  public.puede_ver_sensibles((SELECT caso_id FROM public.documentos d WHERE d.id = documento_id))
);

CREATE POLICY "analisis: lectura" ON public.analisis_caso FOR SELECT USING (public.puede_ver_sensibles(caso_id));
CREATE POLICY "analisis: alta" ON public.analisis_caso FOR INSERT WITH CHECK (public.puede_ver_sensibles(caso_id));
CREATE POLICY "analisis: revisión" ON public.analisis_caso FOR UPDATE USING (public.puede_ver_sensibles(caso_id));

CREATE POLICY "coberturas: lectura" ON public.coberturas_caso FOR SELECT USING (public.puede_ver_sensibles(caso_id));
CREATE POLICY "coberturas: alta" ON public.coberturas_caso FOR INSERT WITH CHECK (public.puede_editar_caso(caso_id));
CREATE POLICY "coberturas: edición" ON public.coberturas_caso FOR UPDATE USING (public.puede_ver_sensibles(caso_id));

CREATE POLICY "informes: lectura" ON public.informes FOR SELECT USING (public.puede_ver_sensibles(caso_id));
CREATE POLICY "informes: alta" ON public.informes FOR INSERT WITH CHECK (public.puede_ver_sensibles(caso_id));
CREATE POLICY "informes: edición" ON public.informes FOR UPDATE USING (public.puede_ver_sensibles(caso_id));

-- UF: lectura para el módulo; escritura sólo backend (service_role, sin política).
CREATE POLICY "uf: lectura" ON public.valores_uf FOR SELECT USING (public.siniestros_rol() IS NOT NULL);

-- TITULARES Y AUDITORÍA: sólo supervisores.
CREATE POLICY "titulares: supervisor" ON public.solicitudes_titulares
  FOR ALL USING (public.siniestros_rol() = 'supervisor') WITH CHECK (public.siniestros_rol() = 'supervisor');
CREATE POLICY "auditoria: supervisor lee" ON public.auditoria
  FOR SELECT USING (public.siniestros_rol() = 'supervisor');

-- ============================================================
-- STORAGE: bucket privado; acceso sólo por URLs firmadas de corta duración.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('siniestros-documentos', 'siniestros-documentos', FALSE, 26214400,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = FALSE;

CREATE POLICY "siniestros docs: lectura" ON storage.objects FOR SELECT USING (
  bucket_id = 'siniestros-documentos' AND (
    public.puede_ver_sensibles(public.caso_de_ruta(name))
    OR (public.puede_ver_caso(public.caso_de_ruta(name)) AND owner = auth.uid())
  )
);
CREATE POLICY "siniestros docs: carga" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'siniestros-documentos' AND public.puede_cargar_documentos(public.caso_de_ruta(name))
);
-- Sin UPDATE/DELETE: los antecedentes son inmutables (el hash se guarda en documentos).
