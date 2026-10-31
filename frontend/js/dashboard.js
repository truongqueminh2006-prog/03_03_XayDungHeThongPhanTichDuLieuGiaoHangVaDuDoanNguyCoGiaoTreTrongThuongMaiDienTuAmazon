const API_BASE_URL = "http://127.0.0.1:8000";

// Quản lý các biểu đồ
const dashboardCharts = {};

// Quản lý dữ liệu và bản đồ Phần 2
let section2Loaded = false;
let section2Map = null;
let section2MapLayer = null;

const chartColors = [
    "#0d6efd", "#198754", "#ffc107", "#dc3545",
    "#6f42c1", "#fd7e14", "#20c997", "#6c757d",
    "#d63384", "#0dcaf0", "#adb5bd", "#6610f2",
    "#1982c4", "#8ac926", "#ff595e", "#0d6efd"
];

// Kiểm tra đăng nhập
function checkLogin() {
    const token = localStorage.getItem("token");

    if (!token || token === "fake-jwt-token") {
        alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// Lời chào người dùng
function updateGreeting() {
    const role = localStorage.getItem("role");
    const greeting = document.getElementById("userGreeting");

    if (greeting) {
        greeting.textContent =
            role === "admin"
                ? "Xin chào, Admin!"
                : "Xin chào, Thành viên!";
    }
}

// Định dạng số
function formatNumber(value, digits = 0) {
    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {
        return "N/A";
    }

    return Number(value).toLocaleString("vi-VN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

// Tạo hoặc cập nhật biểu đồ
function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);

    if (!canvas || typeof Chart === "undefined") return;

    if (dashboardCharts[canvasId]) {
        dashboardCharts[canvasId].destroy();
    }

    dashboardCharts[canvasId] = new Chart(
        canvas.getContext("2d"),
        config
    );
}

// Lấy token và tải Dashboard
async function loadDashboard() {
    if (!checkLogin()) return;

    updateGreeting();

    const token = localStorage.getItem("token");

    // Thiết lập ngày mặc định
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");

    if (startInput && !startInput.value) {
        startInput.value = "2022-02-11";
    }

    if (endInput && !endInput.value) {
        endInput.value = "2022-04-06";
    }

    // Gắn sự kiện bộ lọc
    document.getElementById("applyFilters")?.addEventListener(
        "click",
        () => loadOverview(localStorage.getItem("token"))
    );

    document.getElementById("resetFilters")?.addEventListener(
        "click",
        () => {
            if (startInput) startInput.value = "2022-02-11";
            if (endInput) endInput.value = "2022-04-06";

            const areaInput = document.getElementById("areaFilter");
            if (areaInput) areaInput.value = "";

            loadOverview(localStorage.getItem("token"));
        }
    );

    // Tải thống kê Actual_Risk
    await loadActualRiskSummary(token);

    // Tải dữ liệu tổng quan
    await loadOverview(token);

    // Thiết lập chuyển tab Dashboard
    setupReportTabs(token);
}

// Lấy dữ liệu API Dashboard Overview
async function loadOverview(token) {
    const startDate = document.getElementById("startDate")?.value;
    const endDate = document.getElementById("endDate")?.value;
    const area = document.getElementById("areaFilter")?.value || "";

    const statusElement = document.getElementById("filterStatus");

    if (startDate && endDate && startDate > endDate) {
        alert("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
        return;
    }

    const params = new URLSearchParams();

    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (area) params.append("area", area);

    try {
        if (statusElement) {
            statusElement.textContent = "Đang tải dữ liệu...";
        }

        const response = await fetch(
            `${API_BASE_URL}/api/orders/dashboard/overview?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json"
                }
            }
        );

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("role");

            alert("Phiên đăng nhập hết hạn hoặc bạn không có quyền truy cập.");
            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            throw new Error(
                errorData.detail || `API lỗi HTTP ${response.status}`
            );
        }

        const data = await response.json();

        console.log("Dashboard Overview:", data);

        // Cập nhật KPI
        updateOverviewKPI(data.kpi || {});

        // Cập nhật các biểu đồ
        renderDailyTrendChart(data.daily_trend || []);
        renderWeatherChart(data.by_weather || []);
        renderTrafficAverageChart(data.by_traffic || []);
        renderTrafficCountChart(data.by_traffic || []);
        renderCategoryChart(data.by_category || []);
        renderVehicleAreaChart(data.by_vehicle_area || []);
        renderAreaChart(data.by_vehicle_area || []);

        if (statusElement) {
            statusElement.textContent =
                `Đã tải ${formatNumber(data.kpi?.total_orders)} đơn hàng`;
        }

        // Đánh dấu Phần 2 cần tải lại khi bộ lọc thay đổi
        section2Loaded = false;

        // Nếu đang mở Phần 2 thì tải lại dữ liệu
        const section2 = document.getElementById("section2");

        if (section2 && !section2.classList.contains("d-none")) {
            await loadTimeDistanceDashboard(token, true);
        }

    } catch (error) {
        console.error("Không thể tải Dashboard Overview:", error);

        if (statusElement) {
            statusElement.textContent = "Không thể tải dữ liệu";
        }

        alert("Lỗi tải dữ liệu Dashboard: " + error.message);
    }
}

// Cập nhật 4 KPI
function updateOverviewKPI(kpi) {
    document.getElementById("totalOrders").textContent =
        formatNumber(kpi.total_orders);

    document.getElementById("avgDeliveryTime").textContent =
        formatNumber(kpi.average_delivery_time, 1);

    document.getElementById("avgDistance").textContent =
        formatNumber(kpi.average_distance, 2);

    document.getElementById("avgPrepTime").textContent =
        formatNumber(kpi.average_prep_time, 2);
}

// 1. Xu hướng đơn hàng và thời gian giao trung bình
function renderDailyTrendChart(items) {
    const labels = items.map(item => item.date);
    const orderCounts = items.map(item => Number(item.order_count) || 0);

    const deliveryTimes = items.map(item =>
        item.average_delivery_time === null
            ? null
            : Number(item.average_delivery_time)
    );

    createChart("dailyTrendChart", {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    type: "bar",
                    label: "Số đơn hàng",
                    data: orderCounts,
                    backgroundColor: "#0d6efd",
                    yAxisID: "y"
                },
                {
                    type: "line",
                    label: "Thời gian giao trung bình (phút)",
                    data: deliveryTimes,
                    borderColor: "#dc3545",
                    backgroundColor: "#dc3545",
                    tension: 0.3,
                    spanGaps: false,
                    yAxisID: "y1"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            scales: {
                y: {
                    beginAtZero: true,
                    position: "left",
                    title: {
                        display: true,
                        text: "Số đơn hàng"
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: "right",
                    grid: {
                        drawOnChartArea: false
                    },
                    title: {
                        display: true,
                        text: "Thời gian giao (phút)"
                    }
                }
            }
        }
    });
}

// 2. Thời gian giao theo thời tiết
function renderWeatherChart(items) {
    const labels = items.map(item => item.value);
    const values = items.map(item => Number(item.average_delivery_time) || 0);

    createChart("weatherChart", {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Thời gian giao trung bình (phút)",
                data: values,
                backgroundColor: "#0dcaf0",
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Phút"
                    }
                }
            }
        }
    });
}

// 3. Thời gian giao theo giao thông
function renderTrafficAverageChart(items) {
    const labels = items.map(item => item.value);
    const values = items.map(item => Number(item.average_delivery_time) || 0);

    createChart("trafficChart", {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Thời gian giao trung bình (phút)",
                data: values,
                backgroundColor: [
                    "#198754",
                    "#ffc107",
                    "#fd7e14",
                    "#dc3545"
                ],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Phút"
                    }
                }
            }
        }
    });
}

// 4. Số đơn hàng theo mức độ giao thông
function renderTrafficCountChart(items) {
    createChart("trafficCountChart", {
        type: "doughnut",
        data: {
            labels: items.map(item => item.value),
            datasets: [{
                label: "Số đơn hàng",
                data: items.map(item => Number(item.count) || 0),
                backgroundColor: [
                    "#198754",
                    "#ffc107",
                    "#fd7e14",
                    "#dc3545"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

// 5. Cơ cấu đơn hàng theo danh mục
function renderCategoryChart(items) {
    createChart("categoryChart", {
        type: "doughnut",
        data: {
            labels: items.map(item => item.value),
            datasets: [{
                label: "Số đơn hàng",
                data: items.map(item => Number(item.count) || 0),
                backgroundColor: chartColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                },
                tooltip: {
                    callbacks: {
                        label: context =>
                            `${context.label}: ${formatNumber(context.raw)} đơn`
                    }
                }
            }
        }
    });
}

// 6. Thời gian giao theo phương tiện và khu vực
function renderVehicleAreaChart(items) {
    const areas = [...new Set(items.map(item => item.area))];
    const vehicles = [...new Set(items.map(item => item.vehicle))];

    const datasets = vehicles.map((vehicle, index) => ({
        label: vehicle,
        data: areas.map(area => {
            const record = items.find(
                item => item.area === area && item.vehicle === vehicle
            );

            return record
                ? Number(record.average_delivery_time)
                : null;
        }),
        backgroundColor: chartColors[index % chartColors.length]
    }));

    createChart("vehicleChart", {
        type: "bar",
        data: {
            labels: areas,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Thời gian giao (phút)"
                    }
                }
            }
        }
    });
}

// 7. Phân bố đơn hàng theo khu vực
function renderAreaChart(items) {
    const areaCounts = {};

    items.forEach(item => {
        areaCounts[item.area] =
            (areaCounts[item.area] || 0) + Number(item.order_count || 0);
    });

    const labels = Object.keys(areaCounts);
    const values = Object.values(areaCounts);

    createChart("areaChart", {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Số đơn hàng",
                data: values,
                backgroundColor: "#0d6efd",
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Số đơn hàng"
                    }
                }
            }
        }
    });
}

// ==========================================
// PHẦN 2: PHÂN TÍCH THỜI GIAN VÀ KHOẢNG CÁCH
// ==========================================

// 1. Chuyển đổi giữa các tab Dashboard
function setupReportTabs(token) {
    document.querySelectorAll(".report-tab").forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.target;

            // Cập nhật trạng thái nút
            document.querySelectorAll(".report-tab").forEach(tab => {
                tab.classList.remove("btn-primary", "active");
                tab.classList.add("btn-outline-primary");
            });

            button.classList.remove("btn-outline-primary");
            button.classList.add("btn-primary", "active");

            // Hiển thị section được chọn
            document.querySelectorAll(".report-section").forEach(section => {
                section.classList.toggle(
                    "d-none",
                    section.id !== targetId
                );
            });

            // Tải dữ liệu Phần 2 khi mở tab
            if (targetId === "section2") {
                loadTimeDistanceDashboard(token);

                setTimeout(() => {
                    if (section2Map) {
                        section2Map.invalidateSize();
                    }
                }, 150);
            }
        });
    });
}

// 2. Gọi API lấy dữ liệu Phần 2
async function loadTimeDistanceDashboard(token, forceReload = false) {
    if (section2Loaded && !forceReload) {
        if (section2Map) {
            section2Map.invalidateSize();
        }
        return;
    }

    const status = document.getElementById("timeDistanceStatus");

    const startDate =
        document.getElementById("startDate")?.value || "";

    const endDate =
        document.getElementById("endDate")?.value || "";

    const area =
        document.getElementById("areaFilter")?.value || "";

    const params = new URLSearchParams();

    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (area) params.append("area", area);

    if (status) {
        status.textContent = "Đang tải dữ liệu phân tích...";
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/orders/dashboard/time-distance?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json"
                }
            }
        );

        // Kiểm tra quyền truy cập
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("role");

            alert("Phiên đăng nhập hết hạn hoặc bạn không có quyền truy cập.");
            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            throw new Error(
                errorData.detail || `API lỗi HTTP ${response.status}`
            );
        }

        const data = await response.json();

        console.log("Time Distance Dashboard:", data);

        // Vẽ biểu đồ
        renderSection2AreaChart(data.by_area || []);
        renderSection2Scatter(data.scatter_points || []);
        renderSection2Histogram(data.histogram || []);

        // Vẽ bản đồ
        renderSection2Map(data.map_points || []);

        // Ghi chú số lượng dữ liệu
        const mapNote = document.getElementById("s2MapNote");

        if (mapNote) {
            mapNote.textContent = data.map_note || "";
        }

        const scatterNote = document.getElementById("s2ScatterNote");

        if (scatterNote) {
            scatterNote.textContent =
                `Biểu đồ sử dụng ${formatNumber(data.scatter_sample_count || 0)} đơn được lấy mẫu.`;
        }

        if (status) {
            status.textContent =
                `Đã tổng hợp ${formatNumber(data.kpi?.total_orders || 0)} đơn hàng`;
        }

        section2Loaded = true;

        if (section2Map) {
            setTimeout(() => {
                section2Map.invalidateSize();
            }, 150);
        }

    } catch (error) {
        console.error(
            "Không thể tải phân tích thời gian và khoảng cách:",
            error
        );

        if (status) {
            status.textContent = "Không thể tải dữ liệu";
        }

        const mapNote = document.getElementById("s2MapNote");

        if (mapNote) {
            mapNote.textContent = error.message;
        }
    }
}

// 3. Biểu đồ so sánh thời gian chuẩn bị và giao hàng
function renderSection2AreaChart(items) {
    createChart("s2AreaTimeChart", {
        type: "bar",
        data: {
            labels: items.map(item => item.area || "Unknown"),
            datasets: [
                {
                    label: "Thời gian chuẩn bị (phút)",
                    data: items.map(item => Number(item.average_prep_time) || 0),
                    backgroundColor: "#6B91B8",
                    borderRadius: 4
                },
                {
                    label: "Thời gian giao hàng (phút)",
                    data: items.map(item => Number(item.average_delivery_time) || 0),
                    backgroundColor: "#D49A62",
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Thời gian (phút)"
                    }
                }
            }
        }
    });
}

// 4. Biểu đồ phân tán khoảng cách và thời gian giao hàng
function renderSection2Scatter(items) {
    const colors = {
        High: "#547FA3",
        Medium: "#8B9A8A",
        Low: "#D49A62",
        Jam: "#B77C7C"
    };

    const trafficTypes = [
        ...new Set(items.map(item => item.traffic || "Unknown"))
    ];

    createChart("s2DistanceScatterChart", {
        type: "scatter",
        data: {
            datasets: trafficTypes.map(traffic => ({
                label: traffic,
                data: items
                    .filter(item => (item.traffic || "Unknown") === traffic)
                    .map(item => ({
                        x: Number(item.distance_km),
                        y: Number(item.delivery_time)
                    }))
                    .filter(point =>
                        Number.isFinite(point.x) &&
                        Number.isFinite(point.y)
                    ),
                backgroundColor: colors[traffic] || "#7c8798",
                pointRadius: 3,
                pointHoverRadius: 5
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Khoảng cách (km)"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Thời gian giao hàng (phút)"
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: context =>
                            `${context.dataset.label}: ${context.parsed.x.toFixed(2)} km, ${context.parsed.y.toFixed(1)} phút`
                    }
                }
            }
        }
    });
}

// 5. Biểu đồ phân bố thời gian giao hàng
function renderSection2Histogram(items) {
    createChart("s2DeliveryHistogram", {
        type: "bar",
        data: {
            labels: items.map(item => item.range),
            datasets: [{
                label: "Số đơn hàng",
                data: items.map(item => Number(item.count) || 0),
                backgroundColor: "#D49A62",
                borderRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Thời gian giao hàng (phút)"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Số đơn hàng"
                    }
                }
            }
        }
    });
}

// 6. Bản đồ phân bố điểm giao hàng
function renderSection2Map(items) {
    const mapElement = document.getElementById("section2Map");

    if (!mapElement) return;

    // Kiểm tra thư viện Leaflet
    if (typeof L === "undefined") {
        const mapNote = document.getElementById("s2MapNote");

        if (mapNote) {
            mapNote.textContent =
                "Không tải được thư viện bản đồ Leaflet. Kiểm tra kết nối Internet.";
        }

        return;
    }

    // Khởi tạo bản đồ lần đầu
    if (!section2Map) {
        section2Map = L.map("section2Map").setView([20, 78], 4);

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 18,
                attribution: "&copy; OpenStreetMap"
            }
        ).addTo(section2Map);

        section2MapLayer = L.layerGroup().addTo(section2Map);
    }

    // Xóa các điểm cũ
    section2MapLayer.clearLayers();

    const bounds = [];

    items.forEach(item => {
        const storeLat = Number(item.Store_Latitude);
        const storeLng = Number(item.Store_Longitude);
        const dropLat = Number(item.Drop_Latitude);
        const dropLng = Number(item.Drop_Longitude);

        // Kiểm tra tọa độ
        if (
            ![
                storeLat,
                storeLng,
                dropLat,
                dropLng
            ].every(Number.isFinite)
        ) {
            return;
        }

        const store = [storeLat, storeLng];
        const drop = [dropLat, dropLng];

        bounds.push(store, drop);

        // Điểm cửa hàng
        L.circleMarker(store, {
            radius: 4,
            color: "#547FA3",
            fillColor: "#6B91B8",
            fillOpacity: 0.75
        })
            .bindPopup("Điểm cửa hàng")
            .addTo(section2MapLayer);

        // Điểm giao hàng
        L.circleMarker(drop, {
            radius: 4,
            color: "#B77C7C",
            fillColor: "#D49A62",
            fillOpacity: 0.7
        })
            .bindPopup(`
                <strong>Điểm giao hàng</strong><br>
                Khu vực: ${item.Area || "N/A"}<br>
                Thời gian giao: ${formatNumber(item.Delivery_Time, 1)} phút
            `)
            .addTo(section2MapLayer);
    });

    // Tự động căn chỉnh bản đồ theo vị trí dữ liệu
    if (bounds.length) {
        section2Map.fitBounds(
            bounds,
            {
                padding: [20, 20],
                maxZoom: 8
            }
        );
    } else {
        section2Map.setView([20, 78], 4);
    }
}

// 7. Thống kê nguy cơ giao trễ thực tế
async function loadActualRiskSummary(token) {
    const riskElement = document.getElementById("lateOrderRate");
    const detailElement = document.getElementById("lateOrderRateDetail");

    if (!riskElement) return;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/predict/actual-risk/summary`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error(`API Actual_Risk lỗi HTTP ${response.status}`);
        }

        const result = await response.json();

        riskElement.textContent = formatNumber(result.risk_count);

        if (detailElement) {
            detailElement.textContent =
                `${formatNumber(result.risk_rate, 2)}% trên ` +
                `${formatNumber(result.total_labeled)} đơn có nhãn`;
        }

    } catch (error) {
        console.error("Không thể tải Actual_Risk:", error);

        riskElement.textContent = "N/A";

        if (detailElement) {
            detailElement.textContent =
                "Không thể tải dữ liệu rủi ro";
        }
    }
}

// ==========================================
// PHẦN 03 - KHU VỰC VÀ PHƯƠNG TIỆN
// ==========================================

async function loadAreaVehicleDashboard(token) {
    const startDate = document.getElementById("area3StartDate")?.value;
    const endDate = document.getElementById("area3EndDate")?.value;
    const area = document.getElementById("area3Filter")?.value || "";

    if (startDate && endDate && startDate > endDate) {
        alert("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
        return;
    }

    const params = new URLSearchParams();

    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (area) params.append("area", area);

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/orders/dashboard/area-vehicle?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json"
                }
            }
        );

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("role");

            alert("Phiên đăng nhập hết hạn hoặc bạn không có quyền truy cập.");
            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            throw new Error(
                errorData.detail || `API lỗi HTTP ${response.status}`
            );
        }

        const data = await response.json();

        console.log("Area Vehicle Dashboard:", data);

        // KPI
        const fastestArea = document.getElementById("area3FastestArea");
        const fastestVehicle = document.getElementById("area3FastestVehicle");
        const averageDistance = document.getElementById("area3AverageDistance");

        if (fastestArea) {
            fastestArea.textContent =
                data.fastest_area?.area || "Không có dữ liệu";
        }

        if (fastestVehicle) {
            fastestVehicle.textContent =
                data.fastest_vehicle?.vehicle || "Không có dữ liệu";
        }

        if (averageDistance) {
            averageDistance.textContent =
                Number(data.kpi?.average_distance || 0).toFixed(2);
        }

        // Biểu đồ cơ cấu phương tiện theo khu vực
        renderArea3VehicleChart(data.by_area_vehicle || []);

        // Biểu đồ thời gian giao hàng theo khu vực
        renderArea3DeliveryChart(data.by_area || []);

        // Biểu đồ khoảng cách theo khu vực
        renderArea3DistanceChart(data.by_area || []);

        // Bảng phân tích khu vực và phương tiện
        renderArea3MatrixTable(data.by_area_vehicle || []);

    } catch (error) {
        console.error("Lỗi tải dữ liệu Phần 03:", error);
        alert("Không thể tải dữ liệu Phần 03: " + error.message);
    }
}

// Khởi tạo bộ lọc riêng cho Phần 03 (chỉ gắn sự kiện một lần)
let area3FiltersInitialized = false;

function initArea3Filters() {
    if (area3FiltersInitialized) return;

    const startInput = document.getElementById("area3StartDate");
    const endInput = document.getElementById("area3EndDate");
    const areaInput = document.getElementById("area3Filter");

    if (!startInput || !endInput || !areaInput) return;

    area3FiltersInitialized = true;

    document.getElementById("area3ApplyFilters")?.addEventListener(
        "click",
        () => loadAreaVehicleDashboard(localStorage.getItem("token"))
    );

    document.getElementById("area3ResetFilters")?.addEventListener(
        "click",
        () => {
            startInput.value = "2022-02-11";
            endInput.value = "2022-04-06";
            areaInput.value = "";

            loadAreaVehicleDashboard(localStorage.getItem("token"));
        }
    );
}

// ==========================================
// CÁC BIỂU ĐỒ PHẦN 03
// ==========================================

// 1. Cơ cấu phương tiện theo khu vực
function renderArea3VehicleChart(rows) {
    const vehicleTotals = {};

    rows.forEach(item => {
        const vehicle = item.vehicle || "Khác";

        vehicleTotals[vehicle] =
            (vehicleTotals[vehicle] || 0) + Number(item.order_count || 0);
    });

    createChart("area3VehicleChart", {
        type: "doughnut",
        data: {
            labels: Object.keys(vehicleTotals),
            datasets: [{
                data: Object.values(vehicleTotals),
                backgroundColor: ["#4e79a7", "#f28e2b", "#59a14f"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.toLocaleString("vi-VN")} đơn`;
                        }
                    }
                }
            }
        }
    });
}

// 2. Thời gian giao hàng trung bình theo khu vực
function renderArea3DeliveryChart(rows) {
    createChart("area3DeliveryChart", {
        type: "bar",
        data: {
            labels: rows.map(item => item.area),
            datasets: [{
                label: "Thời gian giao trung bình (phút)",
                data: rows.map(item => Number(item.average_delivery_time || 0)),
                backgroundColor: "#4e79a7"
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Phút"
                    }
                }
            }
        }
    });
}

// 3. Khoảng cách giao hàng trung bình theo khu vực
function renderArea3DistanceChart(rows) {
    createChart("area3DistanceChart", {
        type: "bar",
        data: {
            labels: rows.map(item => item.area),
            datasets: [{
                label: "Khoảng cách trung bình (km)",
                data: rows.map(item => Number(item.average_distance || 0)),
                backgroundColor: "#f28e2b"
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Kilomet"
                    }
                }
            }
        }
    });
}

// 4. Bảng phân tích khu vực và phương tiện
function renderArea3MatrixTable(rows) {
    const tbody = document.querySelector("#area3MatrixTable tbody");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">Không có dữ liệu</td>
            </tr>
        `;
        return;
    }

    const areaOrder = [
        "Metropolitan",
        "Metropolitian",
        "Other",
        "Semi-Urban",
        "Urban"
    ];

    const vehicleOrder = [
        "Motorcycle",
        "Scooter",
        "Van"
    ];

    const sortedRows = [...rows].sort((a, b) => {
        const areaA = areaOrder.indexOf(a.area);
        const areaB = areaOrder.indexOf(b.area);

        const areaDiff =
            (areaA === -1 ? 999 : areaA) -
            (areaB === -1 ? 999 : areaB);

        if (areaDiff !== 0) return areaDiff;

        const vehicleA = vehicleOrder.indexOf(a.vehicle);
        const vehicleB = vehicleOrder.indexOf(b.vehicle);

        return (vehicleA === -1 ? 999 : vehicleA) -
            (vehicleB === -1 ? 999 : vehicleB);
    });

    sortedRows.forEach(item => {
        const tr = document.createElement("tr");

        const values = [
            item.area,
            item.vehicle,
            Number(item.order_count || 0).toLocaleString("vi-VN"),
            Number(item.average_delivery_time || 0).toFixed(2)
        ];

        values.forEach(value => {
            const td = document.createElement("td");
            td.textContent = value ?? "N/A";
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}
// ==========================================
// PHẦN 04 - DỰ ĐOÁN NGUY CƠ GIAO TRỄ
// ==========================================

// Tải dữ liệu phân tích rủi ro từ API
async function loadRiskDashboard(token) {
    let currentStep = "Bắt đầu tải dữ liệu";

    try {
        console.log("ĐÃ GỌI loadRiskDashboard");

        // Bước 1: Gọi API
        currentStep = "Gọi API";

        const response = await fetch(
            `${API_BASE_URL}/api/predict/dashboard/risk-analysis`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json"
                }
            }
        );

        console.log("API STATUS:", response.status);

        // Bước 2: Kiểm tra xác thực
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("role");

            alert("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
            window.location.href = "index.html";
            return;
        }

        // Bước 3: Kiểm tra phản hồi API
        currentStep = "Đọc dữ liệu API";

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || `API lỗi HTTP ${response.status}`
            );
        }

        console.log("RISK DASHBOARD DATA:", data);

        // Bước 4: Kiểm tra dữ liệu KPI
        currentStep = "Cập nhật KPI";

        if (!data.kpi) {
            throw new Error("API không trả về dữ liệu KPI");
        }

        const riskTotalOrders =
            document.getElementById("riskTotalOrders");

        const riskAverageProbability =
            document.getElementById("riskAverageProbability");

        const riskRate =
            document.getElementById("riskRate");

        const riskGaugeValue =
            document.getElementById("riskGaugeValue");

        if (riskTotalOrders) {
            riskTotalOrders.textContent =
                formatNumber(data.kpi.risk_count);
        }

        if (riskAverageProbability) {
            riskAverageProbability.textContent =
                formatNumber(data.kpi.average_probability * 100, 2) + "%";
        }

        if (riskRate) {
            riskRate.textContent =
                formatNumber(data.kpi.risk_rate, 2) + "%";
        }

        if (riskGaugeValue) {
            riskGaugeValue.textContent =
                formatNumber(data.kpi.risk_rate, 2) + "%";
        }

        // Bước 5: Vẽ biểu đồ theo khu vực và phương tiện
        currentStep = "Vẽ biểu đồ khu vực và phương tiện";

        renderRiskAreaVehicleChart(data.by_area_vehicle || []);

        // Bước 6: Vẽ biểu đồ mức độ rủi ro
        currentStep = "Vẽ biểu đồ mức độ rủi ro";

        renderRiskGaugeChart(data.kpi.risk_rate || 0);

        // Bước 7: Vẽ biểu đồ phân phối rủi ro
        currentStep = "Vẽ biểu đồ phân phối rủi ro";

        renderRiskDistributionChart(data.risk_distribution || []);

        // Bước 8: Hiển thị bảng đơn hàng khẩn cấp
        currentStep = "Hiển thị bảng đơn hàng";

        renderUrgentOrdersTable(data.urgent_orders || []);

        console.log("Dashboard 04 đã tải dữ liệu thành công!");

    } catch (error) {
        console.error("Lỗi tại Dashboard 04:", error);
        console.error("Lỗi xảy ra tại bước:", currentStep);

        const riskTotalOrders =
            document.getElementById("riskTotalOrders");

        const riskAverageProbability =
            document.getElementById("riskAverageProbability");

        const riskRate =
            document.getElementById("riskRate");

        const riskGaugeValue =
            document.getElementById("riskGaugeValue");

        if (riskTotalOrders) riskTotalOrders.textContent = "N/A";
        if (riskAverageProbability) riskAverageProbability.textContent = "N/A";
        if (riskRate) riskRate.textContent = "N/A";
        if (riskGaugeValue) riskGaugeValue.textContent = "N/A";

        const tbody = document.getElementById("urgentOrdersTable");

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger">
                        Không thể tải dữ liệu
                    </td>
                </tr>
            `;
        }

        alert(
            "Không thể tải Dashboard Phần 04: " +
            error.message +
            "\nBước xảy ra lỗi: " +
            currentStep
        );
    }
}

// 1. Số đơn có nguy cơ theo khu vực và phương tiện
function renderRiskAreaVehicleChart(items) {
    const areas = [...new Set(items.map(item => item.area))];
    const vehicles = [...new Set(items.map(item => item.vehicle))];

    const datasets = vehicles.map((vehicle, index) => ({
        label: vehicle,

        data: areas.map(area => {
            const record = items.find(
                item =>
                    item.area === area &&
                    item.vehicle === vehicle
            );

            return record
                ? Number(record.risk_count || 0)
                : 0;
        }),

        backgroundColor: chartColors[index % chartColors.length],
        borderRadius: 4
    }));

    createChart("riskAreaVehicleChart", {
        type: "bar",
        data: {
            labels: areas,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "bottom"
                },
                tooltip: {
                    callbacks: {
                        label: context =>
                            `${context.dataset.label}: ${formatNumber(context.raw)} đơn`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Số đơn có nguy cơ"
                    }
                }
            }
        }
    });
}

// 2. Gauge - Mức độ rủi ro hệ thống
function renderRiskGaugeChart(riskRate) {
    const value = Math.min(
        Math.max(Number(riskRate) || 0, 0),
        100
    );

    createChart("riskGaugeChart", {
        type: "doughnut",
        data: {
            labels: [
                "Nguy cơ",
                "Phần còn lại"
            ],
            datasets: [{
                data: [
                    value,
                    100 - value
                ],
                backgroundColor: [
                    "#dc3545",
                    "#e9ecef"
                ],
                borderWidth: 0,
                circumference: 180,
                rotation: 270,
                cutout: "75%"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            }
        }
    });
}

// 3. Phân bố đơn an toàn và đơn có nguy cơ
function renderRiskDistributionChart(items) {
    createChart("riskDistributionChart", {
        type: "doughnut",
        data: {
            labels: items.map(item => item.label),
            datasets: [{
                label: "Số đơn hàng",
                data: items.map(item => Number(item.count) || 0),
                backgroundColor: [
                    "#B8A99A",
                    "#6D9B83",
                    "#C65D52"
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                },
                tooltip: {
                    callbacks: {
                        label: context =>
                            `${context.label}: ${formatNumber(context.raw)} đơn`
                    }
                }
            }
        }
    });
}

// 4. Bảng 20 đơn hàng có xác suất rủi ro cao nhất
function renderUrgentOrdersTable(items) {
    const tbody = document.getElementById("urgentOrdersTable");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!items.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    Không có đơn hàng nguy cơ
                </td>
            </tr>
        `;
        return;
    }

    items.forEach(item => {
        const tr = document.createElement("tr");

        const probability = Number(item.Risk_Probability);

        const values = [
            item.Order_ID,
            item.Area,
            item.Vehicle,
            Number.isFinite(probability)
                ? `${(probability * 100).toFixed(2)}%`
                : "N/A"
        ];

        values.forEach((value, index) => {
            const td = document.createElement("td");
            td.textContent = value ?? "N/A";

            if (index === 3) {
                td.classList.add("text-danger", "fw-bold");
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

// Tự động tải dữ liệu khi chuyển sang Phần 04
document.addEventListener("DOMContentLoaded", function () {
    const tabs = document.querySelectorAll(".report-tab");

    tabs.forEach(tab => {
        tab.addEventListener("click", function () {
            if (this.dataset.target === "section4") {
                const token = localStorage.getItem("token");

                if (token) {
                    loadRiskDashboard(token);
                }
            }
        });
    });
});

// ==========================================
// PHẦN 05 - ĐÁNH GIÁ VÀ TỐI ƯU MÔ HÌNH
// ==========================================

// 1. Dữ liệu so sánh Precision và Recall theo ngưỡng
const thresholdData = [
    {
        threshold: 0.20,
        precision: 0.4130952381,
        recall: 0.9747191011,
        f1: 0.5802675585
    },
    {
        threshold: 0.25,
        precision: 0.4503002001,
        recall: 0.9480337079,
        f1: 0.6105834464
    },
    {
        threshold: 0.30,
        precision: 0.4907338769,
        recall: 0.9297752809,
        f1: 0.6424065987
    },
    {
        threshold: 0.35,
        precision: 0.5308134758,
        recall: 0.9073033708,
        f1: 0.6697770866
    },
    {
        threshold: 0.40,
        precision: 0.5618834081,
        recall: 0.8799157303,
        f1: 0.6858237548
    },
    {
        threshold: 0.45,
        precision: 0.5961155378,
        recall: 0.8405898876,
        f1: 0.6975524476
    },
    {
        threshold: 0.50,
        precision: 0.6451247166,
        recall: 0.7991573034,
        f1: 0.7139272271
    },
    {
        threshold: 0.55,
        precision: 0.6880152188,
        recall: 0.7619382022,
        f1: 0.7230923026
    },
    {
        threshold: 0.60,
        precision: 0.7163561077,
        recall: 0.7289325843,
        f1: 0.7225896276
    },
    {
        threshold: 0.65,
        precision: 0.7507788162,
        recall: 0.6769662921,
        f1: 0.7119645495
    },
    {
        threshold: 0.70,
        precision: 0.7834061135,
        recall: 0.6299157301,
        f1: 0.6983261969
    },
    {
        threshold: 0.75,
        precision: 0.8136958711,
        recall: 0.5674157303,
        f1: 0.6685974348
    },
    {
        threshold: 0.80,
        precision: 0.8231213873,
        recall: 0.5000000000,
        f1: 0.6221057230
    }
];

// 2. Dữ liệu so sánh các mô hình phân loại
const modelComparisonData = [
    {
        model: "RandomForest",
        accuracy: 0.8648087756,
        precision: 0.6451247166,
        recall: 0.7991573034,
        f1: 0.7139272271,
        roc_auc: 0.9280548940
    },
    {
        model: "LogisticRegression",
        accuracy: 0.8101096946,
        precision: 0.5321059722,
        recall: 0.8321629213,
        f1: 0.6491372227,
        roc_auc: 0.9004195802
    },
    {
        model: "Dummy",
        accuracy: 0.7889119478,
        precision: 0,
        recall: 0,
        f1: 0,
        roc_auc: 0.5
    }
];

// 3. Hàm tải Dashboard 05
function loadModelEvaluationDashboard() {
    renderThresholdScatterChart();
    renderThresholdOptimizationChart();
    renderModelComparisonChart();

    console.log("Dashboard 05 đã tải dữ liệu thành công!");
}

// 4. Biểu đồ Scatter Precision và Recall
function renderThresholdScatterChart() {
    const thresholdColors = [
        "#2196F3",
        "#304FFE",
        "#29B6F6",
        "#26A69A",
        "#43A047",
        "#00897B",
        "#F9A825",
        "#8E63CE",
        "#EC4899",
        "#AD1457",
        "#F4511E",
        "#3949AB",
        "#2196F3"
    ];

    const scatterData = thresholdData.map((item, index) => ({
        x: item.precision,
        y: item.recall,
        r: 12,
        threshold: item.threshold,
        backgroundColor: thresholdColors[index]
    }));

    createChart("thresholdScatterChart", {
        type: "bubble",
        data: {
            datasets: [{
                label: "Probability Threshold",
                data: scatterData,
                backgroundColor: scatterData.map(item => item.backgroundColor),
                borderColor: scatterData.map(item => item.backgroundColor),
                hoverRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function (items) {
                            const item = items[0].raw;

                            return "Threshold: " +
                                (item.threshold * 100).toFixed(0) + "%";
                        },
                        label: function (context) {
                            const item = context.raw;

                            return [
                                "Precision: " +
                                    (item.x * 100).toFixed(2) + "%",
                                "Recall: " +
                                    (item.y * 100).toFixed(2) + "%"
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    min: 0.35,
                    max: 0.90,
                    title: {
                        display: true,
                        text: "Precision"
                    },
                    ticks: {
                        callback: value =>
                            (value * 100).toFixed(0) + "%"
                    }
                },
                y: {
                    min: 0.45,
                    max: 1.05,
                    title: {
                        display: true,
                        text: "Recall"
                    },
                    ticks: {
                        callback: value =>
                            (value * 100).toFixed(0) + "%"
                    }
                }
            }
        }
    });
}
// 5. Biểu đồ tối ưu hóa ngưỡng cảnh báo
function renderThresholdOptimizationChart() {
    const labels = thresholdData.map(item =>
        item.threshold.toFixed(2)
    );

    createChart("thresholdOptimizationChart", {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Average of Precision",
                    data: thresholdData.map(item => item.precision),
                    borderColor: "#1689F8",
                    backgroundColor: "#1689F8",
                    tension: 0.3,
                    pointRadius: 3
                },
                {
                    label: "Average of Recall",
                    data: thresholdData.map(item => item.recall),
                    borderColor: "#172C9B",
                    backgroundColor: "#172C9B",
                    tension: 0.3,
                    pointRadius: 3
                },
                {
                    label: "Average of F1",
                    data: thresholdData.map(item => item.f1),
                    borderColor: "#F36B32",
                    backgroundColor: "#F36B32",
                    tension: 0.3,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "bottom"
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ": " +
                                (context.raw * 100).toFixed(2) + "%";
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Probability Threshold"
                    }
                },
                y: {
                    min: 0.3,
                    max: 1.0,
                    ticks: {
                        callback: value =>
                            (value * 100).toFixed(0) + "%"
                    }
                }
            }
        }
    });
}

// 6. Biểu đồ so sánh các mô hình Machine Learning
function renderModelComparisonChart() {
    createChart("modelComparisonChart", {
        type: "bar",
        data: {
            labels: modelComparisonData.map(item => item.model),
            datasets: [
                {
                    label: "Average of Accuracy",
                    data: modelComparisonData.map(item => item.accuracy),
                    backgroundColor: "#1689F8"
                },
                {
                    label: "Average of Precision",
                    data: modelComparisonData.map(item => item.precision),
                    backgroundColor: "#172C9B"
                },
                {
                    label: "Average of Recall",
                    data: modelComparisonData.map(item => item.recall),
                    backgroundColor: "#F36B32"
                },
                {
                    label: "Average of F1",
                    data: modelComparisonData.map(item => item.f1),
                    backgroundColor: "#8E44AD"
                },
                {
                    label: "Average of ROC_AUC",
                    data: modelComparisonData.map(item => item.roc_auc),
                    backgroundColor: "#E83EAD"
                }
            ]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        boxWidth: 10,
                        font: {
                            size: 10
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ": " +
                                (context.raw * 100).toFixed(2) + "%";
                        }
                    }
                }
            },
            scales: {
                x: {
                    min: 0,
                    max: 1,
                    ticks: {
                        callback: value =>
                            (value * 100).toFixed(0) + "%"
                    }
                },
                y: {
                    ticks: {
                        font: {
                            weight: "bold"
                        }
                    }
                }
            }
        }
    });
}

// 7. Tự động tải khi chuyển sang Phần 05
document.addEventListener("DOMContentLoaded", function () {
    const tabs = document.querySelectorAll(".report-tab");

    tabs.forEach(tab => {
        tab.addEventListener("click", function () {
            if (this.dataset.target === "section5") {
                loadModelEvaluationDashboard();
            }
        });
    });
});

// 8. Khởi chạy Dashboard
document.addEventListener("DOMContentLoaded", loadDashboard);

// 9. Chuyển đổi giữa 5 phần Dashboard
document.addEventListener("DOMContentLoaded", function () {
    const tabs = document.querySelectorAll(".report-tab");
    const sections = document.querySelectorAll(".report-section");

    tabs.forEach(tab => {
        tab.addEventListener("click", async function () {
            const targetId = this.dataset.target;

            // Ẩn tất cả các phần
            sections.forEach(section => {
                section.classList.add("d-none");
            });

            // Hiện phần được chọn
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.classList.remove("d-none");
            }

            // Nếu chuyển sang Phần 03 thì tải dữ liệu
            if (targetId === "section3") {
                const token = localStorage.getItem("token");

                const startInput =
                    document.getElementById("area3StartDate");

                const endInput =
                    document.getElementById("area3EndDate");

                if (startInput && !startInput.value) {
                    startInput.value = "2022-02-11";
                }

                if (endInput && !endInput.value) {
                    endInput.value = "2022-04-06";
                }

                initArea3Filters();

                if (token) {
                    await loadAreaVehicleDashboard(token);
                }
            }

            // Cập nhật trạng thái nút
            tabs.forEach(button => {
                button.classList.remove("btn-primary", "active");
                button.classList.add("btn-outline-primary");
            });

            this.classList.remove("btn-outline-primary");
            this.classList.add("btn-primary", "active");
        });
    });
});