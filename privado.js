// ==========================================
// LÓGICA DE CHAT PRIVADO EN TIEMPO REAL 🔒
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabaseClient;

    // Obtener el ID de la sala desde la URL (?room=xxxx-xxxx-xxxx)
    const urlParams = new URLSearchParams(window.location.search);
    const salaId = urlParams.get("room");

    if (!salaId) {
        alert("Sala privada no válida.");
        window.location.href = "index.html";
        return;
    }

    // 1. VERIFICAR SESIÓN
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = "index.html";
        return;
    }
    const userId = session.user.id;

    // 2. VERIFICAR QUE LA SALA ESTÉ ACEPTADA
    const { data: salaData, error: salaError } = await supabase
        .from("salas_privadas")
        .select("estado, usuario_1, usuario_2")
        .eq("id", salaId)
        .single();

    if (salaError || !salaData) {
        alert("Sala no encontrada.");
        window.location.href = "index.html";
        return;
    }

    if (salaData.estado !== "aceptado") {
        alert("Esta solicitud de chat privado aún no ha sido aceptada.");
        window.location.href = "index.html";
        return;
    }

    // Verificar que el usuario tenga permiso para acceder
    if (salaData.usuario_1 !== userId && salaData.usuario_2 !== userId) {
        alert("No tienes permiso para acceder a este chat.");
        window.location.href = "index.html";
        return;
    }

    // Elementos del DOM
    const privatePartnerName = document.getElementById("private-partner-name");
    const privateMessages = document.getElementById("private-messages");
    const privateMessageForm = document.getElementById("private-message-form");
    const privateInput = document.getElementById("private-input");

    let miPerfil = null;

    // 2. CARGAR MI PERFIL
    const { data: perfilData } = await supabase.from("perfiles").select("*").eq("id", userId).single();
    miPerfil = perfilData;

    // 3. CARGAR HISTORIAL DE ESTE CHAT PRIVADO
    async function cargarMensajesPrivados() {
        const { data, error } = await supabase
            .from("mensajes_privados")
            .select("*")
            .eq("sala_id", salaId)
            .order("id", { ascending: true });

        if (error) {
            console.error("Error cargando mensajes privados:", error);
            return;
        }

        privateMessages.innerHTML = "";
        data.forEach(msg => pintarMensajePrivado(msg));
        irAlFondo();
    }

    // 4. PINTAR MENSAJE EN LA INTERFAZ
    function pintarMensajePrivado(msg) {
        const esMio = msg.emisor_id === userId;
        const hora = new Date(msg.creado_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement("div");
        div.className = `msg-block ${esMio ? 'me' : ''}`;
        
        div.innerHTML = `
            <div class="msg-meta">
                <span class="msg-user">${msg.username}</span>
                <span class="msg-time">${hora}</span>
            </div>
            <div class="msg-text">${msg.mensaje.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        `;

        privateMessages.appendChild(div);
        irAlFondo();
    }

    // 5. ENVIAR MENSAJE PRIVADO
    privateMessageForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const texto = privateInput.value.trim();
        if (!texto) return;

        privateInput.value = "";

        const { error } = await supabase
            .from("mensajes_privados")
            .insert([
                {
                    sala_id: salaId,
                    emisor_id: userId,
                    username: miPerfil.username,
                    mensaje: texto
                }
            ]);

        if (error) alert("Error al enviar privado: " + error.message);
    });

    // 6. ESCUCHAR TIEMPO REAL FILTRADO POR ESTA SALA
    supabase
        .channel(`sala-privada-${salaId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'mensajes_privados',
            filter: `sala_id=eq.${salaId}` // Filtro brutal para que no escuche mensajes de otras salas
        }, payload => {
            pintarMensajePrivado(payload.new);
        })
        .subscribe();

    function irAlFondo() {
        privateMessages.scrollTop = privateMessages.scrollHeight;
    }

    // Inicializar carga
    await cargarMensajesPrivados();
});