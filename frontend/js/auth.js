const API_BASE_URL = "http://127.0.0.1:8000";

document.getElementById("loginForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value;
    const errorDiv = document.getElementById("errorMessage");

    if (!user || !pass) {
        errorDiv.innerText = "Vui lòng nhập đầy đủ tài khoản và mật khẩu!";
        errorDiv.style.display = "block";
        return;
    }

    errorDiv.style.display = "none";

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                username: user,
                password: pass
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                typeof result.detail === "string"
                    ? result.detail
                    : "Đăng nhập thất bại. Vui lòng kiểm tra tài khoản và mật khẩu."
            );
        }

        if (!result.access_token) {
            throw new Error("Backend không trả về access token.");
        }

        // Lưu token thật từ FastAPI
        localStorage.setItem("token", result.access_token);

        // Chỉ lưu role nếu backend thực sự trả về
        if (result.role) {
            localStorage.setItem("role", result.role);
        } else {
            localStorage.removeItem("role");
        }

        // Chuyển sang Dashboard
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);

        errorDiv.innerText =
            error instanceof TypeError
                ? "Không kết nối được backend. Hãy kiểm tra FastAPI và CORS."
                : error.message;

        errorDiv.style.display = "block";
    }
});
