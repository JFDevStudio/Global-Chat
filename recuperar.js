document.addEventListener("DOMContentLoaded", async () => {
    const recoveryForm = document.getElementById("recovery-form");
    const newPasswordInput = document.getElementById("new-password");
    const recoverySubmitBtn = document.getElementById("recovery-submit-btn");
    const recoverySuccessBox = document.getElementById("recovery-success-box");
    const recoveryError = document.getElementById("recovery-error");
    const recoveryTitle = document.getElementById("recovery-title");
    const recoverySubtitle = document.getElementById("recovery-subtitle");
    const goToLoginBtn = document.getElementById("go-to-login-btn");

    const supabase = window.supabaseClient;

    // 1. Verificar si hay una sesión activa (el enlace de Supabase la inicia automáticamente)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        recoveryError.innerText = "El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo.";
        recoveryError.classList.remove("hidden");
        recoveryForm.classList.add("hidden");
        return;
    }

    goToLoginBtn.addEventListener("click", () => {
        window.location.href = "index.html";
    });

    recoveryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        recoveryError.classList.add("hidden");
        recoverySubmitBtn.disabled = true;

        const nuevaPassword = newPasswordInput.value.trim();

        try {
            // Supabase detecta automáticamente el token de la sesión desde el hash de la URL
            const { error } = await supabase.auth.updateUser({ password: nuevaPassword });

            if (error) throw error;

            // Ocultar elementos del formulario y mostrar el cuadro de éxito
            recoveryForm.classList.add("hidden");
            recoveryTitle.classList.add("hidden");
            recoverySubtitle.classList.add("hidden");
            recoverySuccessBox.classList.remove("hidden");

        } catch (error) {
            recoveryError.innerText = "Error: " + error.message;
            recoveryError.classList.remove("hidden");
            recoverySubmitBtn.disabled = false;
        }
    });
});