// 1. Kiểm tra đăng nhập
if (!localStorage.getItem('token')) {
    alert('Bạn chưa đăng nhập! Vui lòng đăng nhập lại.');
    window.location.href = 'index.html';
}

// 2. Lắng nghe sự kiện submit form
document.getElementById('predictForm').addEventListener('submit', function (e) {
    e.preventDefault(); // Chặn form load lại trang

    // Lấy dữ liệu người dùng nhập
    const traffic = document.getElementById('traffic').value;
    const vehicle = document.getElementById('vehicle').value;
    const distance = parseFloat(document.getElementById('distance').value);
    const age = parseInt(document.getElementById('agentAge').value);

    // Hiển thị trạng thái đang tải (Loading)
    const btnSubmit = document.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = 'Đang phân tích dữ liệu...';
    btnSubmit.disabled = true;

    /* 
       ========================================================
       TẠM THỜI DÙNG LOGIC GIẢ LẬP (MOCK AI) 
       Vì TV3 chưa làm xong API thật, mình giả lập công thức
       dựa trên các quy tắc thực tế của dữ liệu.
       ========================================================
    */
    setTimeout(() => {
        // Công thức giả lập: Giao thông + Phương tiện + Khoảng cách
        let baseTime = 20; // Thời gian cơ bản (phút)

        // Cộng thêm thời gian theo giao thông
        if (traffic === 'Low') baseTime += 20;
        else if (traffic === 'Medium') baseTime += 40;
        else if (traffic === 'High') baseTime += 80;
        else if (traffic === 'Jam') baseTime += 130;

        // Cộng thêm thời gian do phương tiện
        if (vehicle === 'Van') baseTime += 15;

        // Cộng thêm thời gian do khoảng cách (giả sử 3 phút / 1km)
        baseTime += (distance * 3);

        // Nếu agent lớn tuổi, thời gian có thể lâu hơn chút
        if (age > 35) baseTime += 10;

        // Làm tròn kết quả
        const finalPrediction = Math.round(baseTime);

        // Hiển thị kết quả ra màn hình
        document.getElementById('predictionResult').innerText = `${finalPrediction} phút`;
        document.getElementById('resultBox').style.display = 'block';

        // Trả lại trạng thái cho nút bấm
        btnSubmit.innerHTML = originalText;
        btnSubmit.disabled = false;

        /*
           ========================================================
           KHI TV3 CÓ API THẬT, BẠN SẼ THAY ĐOẠN TRÊN BẰNG ĐOẠN NÀY:
           (Bạn không cần làm bây giờ, mình để đây để bạn biết sau này sửa)
           
           fetch('http://127.0.0.1:8000/api/predict', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ traffic, vehicle, distance, age })
           })
           .then(res => res.json())
           .then(data => {
               document.getElementById('predictionResult').innerText = `${data.predicted_time} phút`;
               document.getElementById('resultBox').style.display = 'block';
               btnSubmit.innerHTML = originalText;
               btnSubmit.disabled = false;
           });
           ========================================================
        */

    }, 1000); // Giả lập độ trễ 1 giây để giống AI đang tính toán
});