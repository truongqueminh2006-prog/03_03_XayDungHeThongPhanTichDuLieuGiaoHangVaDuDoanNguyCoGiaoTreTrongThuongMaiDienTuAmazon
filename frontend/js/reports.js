// 1. KIỂM TRA ĐĂNG NHẬP VÀ PHÂN QUYỀN
// Kiểm tra xem đã đăng nhập chưa
if (!localStorage.getItem('token')) {
    alert('Bạn chưa đăng nhập! Vui lòng đăng nhập lại.');
    window.location.href = 'index.html';
    throw new Error("Chưa đăng nhập");
}

// Lấy quyền (role) từ localStorage
const userRole = localStorage.getItem('role');

// Nếu không phải admin thì chặn lại
if (userRole !== 'admin') {
    alert('Bạn không có quyền truy cập trang này! Chỉ Admin mới được vào.');
    window.location.href = 'dashboard.html';
    throw new Error("Không có quyền Admin");
}

// 2. CHỨC NĂNG XUẤT BÁO CÁO CSV
document.getElementById('btnExport').addEventListener('click', async function () {
    const token = localStorage.getItem('token');

    if (!token) {
        alert('Bạn chưa đăng nhập!');
        return;
    }

    const button = this;
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Đang xuất dữ liệu...';

    try {
        const pageSize = 1000;
        let skip = 0;
        let total = null;
        const allOrders = [];

        // Lấy lần lượt từng trang cho đến khi đủ toàn bộ đơn hàng
        while (total === null || skip < total) {
            const response = await fetch(
                `http://127.0.0.1:8000/api/orders/?limit=${pageSize}&skip=${skip}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Lỗi API: HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!Array.isArray(result.data)) {
                throw new Error('Dữ liệu API không đúng định dạng.');
            }

            if (total === null) {
                total = result.total;
            }

            allOrders.push(...result.data);

            if (result.data.length === 0) {
                break;
            }

            skip += result.data.length;

            button.textContent =
                `Đang xuất ${allOrders.length.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')}...`;
        }

        if (allOrders.length === 0) {
            throw new Error('Không có dữ liệu đơn hàng để xuất.');
        }

        // Dùng danh sách cột từ đơn hàng đầu tiên
        const columns = Object.keys(allOrders[0]);

        function escapeCSV(value) {
            if (value === null || value === undefined) {
                return '';
            }

            let text = String(value);

            // Bảo vệ Excel khỏi diễn giải dữ liệu bắt đầu bằng ký tự công thức
            if (/^[\t\r ]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return '"' + text.replace(/"/g, '""') + '"';
        }

        const csvRows = [
            columns.map(escapeCSV).join(','),
            ...allOrders.map(order =>
                columns.map(column => escapeCSV(order[column])).join(',')
            )
        ];

        // BOM giúp Excel nhận diện UTF-8
        const csvContent = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvContent], {
            type: 'text/csv;charset=utf-8;'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'bao_cao_don_hang.csv';

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

        alert(
            `Xuất CSV thành công!\nĐã xuất ${allOrders.length.toLocaleString('vi-VN')} đơn hàng.`
        );
    } catch (error) {
        console.error('Export CSV error:', error);
        alert(`Không thể xuất báo cáo: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = oldText;
    }
});

// 3. CHỨC NĂNG BACKUP
document.getElementById('btnBackup').addEventListener('click', async function () {
    const token = localStorage.getItem('token');

    if (!token) {
        alert('Bạn chưa đăng nhập!');
        return;
    }

    if (!confirm('Bạn có chắc chắn muốn sao lưu toàn bộ dữ liệu không?')) {
        return;
    }

    const button = this;
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = 'Đang sao lưu...';

    try {
        const response = await fetch(
            'http://127.0.0.1:8000/api/backup/download',
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Lỗi HTTP ${response.status}`);
        }

        const blob = await response.blob();

        if (blob.size === 0) {
            throw new Error('File backup rỗng.');
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `delivery_analytics_backup_${new Date()
            .toISOString().replace(/[:.]/g, '-')}.zip`;

        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        alert('Sao lưu thành công! File ZIP đã được tải xuống máy.');
    } catch (error) {
        console.error('Backup error:', error);
        alert(`Không thể sao lưu dữ liệu: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = oldText;
    }
});

//* 4. CHỨC NĂNG RESTORE THỬ NGHIỆM *//
document.getElementById('btnRestore').addEventListener('click', async function () {
    const fileInput = document.getElementById('restoreFile');
    const token = localStorage.getItem('token');

    if (!token) {
        alert('Bạn chưa đăng nhập! Vui lòng đăng nhập lại.');
        window.location.href = 'index.html';
        return;
    }

    if (localStorage.getItem('role') !== 'admin') {
        alert('Bạn không có quyền thực hiện chức năng này!');
        return;
    }

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert('Vui lòng chọn file backup ZIP trước khi khôi phục!');
        return;
    }

    const file = fileInput.files[0];

    if (!file.name.toLowerCase().endsWith('.zip')) {
        alert('File không đúng định dạng. Vui lòng chọn file ZIP.');
        return;
    }

    if (file.size === 0) {
        alert('File backup rỗng. Vui lòng chọn file khác.');
        return;
    }

    if (!confirm(
        'XÁC NHẬN KHÔI PHỤC THỬ NGHIỆM\n\n' +
        'Database đích: delivery_restore_test\n\n' +
        '• Không thay đổi database gốc delivery_analytics.\n' +
        '• Không tự động xóa dữ liệu hiện có.\n' +
        '• Nếu database thử nghiệm đã có dữ liệu, hệ thống sẽ từ chối ghi đè.\n\n' +
        'Bạn có muốn tiếp tục không?'
    )) {
        return;
    }

    const button = this;
    const oldText = button.textContent;

    button.disabled = true;
    button.textContent = 'Đang khôi phục thử nghiệm...';

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
            'http://127.0.0.1:8000/api/restore/test-restore',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            }
        );

        const result = await response.json().catch(() => ({}));

        // Database thử nghiệm đã có dữ liệu: không thử ghi đè
        if (response.status === 409) {
            alert(
                'KHÔNG THỂ KHÔI PHỤC THỬ NGHIỆM\n\n' +
                'Database delivery_restore_test đã có dữ liệu.\n\n' +
                'Hệ thống đã từ chối ghi đè để bảo vệ dữ liệu hiện có.\n' +
                'Database gốc delivery_analytics không bị thay đổi.\n\n' +
                'Nếu lần khôi phục trước đã thành công, bạn không cần khôi phục lại.'
            );
            return;
        }

        if (response.status === 400) {
            throw new Error(
                result.detail ||
                'File backup không hợp lệ hoặc dữ liệu trong file có vấn đề.'
            );
        }

        if (response.status === 401) {
            throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
        }

        if (response.status === 403) {
            throw new Error('Bạn không có quyền thực hiện chức năng này.');
        }

        if (!response.ok) {
            throw new Error(
                result.detail || `Máy chủ trả về lỗi HTTP ${response.status}.`
            );
        }

        if (result.success !== true) {
            throw new Error('API chưa xác nhận khôi phục thành công.');
        }

        const collectionDetails = Object.entries(result.collections || {})
            .map(([name, count]) =>
                `${name}: ${Number(count).toLocaleString('vi-VN')}`
            )
            .join('\n');

        alert(
            'KHÔI PHỤC THỬ NGHIỆM THÀNH CÔNG!\n\n' +
            `Database: ${result.database}\n` +
            `Tổng bản ghi: ${Number(result.total_documents).toLocaleString('vi-VN')}\n\n` +
            'Chi tiết collection:\n' +
            collectionDetails +
            '\n\nDatabase gốc delivery_analytics không bị thay đổi.'
        );

    } catch (error) {
        console.error('Restore test error:', error);

        alert(
            'KHÔNG THỂ HOÀN TẤT KHÔI PHỤC THỬ NGHIỆM\n\n' +
            `${error.message}\n\n` +
            'Hệ thống không tự động xóa database thử nghiệm hoặc ghi đè dữ liệu. ' +
            'Vui lòng kiểm tra trạng thái database trước khi thử lại.'
        );
    } finally {
        button.disabled = false;
        button.textContent = oldText;
    }
})