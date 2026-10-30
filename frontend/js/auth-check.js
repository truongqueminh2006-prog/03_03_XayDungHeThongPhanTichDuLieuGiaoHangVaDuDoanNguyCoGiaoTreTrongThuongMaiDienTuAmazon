
document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    // Chặn người chưa đăng nhập hoặc còn dùng token giả
    if (!token || token === "fake-jwt-token") {
        alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        window.location.href = "index.html";
        return;
    }

    // Chỉ Admin mới nhìn thấy các chức năng quản trị
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
});
