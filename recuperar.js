document.addEventListener("DOMContentLoaded", async () => {
    const recoveryForm = document.getElementById("recovery-form");
    const newPasswordInput = document.getElementById("new-password");
    const recoverySubmitBtn = document.getElementById("recovery-submit-btn");
    const recoveryMsg = document.getElementById("recovery-msg");
    const recoveryError = document.getElementById("recovery-error");

    const supabase = window.supabaseClient;

    // 1. Verificar si hay una sesión activa (el enlace de Supabase la inicia automáticamente)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        recoveryError.innerText = "El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo.";
        recoveryError.classList.remove("hidden");
        recoveryForm.classList.add("hidden");
        return;
    }

    recoveryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        recoveryError.classList.add("hidden");
        recoveryMsg.classList.add("hidden");
        recoverySubmitBtn.disabled = true;

        const nuevaPassword = newPasswordInput.value.trim();

        try {
            // Supabase detecta automáticamente el token de la sesión desde el hash de la URL
            const { error } = await supabase.auth.updateUser({ password: nuevaPassword });

            if (error) throw error;

            recoveryMsg.innerText = "¡Contraseña actualizada con éxito! Redirigiendo al login en 3 segundos...";
            recoveryMsg.classList.remove("hidden");
            recoveryForm.classList.add("hidden");

            setTimeout(() => {
                window.location.href = "index.html";
            }, 3000);

        } catch (error) {
            recoveryError.innerText = "Error: " + error.message;
            recoveryError.classList.remove("hidden");
            recoverySubmitBtn.disabled = false;
        }
    });
});