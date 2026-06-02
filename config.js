// ==========================================
// CONFIGURACIÓN CENTRAL DE SUPABASE 🚀
// ==========================================

// 1. REEMPLAZA ESTOS VALORES CON LAS CREDENCIALES DE TU PROYECTO
const SUPABASE_URL = "https://mttfctynsvagipmawfjf.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dGZjdHluc3ZhZ2lwbWF3ZmpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTgwNjgsImV4cCI6MjA5NTkzNDA2OH0.hAVx8om486uit01ktVG2vCJKQPhgNxY2kOrLwNzklKs";

// 2. Inicializamos el cliente global de Supabase utilizando la librería cargada por CDN
if (typeof supabase === 'undefined') {
    console.error("Error: La librería de Supabase no se ha cargado correctamente en el HTML.");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Exportamos el cliente para que pueda ser consumido por los scripts de las otras carpetas
window.supabaseClient = supabaseClient;

console.log(">>> Conexión inicializada con Supabase con éxito. 🌐");