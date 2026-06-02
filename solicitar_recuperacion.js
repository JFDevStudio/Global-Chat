document.addEventListener("DOMContentLoaded", () => {
    const recoveryForm = document.getElementById("request-recovery-form");
    const recoveryEmail = document.getElementById("recovery-email");
    const recoveryError = document.getElementById("recovery-error");
    const recoverySuccessBox = document.getElementById("recovery-success-box");
    const backToLoginBtn = document.getElementById("back-to-login-btn");
    const submitBtn = document.getElementById("request-submit-btn");
    const authSubtitle = document.querySelector(".auth-subtitle");

    const supabase = window.supabaseClient;

    backToLoginBtn.addEventListener("click", () => {
        window.location.href = "index.html";
    });

    recoveryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = recoveryEmail.value.trim();
        recoveryError.classList.add("hidden");
        submitBtn.disabled = true;
        submitBtn.innerText = "Enviando enlace...";

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                // Redirige al usuario a la página de establecer nueva contraseña
                redirectTo: window.location.origin + '/recuperar.html',
            });

            if (error) throw error;

            // Ocultar formulario y subtítulo, mostrar cuadro de éxito
            recoveryForm.classList.add("hidden");
            authSubtitle.classList.add("hidden");
            recoverySuccessBox.classList.remove("hidden");
        } catch (error) {
            console.error("Error al solicitar recuperación:", error.message);
            recoveryError.innerText = "Error: " + error.message;
            recoveryError.classList.remove("hidden");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Enviar Enlace de Recuperación 🚀";
        }
    });
});