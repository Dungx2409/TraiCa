const labels = []; // thời gian
const tempData = []; // nhiệt độ
const turbData = []; // độ đục

const ctx = document.getElementById('myChart').getContext('2d');
const myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: labels,
        datasets: [
            {
                label: 'Nhiệt độ (°C)',
                data: tempData,
                borderWidth: 2,
                borderColor: 'red',
                fill: false
            },
            {
                label: 'Độ đục (ADC)',
                data: turbData,
                borderWidth: 2,
                borderColor: 'blue',
                fill: false
            }
        ]
    },
    options: {
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Thời gian'
                }
            },
            y: {
                beginAtZero: true
            }
        }
    }
});

// 📡 Nhận dữ liệu thời gian thực qua WebSocket
const socket = new WebSocket('ws://localhost:3000');
let isRealtimeMode = true; // Biến để kiểm soát chế độ realtime

socket.onmessage = (event) => {
    const json = JSON.parse(event.data);
    console.log('Realtime data:', json);

    // Xử lý dữ liệu unified format
    if (json.temperature !== undefined && json.turbidity !== undefined) {
        // Dữ liệu sensor (nhiệt độ, độ đục) - chỉ cập nhật biểu đồ khi ở chế độ realtime
        if (isRealtimeMode) {
            // Chỉ hiển thị ngày, bỏ giờ
            const dateOnly = json.timestamp.split(' ')[0] || json.timestamp.split('T')[0];
            labels.push(dateOnly);
            tempData.push(json.temperature);
            turbData.push(json.turbidity);

            // Chỉ giữ lại 10 điểm gần nhất
            if (labels.length > 10) {
                labels.shift();
                tempData.shift();
                turbData.shift();
            }

            myChart.update();
        }
    }

    // Cập nhật trạng thái thiết bị (luôn cập nhật, không phụ thuộc vào realtime mode)
    if (json.distance !== undefined) {
        updateFoodLevel(json.distance);
    }
    
    if (json.PIR !== undefined) {
        updateMotionDetection(json.PIR);
    }

    if (json.turbidity !== undefined) {
        updateWaterQuality(json.turbidity);
    }
};

// 📥 Tải dữ liệu cũ từ Firebase thông qua server
async function loadHistory() {
    const from = document.getElementById('from-date').value;
    const to = document.getElementById('to-date').value;
    if (!from || !to) {
        alert('Vui lòng chọn cả ngày bắt đầu và kết thúc!');
        return;
    }

    // Tắt chế độ realtime khi lọc dữ liệu
    isRealtimeMode = false;

    try {
        const response = await fetch(`http://localhost:3000/data_sensor?from=${from}&to=${to}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dữ liệu lịch sử:', data);

        // Xoá dữ liệu cũ trên biểu đồ
        labels.length = 0;
        tempData.length = 0;
        turbData.length = 0;

        data.forEach(d => {
            // Chỉ hiển thị ngày, bỏ giờ
            const dateOnly = d.timestamp.split(' ')[0] || d.timestamp.split('T')[0];
            labels.push(dateOnly);
            tempData.push(d.temperature);
            turbData.push(d.turbidity);
        });

        myChart.update();
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
        alert('Không thể tải dữ liệu. Vui lòng kiểm tra server!');
        // Bật lại realtime nếu có lỗi
        isRealtimeMode = true;
    }
}

function enableRealtime() {
    isRealtimeMode = true;
    
    labels.length = 0;
    tempData.length = 0;
    turbData.length = 0;

    // Tự động cập nhật ngày hôm qua và hôm nay
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    // Chuyển đổi thành định dạng YYYY-MM-DD theo múi giờ địa phương
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    document.getElementById('to-date').value = formatDate(today);
    document.getElementById('from-date').value = formatDate(yesterday);

    myChart.update();
    console.log('Đã bật chế độ thời gian thực');
}

// 🎛️ Hàm điều khiển servo
async function controlServo(value) {
    try {
        const statusElement = document.getElementById('servo-status');
        statusElement.textContent = 'Đang gửi lệnh...';
        statusElement.style.color = 'orange';

        const response = await fetch('http://localhost:3000/control/servo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ value: value })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Servo control result:', result);
        
        // Cập nhật trạng thái
        statusElement.textContent = value === 1 ? 'Servo: BẬT' : 'Servo: TẮT';
        statusElement.style.color = value === 1 ? 'green' : 'red';
        
    } catch (error) {
        console.error('Lỗi khi điều khiển servo:', error);
        const statusElement = document.getElementById('servo-status');
        statusElement.textContent = 'Lỗi kết nối!';
        statusElement.style.color = 'red';
    }
}

// Hàm cập nhật lượng thức ăn dựa vào distance (sửa element ID)
function updateFoodLevel(distanceInCm) {
    const foodPercentageElement = document.getElementById('food-percentage');
    const foodStatusElement = document.getElementById('food-status');
    
    if (!foodPercentageElement || !foodStatusElement) return;
    
    if (distanceInCm === undefined || distanceInCm === null) {
        foodPercentageElement.textContent = '--';
        foodStatusElement.textContent = 'Không có dữ liệu';
        return;
    }

    // Tính toán mức thức ăn (distance càng lớn = thức ăn càng ít)
    let foodLevel;
    let levelText;
    let statusText;

    if (distanceInCm <= 3) {
        foodLevel = 100;
        levelText = '100%';
        statusText = 'Đầy';
    } else if (distanceInCm <= 6) {
        foodLevel = 75;
        levelText = '75%';
        statusText = 'Tốt';
    } else if (distanceInCm <= 10) {
        foodLevel = 50;
        levelText = '50%';
        statusText = 'Trung bình';
    } else if (distanceInCm <= 15) {
        foodLevel = 25;
        levelText = '25%';
        statusText = 'Thấp';
    } else {
        foodLevel = 0;
        levelText = '0%';
        statusText = 'Hết';
    }

    foodPercentageElement.textContent = levelText;
    foodStatusElement.textContent = statusText;
}

// Hàm cập nhật chất lượng nước
function updateWaterQuality(turbidity) {
    const waterQualityElement = document.getElementById('water-quality');
    const waterStatusElement = document.getElementById('water-status');
    
    if (!waterQualityElement || !waterStatusElement) return;
    
    if (turbidity === undefined || turbidity === null) {
        waterQualityElement.textContent = '--';
        waterStatusElement.textContent = 'Không có dữ liệu';
        return;
    }

    // Đánh giá chất lượng nước dựa trên độ đục
    let qualityText;
    let statusText;

    if (turbidity <= 100) {
        qualityText = 'Rất tốt';
        statusText = 'An toàn';
    } else if (turbidity <= 200) {
        qualityText = 'Tốt';
        statusText = 'Bình thường';
    } else if (turbidity <= 300) {
        qualityText = 'Trung bình';
        statusText = 'Cần theo dõi';
    } else {
        qualityText = 'Kém';
        statusText = 'Cần xử lý';
    }

    waterQualityElement.textContent = qualityText;
    waterStatusElement.textContent = statusText;
}

// Hàm cập nhật phát hiện chuyển động
function updateMotionDetection(pirValue) {
    const motionElement = document.getElementById('motion-status');
    
    if (!motionElement) return;
    
    if (pirValue === undefined || pirValue === null) {
        motionElement.textContent = '--';
        return;
    }

    // PIR sensor: 1 = có chuyển động, 0 = không có chuyển động
    if (pirValue === 1 || pirValue === '1' || pirValue === true) {
        motionElement.textContent = 'Phát hiện chuyển động';
        motionElement.style.color = '#ff5722';
    } else {
        motionElement.textContent = 'Không có';
        motionElement.style.color = '#4caf50';
    }
}

// Hàm tắt hệ thống khẩn cấp
function emergencyShutdown() {
    if (confirm('Bạn có chắc chắn muốn tắt hệ thống?')) {
        // Thực hiện logic tắt hệ thống
        console.log('Tắt hệ thống khẩn cấp');
        alert('Đã gửi lệnh tắt hệ thống');
    }
}

// Biến để theo dõi trạng thái thông báo
let notificationEnabled = true;

function sendAlert() {
    console.log('Tắt thông báo');

    notificationEnabled = false;
    
    // Tìm và cập nhật element hiển thị trạng thái thông báo
    const notificationStatusElements = document.querySelectorAll('.status-indicator');
    notificationStatusElements.forEach(element => {
        const textContent = element.textContent || element.innerText;
        if (textContent.includes('Thông báo:')) {
            const statusDiv = element.querySelector('div:last-child');
            const labelDiv = element.querySelector('div:first-child');
            
            if (statusDiv && labelDiv) {
                statusDiv.textContent = 'Đã tắt';
                labelDiv.style.color = '#f44336'; // Đổi màu thành đỏ
                element.classList.remove('active');
                element.classList.add('inactive');
            }
        }
    });
    
    // Cập nhật text nút thành "Bật thông báo"
    const alertButton = document.querySelector('.emergency-btn.alert');
    if (alertButton) {
        alertButton.innerHTML = '<i class="fas fa-bell"></i> Bật thông báo';
        alertButton.onclick = () => enableAlert();
    }
    
    alert('Đã tắt thông báo hệ thống');
}

// Hàm bật lại thông báo
function enableAlert() {
    console.log('Bật thông báo');
    
    // Cập nhật trạng thái thông báo
    notificationEnabled = true;
    
    // Tìm và cập nhật element hiển thị trạng thái thông báo
    const notificationStatusElements = document.querySelectorAll('.status-indicator');
    notificationStatusElements.forEach(element => {
        const textContent = element.textContent || element.innerText;
        if (textContent.includes('Thông báo:')) {
            const statusDiv = element.querySelector('div:last-child');
            const labelDiv = element.querySelector('div:first-child');
            
            if (statusDiv && labelDiv) {
                statusDiv.textContent = 'Đang bật';
                labelDiv.style.color = '#4caf50'; // Đổi màu thành xanh
                element.classList.remove('inactive');
                element.classList.add('active');
            }
        }
    });
    
    // Cập nhật text nút thành "Tắt thông báo"
    const alertButton = document.querySelector('.emergency-btn.alert');
    if (alertButton) {
        alertButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Tắt thông báo';
        alertButton.onclick = () => sendAlert();
    }
    
    alert('Đã bật thông báo hệ thống');
}


// 🕒 Tự động set ngày hôm nay và hôm qua
window.onload = () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    // Chuyển đổi thành định dạng YYYY-MM-DD theo múi giờ địa phương
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    document.getElementById('to-date').value = formatDate(today);
    document.getElementById('from-date').value = formatDate(yesterday);
    
    // Tải trạng thái thiết bị ban đầu
    loadDeviceStatus();
};

// 📡 Hàm tải trạng thái thiết bị ban đầu
async function loadDeviceStatus() {
    try {
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + 
                       String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(today.getDate()).padStart(2, '0');
        
        // Tải dữ liệu sensor mới nhất để lấy trạng thái thiết bị
        const response = await fetch(`http://localhost:3000/data_sensor?from=${todayStr}&to=${todayStr}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
                const latestStatus = data[data.length - 1]; // Lấy dữ liệu mới nhất
                
                // Cập nhật UI với dữ liệu mới nhất
                if (latestStatus.distance !== undefined) {
                    updateFoodLevel(latestStatus.distance);
                }
                
                if (latestStatus.PIR !== undefined) {
                    updateMotionDetection(latestStatus.PIR);
                }

                if (latestStatus.turbidity !== undefined) {
                    updateWaterQuality(latestStatus.turbidity);
                }
            }
        }
    } catch (error) {
        console.log('Không thể tải trạng thái thiết bị ban đầu:', error);
    }
}
