document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    // Kiểm tra trạng thái đăng nhập
    if (!token || token === "fake-jwt-token") {
        alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        window.location.href = "index.html";
        return;
    }

    // Xử lý đăng xuất
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (event) {
            event.preventDefault();

            // Xóa thông tin đăng nhập
            localStorage.removeItem("token");
            localStorage.removeItem("role");

            // Chuyển về trang đăng nhập
            window.location.href = "index.html";
        });
    }

    // Ẩn chức năng quản trị đối với người không phải Admin
    if (role !== "admin") {
        const userBtns = document.querySelectorAll('a[href="users.html"]');
        userBtns.forEach(btn => {
            btn.style.display = "none";
        });

        const reportBtns = document.querySelectorAll('a[href="reports.html"]');
        reportBtns.forEach(btn => {
            btn.style.display = "none";
        });
    }
})