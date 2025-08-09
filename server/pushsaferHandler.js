const push = require('pushsafer-notifications');

// Cấu hình Pushsafer
const pushsafer = new push({
    k: '7Cfq4gWUV7oiJwHsDBSd',
    debug: false
});

// Trạng thái để tránh spam thông báo
let lastNotifications = {
    lowFood: 0,
    highTurbidity: 0
};

const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 phút cooldown

function sendPushsaferNotification(title, message, sound = 0, vibration = 1, icon = 4) {
    return new Promise((resolve, reject) => {
        const msg = {
            m: message,
            t: title,
            s: sound,
            v: vibration,
            i: icon,
            d: 'a'
        };

        pushsafer.send(msg, (err, result) => {
            if (err) {
                console.error('❌ Pushsafer error:', err);
                reject(err);
            } else {
                console.log('✅ Pushsafer notification sent');
                resolve(result);
            }
        });
    });
}

// Test thông báo
function sendTestNotification() {
    return sendPushsaferNotification(
        'Test TraiCa System',
        'Hệ thống thông báo đang hoạt động bình thường!',
        1, 1, 1
    );
}

// Kiểm tra thức ăn
function checkFoodLevel(distanceInCm) {
    const now = Date.now();
    let foodLevel, levelText;

    if (distanceInCm <= 3) {
        foodLevel = 100; levelText = 'ĐẦY';
    } else if (distanceInCm <= 6) {
        foodLevel = 75; levelText = 'NHIỀU';
    } else if (distanceInCm <= 10) {
        foodLevel = 50; levelText = 'TRUNG BÌNH';
    } else if (distanceInCm <= 15) {
        foodLevel = 25; levelText = 'ÍT';
    } else {
        foodLevel = 0; levelText = 'HẾT';
    }

    if (foodLevel <= 25 && (now - lastNotifications.lowFood) > NOTIFICATION_COOLDOWN) {
        const title = 'Thông báo thức ăn cá';
        const message = `Mức thức ăn: ${foodLevel}% (${levelText})\nVui lòng bổ sung thức ăn cho cá!`;
        
        sendPushsaferNotification(title, message).catch(error => {
            console.error('Failed to send food notification:', error);
        });
        
        lastNotifications.lowFood = now;
        console.log(`📱 Sent food notification: ${foodLevel}% (${levelText})`);
    }
}

// Kiểm tra độ đục
function checkTurbidity(turbidity) {
    turbidity = 100 - turbidity;
    const now = Date.now();
    
    if (turbidity > 80 && (now - lastNotifications.highTurbidity) > NOTIFICATION_COOLDOWN) {
        let levelText;
        
        if (turbidity > 95) {
            levelText = 'rất đục';
        } else if (turbidity > 90) {
            levelText = 'đục';
        } else {
            levelText = 'hơi đục';
        }
        
        const title = 'Thông báo chất lượng nước';
        const message = `Độ đục nước: ${turbidity}% (${levelText})\nCần kiểm tra và làm sạch bể cá!`;
        
        sendPushsaferNotification(title, message).catch(error => {
            console.error('Failed to send turbidity notification:', error);
        });
        
        lastNotifications.highTurbidity = now;
        console.log(`📱 Sent turbidity notification: ${turbidity}% (${levelText})`);
    }
}

// Xử lý dữ liệu sensor
function processSensorData(data) {
    if (data.distance !== undefined) {
        checkFoodLevel(data.distance);
    }
    
    if (data.turbidity !== undefined) {
        checkTurbidity(data.turbidity);
    }
}

module.exports = {
    sendPushsaferNotification,
    processSensorData,
    sendTestNotification,
    checkFoodLevel,
    checkTurbidity
};
