document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault(); 

    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');

    // Tài khoản Admin
    if (user === 'admin' && pass === '123456') {
        errorDiv.style.display = 'none';
        localStorage.setItem('token', 'fake-jwt-token');
        localStorage.setItem('role', 'admin'); // Lưu quyền Admin
        window.location.href = 'dashboard.html';
    } 
    // Tài khoản User thường
    else if (user === 'user' && pass === '123456') {
        errorDiv.style.display = 'none';
        localStorage.setItem('token', 'fake-jwt-token');
        localStorage.setItem('role', 'user'); // Lưu quyền User
        window.location.href = 'dashboard.html';
    }
    // Bỏ trống
    else if (user === '' || pass === '') {
        errorDiv.innerText = 'Vui lòng nhập đầy đủ tài khoản và mật khẩu!';
        errorDiv.style.display = 'block';
    } 
    // Sai tài khoản
    else {
        errorDiv.innerText = 'Sai tài khoản hoặc mật khẩu! (Thử: admin/123456 hoặc user/123456)';
        errorDiv.style.display = 'block';
    }
});