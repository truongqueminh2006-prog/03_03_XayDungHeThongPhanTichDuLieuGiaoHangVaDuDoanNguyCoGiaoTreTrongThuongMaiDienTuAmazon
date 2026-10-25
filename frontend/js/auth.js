document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Ngăn trang web bị load lại

    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');

    // Tạm thời dùng tài khoản giả (Mock data) để test
    // Khi nào TV3 làm xong API, chúng ta sẽ thay bằng lệnh gọi fetch() thật
    if (user === 'admin' && pass === '123456') {
        errorDiv.style.display = 'none';
        errorDiv.innerText = '';
        alert('Đăng nhập thành công! Chuyển hướng sang Dashboard...');
        // Lưu token giả
        localStorage.setItem('token', 'fake-jwt-token');
        // Chuyển trang (chúng ta sẽ tạo trang dashboard.html ở bước sau)
        window.location.href = 'dashboard.html';
    } else if (user === '' || pass === '') {
        errorDiv.innerText = 'Vui lòng nhập đầy đủ tài khoản và mật khẩu!';
    } else {
        errorDiv.innerText = 'Sai tài khoản hoặc mật khẩu! (Thử: admin / 123456)';
        errorDiv.style.display = 'block';
    }
});