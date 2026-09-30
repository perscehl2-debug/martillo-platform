-- ============================================================
-- SINIESTROS — Pólizas (el denuncio parte siempre de una póliza)
-- Requiere 002_siniestros.sql. Incluye pólizas de demostración ficticias.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.polizas (
  numero              TEXT PRIMARY KEY,
  producto            TEXT NOT NULL REFERENCES public.productos_seguro(id),
  variante            TEXT,
  aseguradora         TEXT,
  estado              TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulada')),
  fecha_contratacion  DATE NOT NULL,
  vigencia_desde      DATE NOT NULL,
  vigencia_hasta      DATE NOT NULL CHECK (vigencia_hasta >= vigencia_desde),
  patente             TEXT NOT NULL,           -- normalizada (sin puntos ni guiones)
  vehiculo            JSONB NOT NULL,          -- patente, marca, modelo, anio, tipo, uso
  tomador             JSONB NOT NULL,          -- nombre, rut, email, telefono, direccion
  propietario         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS polizas_patente_idx ON public.polizas (patente);

ALTER TABLE public.polizas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.polizas FROM anon;

DROP POLICY IF EXISTS "polizas: lectura módulo" ON public.polizas;
CREATE POLICY "polizas: lectura módulo" ON public.polizas
  FOR SELECT USING (public.siniestros_rol() IS NOT NULL);
DROP POLICY IF EXISTS "polizas: supervisor administra" ON public.polizas;
CREATE POLICY "polizas: supervisor administra" ON public.polizas
  FOR ALL USING (public.siniestros_rol() = 'supervisor') WITH CHECK (public.siniestros_rol() = 'supervisor');

DROP TRIGGER IF EXISTS auditar ON public.polizas;
CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON public.polizas
  FOR EACH ROW EXECUTE FUNCTION public.auditar();

-- Pólizas de demostración (las mismas de lib/siniestros/polizas/demo.json).
INSERT INTO public.polizas (numero, producto, variante, aseguradora, estado, fecha_contratacion, vigencia_desde, vigencia_hasta, patente, vehiculo, tomador, propietario) VALUES
  ('SOAP-2026-100245', 'SOAP', 'SOAP', 'Aseguradora Demo S.A.', 'vigente', '2026-03-15', '2026-04-01', '2027-03-31', 'KJTR45',
   '{"patente": "KJTR45", "marca": "Toyota", "modelo": "Yaris", "anio": 2019, "tipo": "Automóvil", "uso": "Particular"}'::jsonb, '{"nombre": "Juan Andrés Pérez Soto", "rut": "12345678-5", "email": "jperez@demo.cl", "telefono": "+56 9 1111 2222", "direccion": "Av. Alemania 0450, Temuco"}'::jsonb, '{"nombre": "Juan Andrés Pérez Soto", "rut": "12345678-5"}'::jsonb),
  ('SOAP-2025-087311', 'SOAP', 'SOAP', 'Aseguradora Demo S.A.', 'vigente', '2025-03-20', '2025-04-01', '2026-03-31', 'HXLP72',
   '{"patente": "HXLP72", "marca": "Hyundai", "modelo": "Accent", "anio": 2016, "tipo": "Automóvil", "uso": "Particular"}'::jsonb, '{"nombre": "María José González Rojas", "rut": "11111111-1", "email": "mgonzalez@demo.cl", "telefono": "+56 9 3333 4444", "direccion": "Los Aromos 123, Padre Las Casas"}'::jsonb, '{"nombre": "María José González Rojas", "rut": "11111111-1"}'::jsonb),
  ('SOAP-2026-100390', 'SOAP', 'SOAP', 'Aseguradora Demo S.A.', 'vigente', '2026-09-20', '2026-09-20', '2027-03-31', 'LBFT31',
   '{"patente": "LBFT31", "marca": "Chevrolet", "modelo": "Sail", "anio": 2021, "tipo": "Automóvil", "uso": "Transporte de pasajeros (taxi)"}'::jsonb, '{"nombre": "Transportes Cautín Ltda.", "rut": "76086428-5", "email": "contacto@cautin-demo.cl", "telefono": "+56 45 222 3344", "direccion": "Balmaceda 800, Temuco"}'::jsonb, '{"nombre": "Transportes Cautín Ltda.", "rut": "76086428-5"}'::jsonb),
  ('SOAPEX-2026-000517', 'SOAP', 'SOAPEX', 'Aseguradora Demo S.A.', 'vigente', '2026-07-02', '2026-07-02', '2026-10-31', 'AB123CD',
   '{"patente": "AB123CD", "marca": "Volkswagen", "modelo": "Amarok", "anio": 2022, "tipo": "Camioneta", "uso": "Particular (matrícula argentina)"}'::jsonb, '{"nombre": "Martín Rodríguez", "rut": null, "email": "mrodriguez@demo.com.ar", "telefono": "+54 9 2944 55 6677", "direccion": "San Carlos de Bariloche, Argentina"}'::jsonb, '{"nombre": "Martín Rodríguez", "rut": null}'::jsonb)
ON CONFLICT (numero) DO NOTHING;
