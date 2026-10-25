// Kiểm tra đăng nhập
if (!localStorage.getItem('token')) {
    alert('Bạn chưa đăng nhập!');
    window.location.href = 'index.html';
}

// Hàm hiển thị lỗi màu đỏ
function showError(message) {
    const errorDiv = document.getElementById('formError');
    errorDiv.innerText = message;
    errorDiv.style.display = 'block';
    // Tự động cuộn lên đầu form để người dùng thấy lỗi
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Hàm ẩn lỗi
function hideError() {
    document.getElementById('formError').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
    // 1. KHỞI TẠO LỊCH FLATPICKR
    const orderDateInput = document.getElementById('orderDate');
    if (orderDateInput && typeof flatpickr !== 'undefined') {
        flatpickr(orderDateInput, {
            dateFormat: 'd/m/Y',
            allowInput: true,
            disableMobile: true,
            locale: 'vn'
        });
    }

    // 2. KIỂM TRA CHẾ ĐỘ SỬA
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('id');

    if (editId) {
        document.getElementById('formTitle').innerText = "Sửa Đơn Hàng";
        document.getElementById('isEditMode').value = "true";

        let savedOrders = JSON.parse(localStorage.getItem('ordersData')) || [];
        const orderToEdit = savedOrders.find(o => o.id === editId);

        if (orderToEdit) {
            document.getElementById('orderId').value = orderToEdit.id;
            document.getElementById('orderId').disabled = true;

            if (orderToEdit.date) {
                const [y, m, d] = orderToEdit.date.split('-');
                document.getElementById('orderDate').value = `${d}/${m}/${y}`;
            }

            document.getElementById('agentAge').value = orderToEdit.age;
            document.getElementById('agentRating').value = orderToEdit.rating;
            document.getElementById('traffic').value = orderToEdit.traffic;
            document.getElementById('vehicle').value = orderToEdit.vehicle;
            document.getElementById('deliveryTime').value = orderToEdit.time;
        }
    }

    // 3. XỬ LÝ KHI BẤM NÚT "LƯU ĐƠN HÀNG"
    document.getElementById('orderForm').addEventListener('submit', function (event) {
        event.preventDefault();
        hideError(); // Ẩn lỗi cũ trước khi kiểm tra mới

        const isEdit = document.getElementById('isEditMode').value === "true";

        // Lấy dữ liệu
        const orderId = document.getElementById('orderId').value.trim();
        const dateValue = document.getElementById('orderDate').value.trim();
        const agentAge = parseInt(document.getElementById('agentAge').value, 10);
        const agentRating = parseFloat(document.getElementById('agentRating').value);
        const deliveryTime = parseInt(document.getElementById('deliveryTime').value, 10);

        // --- BẮT ĐẦU VALIDATE (KIỂM TRA LỖI) ---

        // 1. Kiểm tra mã đơn hàng trống
        if (!orderId) {
            showError("Vui lòng nhập Mã đơn hàng!");
            return;
        }

        // 2. Kiểm tra ngày tháng
        const dateParts = dateValue.split('/');
        if (dateParts.length !== 3) {
            showError("Vui lòng nhập ngày theo định dạng DD/MM/YYYY!");
            return;
        }

        const [day, month, year] = dateParts;
        const dayNum = Number(day);
        const monthNum = Number(month);
        const yearNum = Number(year);

        const checkDate = new Date(yearNum, monthNum - 1, dayNum);

        if (
            !day || !month || !year ||
            checkDate.getFullYear() !== yearNum ||
            checkDate.getMonth() !== monthNum - 1 ||
            checkDate.getDate() !== dayNum
        ) {
            showError("Ngày không hợp lệ. Vui lòng kiểm tra lại (Ví dụ: 25/10/2026)!");
            return;
        }

        // 3. Kiểm tra số (Tuổi, Đánh giá, Thời gian)
        if (agentAge < 18 || agentAge > 60) {
            showError("Tuổi Agent phải từ 18 đến 60!");
            return;
        }

        if (agentRating < 1 || agentRating > 5) {
            showError("Đánh giá phải từ 1 đến 5 sao!");
            return;
        }

        if (deliveryTime < 1) {
            showError("Thời gian giao hàng phải lớn hơn 0 phút!");
            return;
        }

        // --- KẾT THÚC VALIDATE ---

        // Tạo object dữ liệu
        const orderData = {
            id: orderId,
            date: `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
            age: agentAge,
            rating: agentRating,
            traffic: document.getElementById('traffic').value,
            vehicle: document.getElementById('vehicle').value,
            time: deliveryTime
        };

        let savedOrders = JSON.parse(localStorage.getItem('ordersData')) || [];

        if (isEdit) {
            const index = savedOrders.findIndex(o => o.id === orderData.id);
            if (index !== -1) {
                savedOrders[index] = orderData;
            }
        } else {
            savedOrders.unshift(orderData);
        }

        localStorage.setItem('ordersData', JSON.stringify(savedOrders));

        // Nếu lưu thành công thì chuyển trang (có thể thêm thông báo nếu muốn)
        window.location.href = 'orders.html';
    });
});