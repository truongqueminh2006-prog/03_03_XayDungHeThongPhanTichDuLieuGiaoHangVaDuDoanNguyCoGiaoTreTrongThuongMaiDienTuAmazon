const API_BASE_URL = "http://127.0.0.1:8000";

let vehicleCompositionChart = null;
let areaAnalysisChart = null;

const VEHICLE_ORDER = ["Motorcycle", "Scooter", "Van"];

const AREA_ORDER = [
    "Semi-Urban",
    "Metropolitan",
    "Urban",
    "Other"
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

// Định dạng số
function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "N/A";
    }

    return Number(value).toLocaleString("vi-VN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

// Lấy dữ liệu từ API
async function loadAreaVehicleDashboard() {
    if (!checkLogin()) return;

    const token = localStorage.getItem("token");

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const selectedArea = document.getElementById("areaFilter").value;

    const statusElement = document.getElementById("filterStatus");

    if (startDate && endDate && startDate > endDate) {
        statusElement.textContent = "Ngày bắt đầu không được sau ngày kết thúc.";
        alert("Vui lòng kiểm tra lại khoảng thời gian.");
        return;
    }

    const params = new URLSearchParams();

    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (selectedArea) params.append("area", selectedArea);

    statusElement.textContent = "Đang tải dữ liệu...";

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
                errorData.detail || `API trả về HTTP ${response.status}`
            );
        }

        const data = await response.json();

        console.log("Dữ liệu phân tích khu vực và phương tiện:", data);

        renderKPIs(data);
        renderVehicleCompositionChart(data.by_vehicle || []);
        renderAreaAnalysisChart(data.by_area || []);
        renderMatrixTable(data.by_area_vehicle || []);

        statusElement.textContent =
            `Đã tải dữ liệu thành công: ${Number(data.kpi.total_orders || 0).toLocaleString("vi-VN")} đơn hàng.`;

    } catch (error) {
        console.error("Lỗi tải Dashboard khu vực và phương tiện:", error);

        statusElement.textContent = `Không thể tải dữ liệu: ${error.message}`;

        document.getElementById("fastestArea").textContent = "N/A";
        document.getElementById("fastestVehicle").textContent = "N/A";
        document.getElementById("averageDistance").textContent = "N/A";
    }
}

// 1. Hiển thị ba KPI
function renderKPIs(data) {
    const fastestArea = data.fastest_area;
    const fastestVehicle = data.fastest_vehicle;
    const kpi = data.kpi || {};

    document.getElementById("fastestArea").textContent =
        fastestArea?.area || "N/A";

    document.getElementById("fastestAreaDetail").textContent =
        fastestArea
            ? `${formatNumber(fastestArea.average_delivery_time)} phút`
            : "Không có dữ liệu";

    document.getElementById("fastestVehicle").textContent =
        fastestVehicle?.vehicle || "N/A";

    document.getElementById("fastestVehicleDetail").textContent =
        fastestVehicle
            ? `${formatNumber(fastestVehicle.average_delivery_time)} phút`
            : "Không có dữ liệu";

    document.getElementById("averageDistance").textContent =
        kpi.average_distance !== null && kpi.average_distance !== undefined
            ? `${formatNumber(kpi.average_distance)} km`
            : "N/A";
}

// 2. Biểu đồ donut cơ cấu phương tiện
function renderVehicleCompositionChart(items) {
    const canvas = document.getElementById("vehicleCompositionChart");
    if (!canvas) return;

    if (vehicleCompositionChart) {
        vehicleCompositionChart.destroy();
    }

    const vehicleData = VEHICLE_ORDER.map(name => {
        const found = items.find(item => item.vehicle === name);

        return {
            name,
            count: Number(found?.order_count || 0)
        };
    });

    const labels = vehicleData.map(item => item.name);
    const values = vehicleData.map(item => item.count);

    vehicleCompositionChart = new Chart(canvas, {
        type: "doughnut",

        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "#6CA6DF",
                    "#7567B1",
                    "#E58B61"
                ],
                borderColor: "#ffffff",
                borderWidth: 2,
                hoverOffset: 8
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "52%",

            plugins: {
                legend: {
                    position: "right"
                },

                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = values.reduce((sum, value) => sum + value, 0);
                            const count = Number(context.raw || 0);
                            const percentage = total > 0
                                ? (count / total * 100).toFixed(2)
                                : 0;

                            return `${context.label}: ${count.toLocaleString("vi-VN")} đơn (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 3. Biểu đồ thời gian giao và khoảng cách theo khu vực
function renderAreaAnalysisChart(items) {
    const canvas = document.getElementById("areaAnalysisChart");
    if (!canvas) return;

    if (areaAnalysisChart) {
        areaAnalysisChart.destroy();
    }

    // Sắp xếp khu vực theo thời gian giao trung bình giảm dần
    const sortedItems = [...items].sort((a, b) => {
        return Number(b.average_delivery_time || 0) -
            Number(a.average_delivery_time || 0);
    });

    const labels = sortedItems.map(item => item.area);

    const deliveryValues = sortedItems.map(item =>
        item.average_delivery_time === null
            ? null
            : Number(item.average_delivery_time)
    );

    const distanceValues = sortedItems.map(item =>
        item.average_distance === null
            ? null
            : Number(item.average_distance)
    );

    areaAnalysisChart = new Chart(canvas, {
        type: "bar",

        data: {
            labels,

            datasets: [
                {
                    label: "Avg_Delivery_Time (phút)",
                    data: deliveryValues,
                    backgroundColor: "#6CA6DF",
                    borderColor: "#477FAF",
                    borderWidth: 1,
                    xAxisID: "x"
                },
                {
                    label: "Avg_Distance (km)",
                    data: distanceValues,
                    backgroundColor: "#7567B1",
                    borderColor: "#55478D",
                    borderWidth: 1,
                    xAxisID: "x1"
                }
            ]
        },

        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                x: {
                    type: "linear",
                    position: "bottom",
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Thời gian giao hàng (phút)"
                    }
                },

                x1: {
                    type: "linear",
                    position: "top",
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false
                    },
                    title: {
                        display: true,
                        text: "Khoảng cách (km)"
                    }
                },

                y: {
                    ticks: {
                        font: {
                            weight: "bold"
                        }
                    }
                }
            },

            plugins: {
                legend: {
                    position: "bottom"
                },

                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const unit = context.dataset.xAxisID === "x1"
                                ? " km"
                                : " phút";

                            return `${context.dataset.label}: ${formatNumber(context.raw)}${unit}`;
                        }
                    }
                }
            }
        }
    });
}

// 4. Bảng ma trận khu vực và phương tiện
function renderMatrixTable(items) {
    const body = document.getElementById("matrixTableBody");
    const footer = document.getElementById("matrixTableFooter");

    body.innerHTML = "";
    footer.innerHTML = "";

    const areaNames = [...new Set(items.map(item => item.area))];

    // Sắp xếp theo thứ tự hiển thị của báo cáo
    areaNames.sort((a, b) => {
        const indexA = AREA_ORDER.indexOf(a);
        const indexB = AREA_ORDER.indexOf(b);

        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;

        return indexA - indexB;
    });

    if (areaNames.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    Không có dữ liệu phù hợp.
                </td>
            </tr>
        `;
        return;
    }

    const vehicleTotals = {};
    const vehicleCounts = {};

    VEHICLE_ORDER.forEach(vehicle => {
        vehicleTotals[vehicle] = 0;
        vehicleCounts[vehicle] = 0;
    });

    let grandTotal = 0;
    let grandCount = 0;

    areaNames.forEach(area => {
        const areaItems = items.filter(item => item.area === area);

        const areaVehicleData = {};
        let areaSum = 0;
        let areaCount = 0;

        VEHICLE_ORDER.forEach(vehicle => {
            const found = areaItems.find(item => item.vehicle === vehicle);

            const avg = found?.average_delivery_time;
            const count = Number(found?.order_count || 0);

            areaVehicleData[vehicle] =
                avg === null || avg === undefined ? null : Number(avg);

            if (areaVehicleData[vehicle] !== null && count > 0) {
                areaSum += areaVehicleData[vehicle] * count;
                areaCount += count;

                vehicleTotals[vehicle] +=
                    areaVehicleData[vehicle] * count;

                vehicleCounts[vehicle] += count;
            }
        });

        grandTotal += areaSum;
        grandCount += areaCount;

        const areaAverage = areaCount > 0
            ? areaSum / areaCount
            : null;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td class="fw-semibold">${area}</td>
            ${VEHICLE_ORDER.map(vehicle => `
                <td>
                    ${areaVehicleData[vehicle] === null
                        ? "—"
                        : formatNumber(areaVehicleData[vehicle])}
                </td>
            `).join("")}
            <td class="fw-bold">
                ${areaAverage === null ? "—" : formatNumber(areaAverage)}
            </td>
        `;

        body.appendChild(row);
    });

    // Dòng tổng toàn bộ
    const totalCells = VEHICLE_ORDER.map(vehicle => {
        if (vehicleCounts[vehicle] === 0) return "—";

        return formatNumber(
            vehicleTotals[vehicle] / vehicleCounts[vehicle]
        );
    });

    const overallAverage = grandCount > 0
        ? grandTotal / grandCount
        : null;

    footer.innerHTML = `
        <tr>
            <td>Total</td>
            ${totalCells.map(value => `<td>${value}</td>`).join("")}
            <td>${overallAverage === null ? "—" : formatNumber(overallAverage)}</td>
        </tr>
    `;
}

// 5. Thiết lập bộ lọc
function setupFilters() {
    document.getElementById("applyFilters").addEventListener("click", () => {
        loadAreaVehicleDashboard();
    });

    document.getElementById("resetFilters").addEventListener("click", () => {
        document.getElementById("startDate").value = "2022-02-11";
        document.getElementById("endDate").value = "2022-04-06";
        document.getElementById("areaFilter").value = "";

        loadAreaVehicleDashboard();
    });
}

// Khởi chạy trang
document.addEventListener("DOMContentLoaded", () => {
    if (!checkLogin()) return;

    setupFilters();
    loadAreaVehicleDashboard();
});
