-- ==============================================================================
-- SCRIPT DE CONFIGURACIÓN AUTOMÁTICA DE SUPABASE PARA NIDA YALICO INMOBILIARIA
-- ==============================================================================
-- Instrucciones:
-- 1. Entra a tu proyecto en https://supabase.com
-- 2. Ve al menú lateral "SQL Editor" -> "+ New Query"
-- 3. Pega todo este código y haz clic en "RUN" (Ejecutar)
-- ¡Listo! Tu base de datos y almacén de fotos quedarán configurados al 100%.
-- ==============================================================================

-- 1. CREAR LA TABLA DE PROPIEDADES (O ACTUALIZAR SI YA EXISTÍA)
CREATE TABLE IF NOT EXISTS public.properties (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    operation TEXT NOT NULL,
    district TEXT NOT NULL,
    address TEXT NOT NULL,
    currency TEXT DEFAULT 'USD', -- 'USD' o 'PEN'
    price_usd NUMERIC DEFAULT 0,
    price_pen NUMERIC DEFAULT 0,
    area_m2 NUMERIC DEFAULT 0,
    built_area_m2 NUMERIC DEFAULT 0,
    bedrooms INTEGER DEFAULT 0,
    bathrooms INTEGER DEFAULT 0,
    parking INTEGER DEFAULT 0,
    floors INTEGER DEFAULT 1,
    antiquity TEXT,
    featured BOOLEAN DEFAULT false,
    badge TEXT,
    status TEXT DEFAULT 'disponible', -- 'disponible', 'vendido', 'alquilado', 'oculto'
    description TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar que la columna currency exista si la tabla fue creada previamente:
ALTER TABLE IF EXISTS public.properties ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Habilitar Row Level Security (Seguridad por filas)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- POLÍTICA 1: Permitir lectura pública de propiedades disponibles, vendidas y alquiladas
DROP POLICY IF EXISTS "Lectura pública de propiedades" ON public.properties;
CREATE POLICY "Lectura pública de propiedades"
    ON public.properties FOR SELECT
    USING (true);

-- POLÍTICA 2: Permitir inserción de propiedades desde el panel
DROP POLICY IF EXISTS "Insertar propiedades panel" ON public.properties;
CREATE POLICY "Insertar propiedades panel"
    ON public.properties FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- POLÍTICA 3: Permitir actualización de propiedades desde el panel
DROP POLICY IF EXISTS "Actualizar propiedades panel" ON public.properties;
CREATE POLICY "Actualizar propiedades panel"
    ON public.properties FOR UPDATE
    TO anon, authenticated
    USING (true);

-- POLÍTICA 4: Permitir eliminación de propiedades desde el panel
DROP POLICY IF EXISTS "Eliminar propiedades panel" ON public.properties;
CREATE POLICY "Eliminar propiedades panel"
    ON public.properties FOR DELETE
    TO anon, authenticated
    USING (true);


-- 2. CREAR BUCKET DE ALMACENAMIENTO PARA FOTOS (property-images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Limpiar cualquier política antigua de almacenamiento
DROP POLICY IF EXISTS "Subir fotos de propiedades autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Fotos de propiedades públicas" ON storage.objects;
DROP POLICY IF EXISTS "Borrar fotos autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Subir fotos panel" ON storage.objects;
DROP POLICY IF EXISTS "Borrar fotos panel" ON storage.objects;
DROP POLICY IF EXISTS "Fotos públicas property-images" ON storage.objects;
DROP POLICY IF EXISTS "Subir fotos property-images" ON storage.objects;
DROP POLICY IF EXISTS "Modificar fotos property-images" ON storage.objects;
DROP POLICY IF EXISTS "Borrar fotos property-images" ON storage.objects;

-- POLÍTICA DE ALMACENAMIENTO 1: Permitir ver fotos a cualquier visitante
CREATE POLICY "Fotos públicas property-images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'property-images');

-- POLÍTICA DE ALMACENAMIENTO 2: Permitir subir fotos al panel (con clave anon o autenticado)
CREATE POLICY "Subir fotos property-images"
    ON storage.objects FOR INSERT
    TO public, anon, authenticated
    WITH CHECK (bucket_id = 'property-images');

-- POLÍTICA DE ALMACENAMIENTO 3: Permitir actualizar y borrar fotos en property-images
CREATE POLICY "Modificar fotos property-images"
    ON storage.objects FOR UPDATE
    TO public, anon, authenticated
    USING (bucket_id = 'property-images');

CREATE POLICY "Borrar fotos property-images"
    ON storage.objects FOR DELETE
    TO public, anon, authenticated
    USING (bucket_id = 'property-images');
