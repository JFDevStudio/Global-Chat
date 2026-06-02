// ==========================================
// CONFIGURACIÓN CENTRAL DE SUPABASE 🚀
// ==========================================

// 1. REEMPLAZA ESTOS VALORES CON LAS CREDENCIALES DE TU PROYECTO
const SUPABASE_URL = "https://mttfctynsvagipmawfjf.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_7xn0yYfsFjCe6YQpXhkKxA_6LaE6jA0";

// 2. Inicializamos el cliente global de Supabase utilizando la librería cargada por CDN
if (typeof supabase === 'undefined') {
    console.error("Error: La librería de Supabase no se ha cargado correctamente en el HTML.");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Exportamos el cliente para que pueda ser consumido por los scripts de las otras carpetas
window.supabaseClient = supabaseClient;

console.log(">>> Conexión inicializada con Supabase con éxito. 🌐");