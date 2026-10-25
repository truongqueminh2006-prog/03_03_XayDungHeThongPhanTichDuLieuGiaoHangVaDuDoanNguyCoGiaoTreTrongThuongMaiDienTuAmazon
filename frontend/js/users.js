// Kiểm tra đăng nhập
if (!localStorage.getItem('token')) {
    alert('Bạn chưa đăng nhập!');
    window.location.href = 'index.html';
}

// GIẢ LẬP PHÂN QUYỀN: Nếu không phải admin thì đá ra ngoài
// Khi có API thật, TV3 sẽ trả về role, bạn sẽ kiểm tra biến 'role' thay vì hardcode thế này.
const currentUser = 'admin'; // Giả sử user hiện tại là admin
if (currentUser !== 'admin') {
    alert('Bạn không có quyền truy cập trang này! Chỉ Admin mới được vào.');
    window.location.href = 'dashboard.html'; // Đá về dashboard
}