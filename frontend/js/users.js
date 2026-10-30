
const API_URL = "http://127.0.0.1:8000/api/users";

let usersList = [];
let editingUsername = null;

const token = localStorage.getItem("token");
const userRole = (localStorage.getItem("role") || "").toLowerCase();

if (!token) {
    alert("Bạn chưa đăng nhập!");
    window.location.href = "index.html";
} else if (userRole !== "admin") {
    alert("Bạn không có quyền truy cập trang này!");
    window.location.href = "dashboard.html";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

async function apiRequest(path = "", options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        alert("Phiên đăng nhập hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.");
        localStorage.removeItem("token");
        window.location.href = "index.html";
        throw new Error("Unauthorized");
    }

    if (response.status === 403) {
        throw new Error(data.detail || "Bạn không có quyền thực hiện thao tác này.");
    }

    if (!response.ok) {
        throw new Error(data.detail || `Lỗi API (${response.status})`);
    }

    return data;
}

function showError(error) {
    if (error.message !== "Unauthorized") {
        alert(error.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
    }
}

async function loadUsers() {
    try {
        usersList = await apiRequest();
        renderUsers();
    } catch (error) {
        showError(error);
    }
}

function renderUsers() {
    const tbody = document.querySelector("table tbody");

    if (!tbody) {
        console.error("Không tìm thấy phần tbody của bảng người dùng.");
        return;
    }

    if (usersList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Chưa có người dùng.</td>
            </tr>`;
        return;
    }

    tbody.innerHTML = usersList.map((user, index) => {
        const role = user.role === "Admin" ? "Admin" : "User";
        const active = user.status === "Hoạt động";

        const roleBadge = role === "Admin"
            ? '<span class="badge bg-danger">Admin</span>'
            : '<span class="badge bg-primary">User</span>';

        const statusBadge = active
            ? '<span class="badge bg-success">Hoạt động</span>'
            : '<span class="badge bg-secondary">Bị khóa</span>';

        return `
            <tr>
                <td>${escapeHTML(user.username)}</td>
                <td>${escapeHTML(user.fullname)}</td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-warning"
                        onclick="openEditUserModal(${index})">
                        Sửa
                    </button>
                    ${user.username !== localStorage.getItem("username") ? `
                    <button class="btn btn-sm btn-danger ms-1"
                        onclick="deleteUser(${index})">
                        Xóa
                    </button>` : ""}
                </td>
            </tr>`;
    }).join("");
}

function openAddUserModal() {
    editingUsername = null;

    document.getElementById("userForm").reset();
    document.getElementById("isEditUser").value = "false";
    document.getElementById("inputUsername").disabled = false;
    document.getElementById("inputPassword").value = "";
    document.getElementById("inputPassword").required = true;
    document.getElementById("passwordHelp").textContent =
        "Bắt buộc khi tạo tài khoản mới (tối thiểu 8 ký tự).";
    document.getElementById("modalTitle").textContent = "Thêm User Mới";
    document.getElementById("inputRole").value = "User";
    document.getElementById("inputStatus").value = "Hoạt động";

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("userModal")
    ).show();
}

function openEditUserModal(index) {
    const user = usersList[index];
    if (!user) return;

    editingUsername = user.username;

    document.getElementById("userForm").reset();
    document.getElementById("isEditUser").value = "true";
    document.getElementById("inputUsername").value = user.username;
    document.getElementById("inputUsername").disabled = true;
    document.getElementById("inputFullName").value = user.fullname || "";
    document.getElementById("inputRole").value = user.role;
    document.getElementById("inputStatus").value = user.status;
    document.getElementById("inputPassword").value = "";
    document.getElementById("inputPassword").required = false;
    document.getElementById("passwordHelp").textContent =
        "Không cần mật khẩu khi sửa thông tin.";

    document.getElementById("modalTitle").textContent = "Sửa thông tin User";

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("userModal")
    ).show();
}

async function saveUser() {
    const username = document.getElementById("inputUsername").value.trim();
    const fullname = document.getElementById("inputFullName").value.trim();
    const password = document.getElementById("inputPassword").value;
    const role = document.getElementById("inputRole").value.toLowerCase();
    const status = document.getElementById("inputStatus").value;
    const isEdit = document.getElementById("isEditUser").value === "true";

    if (!username || !fullname) {
        alert("Vui lòng nhập tên đăng nhập và họ tên.");
        return;
    }

    if (!isEdit && password.length < 8) {
        alert("Mật khẩu phải có ít nhất 8 ký tự.");
        return;
    }

    const payload = { fullname, role, status };

    try {
        if (isEdit) {
            await apiRequest(`/${encodeURIComponent(editingUsername)}`, {
                method: "PUT",
                body: JSON.stringify(payload)
            });
        } else {
            await apiRequest("", {
                method: "POST",
                body: JSON.stringify({ username, password, ...payload })
            });
        }

        bootstrap.Modal.getOrCreateInstance(
            document.getElementById("userModal")
        ).hide();

        alert(isEdit ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản mới.");
        await loadUsers();
    } catch (error) {
        showError(error);
    }
}

async function deleteUser(index) {
    const user = usersList[index];
    if (!user) return;

    if (!confirm(`Bạn có chắc muốn xóa tài khoản "${user.username}" không?`)) {
        return;
    }

    try {
        await apiRequest(`/${encodeURIComponent(user.username)}`, {
            method: "DELETE"
        });

        alert("Đã xóa tài khoản.");
        await loadUsers();
    } catch (error) {
        showError(error);
    }
}

if (token && userRole === "admin") {
    loadUsers();
}
