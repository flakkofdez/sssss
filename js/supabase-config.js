/**
 * CONEXIÓN Y SERVICIO DE SUPABASE
 * Nida Yalico - Asesoría Inmobiliaria
 */

// Puedes ingresar tus claves aquí directamente o ingresarlas desde el asistente en admin.html
const DEFAULT_SUPABASE_CONFIG = {
    url: "https://itjjuiycwykxkogluzgp.supabase.co",
    anonKey: "sb_publishable_Hc3xu5soXfnIZrIYxELOFw_PbcNKIKd"
};

// Limpiar y estandarizar la URL de Supabase (remover /rest/v1/ si se incluye)
function sanitizeSupabaseUrl(url) {
    if (!url) return '';
    return url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

// Obtener credenciales (primero revisa localStorage, luego este archivo)
function getSupabaseCredentials() {
    const localUrl = localStorage.getItem('ny_supabase_url');
    const localKey = localStorage.getItem('ny_supabase_key');

    const rawUrl = (localUrl && localUrl.trim()) ? localUrl.trim() : DEFAULT_SUPABASE_CONFIG.url.trim();
    const rawKey = (localKey && localKey.trim()) ? localKey.trim() : DEFAULT_SUPABASE_CONFIG.anonKey.trim();

    return {
        url: sanitizeSupabaseUrl(rawUrl),
        anonKey: rawKey
    };
}

// Inicializar cliente Supabase
let supabaseClient = null;

function getSupabase() {
    if (supabaseClient) return supabaseClient;

    const creds = getSupabaseCredentials();
    if (creds.url && creds.anonKey && window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(creds.url, creds.anonKey);
            return supabaseClient;
        } catch (err) {
            console.error("Error al inicializar Supabase:", err);
            return null;
        }
    }
    return null;
}

// Comprobar si Supabase está conectado
function isSupabaseConfigured() {
    const creds = getSupabaseCredentials();
    return Boolean(creds.url && creds.anonKey && creds.url.startsWith('https://'));
}

// Guardar credenciales desde el asistente visual en admin.html
function saveSupabaseCredentials(url, anonKey) {
    localStorage.setItem('ny_supabase_url', sanitizeSupabaseUrl(url));
    localStorage.setItem('ny_supabase_key', anonKey.trim());
    supabaseClient = null; // Reiniciar instancia
}

// Desconectar o limpiar credenciales
function clearSupabaseCredentials() {
    localStorage.removeItem('ny_supabase_url');
    localStorage.removeItem('ny_supabase_key');
    supabaseClient = null;
}

// ==============================================================================
// FUNCIONES DE SINCRONIZACIÓN DE PROPIEDADES
// ==============================================================================

// Adaptar propiedad de Supabase al formato que usa la web
function mapSupabaseToApp(p) {
    return {
        id: p.id,
        code: p.code,
        title: p.title,
        type: p.type,
        operation: p.operation,
        district: p.district,
        address: p.address,
        currency: p.currency || (Number(p.price_usd) > 0 ? 'USD' : 'PEN'),
        priceUSD: Number(p.price_usd) || 0,
        pricePEN: Number(p.price_pen) || 0,
        areaM2: Number(p.area_m2) || 0,
        builtAreaM2: Number(p.built_area_m2) || 0,
        bedrooms: Number(p.bedrooms) || 0,
        bathrooms: Number(p.bathrooms) || 0,
        parking: Number(p.parking) || 0,
        floors: Number(p.floors) || 1,
        antiquity: p.antiquity || '',
        featured: Boolean(p.featured),
        badge: p.badge || '',
        status: p.status || 'disponible',
        description: p.description || '',
        images: Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? JSON.parse(p.images) : []),
        features: Array.isArray(p.features) ? p.features : (typeof p.features === 'string' ? JSON.parse(p.features) : []),
        createdAt: p.created_at
    };
}

// Adaptar propiedad de la App al formato de columnas en Supabase
function mapAppToSupabase(p) {
    return {
        id: p.id,
        code: p.code,
        title: p.title,
        type: p.type,
        operation: p.operation,
        district: p.district,
        address: p.address,
        currency: p.currency || (Number(p.priceUSD) > 0 ? 'USD' : 'PEN'),
        price_usd: Number(p.priceUSD) || 0,
        price_pen: Number(p.pricePEN) || 0,
        area_m2: Number(p.areaM2) || 0,
        built_area_m2: Number(p.builtAreaM2) || 0,
        bedrooms: Number(p.bedrooms) || 0,
        bathrooms: Number(p.bathrooms) || 0,
        parking: Number(p.parking) || 0,
        floors: Number(p.floors) || 1,
        antiquity: p.antiquity || '',
        featured: Boolean(p.featured),
        badge: p.badge || '',
        status: p.status || 'disponible',
        description: p.description || '',
        images: p.images || [],
        features: p.features || []
    };
}

// Obtener todas las propiedades (modo híbrido)
async function fetchAllProperties() {
    const sb = getSupabase();
    if (!sb) {
        console.log("Supabase no configurado, utilizando datos locales de data.js");
        return PROPERTIES_DATA;
    }

    try {
        const { data, error } = await sb
            .from('properties')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn("Aviso al consultar Supabase, usando respaldo local:", error.message);
            return PROPERTIES_DATA;
        }

        if (data && data.length > 0) {
            return data.map(mapSupabaseToApp);
        } else {
            // Si la tabla está vacía en Supabase, devolver respaldo local
            return PROPERTIES_DATA;
        }
    } catch (e) {
        console.error("Fallo de red con Supabase, usando respaldo:", e);
        return PROPERTIES_DATA;
    }
}

// Subir una imagen al bucket 'property-images' de Supabase
async function uploadPropertyImageFile(file) {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase no está configurado.");

    // Crear nombre único y limpio para el archivo
    const fileExt = file.name.split('.').pop();
    const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `propiedades/${cleanFileName}`;

    const { data, error } = await sb.storage
        .from('property-images')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) throw error;

    // Obtener la URL pública directa
    const { data: urlData } = sb.storage
        .from('property-images')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}
