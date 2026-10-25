// File này dùng để kiểm tra quyền và ẩn/hiện các nút trên thanh menu
document.addEventListener('DOMContentLoaded', function () {
    // Lấy quyền người dùng từ localStorage (đã lưu lúc đăng nhập)
    const role = localStorage.getItem('role');

    // Nếu KHÔNG phải là admin
    if (role !== 'admin') {
        // 1. Tìm và ẩn nút "Quản lý Users"
        const userBtns = document.querySelectorAll('a[href="users.html"]');
        userBtns.forEach(btn => btn.style.display = 'none');

        // 2. Tìm và ẩn nút "Báo cáo & Backup"
        const reportBtns = document.querySelectorAll('a[href="reports.html"]');
        reportBtns.forEach(btn => btn.style.display = 'none');

        // 3. (Tùy chọn) Đổi chữ "Xin chào, Admin!" thành "Xin chào, User!"
        const greetingText = document.querySelector('span.text-white.me-3.border-start.ps-3');
        if (greetingText) {
            greetingText.innerText = 'Xin chào, Thành viên!';
        }
    }
});