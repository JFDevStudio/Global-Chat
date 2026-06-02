// ==========================================
// LÓGICA DEL CHAT GLOBAL EN TIEMPO REAL 🌐
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabaseClient;
    if (!supabase) {
        console.error("Supabase client no definido. Revisa config.js y el orden de los scripts.");
        return;
    }

    // Elementos del DOM
    const userDisplayName = document.getElementById("user-display-name");
    const userLevelBadge = document.getElementById("user-level-badge");
    const userRoleBadge = document.getElementById("user-role-badge");
    const logoutBtn = document.getElementById("logout-btn");
    const chatMessages = document.getElementById("chat-messages");
    const messageForm = document.getElementById("message-form");
    const messageInput = document.getElementById("message-input");
    const cooldownTimer = document.getElementById("cooldown-timer");
    const targetPrivateUser = document.getElementById("target-private-user");
    const requestPrivateBtn = document.getElementById("request-private-btn");
    const chatNotification = document.getElementById("chat-notification");
    const menuToggle = document.getElementById("menu-toggle");
    const sidePanel = document.querySelector(".side-panel");

    // --- LÓGICA DE MENÚ MÓVIL ---
    if (menuToggle) {
        menuToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            sidePanel.classList.toggle("active");
        });
    }

    // Cerrar menú al hacer clic fuera del panel
    document.addEventListener("click", (e) => {
        if (sidePanel && sidePanel.classList.contains("active") && !sidePanel.contains(e.target) && e.target !== menuToggle) {
            sidePanel.classList.remove("active");
        }
    });

    let miPerfil = null;
    let puedoEnviarMensaje = true;
    const themeButtons = document.querySelectorAll(".theme-btn");

    // --- SISTEMA DE NOTIFICACIONES INTERNAS ---
    function mostrarAviso(mensaje, duracion = 5000) {
        chatNotification.innerText = mensaje;
        chatNotification.classList.remove("hidden");
        
        // Auto-ocultar después de X tiempo
        if (window.notificationTimeout) clearTimeout(window.notificationTimeout);
        
        window.notificationTimeout = setTimeout(() => {
            chatNotification.classList.add("hidden");
        }, duracion);
    }

    // --- SISTEMA DE TEMAS ---
    themeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.classList.contains("locked")) return;
            themeButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const tema = btn.dataset.theme;
            document.body.className = tema !== "default" ? `tema-${tema}` : "";
        });
    });

    function gestionarTemas(nivel) {
        themeButtons.forEach(btn => {
            const nivelRequerido = parseInt(btn.dataset.level);
            if (nivel >= nivelRequerido) {
                btn.classList.remove("locked");
                btn.disabled = false;
                btn.innerText = btn.innerText.replace(" 🔒", "");
                btn.title = `Activar tema ${btn.dataset.theme}`;
            }
        });
    }

    // 1. VERIFICAR SESIÓN ACTIVA
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // Si no hay sesión, mandarlo directo al login de la raíz
        window.location.href = "index.html"; 
        return;
    }

    const userId = session.user.id;

    // 2. CARGAR PERFIL DEL USUARIO (Nivel, Rol, Username)
    async function cargarPerfil() {
        const { data, error } = await supabase
            .from("perfiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (error) {
            console.error("Error cargando perfil:", error);
            await supabase.auth.signOut();
            window.location.href = "index.html"; 
            return;
        }

        miPerfil = data;

        // 🛡️ SEGURIDAD: Bloqueo inmediato si el usuario está baneado
        if (miPerfil.baneado) {
            mostrarAviso("Tu cuenta ha sido baneada permanentemente. Cerrando sesión... ⛔");
            setTimeout(async () => {
                await supabase.auth.signOut();
                window.location.href = "index.html";
            }, 3000);
            return;
        }

        userDisplayName.innerText = miPerfil.username;
        userLevelBadge.innerText = `Nivel ${miPerfil.nivel}`;
        userRoleBadge.innerText = miPerfil.rol.toUpperCase();
        gestionarTemas(miPerfil.nivel);
        
        // Color estético según el rango
        if (miPerfil.rol === 'owner') userRoleBadge.style.background = "#ef4444"; // Rojo Rey 👑
        else if (miPerfil.rol === 'admin') userRoleBadge.style.background = "#3b82f6"; // Azul Admin
        else if (miPerfil.rol === 'moderador') userRoleBadge.style.background = "#10b981"; // Verde Mod
    }

    // 3. CARGAR LOS ÚLTIMOS MENSAJES (Historial)
    async function cargarHistorialChat() {
        const { data, error } = await supabase
            .from("chat_global")
            .select("*")
            .eq("eliminado", false) // Solo traer los que no han sido borrados por moderación
            .order("id", { ascending: true })
            .limit(50);

        if (error) {
            console.error("Error cargando mensajes:", error);
            return;
        }

        chatMessages.innerHTML = ""; // Limpiar contenedor

        // ⚠️ OPTIMIZACIÓN: Buscamos todos los perfiles de los autores de una vez
        // para evitar hacer 50 consultas seguidas (Problema N+1) que bloquean la carga.
        const userIds = [...new Set(data.map(m => m.usuario_id))];
        const { data: perfiles, error: errPerfiles } = await supabase
            .from("perfiles")
            .select("id, muteado_hasta, baneado, rol")
            .in("id", userIds);

        if (errPerfiles) {
            console.error("Error cargando perfiles del historial:", errPerfiles);
            return;
        }

        const perfilesMap = {};
        perfiles.forEach(p => perfilesMap[p.id] = p);

        data.forEach(msg => {
            pintarMensaje(msg, perfilesMap[msg.usuario_id]);
        });

        irAlFondoChat();
    }

    // 4. FUNCIÓN PARA PINTAR EL MENSAJE EN EL HTML (Con validación de mute/ban)
    async function pintarMensaje(msg, perfilUsuario = null) {
        // Si no tenemos el perfil (mensajes nuevos), lo buscamos. 
        // Si viene del historial, ya lo tenemos en caché.
        if (!perfilUsuario) {
            const { data } = await supabase
                .from("perfiles")
                .select("muteado_hasta, baneado, rol")
                .eq("id", msg.usuario_id)
                .single();
            perfilUsuario = data;
        }

        if (!perfilUsuario) return; // Usuario no encontrado

        // Si está baneado, no mostrar el mensaje
        if (perfilUsuario.baneado) return;

        // Si está muteado y aún está en período de silencio, no mostrar
        if (perfilUsuario.muteado_hasta) {
            const ahora = new Date();
            const muteHasta = new Date(perfilUsuario.muteado_hasta);
            if (ahora < muteHasta) {
                return; // El usuario aún está muteado, no mostrar mensaje
            }
        }

        const esMio = msg.usuario_id === userId;
        const hora = new Date(msg.creado_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement("div");
        div.className = `msg-block ${esMio ? 'me' : ''}`;
        
        const msgMeta = document.createElement("div");
        msgMeta.className = "msg-meta";
        
        const spanUser = document.createElement("span");
        spanUser.className = "msg-user";
        spanUser.innerText = msg.username;
        spanUser.style.cursor = "pointer";
        spanUser.style.textDecoration = "underline";
        
        spanUser.addEventListener("click", () => {
            if (msg.usuario_id !== userId) {
                targetPrivateUser.value = msg.username;
                targetPrivateUser.focus();
            }
        });
        
        // Etiqueta de Rol (Moderador, Admin, etc.) para identificar al Staff
        const spanRole = document.createElement("span");
        spanRole.className = "role-badge";
        spanRole.innerText = perfilUsuario.rol.toUpperCase();
        spanRole.style.fontSize = "0.6rem";
        spanRole.style.padding = "1px 6px";
        spanRole.style.marginLeft = "5px";
        spanRole.style.verticalAlign = "middle";
        
        // Colores consistentes con el diseño del header
        if (perfilUsuario.rol === 'owner') spanRole.style.background = "#ef4444";
        else if (perfilUsuario.rol === 'admin') spanRole.style.background = "#3b82f6";
        else if (perfilUsuario.rol === 'moderador') spanRole.style.background = "#10b981";

        const spanTime = document.createElement("span");
        spanTime.className = "msg-time";
        spanTime.innerText = hora;
        
        msgMeta.appendChild(spanUser);
        msgMeta.appendChild(spanRole);
        msgMeta.appendChild(spanTime);
        
        const msgText = document.createElement("div");
        msgText.className = "msg-text";
        msgText.innerText = msg.mensaje;
        
        div.appendChild(msgMeta);
        div.appendChild(msgText);

        chatMessages.appendChild(div);
        irAlFondoChat();
    }

    // 5. ENVIAR MENSAJE CON CONTROL DE RANGOS, COOLDOWN Y COMANDOS DE MODERACIÓN
    messageForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const texto = messageInput.value.trim();
        if (!texto) return;

        messageInput.value = "";

        // 1. VERIFICAR SI ES UN COMANDO DE MODERACIÓN
        if (texto.startsWith("/")) {
            // 1. Validar si mi rol tiene permisos (El owner y admin pueden todo, moderador solo mute/unmute)
            if (miPerfil.rol === 'usuario') {
                mostrarAviso("No tienes permisos para ejecutar comandos de moderación. ❌");
                return;
            }

            const partes = texto.split(" ");
            const comando = partes[0].toLowerCase(); // /mute, /ban, etc.
            const targetUsername = partes[1] ? partes[1].replace("@", "") : null;

            if (!targetUsername) {
                mostrarAviso("Formato incorrecto. Usa: /comando @username [minutos]");
                return;
            }

            try {
                // Buscar al usuario objetivo en la tabla perfiles
                const { data: objetivo, error: errBusqueda } = await supabase
                    .from("perfiles")
                    .select("id, rol")
                    .eq("username", targetUsername)
                    .maybeSingle();

                if (errBusqueda || !objetivo) {
                    mostrarAviso("Usuario no encontrado.");
                    return;
                }

                // 2. FILTRO DE SEGURIDAD ABSOLUTA (¡Protección para el Owner!)
                if (objetivo.rol === 'owner') {
                    mostrarAviso("¡Imposible! No puedes moderar al Dueño. 👑");
                    return;
                }

                // 3. Evitar que un moderador afecte a rangos superiores o iguales
                if (miPerfil.rol === 'moderador' && (objetivo.rol === 'administrador' || objetivo.rol === 'admin' || objetivo.rol === 'moderador')) {
                    mostrarAviso("No puedes moderar a alguien de tu mismo rango o superior. 🛡️");
                    return;
                }

                // 4. Asegurar que solo Admin u Owner puedan usar Ban/Unban
                if ((comando === "/ban" || comando === "/unban") && (miPerfil.rol !== 'administrador' && miPerfil.rol !== 'admin' && miPerfil.rol !== 'owner')) {
                    mostrarAviso("Solo Administradores pueden usar Ban/Unban. 🚫");
                    return;
                }

                // EJECUTAR COMANDOS
                if (comando === "/mute") {
                    const minutos = parseInt(partes[2]) || 5; // 5 minutos por defecto
                    const fechaMute = new Date();
                    fechaMute.setMinutes(fechaMute.getMinutes() + minutos);

                    await supabase
                        .from("perfiles")
                        .update({ muteado_hasta: fechaMute.toISOString() })
                        .eq("id", objetivo.id);

                    mostrarAviso(`¡@${targetUsername} silenciado por ${minutos} min! 🤫`);
                } 
                
                else if (comando === "/unmute") {
                    await supabase
                        .from("perfiles")
                        .update({ muteado_hasta: null })
                        .eq("id", objetivo.id);

                    mostrarAviso(`Silencio quitado a @${targetUsername}. 🔊`);
                } 
                
                else if (comando === "/ban") {
                    if (miPerfil.rol !== 'administrador' && miPerfil.rol !== 'admin' && miPerfil.rol !== 'owner') {
                        alert("Solo los administradores pueden banear usuarios. 🚫");
                        return;
                    }
                    await supabase
                        .from("perfiles")
                        .update({ baneado: true })
                        .eq("id", objetivo.id);

                    mostrarAviso(`¡@${targetUsername} baneado permanentemente! 🔨`);
                } 
                
                else if (comando === "/unban") {
                    if (miPerfil.rol !== 'administrador' && miPerfil.rol !== 'admin' && miPerfil.rol !== 'owner') {
                        alert("Solo los administradores pueden desbanear usuarios. ⚖️");
                        return;
                    }
                    await supabase
                        .from("perfiles")
                        .update({ baneado: false })
                        .eq("id", objetivo.id);

                    mostrarAviso(`Baneo levantado para @${targetUsername}. ✨`);
                } 
                
                else {
                    mostrarAviso(`Comando desconocido: ${comando}`);
                }

            } catch (error) {
                console.error("Error ejecutando comando:", error);
                alert("Error al ejecutar el comando: " + error.message);
            }
            return; // Detiene la ejecución para que el comando no se envíe como mensaje público
        }

        // 2. LÓGICA NORMAL DE ENVIAR MENSAJE
        // Validar Cooldown (Los usuarios normales esperan 5s, los moderadores/admins/owners NO)
        if (!puedoEnviarMensaje && !['moderador', 'admin', 'owner', 'administrador'].includes(miPerfil.rol)) {
            return;
        }

        // 🛡️ SEGURIDAD: Verificar si el usuario está muteado antes de enviar
        if (miPerfil.muteado_hasta) {
            const ahora = new Date();
            const muteHasta = new Date(miPerfil.muteado_hasta);
            if (ahora < muteHasta) {
                const minutosRestantes = Math.ceil((muteHasta - ahora) / (1000 * 60));
                mostrarAviso(`Muteado: Te quedan ${minutosRestantes} minutos de silencio. 🤫`);
                return;
            }
        }

        // Insertar el mensaje en Supabase
        const { error } = await supabase
            .from("chat_global")
            .insert([
                {
                    usuario_id: userId,
                    username: miPerfil.username,
                    mensaje: texto
                }
            ]);

        if (error) {
            alert("Error al enviar: " + error.message);
            return;
        }

        // --- ACTUALIZACIÓN DE NIVEL ---
        await cargarPerfil();

        // Aplicar penalización de 5 segundos si es usuario común
        if (!['moderador', 'admin', 'owner', 'administrador'].includes(miPerfil.rol)) {
            activarCooldown();
        }
    });

    // 6. ESCUCHAR EL CHAT EN TIEMPO REAL (La magia de los WebSockets)
    const channel = supabase
        .channel('sala-global')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global' }, payload => {
            // Cada vez que se inserte una fila en la base de datos, se ejecuta esto al instante
            if (!payload.new.eliminado) {
                pintarMensaje(payload.new);
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Conectado a la sala de chat en tiempo real');
            }
        });

    // --- FUNCIONES AUXILIARES ---
    function activarCooldown() {
        puedoEnviarMensaje = false;
        cooldownTimer.classList.remove("hidden");
        let segundos = 5;
        
        const intervalo = setInterval(() => {
            segundos--;
            if (segundos <= 0) {
                clearInterval(intervalo);
                puedoEnviarMensaje = true;
                cooldownTimer.classList.add("hidden");
            }
        }, 1000);
    }

    function irAlFondoChat() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function filtrarTexto(texto) {
        // Seguridad básica para evitar que inyecten código HTML malicioso (XSS)
        return texto.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // CERRAR SESIÓN
    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "index.html";
    });

    // ==========================================
    // LÓGICA DE CREACIÓN DE CHATS PRIVADOS 🔒
    // ==========================================
    const activePrivatesList = document.getElementById("active-privates-list");

    // 1. FUNCIÓN PARA BUSCAR USUARIO Y CREAR/ABRIR LA SALA
    requestPrivateBtn.addEventListener("click", async () => {
        const usernameBuscar = targetPrivateUser.value.trim();
        
        if (!usernameBuscar) {
            alert("Por favor, escribe el nombre del usuario.");
            return;
        }

        if (usernameBuscar === miPerfil.username) {
            alert("No puedes abrir un chat privado contigo mismo, crack. 🤔");
            return;
        }

        requestPrivateBtn.disabled = true;

        try {
            // a) Buscar al usuario objetivo por su username en la tabla 'perfiles'
            const { data: usuarioDestino, error: errorBusqueda } = await supabase
                .from("perfiles")
                .select("id")
                .eq("username", usernameBuscar)
                .maybeSingle();

            if (errorBusqueda || !usuarioDestino) {
                throw new Error("Usuario no encontrado. Revisa si está bien escrito.");
            }

            // b) Ordenar los IDs alfabéticamente
            const [u1, u2] = [userId, usuarioDestino.id].sort();

            // c) Verificar si ya existe una sala entre estos usuarios
            const { data: salaExistente, error: errorVerificar } = await supabase
                .from("salas_privadas")
                .select("id, estado")
                .eq("usuario_1", u1)
                .eq("usuario_2", u2)
                .maybeSingle();

            if (errorVerificar && errorVerificar.code !== "PGRST116") {
                throw errorVerificar;
            }

            if (salaExistente) {
                // La sala ya existe
                if (salaExistente.estado === "aceptado") {
                    window.location.href = `privado.html?room=${salaExistente.id}`;
                } else if (salaExistente.estado === "pendiente") {
                    alert("Solicitud ya enviada. Esperando que acepte...");
                }
                targetPrivateUser.value = "";
                return;
            }

            // d) Crear nueva sala con estado 'pendiente'
            const { data: nuevaSala, error: errorSala } = await supabase
                .from("salas_privadas")
                .insert([{ 
                    usuario_1: u1, 
                    usuario_2: u2,
                    estado: 'pendiente',
                    solicitado_por: userId
                }])
                .select()
                .single();

            if (errorSala) throw errorSala;

            alert("Solicitud enviada. Esperando aprobación...");
            targetPrivateUser.value = "";
            await cargarSalasPrivadasActivas();

        } catch (error) {
            alert(error.message);
        } finally {
            requestPrivateBtn.disabled = false;
        }
    });

    // 2. FUNCIÓN PARA CARGAR MIS CHATS PRIVADOS Y SOLICITUDES PENDIENTES
    async function cargarSalasPrivadasActivas() {
        try {
            const chatActivosList = document.getElementById("chats-activos-list");
            const solicitudesList = document.getElementById("solicitudes-pendientes-list");
            
            if (!chatActivosList || !solicitudesList) return;
            
            // Limpiar ambos contenedores
            chatActivosList.innerHTML = '<p class="empty-list">No tienes chats activos.</p>';
            solicitudesList.innerHTML = '<p class="empty-list">No tienes solicitudes pendientes.</p>';

            // Buscamos todas las salas donde yo sea usuario_1 O usuario_2
            const { data: salas, error } = await supabase
                .from("salas_privadas")
                .select(`
                    id,
                    usuario_1,
                    usuario_2,
                    estado,
                    solicitado_por
                `)
                .or(`usuario_1.eq.${userId},usuario_2.eq.${userId}`);

            if (error) {
                console.error("Error cargando salas privadas:", error);
                return;
            }
            
            if (!salas || salas.length === 0) return;

        for (const sala of salas) {
            const otroUsuarioId = sala.usuario_1 === userId ? sala.usuario_2 : sala.usuario_1;

            const { data: perfilOtro } = await supabase
                .from("perfiles")
                .select("username")
                .eq("id", otroUsuarioId)
                .single();

            if (!perfilOtro) continue;

            if (sala.estado === "aceptado") {
                // CHATS ACTIVOS
                const a = document.createElement("a");
                a.className = "private-link-item";
                a.href = `privado.html?room=${sala.id}`;
                a.innerHTML = `💬 ${perfilOtro.username} →`;
                
                // Limpiar el empty-list si es la primera vez
                if (chatActivosList.innerHTML.includes("empty-list")) {
                    chatActivosList.innerHTML = "";
                }
                chatActivosList.appendChild(a);

            } else if (sala.estado === "pendiente" && sala.solicitado_por !== userId) {
                // SOLICITUDES PENDIENTES (solo las que me enviaron a mí, no las que envié yo)
                const div = document.createElement("div");
                div.className = "private-request-item";
                div.style.display = "flex";
                div.style.justifyContent = "space-between";
                div.style.alignItems = "center";
                div.style.background = "var(--bg-dark)";
                div.style.padding = "8px 12px";
                div.style.borderRadius = "6px";
                div.style.border = "1px solid #334155";
                div.style.marginBottom = "8px";

                const nombre = document.createElement("span");
                nombre.innerText = `📨 ${perfilOtro.username}`;
                nombre.style.flex = "1";

                const btnAceptar = document.createElement("button");
                btnAceptar.className = "secondary-btn";
                btnAceptar.innerText = "✅";
                btnAceptar.style.width = "auto";
                btnAceptar.style.padding = "6px 10px";
                btnAceptar.style.marginRight = "5px";
                btnAceptar.style.fontSize = "0.8rem";
                btnAceptar.addEventListener("click", async () => {
                    await aceptarSolicitud(sala.id);
                });

                const btnRechazar = document.createElement("button");
                btnRechazar.className = "secondary-btn";
                btnRechazar.style.background = "#ef4444";
                btnRechazar.innerText = "❌";
                btnRechazar.style.width = "auto";
                btnRechazar.style.padding = "6px 10px";
                btnRechazar.style.fontSize = "0.8rem";
                btnRechazar.addEventListener("click", async () => {
                    await rechazarSolicitud(sala.id);
                });

                div.appendChild(nombre);
                div.appendChild(btnAceptar);
                div.appendChild(btnRechazar);

                // Limpiar el empty-list si es la primera vez
                if (solicitudesList.innerHTML.includes("empty-list")) {
                    solicitudesList.innerHTML = "";
                }
                solicitudesList.appendChild(div);
            }
        }
        } catch (error) {
            console.error("Error en cargarSalasPrivadasActivas:", error);
        }
    }

    // 3. FUNCIONES PARA ACEPTAR Y RECHAZAR SOLICITUDES
    async function aceptarSolicitud(salaId) {
        const { error } = await supabase
            .from("salas_privadas")
            .update({ estado: "aceptado" })
            .eq("id", salaId);

        if (error) {
            alert("Error al aceptar: " + error.message);
        } else {
            await cargarSalasPrivadasActivas();
        }
    }

    async function rechazarSolicitud(salaId) {
        const { error } = await supabase
            .from("salas_privadas")
            .delete()
            .eq("id", salaId);

        if (error) {
            alert("Error al rechazar: " + error.message);
        } else {
            await cargarSalasPrivadasActivas();
        }
    }

    // 4. ESCUCHAR CAMBIOS EN TIEMPO REAL EN SALAS PRIVADAS
    supabase
        .channel("salas-privadas-channel")
        .on("postgres_changes", { event: "*", schema: "public", table: "salas_privadas" }, payload => {
            // Cualquier cambio en salas privadas recarga la lista
            cargarSalasPrivadasActivas();
        })
        .subscribe();

    // Ejecución Inicial
    await cargarPerfil();
    await cargarHistorialChat();
    try {
        await cargarSalasPrivadasActivas();
    } catch (error) {
        console.error("Error cargando salas privadas:", error);
    }
});
