// 1. Dữ liệu mẫu (Mock Data lấy từ file CSV của TV1)
const allOrders = [
    { id: "ialx566343618", date: "2022-03-19", age: 37, rating: 4.9, traffic: "High", vehicle: "Van", time: 120 },
    { id: "akqg208421122", date: "2022-03-25", age: 34, rating: 4.5, traffic: "Jam", vehicle: "Scooter", time: 165 },
    { id: "njpu434582536", date: "2022-03-19", age: 23, rating: 4.4, traffic: "Low", vehicle: "Scooter", time: 130 },
    { id: "rjto796129700", date: "2022-04-05", age: 38, rating: 4.7, traffic: "Medium", vehicle: "Scooter", time: 105 },
    { id: "zguw716275638", date: "2022-03-26", age: 32, rating: 4.6, traffic: "High", vehicle: "Scooter", time: 150 },
    { id: "fxuu788413734", date: "2022-03-11", age: 22, rating: 4.8, traffic: "Jam", vehicle: "Scooter", time: 130 },
    { id: "njmo150975311", date: "2022-03-04", age: 33, rating: 4.7, traffic: "Jam", vehicle: "Scooter", time: 200 },
    { id: "jvjc772545076", date: "2022-03-14", age: 35, rating: 4.6, traffic: "Medium", vehicle: "Scooter", time: 160 }
];

// 2. Hàm hiển thị dữ liệu ra bảng
function renderTable(data) {
    const tbody = document.getElementById('orderTableBody');
    tbody.innerHTML = ''; // Xóa dữ liệu cũ

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Không tìm thấy đơn hàng nào!</td></tr>';
        return;
    }

    data.forEach(order => {
        // Tạo màu cho nhãn Giao thông cho đẹp
        let trafficBadge = "";
        if (order.traffic === "Low") trafficBadge = '<span class="badge bg-success">Low</span>';
        else if (order.traffic === "Medium") trafficBadge = '<span class="badge bg-warning text-dark">Medium</span>';
        else if (order.traffic === "High") trafficBadge = '<span class="badge bg-orange" style="background-color: #fd7e14;">High</span>';
        else if (order.traffic === "Jam") trafficBadge = '<span class="badge bg-danger">Jam</span>';

        const row = `
                    <tr>
                        <td class="fw-bold">${order.id}</td>
                        <td>${order.date}</td>
                        <td>${order.age}</td>
                        <td>${order.rating} ⭐</td>
                        <td>${trafficBadge}</td>
                        <td>${order.vehicle}</td>
                        <td>${order.time}</td>
                        <td>
                            <button class="btn btn-sm btn-info text-white" onclick="alert('Xem chi tiết đơn: ${order.id}')">Xem</button>
                            <button class="btn btn-sm btn-warning" onclick="alert('Sửa đơn: ${order.id}')">Sửa</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteOrder('${order.id}')">Xóa</button>
                        </td>
                    </tr>
                `;
        tbody.innerHTML += row;
    });
}

// 3. Hàm xử lý Tìm kiếm & Lọc
function applyFilters() {
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    const trafficFilter = document.getElementById('filterTraffic').value;

    const filteredData = allOrders.filter(order => {
        // Kiểm tra từ khóa (theo mã đơn)
        const matchKeyword = order.id.toLowerCase().includes(keyword);
        // Kiểm tra bộ lọc giao thông
        const matchTraffic = trafficFilter === "" || order.traffic === trafficFilter;

        return matchKeyword && matchTraffic;
    });

    renderTable(filteredData);
}

// 4. Hàm làm mới bộ lọc
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterTraffic').value = '';
    renderTable(allOrders);
}

// 5. Hàm xóa đơn hàng (Mock)
function deleteOrder(id) {
    if (confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${id} không?`)) {
        alert(`Đã xóa đơn hàng ${id} (Chức năng thật sẽ gọi API của TV3)`);
    }
}

// 6. Chạy hiển thị bảng lần đầu khi mở trang
renderTable(allOrders);