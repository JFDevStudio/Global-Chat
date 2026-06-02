// ==========================================
// LÓGICA DE AUTENTICACIÓN Y REGISTRO 🔐
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // 1. Capturar elementos del DOM del index.html
    const authForm = document.getElementById("auth-form");
    const usernameGroup = document.getElementById("username-group");
    const authUsername = document.getElementById("auth-username");
    const authEmail = document.getElementById("auth-email");
    const authPassword = document.getElementById("auth-password");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const toggleAuthMode = document.getElementById("toggle-auth-mode");
    const authError = document.getElementById("auth-error");
    const authLinks = document.querySelector(".auth-links");
    const accountCreatedBox = document.getElementById("account-created-box");
    const continueToLoginBtn = document.getElementById("continue-to-login-btn");
    const rateLimitBox = document.getElementById("rate-limit-box");
    const closeRateLimitBtn = document.getElementById("close-rate-limit-btn");

    // El cliente de Supabase viene heredado desde config.js a través de window
    const supabase = window.supabaseClient;

    // --- PERSISTENCIA DE SESIÓN ---
    // Si el usuario ya está logueado, lo mandamos directo al chat
    const verificarSesionActiva = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user?.email_confirmed_at) {
            console.log("Sesión activa detectada, redirigiendo...");
            window.location.href = "global.html";
        }
    };

    // Ejecutamos la comprobación al cargar la página
    verificarSesionActiva();

    // Estado local: 'login' o 'registro' (empezamos en login por defecto)
    let isLoginMode = true; 
    usernameGroup.classList.add("hidden"); // Escondemos el campo username en login
    authUsername.removeAttribute("required");
    authSubmitBtn.innerText = "Iniciar Sesión 🚀";

    function mostrarLogin() {
        isLoginMode = true;
        authForm.classList.remove("hidden");
        authLinks.classList.remove("hidden");
        accountCreatedBox.classList.add("hidden");
        usernameGroup.classList.add("hidden");
        authUsername.removeAttribute("required");
        toggleAuthMode.innerText = "¿No tienes cuenta? Regístrate aquí";
        authSubmitBtn.innerText = "Iniciar Sesión 🚀";
        authSubmitBtn.disabled = false;
        authEmail.value = "";
        authPassword.value = "";
        authUsername.value = "";
        authError.innerText = "";
    }

    function mostrarCuentaCreada() {
        authForm.classList.add("hidden");
        authLinks.classList.add("hidden");
        accountCreatedBox.classList.remove("hidden");
        authSubmitBtn.disabled = false;
        authError.innerText = "";
    }

    continueToLoginBtn.addEventListener("click", mostrarLogin);

    closeRateLimitBtn.addEventListener("click", () => {
        rateLimitBox.classList.add("hidden");
        authForm.classList.remove("hidden");
        authLinks.classList.remove("hidden");
    });

    // 2. INTERRUPTOR: Alternar entre modo Login y modo Registro
    toggleAuthMode.addEventListener("click", (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        authError.innerText = ""; // Limpiar errores previos

        if (isLoginMode) {
            usernameGroup.classList.add("hidden");
            authUsername.removeAttribute("required");
            toggleAuthMode.innerText = "¿No tienes cuenta? Regístrate aquí";
            authSubmitBtn.innerText = "Iniciar Sesión 🚀";
        } else {
            usernameGroup.classList.remove("hidden");
            authUsername.setAttribute("required", "true");
            toggleAuthMode.innerText = "¿Ya tienes cuenta? Inicia sesión";
            authSubmitBtn.innerText = "Crear Cuenta Nueva ✨";
        }
    });

    // 3. EVENTO PRINCIPAL: Enviar Formulario (Submit)
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authError.innerText = "";
        authSubmitBtn.disabled = true;

        const email = authEmail.value.trim();
        const password = authPassword.value.trim();
        const username = authUsername.value.trim();

        try {
            if (isLoginMode) {
                // --- PROCESO DE LOGUEO ---
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;

                if (!data.user?.email_confirmed_at) {
                    await supabase.auth.signOut();
                    throw new Error("Debes confirmar tu correo electronico antes de iniciar sesion.");
                }

                console.log("Sesión iniciada con éxito", data);
                window.location.href = "global.html"; 

            } else {
                // --- PROCESO DE REGISTRO ---
                // a) Validar que el username no tenga espacios molestos
                if (username.includes(" ")) {
                    throw new Error("El nombre de usuario no puede contener espacios.");
                }

                // b) Crear el usuario en la autenticación central de Supabase
                const { data: authData, error: authErrorResult } = await supabase.auth.signUp({ 
                    email, 
                    password,
                    options: {
                        emailRedirectTo: window.location.origin + '/confirmado.html'
                    }
                });
                if (authErrorResult) throw authErrorResult;

                const user = authData.user;
                if (!user) throw new Error("No se pudo crear el usuario. Intenta de nuevo.");

                // c) Insertar el perfil personalizado del usuario en nuestra tabla 'perfiles'
                const { error: profileError } = await supabase
                    .from("perfiles")
                    .insert([
                        { 
                            id: user.id, 
                            username: username, 
                            rol: 'usuario', // Rol base por defecto
                            nivel: 1, 
                            experiencia: 0 
                        }
                    ]);

                if (profileError) {
                    // Si el username ya existe o falla, borramos el auth para no dejar cuentas fantasma
                    await supabase.rpc('delete_user_cascade'); // (Opcional, Supabase maneja restricciones)
                    throw new Error("El nombre de usuario ya está en uso. Elige otro.");
                }

                await supabase.auth.signOut();
                mostrarCuentaCreada();
            }
        } catch (error) {
            console.error("Error de autenticación:", error.message);
            
            // Detectar si es error de rate limit
            if (error.message.includes("rate limit")) {
                authForm.classList.add("hidden");
                authLinks.classList.add("hidden");
                rateLimitBox.classList.remove("hidden");
                authSubmitBtn.disabled = false;
            } else {
                authError.innerText = `Ocurrió un error: ${error.message}`;
                authSubmitBtn.disabled = false;
            }
        }
    });
});
