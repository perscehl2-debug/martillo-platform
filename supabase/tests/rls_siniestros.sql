-- Pruebas de RLS del módulo de siniestros (criterio de aceptación Fase 0:
-- cada rol ve sólo lo permitido). Se ejecuta con run-rls-tests.sh.

-- ─── Utilidades ────────────────────────────────────────────
CREATE SCHEMA pruebas;
GRANT USAGE ON SCHEMA pruebas TO anon, authenticated;

CREATE FUNCTION pruebas.igual(actual ANYELEMENT, esperado ANYELEMENT, msg TEXT) RETURNS VOID AS $$
BEGIN
  IF actual IS DISTINCT FROM esperado THEN
    RAISE EXCEPTION 'FALLA: % (obtenido %, esperado %)', msg, actual, esperado;
  END IF;
  RAISE NOTICE 'ok: %', msg;
END $$ LANGUAGE plpgsql;

-- Ejecuta SQL y exige que falle.
CREATE FUNCTION pruebas.falla(sql TEXT, msg TEXT) RETURNS VOID AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % (%)', msg, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'FALLA: % (la sentencia no falló)', msg;
END $$ LANGUAGE plpgsql;

-- Filas afectadas por un UPDATE/DELETE (0 si RLS lo oculta).
CREATE FUNCTION pruebas.filas(sql TEXT) RETURNS INT AS $$
DECLARE n INT;
BEGIN
  EXECUTE sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$ LANGUAGE plpgsql;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pruebas TO anon, authenticated;

CREATE FUNCTION pruebas.como(uid TEXT) RETURNS VOID AS $$
  SELECT set_config('request.jwt.claim.sub', uid, FALSE)
$$ LANGUAGE sql;
GRANT EXECUTE ON FUNCTION pruebas.como(TEXT) TO anon, authenticated;

-- ─── Datos (como superusuario = backend) ───────────────────
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'sup@x.cl'),
  ('00000000-0000-0000-0000-00000000000b', 'liq1@x.cl'),
  ('00000000-0000-0000-0000-00000000000c', 'liq2@x.cl'),
  ('00000000-0000-0000-0000-00000000000d', 'adm@x.cl'),
  ('00000000-0000-0000-0000-00000000000e', 'externo@x.cl'),
  ('00000000-0000-0000-0000-00000000000f', 'sup2@x.cl');

INSERT INTO public.usuarios (id, nombre, rol) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Supervisora', 'supervisor'),
  ('00000000-0000-0000-0000-00000000000b', 'Liquidador Uno', 'liquidador'),
  ('00000000-0000-0000-0000-00000000000c', 'Liquidadora Dos', 'liquidador'),
  ('00000000-0000-0000-0000-00000000000d', 'Administrativo', 'administrativo'),
  ('00000000-0000-0000-0000-00000000000f', 'Supervisor Dos', 'supervisor');

INSERT INTO public.casos_siniestro (id, producto_id, reglas_version, regimen_cobertura, coberturas, fecha_accidente,
                                    fecha_denuncio, poliza_fecha_contratacion, liquidador_id, estado) VALUES
  ('10000000-0000-0000-0000-000000000001', 'SOAP', '2026.1', 'post_ley_jacinta', ARRAY['muerte'], '2026-08-01', '2026-08-05', '2026-03-01', '00000000-0000-0000-0000-00000000000b', 'en_analisis'),
  ('10000000-0000-0000-0000-000000000002', 'SOAP', '2026.1', 'pre_ley_jacinta', ARRAY['gastos_medicos'], '2026-07-01', '2026-07-03', '2025-10-01', '00000000-0000-0000-0000-00000000000c', 'en_analisis');

INSERT INTO public.personas (caso_id, rol, nombre, rut) VALUES
  ('10000000-0000-0000-0000-000000000001', 'victima', 'Víctima A', '12345678-5'),
  ('10000000-0000-0000-0000-000000000002', 'victima', 'Víctima B', '11111111-1');

INSERT INTO public.documentos (id, caso_id, tipo, nombre_archivo, storage_path, hash_sha256, mime, subido_por) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'cert_defuncion', 'def.pdf',
   '10000000-0000-0000-0000-000000000001/def.pdf', repeat('a', 64), 'application/pdf', '00000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'cert_accidente', 'acc.pdf',
   '10000000-0000-0000-0000-000000000001/acc.pdf', repeat('b', 64), 'application/pdf', '00000000-0000-0000-0000-00000000000d'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'boletas_facturas', 'bol.pdf',
   '10000000-0000-0000-0000-000000000002/bol.pdf', repeat('c', 64), 'application/pdf', '00000000-0000-0000-0000-00000000000c');

INSERT INTO public.extracciones (documento_id, json_datos, confianza, modelo) VALUES
  ('20000000-0000-0000-0000-000000000001', '{"campos":{}}', 0.9, 'test'),
  ('20000000-0000-0000-0000-000000000003', '{"campos":{}}', 0.8, 'test');

INSERT INTO public.analisis_caso (caso_id, resumen) VALUES
  ('10000000-0000-0000-0000-000000000001', 'resumen A'),
  ('10000000-0000-0000-0000-000000000002', 'resumen B');

INSERT INTO public.informes (id, caso_id, tipo, json_contenido, redactado_por) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'informe_liquidacion', '{}', '00000000-0000-0000-0000-00000000000b');

INSERT INTO public.valores_uf (fecha, valor) VALUES ('2026-09-22', 40991.00);

INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('siniestros-documentos', '10000000-0000-0000-0000-000000000001/def.pdf', '00000000-0000-0000-0000-00000000000b'),
  ('siniestros-documentos', '10000000-0000-0000-0000-000000000001/acc.pdf', '00000000-0000-0000-0000-00000000000d'),
  ('siniestros-documentos', '10000000-0000-0000-0000-000000000002/bol.pdf', '00000000-0000-0000-0000-00000000000c');

-- ─── Liquidador 1: sólo su caso ────────────────────────────
SET ROLE authenticated;
SELECT pruebas.como('00000000-0000-0000-0000-00000000000b');
SELECT pruebas.igual((SELECT count(*) FROM public.casos_siniestro), 1::BIGINT, 'liquidador ve sólo su caso');
SELECT pruebas.igual((SELECT count(*) FROM public.casos_siniestro WHERE id = '10000000-0000-0000-0000-000000000002'), 0::BIGINT, 'liquidador no ve caso ajeno');
SELECT pruebas.igual((SELECT count(*) FROM public.personas), 1::BIGINT, 'liquidador ve sólo personas de su caso');
SELECT pruebas.igual((SELECT count(*) FROM public.documentos), 2::BIGINT, 'liquidador ve todos los documentos de su caso');
SELECT pruebas.igual((SELECT count(*) FROM public.extracciones), 1::BIGINT, 'liquidador ve extracciones de su caso');
SELECT pruebas.igual((SELECT count(*) FROM public.analisis_caso), 1::BIGINT, 'liquidador ve análisis de su caso');
SELECT pruebas.igual((SELECT count(*) FROM storage.objects), 2::BIGINT, 'liquidador ve archivos de su caso en storage');
SELECT pruebas.igual((SELECT count(*) FROM public.auditoria), 0::BIGINT, 'liquidador no lee la auditoría');
SELECT pruebas.igual((SELECT count(*) FROM public.valores_uf), 1::BIGINT, 'liquidador lee valores UF');
SELECT pruebas.igual(pruebas.filas($$UPDATE public.casos_siniestro SET relato = 'x' WHERE id = '10000000-0000-0000-0000-000000000002'$$), 0, 'liquidador no edita caso ajeno');
SELECT pruebas.igual(pruebas.filas($$UPDATE public.casos_siniestro SET relato = 'editado' WHERE id = '10000000-0000-0000-0000-000000000001'$$), 1, 'liquidador edita su caso');
SELECT pruebas.falla($$UPDATE public.casos_siniestro SET liquidador_id = '00000000-0000-0000-0000-00000000000c' WHERE id = '10000000-0000-0000-0000-000000000001'$$, 'liquidador no puede reasignar');
SELECT pruebas.falla($$UPDATE public.casos_siniestro SET prorroga_liquidacion = TRUE, prorroga_fundamento = 'x' WHERE id = '10000000-0000-0000-0000-000000000001'$$, 'liquidador no concede prórrogas');
SELECT pruebas.falla($$UPDATE public.informes SET estado = 'aprobado' WHERE id = '30000000-0000-0000-0000-000000000001'$$, 'liquidador no aprueba informes');
SELECT pruebas.falla($$INSERT INTO public.valores_uf (fecha, valor) VALUES ('2026-09-23', 1)$$, 'liquidador no escribe valores UF');
SELECT pruebas.falla($$INSERT INTO public.personas (caso_id, rol, nombre) VALUES ('10000000-0000-0000-0000-000000000002', 'beneficiario', 'X')$$, 'liquidador no agrega personas a caso ajeno');
SELECT pruebas.falla($$INSERT INTO storage.objects (bucket_id, name) VALUES ('siniestros-documentos', '10000000-0000-0000-0000-000000000002/x.pdf')$$, 'liquidador no sube archivos a caso ajeno');
SELECT pruebas.falla($$INSERT INTO public.extracciones (documento_id, json_datos) VALUES ('20000000-0000-0000-0000-000000000001', '{}')$$, 'extracciones sólo las escribe el backend');
SELECT pruebas.falla($$DELETE FROM public.auditoria$$, 'auditoría no se borra');
SELECT pruebas.igual(pruebas.filas($$UPDATE public.usuarios SET rol = 'supervisor' WHERE id = '00000000-0000-0000-0000-00000000000b'$$), 0, 'liquidador no se autoasciende');
RESET ROLE;

-- ─── Liquidadora 2 ─────────────────────────────────────────
SET ROLE authenticated;
SELECT pruebas.como('00000000-0000-0000-0000-00000000000c');
SELECT pruebas.igual((SELECT count(*) FROM public.casos_siniestro), 1::BIGINT, 'liquidadora 2 ve sólo su caso');
SELECT pruebas.igual((SELECT count(*) FROM public.extracciones), 1::BIGINT, 'liquidadora 2 ve sólo sus extracciones');
SELECT pruebas.igual((SELECT count(*) FROM public.informes), 0::BIGINT, 'liquidadora 2 no ve informes ajenos');
SELECT pruebas.igual((SELECT count(*) FROM storage.objects WHERE name LIKE '10000000-0000-0000-0000-000000000001/%'), 0::BIGINT, 'liquidadora 2 no ve archivos ajenos');
RESET ROLE;

-- ─── Administrativo: recepción, sin datos sensibles ────────
SET ROLE authenticated;
SELECT pruebas.como('00000000-0000-0000-0000-00000000000d');
SELECT pruebas.igual((SELECT count(*) FROM public.casos_siniestro), 2::BIGINT, 'administrativo ve los casos');
SELECT pruebas.igual((SELECT count(*) FROM public.documentos), 1::BIGINT, 'administrativo ve sólo documentos que subió');
SELECT pruebas.igual((SELECT count(*) FROM storage.objects), 1::BIGINT, 'administrativo ve sólo archivos que subió');
SELECT pruebas.igual((SELECT count(*) FROM public.extracciones), 0::BIGINT, 'administrativo no ve extracciones');
SELECT pruebas.igual((SELECT count(*) FROM public.analisis_caso), 0::BIGINT, 'administrativo no ve análisis');
SELECT pruebas.igual((SELECT count(*) FROM public.informes), 0::BIGINT, 'administrativo no ve informes');
SELECT pruebas.igual((SELECT count(*) FROM public.coberturas_caso), 0::BIGINT, 'administrativo no ve montos');
SELECT pruebas.igual(pruebas.filas($$UPDATE public.casos_siniestro SET relato = 'x' WHERE id = '10000000-0000-0000-0000-000000000001'$$), 0, 'administrativo no edita casos fuera de recepción');
-- Alta de un caso con RETURNING (la política de lectura debe ver la fila nueva).
DO $$
DECLARE v_numero TEXT;
BEGIN
  INSERT INTO public.casos_siniestro (producto_id, reglas_version, regimen_cobertura, coberturas, fecha_accidente, fecha_denuncio, poliza_fecha_contratacion)
  VALUES ('SOAP', '2026.1', 'post_ley_jacinta', ARRAY['ipt'], '2026-09-01', '2026-09-02', '2026-04-01')
  RETURNING numero INTO v_numero;
  PERFORM pruebas.igual(v_numero LIKE 'SOAP-2026-%', TRUE, 'administrativo registra un denuncio y obtiene número de caso');
END $$;
SELECT pruebas.igual(pruebas.filas($$INSERT INTO storage.objects (bucket_id, name) VALUES ('siniestros-documentos', '10000000-0000-0000-0000-000000000001/nuevo.pdf')$$), 1, 'administrativo carga antecedentes');
RESET ROLE;

-- ─── Supervisor: todo, aprobación con cuatro ojos ──────────
SET ROLE authenticated;
SELECT pruebas.como('00000000-0000-0000-0000-00000000000a');
SELECT pruebas.igual((SELECT count(*) FROM public.casos_siniestro), 3::BIGINT, 'supervisor ve todos los casos');
SELECT pruebas.igual((SELECT count(*) FROM public.extracciones), 2::BIGINT, 'supervisor ve todas las extracciones');
SELECT pruebas.igual((SELECT count(*) > 0 FROM public.auditoria), TRUE, 'supervisor lee la auditoría');
SELECT pruebas.igual(pruebas.filas($$UPDATE public.casos_siniestro SET liquidador_id = '00000000-0000-0000-0000-00000000000c' WHERE id = '10000000-0000-0000-0000-000000000001'$$), 1, 'supervisor reasigna');
SELECT pruebas.igual(pruebas.filas($$UPDATE public.informes SET estado = 'aprobado', aprobado_por = auth.uid(), aprobado_at = NOW() WHERE id = '30000000-0000-0000-0000-000000000001'$$), 1, 'supervisor aprueba informe');
SELECT pruebas.igual(pruebas.filas($$UPDATE public.informes SET estado = 'emitido' WHERE id = '30000000-0000-0000-0000-000000000001'$$), 1, 'supervisor emite informe');
SELECT pruebas.falla($$UPDATE public.informes SET monto_uf = 1 WHERE id = '30000000-0000-0000-0000-000000000001'$$, 'informe emitido es inmutable');
INSERT INTO public.informes (id, caso_id, tipo, json_contenido) VALUES ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'finiquito', '{}');
SELECT pruebas.falla($$UPDATE public.informes SET estado = 'aprobado' WHERE id = '30000000-0000-0000-0000-000000000002'$$, 'redactor no aprueba su propio informe');
RESET ROLE;

SET ROLE authenticated;
SELECT pruebas.como('00000000-0000-0000-0000-00000000000f');
SELECT pruebas.igual(pruebas.filas($$UPDATE public.informes SET estado = 'aprobado' WHERE id = '30000000-0000-0000-0000-000000000002'$$), 1, 'otro supervisor sí aprueba');
RESET ROLE;

-- La auditoría registró la reasignación con quién y el antes/después.
SELECT pruebas.igual(
  (SELECT payload -> 'liquidador_id' ->> 'despues' FROM public.auditoria
    WHERE entidad = 'casos_siniestro' AND accion = 'update' AND payload ? 'liquidador_id'
    ORDER BY id DESC LIMIT 1),
  '00000000-0000-0000-0000-00000000000c', 'auditoría registra el cambio');

-- ─── Usuario autenticado ajeno al módulo y anónimo ─────────
SET ROLE authenticated;
SELECT pruebas.como('00000000-0000-0000-0000-00000000000e');
SELECT pruebas.igual((SELECT count(*) FROM public.casos_siniestro), 0::BIGINT, 'usuario sin rol no ve casos');
SELECT pruebas.igual((SELECT count(*) FROM public.personas), 0::BIGINT, 'usuario sin rol no ve personas');
SELECT pruebas.igual((SELECT count(*) FROM storage.objects), 0::BIGINT, 'usuario sin rol no ve archivos');
SELECT pruebas.falla($$INSERT INTO public.casos_siniestro (producto_id, reglas_version, regimen_cobertura, coberturas, fecha_accidente, fecha_denuncio, poliza_fecha_contratacion) VALUES ('SOAP', '1', 'x', ARRAY['ipt'], '2026-01-01', '2026-01-01', '2026-01-01')$$, 'usuario sin rol no crea casos');
RESET ROLE;

SET ROLE anon;
SELECT pruebas.como('');
SELECT pruebas.falla($$SELECT count(*) FROM public.casos_siniestro$$, 'anónimo sin acceso a casos');
SELECT pruebas.falla($$SELECT count(*) FROM public.valores_uf$$, 'anónimo sin acceso a UF');
RESET ROLE;
