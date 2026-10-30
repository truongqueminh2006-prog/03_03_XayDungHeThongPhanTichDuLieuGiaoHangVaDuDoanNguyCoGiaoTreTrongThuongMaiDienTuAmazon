
const API_BASE_URL = "http://127.0.0.1:8000";
const BATCH_SIZE = 1000;

let allOrders = [];
let currentOrders = [];

// 1. KIỂM TRA ĐĂNG NHẬP
function getToken() {
    const token = localStorage.getItem("token");

    if (!token || token === "fake-jwt-token") {
        alert("Vui lòng đăng nhập bằng tài khoản thật.");
        window.location.href = "index.html";
        return null;
    }

    return token;
}

// 2. CHUYỂN DỮ LIỆU THÀNH HTML AN TOÀN
function escapeHTML(value) {
    return String(value ?? "—").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// 3. ĐỊNH DẠNG NGÀY ĐẶT HÀNG
function formatOrderDate(order) {
    const key = String(order.DateKey ?? "");

    if (/^\d{8}$/.test(key)) {
        return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
    }

    return order.Order_Date ?? "—";
}

// 4. CHUẨN HÓA DỮ LIỆU ĐƠN HÀNG
function normalizeOrder(order) {
    return {
        id: String(order.Order_ID ?? ""),
        date: formatOrderDate(order),
        age: order.Agent_Age ?? "—",
        rating: order.Agent_Rating ?? "—",
        traffic: order.Traffic ?? "—",
        vehicle: order.VehicleKey != null
            ? `Vehicle ${order.VehicleKey}`
            : "—",
        time: order.Delivery_Time ?? "—",
        raw: order
    };
}

// 5. TẢI TOÀN BỘ ĐƠN HÀNG TỪ FASTAPI
async function loadOrders() {
    const token = getToken();
    if (!token) return;

    const tbody = document.getElementById("orderTableBody");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    Đang chuẩn bị tải đơn hàng...
                </td>
            </tr>
        `;
    }

    try {
        let skip = 0;
        let total = null;
        const records = [];

        while (total === null || skip < total) {
            const response = await fetch(
                `${API_BASE_URL}/api/orders/?limit=${BATCH_SIZE}&skip=${skip}`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Accept": "application/json"
                    }
                }
            );

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("token");
                localStorage.removeItem("role");

                alert(
                    "Phiên đăng nhập hết hạn hoặc bạn không có quyền truy cập."
                );

                window.location.href = "index.html";
                return;
            }

            if (!response.ok) {
                throw new Error(`API trả về HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!Array.isArray(result.data)) {
                throw new Error(
                    "API không trả về danh sách đơn hàng hợp lệ."
                );
            }

            if (total === null) {
                total = Number(result.total);

                if (!Number.isFinite(total) || total < 0) {
                    throw new Error("Tổng số đơn hàng không hợp lệ.");
                }
            }

            if (result.data.length === 0 && skip < total) {
                throw new Error(
                    "API không trả thêm dữ liệu. Đã dừng để tránh lặp vô hạn."
                );
            }

            records.push(...result.data);
            skip += result.data.length;

            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4">
                            Đang tải
                            <strong>
                                ${records.length.toLocaleString("vi-VN")}
                            </strong>
                            /
                            <strong>
                                ${total.toLocaleString("vi-VN")}
                            </strong>
                            đơn hàng...
                        </td>
                    </tr>
                `;
            }

            console.log(
                `Tiến độ tải: ${records.length}/${total} đơn hàng`
            );
        }

        // Chuẩn hóa toàn bộ dữ liệu sau khi tải xong
        allOrders = records.map(normalizeOrder);
        currentOrders = [...allOrders];

        console.log("Tổng đơn hàng backend:", total);
        console.log("Tổng đơn hàng đã tải:", allOrders.length);

        // Hiển thị danh sách sau khi tải
        applyFilters();

    } catch (error) {
        console.error("Lỗi tải đơn hàng:", error);
        console.error("Chi tiết:", error.message);

        if (tbody) {
            tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger py-4">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
        }
    }

}

// 6. HIỂN THỊ BẢNG ĐƠN HÀNG
function renderTable(data) {
    const tbody = document.getElementById("orderTableBody");
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    Không tìm thấy đơn hàng nào!
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map(order => {
        let trafficBadge = "";

        switch (order.traffic) {
            case "Low":
                trafficBadge =
                    '<span class="badge bg-success">Low</span>';
                break;

            case "Medium":
                trafficBadge =
                    '<span class="badge bg-warning text-dark">Medium</span>';
                break;

            case "High":
                trafficBadge =
                    '<span class="badge" style="background-color:#fd7e14">High</span>';
                break;

            case "Jam":
                trafficBadge =
                    '<span class="badge bg-danger">Jam</span>';
                break;

            default:
                trafficBadge = `
                    <span class="badge bg-secondary">
                        ${escapeHTML(order.traffic)}
                    </span>
                `;
        }

        const safeId = escapeHTML(order.id);
        const safeDate = escapeHTML(order.date);
        const safeAge = escapeHTML(order.age);
        const safeRating = escapeHTML(order.rating);
        const safeVehicle = escapeHTML(order.vehicle);
        const safeTime = escapeHTML(order.time);

        return `
            <tr>
                <td class="fw-bold">${safeId}</td>
                <td>${safeDate}</td>
                <td>${safeAge}</td>
                <td>
                    ${safeRating === "—" ? "—" : `${safeRating} ⭐`}
                </td>
                <td>${trafficBadge}</td>
                <td>${safeVehicle}</td>
                <td>
                    ${safeTime === "—" ? "—" : `${safeTime} phút`}
                </td>
                <td>
                    <button
                        class="btn btn-sm btn-info text-white"
                        onclick="viewOrder('${safeId}')">
                        Xem
                    </button>

                    <button
                        class="btn btn-sm btn-warning"
                        onclick="editOrder('${safeId}')">
                        Sửa
                    </button>

                    <button
                        class="btn btn-sm btn-danger"
                        onclick="deleteOrder('${safeId}')">
                        Xóa
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// 7. TÌM KIẾM VÀ LỌC ĐƠN HÀNG
function applyFilters() {
    const searchElement = document.getElementById("searchInput");
    const trafficElement = document.getElementById("filterTraffic");

    const keyword = (searchElement?.value ?? "")
        .trim()
        .toLowerCase();

    const trafficFilter = trafficElement?.value ?? "";

    currentOrders = allOrders.filter(order => {
        const matchKeyword = order.id.toLowerCase().includes(keyword);

        const matchTraffic =
            trafficFilter === "" ||
            order.traffic === trafficFilter;

        return matchKeyword && matchTraffic;
    });

    renderTable(currentOrders);

    // Cập nhật số lượng kết quả nếu HTML có phần tử này
    const resultCount = document.getElementById("orderResultCount");

    if (resultCount) {
        resultCount.textContent =
            `Hiển thị ${currentOrders.length.toLocaleString("vi-VN")} / ` +
            `${allOrders.length.toLocaleString("vi-VN")} đơn hàng`;
    }
}

// 8. ĐẶT LẠI BỘ LỌC
function resetFilters() {
    const searchElement = document.getElementById("searchInput");
    const trafficElement = document.getElementById("filterTraffic");

    if (searchElement) searchElement.value = "";
    if (trafficElement) trafficElement.value = "";

    applyFilters();
}

// 9. MỞ TRANG SỬA ĐƠN HÀNG
function editOrder(id) {
    window.location.href =
        `order-form.html?id=${encodeURIComponent(id)}`;
}

// 10. XEM CHI TIẾT ĐƠN HÀNG
function viewOrder(id) {
    const order = allOrders.find(item => item.id === String(id));
    if (!order) return;

    const fields = {
        modalOrderId: order.id,
        modalOrderDate: order.date,
        modalAgentAge: order.age,
        modalAgentRating: order.rating,
        modalTraffic: order.traffic,
        modalVehicle: order.vehicle,
        modalDeliveryTime:
            order.time === "—" ? "—" : `${order.time} phút`
    };

    for (const [elementId, value] of Object.entries(fields)) {
        const element = document.getElementById(elementId);

        if (element) {
            element.textContent = value;
        }
    }

    const modalElement = document.getElementById("orderDetailModal");

    if (modalElement && typeof bootstrap !== "undefined") {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
    }
}

// 11. XÓA ĐƠN HÀNG QUA API
async function deleteOrder(id) {
    if (localStorage.getItem("role") !== "admin") {
        alert("Chỉ Admin mới được phép xóa đơn hàng.");
        return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${id} không?`)) {
        return;
    }

    const token = getToken();
    if (!token) return;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/orders/${encodeURIComponent(id)}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            }
        );

        if (response.status === 401 || response.status === 403) {
            alert(
                "Bạn không có quyền xóa đơn hàng hoặc phiên đăng nhập đã hết hạn."
            );
            return;
        }

        if (!response.ok) {
            const message = await response.text();

            throw new Error(`HTTP ${response.status}: ${message}`);
        }

        alert("Đã xóa đơn hàng thành công.");

        // Tải lại danh sách để đồng bộ với MongoDB
        await loadOrders();

    } catch (error) {
        console.error("Lỗi xóa đơn hàng:", error);

        alert(
            "Không xóa được đơn hàng. Hãy kiểm tra endpoint DELETE trong backend."
        );
    }
}

// 12. KHỞI TẠO TRANG
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("searchInput")
        ?.addEventListener("input", applyFilters);

    document.getElementById("filterTraffic")
        ?.addEventListener("change", applyFilters);

    loadOrders();
});
