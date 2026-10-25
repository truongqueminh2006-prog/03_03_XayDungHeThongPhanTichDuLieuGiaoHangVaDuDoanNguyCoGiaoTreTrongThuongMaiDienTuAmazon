// Kiểm tra đăng nhập
if (!localStorage.getItem('token')) {
    alert('Bạn chưa đăng nhập!');
    window.location.href = 'index.html';
}

// 1. Chức năng Xuất báo cáo CSV (Giả lập tạo file)
document.getElementById('btnExport').addEventListener('click', function () {
    // Tạo dữ liệu giả lập dạng CSV
    const csvContent = "Order_ID,Ngay_dat,Giao_thong,Thoi_gian_giao\n" +
        "ialx566343618,2022-03-19,High,120\n" +
        "akqg208421122,2022-03-25,Jam,165\n" +
        "njpu434582536,2022-03-19,Low,130\n" +
        "rjto796129700,2022-04-05,Medium,105";

    // Tạo file blob và link tải xuống
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bao_cao_don_hang.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("Đã tải xuống file báo cáo thành công!");
});

// 2. Chức năng Backup
document.getElementById('btnBackup').addEventListener('click', function () {
    if (confirm("Bạn có chắc chắn muốn sao lưu toàn bộ dữ liệu không?")) {
        // Giả lập gọi API của TV3 để chạy lệnh mongodump
        setTimeout(() => {
            alert("✅ Sao lưu thành công! File backup đã được lưu trên server.");
        }, 1000);
    }
});

// 3. Chức năng Restore
document.getElementById('btnRestore').addEventListener('click', function () {
    const fileInput = document.getElementById('restoreFile');
    if (fileInput.files.length === 0) {
        alert("Vui lòng chọn file backup trước khi phục hồi!");
        return;
    }

    if (confirm("CẢNH BÁO: Phục hồi sẽ ghi đè lên dữ liệu hiện tại. Bạn có chắc chắn?")) {
        // Giả lập gọi API của TV3 để chạy lệnh mongorestore
        setTimeout(() => {
            alert("✅ Phục hồi dữ liệu thành công!");
        }, 1500);
    }
});