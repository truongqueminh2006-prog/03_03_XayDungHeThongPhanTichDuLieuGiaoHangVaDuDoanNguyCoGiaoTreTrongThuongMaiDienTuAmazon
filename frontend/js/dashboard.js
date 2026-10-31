
const API_BASE_URL = "http://127.0.0.1:8000";

// Quáº£n lÃ½ cÃ¡c biá»ƒu Ä‘á»“
const dashboardCharts = {};

// Quáº£n lÃ½ dá»¯ liá»‡u vÃ  báº£n Ä‘á»“ Pháº§n 2
let section2Loaded = false;
let section2Map = null;
let section2MapLayer = null;

const chartColors = [
    "#0d6efd", "#198754", "#ffc107", "#dc3545",
    "#6f42c1", "#fd7e14", "#20c997", "#6c757d",
    "#d63384", "#0dcaf0", "#adb5bd", "#6610f2",
    "#1982c4", "#8ac926", "#ff595e", "#0d6efd"
];

// Kiá»ƒm tra Ä‘Äƒng nháº­p
function checkLogin() {
    const token = localStorage.getItem("token");

    if (!token || token === "fake-jwt-token") {
        alert("PhiÃªn Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// Lá»i chÃ o ngÆ°á»i dÃ¹ng
function updateGreeting() {
    const role = localStorage.getItem("role");
    const greeting = document.getElementById("userGreeting");

    if (greeting) {
        greeting.textContent =
            role === "admin"
                ? "Xin chÃ o, Admin!"
                : "Xin chÃ o, ThÃ nh viÃªn!";
    }
}

// Äá»‹nh dáº¡ng sá»‘
function formatNumber(value, digits = 0) {
    if (value === null || value === undefined ||
        !Number.isFinite(Number(value))) {
        return "N/A";
    }

    return Number(value).toLocaleString("vi-VN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

// Táº¡o hoáº·c cáº­p nháº­t biá»ƒu Ä‘á»“
function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    if (dashboardCharts[canvasId]) {
        dashboardCharts[canvasId].destroy();
    }

    dashboardCharts[canvasId] = new Chart(
        canvas.getContext("2d"),
        config
    );
}

// Láº¥y token vÃ  táº£i Dashboard
async function loadDashboard() {
    if (!checkLogin()) return;

    updateGreeting();

    const token = localStorage.getItem("token");

    // Thiáº¿t láº­p ngÃ y máº·c Ä‘á»‹nh
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");

    if (startInput && !startInput.value) {
        startInput.value = "2022-02-11";
    }

    if (endInput && !endInput.value) {
        endInput.value = "2022-04-06";
    }

    // Gáº¯n sá»± kiá»‡n bá»™ lá»c
    document.getElementById("applyFilters")?.addEventListener(
        "click",
        () => loadOverview(token)
    );

    document.getElementById("resetFilters")?.addEventListener(
        "click",
        () => {
            startInput.value = "2022-02-11";
            endInput.value = "2022-04-06";
            document.getElementById("areaFilter").value = "";
            loadOverview(token);
        }
    );

    // Táº£i thá»‘ng kÃª Actual_Risk
    await loadActualRiskSummary(token);

    // Táº£i dá»¯ liá»‡u tá»•ng quan
    await loadOverview(token);

    // Thiáº¿t láº­p chuyá»ƒn tab Dashboard
    setupReportTabs(token);
}

// Láº¥y dá»¯ liá»‡u API Dashboard Overview
async function loadOverview(token) {
    const startDate = document.getElementById("startDate")?.value;
    const endDate = document.getElementById("endDate")?.value;
    const area = document.getElementById("areaFilter")?.value || "";

    const statusElement = document.getElementById("filterStatus");

    if (startDate && endDate && startDate > endDate) {
        alert("NgÃ y báº¯t Ä‘áº§u khÃ´ng Ä‘Æ°á»£c lá»›n hÆ¡n ngÃ y káº¿t thÃºc.");
        return;
    }

    const params = new URLSearchParams();

    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (area) params.append("area", area);

    try {
        if (statusElement) {
            statusElement.textContent = "Äang táº£i dá»¯ liá»‡u...";
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

            alert("PhiÃªn Ä‘Äƒng nháº­p háº¿t háº¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p.");
            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.detail || `API lá»—i HTTP ${response.status}`
            );
        }

        const data = await response.json();

        console.log("Dashboard Overview:", data);

        // Cáº­p nháº­t KPI
        updateOverviewKPI(data.kpi);

        // Cáº­p nháº­t cÃ¡c biá»ƒu Ä‘á»“
        renderDailyTrendChart(data.daily_trend || []);
        renderWeatherChart(data.by_weather || []);
        renderTrafficAverageChart(data.by_traffic || []);
        renderTrafficCountChart(data.by_traffic || []);
        renderCategoryChart(data.by_category || []);
        renderVehicleAreaChart(data.by_vehicle_area || []);
        renderAreaChart(data.by_vehicle_area || []);

        if (statusElement) {
            statusElement.textContent =
                `ÄÃ£ táº£i ${formatNumber(data.kpi.total_orders)} Ä‘Æ¡n hÃ ng`;
        }

        // ÄÃ¡nh dáº¥u Pháº§n 2 cáº§n táº£i láº¡i khi bá»™ lá»c thay Ä‘á»•i
        section2Loaded = false;

        // Náº¿u Ä‘ang má»Ÿ Pháº§n 2 thÃ¬ táº£i láº¡i dá»¯ liá»‡u
        const section2 = document.getElementById("section2");

        if (section2 && !section2.classList.contains("d-none")) {
            await loadTimeDistanceDashboard(token, true);
        }

    } catch (error) {
        console.error("KhÃ´ng thá»ƒ táº£i Dashboard Overview:", error);

        if (statusElement) {
            statusElement.textContent = "KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u";
        }

        alert("Lá»—i táº£i dá»¯ liá»‡u Dashboard: " + error.message);
    }
}

// Cáº­p nháº­t 4 KPI
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

// 1. Xu hÆ°á»›ng Ä‘Æ¡n hÃ ng vÃ  thá»i gian giao theo ngÃ y
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
                    label: "Sá»‘ Ä‘Æ¡n hÃ ng",
                    data: orderCounts,
                    backgroundColor: "#0d6efd",
                    yAxisID: "y"
                },
                {
                    type: "line",
                    label: "Thá»i gian giao trung bÃ¬nh (phÃºt)",
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
                        text: "Sá»‘ Ä‘Æ¡n hÃ ng"
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
                        text: "Thá»i gian giao (phÃºt)"
                    }
                }
            }
        }
    });
}

// 2. Thá»i gian giao theo thá»i tiáº¿t
function renderWeatherChart(items) {
    const labels = items.map(item => item.value);
    const values = items.map(item => item.average_delivery_time);

    createChart("weatherChart", {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Thá»i gian giao trung bÃ¬nh (phÃºt)",
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
                        text: "PhÃºt"
                    }
                }
            }
        }
    });
}

// 3. Thá»i gian giao theo giao thÃ´ng
function renderTrafficAverageChart(items) {
    const labels = items.map(item => item.value);
    const values = items.map(item => item.average_delivery_time);

    createChart("trafficChart", {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Thá»i gian giao trung bÃ¬nh (phÃºt)",
                data: values,
                backgroundColor: ["#198754", "#ffc107", "#fd7e14", "#dc3545"],
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
                        text: "PhÃºt"
                    }
                }
            }
        }
    });
}

// 4. Sá»‘ Ä‘Æ¡n hÃ ng theo má»©c Ä‘á»™ giao thÃ´ng
function renderTrafficCountChart(items) {
    createChart("trafficCountChart", {
        type: "doughnut",
        data: {
            labels: items.map(item => item.value),
            datasets: [{
                label: "Sá»‘ Ä‘Æ¡n hÃ ng",
                data: items.map(item => Number(item.count) || 0),
                backgroundColor: ["#198754", "#ffc107", "#fd7e14", "#dc3545"]
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

// 5. CÆ¡ cáº¥u Ä‘Æ¡n hÃ ng theo danh má»¥c
function renderCategoryChart(items) {
    createChart("categoryChart", {
        type: "doughnut",
        data: {
            labels: items.map(item => item.value),
            datasets: [{
                label: "Sá»‘ Ä‘Æ¡n hÃ ng",
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
                            `${context.label}: ${formatNumber(context.raw)} Ä‘Æ¡n`
                    }
                }
            }
        }
    });
}

// 6. Thá»i gian giao theo phÆ°Æ¡ng tiá»‡n vÃ  khu vá»±c
function renderVehicleAreaChart(items) {
    const areas = [...new Set(items.map(item => item.area))];
    const vehicles = [...new Set(items.map(item => item.vehicle))];

    const datasets = vehicles.map((vehicle, index) => ({
        label: vehicle,
        data: areas.map(area => {
            const record = items.find(
                item => item.area === area && item.vehicle === vehicle
            );

            return record ? record.average_delivery_time : null;
        }),
        backgroundColor: chartColors[index]
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
                        text: "Thá»i gian giao (phÃºt)"
                    }
                }
            }
        }
    });
}

// 7. PhÃ¢n bá»‘ Ä‘Æ¡n hÃ ng theo khu vá»±c
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
                label: "Sá»‘ Ä‘Æ¡n hÃ ng",
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
                        text: "Sá»‘ Ä‘Æ¡n hÃ ng"
                    }
                }

            }
        }
    });
}
//  ==========================================
//  PHáº¦N 2: PHÃ‚N TÃCH THá»œI GIAN VÃ€ KHOáº¢NG CÃCH
//  ==========================================

// 1. Chuyá»ƒn Ä‘á»•i giá»¯a cÃ¡c tab Dashboard
function setupReportTabs(token) {

    document.querySelectorAll(".report-tab").forEach(button => {

        button.addEventListener("click", () => {

            const targetId = button.dataset.target;

            // Cáº­p nháº­t tráº¡ng thÃ¡i nÃºt
            document.querySelectorAll(".report-tab").forEach(tab => {

                tab.classList.remove("btn-primary", "active");
                tab.classList.add("btn-outline-primary");

            });

            button.classList.remove("btn-outline-primary");
            button.classList.add("btn-primary", "active");

            // Hiá»ƒn thá»‹ section Ä‘Æ°á»£c chá»n
            document.querySelectorAll(".report-section").forEach(section => {

                section.classList.toggle(
                    "d-none",
                    section.id !== targetId
                );

            });

            // Táº£i dá»¯ liá»‡u Pháº§n 2 khi má»Ÿ tab
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


// 2. Gá»i API láº¥y dá»¯ liá»‡u Pháº§n 2
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

    if (startDate) {
        params.append("start_date", startDate);
    }

    if (endDate) {
        params.append("end_date", endDate);
    }

    if (area) {
        params.append("area", area);
    }

    if (status) {
        status.textContent = "Äang táº£i dá»¯ liá»‡u phÃ¢n tÃ­ch...";
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

        // Kiá»ƒm tra quyá»n truy cáº­p
        if (response.status === 401 || response.status === 403) {

            localStorage.removeItem("token");
            localStorage.removeItem("role");

            alert("PhiÃªn Ä‘Äƒng nháº­p háº¿t háº¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p.");

            window.location.href = "index.html";

            return;
        }

        if (!response.ok) {

            const errorData = await response.json().catch(() => ({}));

            throw new Error(
                errorData.detail || `API lá»—i HTTP ${response.status}`
            );

        }

        const data = await response.json();

        console.log("Time Distance Dashboard:", data);

        // Váº½ biá»ƒu Ä‘á»“
        renderSection2AreaChart(data.by_area || []);

        renderSection2Scatter(data.scatter_points || []);

        renderSection2Histogram(data.histogram || []);

        // Váº½ báº£n Ä‘á»“
        renderSection2Map(data.map_points || []);

        // Ghi chÃº sá»‘ lÆ°á»£ng dá»¯ liá»‡u
        const mapNote = document.getElementById("s2MapNote");

        if (mapNote) {
            mapNote.textContent = data.map_note || "";
        }

        const scatterNote = document.getElementById("s2ScatterNote");

        if (scatterNote) {

            scatterNote.textContent =
                `Biá»ƒu Ä‘á»“ sá»­ dá»¥ng ${formatNumber(data.scatter_sample_count || 0)} Ä‘Æ¡n Ä‘Æ°á»£c láº¥y máº«u.`;

        }

        if (status) {

            status.textContent =
                `ÄÃ£ tá»•ng há»£p ${formatNumber(data.kpi?.total_orders || 0)} Ä‘Æ¡n hÃ ng`;

        }

        section2Loaded = true;

        if (section2Map) {

            setTimeout(() => {
                section2Map.invalidateSize();
            }, 150);

        }

    } catch (error) {

        console.error(
            "KhÃ´ng thá»ƒ táº£i phÃ¢n tÃ­ch thá»i gian vÃ  khoáº£ng cÃ¡ch:",
            error
        );

        if (status) {
            status.textContent = "KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u";
        }

        const mapNote = document.getElementById("s2MapNote");

        if (mapNote) {
            mapNote.textContent = error.message;
        }

    }

}


// 3. Biá»ƒu Ä‘á»“ so sÃ¡nh thá»i gian chuáº©n bá»‹ vÃ  giao hÃ ng
function renderSection2AreaChart(items) {

    createChart("s2AreaTimeChart", {

        type: "bar",

        data: {

            labels: items.map(item => item.area || "Unknown"),

            datasets: [

                {
                    label: "Thá»i gian chuáº©n bá»‹ (phÃºt)",

                    data: items.map(item => item.average_prep_time),

                    backgroundColor: "#6B91B8",

                    borderRadius: 4
                },

                {
                    label: "Thá»i gian giao hÃ ng (phÃºt)",

                    data: items.map(item => item.average_delivery_time),

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
                        text: "Thá»i gian (phÃºt)"
                    }

                }

            }

        }

    });

}


// 4. Biá»ƒu Ä‘á»“ phÃ¢n tÃ¡n khoáº£ng cÃ¡ch vÃ  thá»i gian giao hÃ ng
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

                    .filter(item =>
                        (item.traffic || "Unknown") === traffic
                    )

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
                        text: "Khoáº£ng cÃ¡ch (km)"
                    }

                },

                y: {

                    beginAtZero: true,

                    title: {
                        display: true,
                        text: "Thá»i gian giao hÃ ng (phÃºt)"
                    }

                }

            },

            plugins: {

                tooltip: {

                    callbacks: {

                        label: context =>

                            `${context.dataset.label}: ${context.parsed.x.toFixed(2)} km, ${context.parsed.y.toFixed(1)} phÃºt`

                    }

                }

            }

        }

    });

}


// 5. Biá»ƒu Ä‘á»“ phÃ¢n bá»‘ thá»i gian giao hÃ ng
function renderSection2Histogram(items) {

    createChart("s2DeliveryHistogram", {

        type: "bar",

        data: {

            labels: items.map(item => item.range),

            datasets: [

                {

                    label: "Sá»‘ Ä‘Æ¡n hÃ ng",

                    data: items.map(item => Number(item.count) || 0),

                    backgroundColor: "#D49A62",

                    borderRadius: 3

                }

            ]

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
                        text: "Thá»i gian giao hÃ ng (phÃºt)"
                    }

                },

                y: {

                    beginAtZero: true,

                    title: {
                        display: true,
                        text: "Sá»‘ Ä‘Æ¡n hÃ ng"
                    }

                }

            }

        }

    });

}


// 6. Báº£n Ä‘á»“ phÃ¢n bá»‘ Ä‘iá»ƒm giao hÃ ng
function renderSection2Map(items) {

    const mapElement = document.getElementById("section2Map");

    if (!mapElement) return;

    // Kiá»ƒm tra thÆ° viá»‡n Leaflet
    if (typeof L === "undefined") {

        document.getElementById("s2MapNote").textContent =
            "KhÃ´ng táº£i Ä‘Æ°á»£c thÆ° viá»‡n báº£n Ä‘á»“ Leaflet. Kiá»ƒm tra káº¿t ná»‘i Internet.";

        return;

    }

    // Khá»Ÿi táº¡o báº£n Ä‘á»“ láº§n Ä‘áº§u
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

    // XÃ³a cÃ¡c Ä‘iá»ƒm cÅ©
    section2MapLayer.clearLayers();

    const bounds = [];

    items.forEach(item => {

        const storeLat = Number(item.Store_Latitude);

        const storeLng = Number(item.Store_Longitude);

        const dropLat = Number(item.Drop_Latitude);

        const dropLng = Number(item.Drop_Longitude);

        // Kiá»ƒm tra tá»a Ä‘á»™
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

        // Äiá»ƒm cá»­a hÃ ng
        L.circleMarker(store, {

            radius: 4,

            color: "#547FA3",

            fillColor: "#6B91B8",

            fillOpacity: 0.75

        })

        .bindPopup("Äiá»ƒm cá»­a hÃ ng")

        .addTo(section2MapLayer);


        // Äiá»ƒm giao hÃ ng
        L.circleMarker(drop, {

            radius: 4,

            color: "#B77C7C",

            fillColor: "#D49A62",

            fillOpacity: 0.7

        })

        .bindPopup(

            `Äiá»ƒm giao hÃ ng<br>
            Khu vá»±c: ${item.Area || "N/A"}<br>
            Thá»i gian giao: ${formatNumber(item.Delivery_Time, 1)} phÃºt`

        )

        .addTo(section2MapLayer);

    });

    // Tá»± Ä‘á»™ng cÄƒn chá»‰nh báº£n Ä‘á»“ theo vá»‹ trÃ­ dá»¯ liá»‡u
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

// 7. Thá»‘ng kÃª nguy cÆ¡ giao trá»… thá»±c táº¿
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
            throw new Error(`API Actual_Risk lá»—i HTTP ${response.status}`);
        }

        const result = await response.json();

        riskElement.textContent =
            formatNumber(result.risk_count);

        if (detailElement) {
            detailElement.textContent =
                `${formatNumber(result.risk_rate, 2)}% trÃªn ` +
                `${formatNumber(result.total_labeled)} Ä‘Æ¡n cÃ³ nhÃ£n`;
        }

    } catch (error) {
        console.error("KhÃ´ng thá»ƒ táº£i Actual_Risk:", error);

        riskElement.textContent = "N/A";

        if (detailElement) {
            detailElement.textContent = "KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u rá»§i ro";
        }
    }
}

// ==========================================
// PHAN 03 - KHU VUC VA PHUONG TIEN
// ==========================================

async function loadAreaVehicleDashboard(token) {
    const startDate = document.getElementById("area3StartDate")?.value;
    const endDate = document.getElementById("area3EndDate")?.value;
    const area = document.getElementById("area3Filter")?.value || "";

    if (startDate && endDate && startDate > endDate) {
        alert("NgÃ y báº¯t Ä‘áº§u khÃ´ng Ä‘Æ°á»£c lá»›n hÆ¡n ngÃ y káº¿t thÃºc.");
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
            alert("PhiÃªn Ä‘Äƒng nháº­p háº¿t háº¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p.");
            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API lá»—i HTTP ${response.status}`);
        }

        const data = await response.json();

        console.log("Area Vehicle Dashboard:", data);

        // KPI
        document.getElementById("area3FastestArea").textContent =
            data.fastest_area?.area || "KhÃ´ng cÃ³ dá»¯ liá»‡u";

        document.getElementById("area3FastestVehicle").textContent =
            data.fastest_vehicle?.vehicle || "KhÃ´ng cÃ³ dá»¯ liá»‡u";

        document.getElementById("area3AverageDistance").textContent =
            Number(data.kpi?.average_distance || 0).toFixed(2);

        // Biá»ƒu Ä‘á»“ cÆ¡ cáº¥u phÆ°Æ¡ng tiá»‡n theo khu vá»±c
        renderArea3VehicleChart(data.by_area_vehicle || []);

        // Biá»ƒu Ä‘á»“ thá»i gian giao hÃ ng theo khu vá»±c
        renderArea3DeliveryChart(data.by_area || []);

        // Biá»ƒu Ä‘á»“ khoáº£ng cÃ¡ch theo khu vá»±c
        renderArea3DistanceChart(data.by_area || []);

        // Báº£ng phÃ¢n tÃ­ch khu vá»±c vÃ  phÆ°Æ¡ng tiá»‡n
        renderArea3MatrixTable(data.by_area_vehicle || []);

    } catch (error) {
        console.error("Lá»—i táº£i dá»¯ liá»‡u Pháº§n 03:", error);
        alert("KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u Pháº§n 03: " + error.message);
    }
}

// Khá»Ÿi táº¡o bá»™ lá»c riÃªng cho Pháº§n 03
function initArea3Filters(token) {
    const startInput = document.getElementById("area3StartDate");
    const endInput = document.getElementById("area3EndDate");
    const areaInput = document.getElementById("area3Filter");

    if (!startInput || !endInput || !areaInput) return;

    document.getElementById("area3ApplyFilters")?.addEventListener(
        "click",
        () => loadAreaVehicleDashboard(token)
    );

    document.getElementById("area3ResetFilters")?.addEventListener(
        "click",
        () => {
            startInput.value = "2022-02-11";
            endInput.value = "2022-04-06";
            areaInput.value = "";
            loadAreaVehicleDashboard(token);
        }
    );
}

// ==========================================
// CAC BIEU DO PHAN 03
// ==========================================

// 1. Co cau phuong tien theo khu vuc
function renderArea3VehicleChart(rows) {
    const vehicleTotals = {};

    rows.forEach(item => {
        const vehicle = item.vehicle || "KhÃ¡c";
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
                legend: { position: "bottom" },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.toLocaleString("vi-VN")} Ä‘Æ¡n`;
                        }
                    }
                }
            }
        }
    });
}

// 2. Thoi gian giao hang trung binh theo khu vuc
function renderArea3DeliveryChart(rows) {
    createChart("area3DeliveryChart", {
        type: "bar",
        data: {
            labels: rows.map(item => item.area),
            datasets: [{
                label: "Thá»i gian giao trung bÃ¬nh (phÃºt)",
                data: rows.map(item => Number(item.average_delivery_time || 0)),
                backgroundColor: "#4e79a7"
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "PhÃºt"
                    }
                }
            }
        }
    });
}

// 3. Khoang cach giao hang trung binh theo khu vuc
function renderArea3DistanceChart(rows) {
    createChart("area3DistanceChart", {
        type: "bar",
        data: {
            labels: rows.map(item => item.area),
            datasets: [{
                label: "Khoáº£ng cÃ¡ch trung bÃ¬nh (km)",
                data: rows.map(item => Number(item.average_distance || 0)),
                backgroundColor: "#f28e2b"
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
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

// 4. Bang phan tich khu vuc va phuong tien
function renderArea3MatrixTable(rows) {
    const tbody = document.querySelector("#area3MatrixTable tbody");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">KhÃ´ng cÃ³ dá»¯ liá»‡u</td>
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

    const vehicleOrder = ["Motorcycle", "Scooter", "Van"];

    const sortedRows = [...rows].sort((a, b) => {
        const areaDiff = areaOrder.indexOf(a.area) - areaOrder.indexOf(b.area);

        if (areaDiff !== 0) return areaDiff;

        return vehicleOrder.indexOf(a.vehicle) - vehicleOrder.indexOf(b.vehicle);
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
            td.textContent = value;
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

// ==========================================
// PHAN 04 - DU DOAN NGUY CO GIAO TRE
// ==========================================

// Tai du lieu phan tich rui ro tu API
async function loadRiskDashboard(token) {
    let currentStep = "Báº¯t Ä‘áº§u táº£i dá»¯ liá»‡u";

    try {
        console.log("ÄÃƒ Gá»ŒI loadRiskDashboard");

        // BÆ°á»›c 1: Gá»i API
        currentStep = "Gá»i API";

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

        // BÆ°á»›c 2: Kiá»ƒm tra xÃ¡c thá»±c
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("role");

            alert("PhiÃªn Ä‘Äƒng nháº­p háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.");
            window.location.href = "index.html";
            return;
        }

        // BÆ°á»›c 3: Kiá»ƒm tra pháº£n há»“i API
        currentStep = "Äá»c dá»¯ liá»‡u API";

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || `API lá»—i HTTP ${response.status}`
            );
        }

        console.log("RISK DASHBOARD DATA:", data);

        // BÆ°á»›c 4: Kiá»ƒm tra dá»¯ liá»‡u KPI
        currentStep = "Cáº­p nháº­t KPI";

        if (!data.kpi) {
            throw new Error("API khÃ´ng tráº£ vá» dá»¯ liá»‡u KPI");
        }

        document.getElementById("riskTotalOrders").textContent =
            formatNumber(data.kpi.risk_count);

        document.getElementById("riskAverageProbability").textContent =
            formatNumber(data.kpi.average_probability * 100, 2) + "%";

        document.getElementById("riskRate").textContent =
            formatNumber(data.kpi.risk_rate, 2) + "%";

        document.getElementById("riskGaugeValue").textContent =
            formatNumber(data.kpi.risk_rate, 2) + "%";

        // BÆ°á»›c 5: Váº½ biá»ƒu Ä‘á»“ theo khu vá»±c vÃ  phÆ°Æ¡ng tiá»‡n
        currentStep = "Váº½ biá»ƒu Ä‘á»“ khu vá»±c vÃ  phÆ°Æ¡ng tiá»‡n";

        renderRiskAreaVehicleChart(data.by_area_vehicle || []);

        // BÆ°á»›c 6: Váº½ biá»ƒu Ä‘á»“ má»©c Ä‘á»™ rá»§i ro
        currentStep = "Váº½ biá»ƒu Ä‘á»“ má»©c Ä‘á»™ rá»§i ro";

        renderRiskGaugeChart(data.kpi.risk_rate || 0);

        // BÆ°á»›c 7: Váº½ biá»ƒu Ä‘á»“ phÃ¢n phá»‘i rá»§i ro
        currentStep = "Váº½ biá»ƒu Ä‘á»“ phÃ¢n phá»‘i rá»§i ro";

        renderRiskDistributionChart(data.risk_distribution || []);

        // BÆ°á»›c 8: Hiá»ƒn thá»‹ báº£ng Ä‘Æ¡n hÃ ng kháº©n cáº¥p
        currentStep = "Hiá»ƒn thá»‹ báº£ng Ä‘Æ¡n hÃ ng";

        renderUrgentOrdersTable(data.urgent_orders || []);

        console.log("Dashboard 04 Ä‘Ã£ táº£i dá»¯ liá»‡u thÃ nh cÃ´ng!");

    } catch (error) {
        console.error("Lá»—i táº¡i Dashboard 04:", error);
        console.error("Lá»—i xáº£y ra táº¡i bÆ°á»›c:", currentStep);

        document.getElementById("riskTotalOrders").textContent = "N/A";
        document.getElementById("riskAverageProbability").textContent = "N/A";
        document.getElementById("riskRate").textContent = "N/A";
        document.getElementById("riskGaugeValue").textContent = "N/A";

        const tbody = document.getElementById("urgentOrdersTable");

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger">
                        KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u
                    </td>
                </tr>
            `;
        }

        alert(
            "KhÃ´ng thá»ƒ táº£i Dashboard Pháº§n 04: " +
            error.message +
            "\nBÆ°á»›c xáº£y ra lá»—i: " +
            currentStep
        );
    }
}

// 1. So don co nguy co theo khu vuc va phuong tien
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

            return record ? Number(record.risk_count || 0) : 0;
        }),
        backgroundColor: chartColors[index],
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
                            `${context.dataset.label}: ${formatNumber(context.raw)} don`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "So don co nguy co"
                    }
                }
            }
        }
    });
}

// 2. Gauge - Muc do rui ro he thong
function renderRiskGaugeChart(riskRate) {
    const value = Math.min(Math.max(Number(riskRate) || 0, 0), 100);

    createChart("riskGaugeChart", {
        type: "doughnut",
        data: {
            labels: ["Nguy co", "Phan con lai"],
            datasets: [{
                data: [value, 100 - value],
                backgroundColor: ["#dc3545", "#e9ecef"],
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

// 3. Phan bo don an toan va don co nguy co
function renderRiskDistributionChart(items) {
    createChart("riskDistributionChart", {
        type: "doughnut",
        data: {
            labels: items.map(item => item.label),
            datasets: [{
                label: "So don hang",
                data: items.map(item => Number(item.count) || 0),
                backgroundColor: ["#B8A99A", "#6D9B83", "#C65D52"],
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
                            `${context.label}: ${formatNumber(context.raw)} don`
                    }
                }
            }
        }
    });
}

// 4. Bang 20 don hang co xac suat rui ro cao nhat
function renderUrgentOrdersTable(items) {
    const tbody = document.getElementById("urgentOrdersTable");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!items.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    Khong co don hang nguy co
                </td>
            </tr>
        `;
        return;
    }

    items.forEach(item => {
        const tr = document.createElement("tr");

        const values = [
            item.Order_ID,
            item.Area,
            item.Vehicle,
            `${(Number(item.Risk_Probability) * 100).toFixed(2)}%`
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

// Tu dong tai du lieu khi chuyen sang Phan 04
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
// PHáº¦N 05 - ÄÃNH GIÃ VÃ€ Tá»I Æ¯U MÃ” HÃŒNH
// ==========================================

// 1. Dá»® LIá»†U SO SÃNH PRECISION VÃ€ RECALL THEO NGÆ¯á» NG

const thresholdData = [
    { threshold: 0.20, precision: 0.4130952381, recall: 0.9747191011, f1: 0.5802675585 },
    { threshold: 0.25, precision: 0.4503002001, recall: 0.9480337079, f1: 0.6105834464 },
    { threshold: 0.30, precision: 0.4907338769, recall: 0.9297752809, f1: 0.6424065987 },
    { threshold: 0.35, precision: 0.5308134758, recall: 0.9073033708, f1: 0.6697770866 },
    { threshold: 0.40, precision: 0.5618834081, recall: 0.8799157303, f1: 0.6858237548 },
    { threshold: 0.45, precision: 0.5961155378, recall: 0.8405898876, f1: 0.6975524476 },
    { threshold: 0.50, precision: 0.6451247166, recall: 0.7991573034, f1: 0.7139272271 },
    { threshold: 0.55, precision: 0.6880152188, recall: 0.7619382022, f1: 0.7230923026 },
    { threshold: 0.60, precision: 0.7163561077, recall: 0.7289325843, f1: 0.7225896276 },
    { threshold: 0.65, precision: 0.7507788162, recall: 0.6769662921, f1: 0.7119645495 },
    { threshold: 0.70, precision: 0.7834061135, recall: 0.6299157301, f1: 0.6983261969 },
    { threshold: 0.75, precision: 0.8136958711, recall: 0.5674157303, f1: 0.6685974348 },
    { threshold: 0.80, precision: 0.8231213873, recall: 0.5000000000, f1: 0.6221057230 }
];

// 2. Dá»® LIá»†U SO SÃNH CÃC MÃ” HÃŒNH PHÃ‚N LOáº I

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


// 3. HÃ€M Táº¢I DASHBOARD 05

function loadModelEvaluationDashboard() {

    renderThresholdScatterChart();
    renderThresholdOptimizationChart();
    renderModelComparisonChart();

    console.log("Dashboard 05 Ä‘Ã£ táº£i dá»¯ liá»‡u thÃ nh cÃ´ng!");
}

// 4. BIá»‚U Äá»’ SCATTER PRECISION VÃ€ RECALL

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
                                "Precision: " + (item.x * 100).toFixed(2) + "%",
                                "Recall: " + (item.y * 100).toFixed(2) + "%"
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
                        callback: value => (value * 100).toFixed(0) + "%"
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
                        callback: value => (value * 100).toFixed(0) + "%"
                    }
                }
            }
        }
    });
}

// 5. BIá»‚U Äá»’ Tá»I Æ¯U HÃ“A NGÆ¯á» NG Cáº¢NH BÃO

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
                        callback: value => (value * 100).toFixed(0) + "%"
                    }
                }
            }
        }
    });
}

// 6. BIá»‚U Äá»’ SO SÃNH CÃC MÃ” HÃŒNH MACHINE LEARNING

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
                        callback: value => (value * 100).toFixed(0) + "%"
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

// 7. Tá»° Äá»˜NG Táº¢I KHI CHUYá»‚N SANG PHáº¦N 05

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

// 9. Khá»Ÿi cháº¡y Dashboard
document.addEventListener("DOMContentLoaded", loadDashboard);

// 10. CHUYEN DOI GIUA 5 PHAN DASHBOARD
document.addEventListener("DOMContentLoaded", function () {

    const tabs = document.querySelectorAll(".report-tab");
    const sections = document.querySelectorAll(".report-section");

    tabs.forEach(tab => {
        tab.addEventListener("click", async function () {

            const targetId = this.dataset.target;

            // An tat ca cac phan
            sections.forEach(section => {
                section.classList.add("d-none");
            });

            // Hien phan duoc chon
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.classList.remove("d-none");
            }
            // Neu chuyen sang Phan 03 thi tai du lieu
            if (targetId === "section3") {
            const token = localStorage.getItem("token");

            const startInput = document.getElementById("area3StartDate");
            const endInput = document.getElementById("area3EndDate");

            if (startInput && !startInput.value) {
                startInput.value = "2022-02-11";
            }

            if (endInput && !endInput.value) {
                endInput.value = "2022-04-06";
            }

            initArea3Filters(token);
            await loadAreaVehicleDashboard(token);
            }
            // Cap nhat trang thai nut
            tabs.forEach(button => {
                button.classList.remove("btn-primary", "active");
                button.classList.add("btn-outline-primary");
            });

            this.classList.remove("btn-outline-primary");
            this.classList.add("btn-primary", "active");

        });
    });

});
