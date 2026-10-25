// 1. KIỂM TRA QUYỀN ADMIN (Bắt buộc)
if (!localStorage.getItem('token')) {
    alert('Bạn chưa đăng nhập!'); window.location.href = 'index.html';
    throw new Error("Chưa đăng nhập");
}
const userRole = localStorage.getItem('role');
if (userRole !== 'admin') {
    alert('Bạn không có quyền truy cập trang này!'); window.location.href = 'dashboard.html';
    throw new Error("Không có quyền Admin");
}

// 2. KHỞI TẠO DỮ LIỆU MẪU (Nếu chưa có trong localStorage)
let usersList = JSON.parse(localStorage.getItem('usersData'));
if (!usersList) {
    usersList = [
        { username: "admin", fullname: "Quản trị viên", role: "Admin", status: "Hoạt động" },
        { username: "tthang", fullname: "Cao Tấn Thắng", role: "User", status: "Hoạt động" },
        { username: "kmy", fullname: "Đặng Kim Mỹ", role: "User", status: "Bị khóa" }
    ];
    localStorage.setItem('usersData', JSON.stringify(usersList));
}

// 3. HÀM HIỂN THỊ BẢNG USER
function renderUsers() {
    const tbody = document.querySelector('table tbody');
    tbody.innerHTML = '';

    usersList.forEach((user, index) => {
        let roleBadge = user.role === 'Admin' ? '<span class="badge bg-danger">Admin</span>' : '<span class="badge bg-primary">User</span>';
        let statusBadge = user.status === 'Hoạt động' ? '<span class="badge bg-success">Hoạt động</span>' : '<span class="badge bg-secondary">Bị khóa</span>';
        
        // Không cho phép xóa tài khoản admin gốc
        let actionBtns = `
            <button class="btn btn-sm btn-warning" onclick="openEditUserModal(${index})">Sửa</button>
        `;
        if (user.username !== 'admin') {
            actionBtns += `<button class="btn btn-sm btn-danger ms-1" onclick="deleteUser(${index})">Xóa</button>`;
        }

        const row = `
            <tr>
                <td>${user.username}</td>
                <td>${user.fullname}</td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td>${actionBtns}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// 4. CÁC HÀM XỬ LÝ MODAL VÀ LƯU DỮ LIỆU
function openAddUserModal() {
    document.getElementById('modalTitle').innerText = "Thêm User Mới";
    document.getElementById('isEditUser').value = "false";
    document.getElementById('userForm').reset();
    document.getElementById('inputUsername').disabled = false; // Cho phép nhập username mới
    
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    modal.show();
}

function openEditUserModal(index) {
    document.getElementById('modalTitle').innerText = "Sửa Thông Tin User";
    document.getElementById('isEditUser').value = "true";
    
    const user = usersList[index];
    document.getElementById('inputUsername').value = user.username;
    document.getElementById('inputUsername').disabled = true; // Không cho sửa username (vì là khóa chính)
    document.getElementById('inputFullName').value = user.fullname;
    document.getElementById('inputRole').value = user.role;
    document.getElementById('inputStatus').value = user.status;
    
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    modal.show();
}

function saveUser() {
    const isEdit = document.getElementById('isEditUser').value === "true";
    const username = document.getElementById('inputUsername').value.trim();
    const fullname = document.getElementById('inputFullName').value.trim();
    const role = document.getElementById('inputRole').value;
    const status = document.getElementById('inputStatus').value;

    if (!username || !fullname) {
        alert("Vui lòng nhập đầy đủ Tên đăng nhập và Họ tên!");
        return;
    }

    if (isEdit) {
        // Tìm user cũ và cập nhật
        const index = usersList.findIndex(u => u.username === username);
        if (index !== -1) {
            usersList[index].fullname = fullname;
            usersList[index].role = role;
            usersList[index].status = status;
        }
    } else {
        // Kiểm tra trùng tên đăng nhập
        if (usersList.find(u => u.username === username)) {
            alert("Tên đăng nhập này đã tồn tại!");
            return;
        }
        // Thêm mới
        usersList.push({ username, fullname, role, status });
    }

    localStorage.setItem('usersData', JSON.stringify(usersList));
    
    // Đóng modal và vẽ lại bảng
    bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    renderUsers();
    alert("✅ Đã lưu thông tin User thành công!");
}

function deleteUser(index) {
    const user = usersList[index];
    if (confirm(`Bạn có chắc chắn muốn xóa user "${user.username}" không?`)) {
        usersList.splice(index, 1);
        localStorage.setItem('usersData', JSON.stringify(usersList));
        renderUsers();
        alert("✅ Đã xóa user thành công!");
    }
}

// 5. CHẠY HIỂN THỊ BẢNG LẦN ĐẦU
renderUsers();