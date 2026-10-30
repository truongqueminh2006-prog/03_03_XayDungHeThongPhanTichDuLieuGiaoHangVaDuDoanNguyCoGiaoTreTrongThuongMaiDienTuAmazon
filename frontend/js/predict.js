const token = localStorage.getItem("token");

if (!token) {
    alert("Bạn chưa đăng nhập! Vui lòng đăng nhập lại.");
    window.location.href = "index.html";
}

const predictForm = document.getElementById("predictForm");

if (predictForm) {
    predictForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const btnSubmit = predictForm.querySelector('button[type="submit"]');
        const resultBox = document.getElementById("resultBox");
        const predictionResult = document.getElementById("predictionResult");

        const originalText = btnSubmit.innerHTML;

        const temperature = document.getElementById("temperature");
        const precipitation = document.getElementById("precipitation");
        const windSpeed = document.getElementById("windSpeed");

        // Lấy dữ liệu từ form
        const payload = {
            agent_age: Number(document.getElementById("agentAge").value),
            agent_rating: Number(document.getElementById("agentRating").value),
            distance_km: Number(document.getElementById("distance").value),
            traffic: document.getElementById("traffic").value,
            vehicle: document.getElementById("vehicle").value.toLowerCase(),
            area: document.getElementById("area").value,
            category: document.getElementById("category").value,
            order_datetime: new Date().toISOString()
        };

        if (temperature && temperature.value !== "") {
            payload.temperature_c = Number(temperature.value);
        }

        if (precipitation && precipitation.value !== "") {
            payload.precipitation_mm = Number(precipitation.value);
        }

        if (windSpeed && windSpeed.value !== "") {
            payload.wind_speed_kmh = Number(windSpeed.value);
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "Đang chạy 3 mô hình AI...";

        resultBox.style.display = "block";
        predictionResult.innerText = "Đang dự đoán...";

        // Tạo khu vực hiển thị thêm kết quả nếu chưa có
        let extraResults = document.getElementById("extraPredictionResults");

        if (!extraResults) {
            extraResults = document.createElement("div");
            extraResults.id = "extraPredictionResults";
            extraResults.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 16px;
                margin-top: 18px;
            `;
            resultBox.appendChild(extraResults);
        }

        extraResults.innerHTML = `
            <div style="padding:20px;border-radius:10px;background:#fff3cd;border:1px solid #ffe69c;">
                <h3 style="margin-top:0;">⚠️ Rủi ro giao hàng</h3>
                <p>Đang phân loại...</p>
            </div>
            <div style="padding:20px;border-radius:10px;background:#d1e7dd;border:1px solid #a3cfbb;">
                <h3 style="margin-top:0;">🧩 Phân cụm K-Means</h3>
                <p>Đang phân cụm...</p>
            </div>
        `;

        // Hàm gọi API và đọc lỗi
        async function callPredictionAPI(endpoint) {
            const response = await fetch(
                `http://127.0.0.1:8000/api/predict/${endpoint}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                const detail = typeof data.detail === "string"
                    ? data.detail
                    : JSON.stringify(data.detail || data);

                throw new Error(`${endpoint}: ${detail || response.status}`);
            }

            return data;
        }

        try {
            // Gọi 3 API song song
            const results = await Promise.allSettled([
                callPredictionAPI("delivery-time"),
                callPredictionAPI("delivery-risk"),
                callPredictionAPI("cluster")
            ]);

            // 1. Thời gian giao hàng
            const timeResult = results[0];

            if (timeResult.status === "fulfilled") {
                const data = timeResult.value;

                if (typeof data.predicted_minutes !== "number") {
                    predictionResult.innerText = "API không trả về thời gian hợp lệ.";
                } else {
                    predictionResult.innerText =
                        `${data.predicted_minutes.toFixed(2)} phút`;
                }
            } else {
                predictionResult.innerText = "Không thể dự đoán thời gian.";
            }

            // 2. Phân loại rủi ro
            const riskResult = results[1];

            if (riskResult.status === "fulfilled") {
                const data = riskResult.value;
                const probability = Number(data.risk_probability);

                const probabilityText = Number.isFinite(probability)
                    ? `${(probability * 100).toFixed(1)}%`
                    : "Chưa có dữ liệu";

                const riskColor = Number(data.risk_class) === 1
                    ? "#b02a37"
                    : "#146c43";

                extraResults.children[0].innerHTML = `
                    <h3 style="margin-top:0;">⚠️ Rủi ro giao hàng</h3>
                    <p style="font-size:19px;font-weight:bold;color:${riskColor};">
                        ${data.risk_label}
                    </p>
                    <p>Xác suất thuộc nhóm rủi ro: ${probabilityText}</p>
                    <p style="font-size:13px;color:#555;">
                        Ngưỡng phân loại: ${(Number(data.probability_threshold) * 100).toFixed(0)}%
                    </p>
                `;
            } else {
                extraResults.children[0].innerHTML = `
                    <h3 style="margin-top:0;">⚠️ Rủi ro giao hàng</h3>
                    <p style="color:#b02a37;">Không lấy được kết quả.</p>
                    <p style="font-size:13px;">${riskResult.reason.message}</p>
                `;
            }

            // 3. Phân cụm K-Means
            const clusterResult = results[2];

            if (clusterResult.status === "fulfilled") {
                const data = clusterResult.value;

                extraResults.children[1].innerHTML = `
                    <h3 style="margin-top:0;">🧩 Phân cụm K-Means</h3>
                    <p style="font-size:28px;font-weight:bold;color:#146c43;">
                        Cụm ${data.cluster}
                    </p>
                    <p>Tổng số cụm: ${data.total_clusters}</p>
                    <p style="font-size:13px;color:#555;">
                        Mô hình: ${data.model}
                    </p>
                `;
            } else {
                extraResults.children[1].innerHTML = `
                    <h3 style="margin-top:0;">🧩 Phân cụm K-Means</h3>
                    <p style="color:#b02a37;">Không lấy được kết quả.</p>
                    <p style="font-size:13px;">${clusterResult.reason.message}</p>
                `;
            }

            // Thông báo nếu có API gặp lỗi
            const failedAPIs = results
                .map((result, index) => ({
                    result,
                    name: ["Thời gian giao hàng", "Rủi ro giao hàng", "K-Means"][index]
                }))
                .filter(item => item.result.status === "rejected");

            if (failedAPIs.length > 0) {
                alert(
                    "Một số mô hình chưa trả về kết quả:\n" +
                    failedAPIs.map(item =>
                        `${item.name}: ${item.result.reason.message}`
                    ).join("\n") +
                    "\n\nRin kiểm tra backend và API tương ứng nhé."
                );
            }

        } catch (error) {
            predictionResult.innerText = "Đã xảy ra lỗi khi dự đoán.";
            alert("Lỗi: " + error.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
        }
    });
}
