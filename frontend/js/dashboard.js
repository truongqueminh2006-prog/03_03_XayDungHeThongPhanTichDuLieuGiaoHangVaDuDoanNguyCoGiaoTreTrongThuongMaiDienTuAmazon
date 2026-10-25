// Kiểm tra phân quyền: Nếu chưa có token (chưa đăng nhập) thì đá về trang login
if (!localStorage.getItem('token')) {
    alert('Bạn chưa đăng nhập! Vui lòng đăng nhập lại.');
    window.location.href = 'index.html';
}
// 1. Vẽ biểu đồ cột: Thời gian giao TB theo phương tiện (Scooter vs Van)
const ctx1 = document.getElementById('vehicleChart').getContext('2d');
new Chart(ctx1, {
    type: 'bar',
    data: {
        labels: ['Scooter', 'Van'], // Trục X
        datasets: [{
            label: 'Thời gian giao trung bình (phút)',
            data: [120, 160], // Dữ liệu giả (Mock data)
            backgroundColor: ['#0d6efd', '#6c757d'],
            borderRadius: 5
        }]
    },
    options: {
        responsive: true,
        scales: {
            y: { beginAtZero: true }
        }
    }
});

// 2. Vẽ biểu đồ tròn: Tỷ lệ các mức giao thông
const ctx2 = document.getElementById('trafficChart').getContext('2d');
new Chart(ctx2, {
    type: 'doughnut',
    data: {
        labels: ['Low', 'Medium', 'High', 'Jam'],
        datasets: [{
            data: [30, 25, 25, 20], // Dữ liệu giả (%)
            backgroundColor: ['#198754', '#ffc107', '#fd7e14', '#dc3545']
        }]
    },
    options: {
        responsive: true
    }
});