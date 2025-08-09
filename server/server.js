const express = require('express');
const cors = require('cors');

const http = require('http');
const { setupWebSocket } = require('./websocket');
const { setupMQTT, publishServoControl } = require('./mqttHandler');
const { db, ref, get, query, orderByChild, startAt, endAt } = require('./firebase');

const app = express();
const server = http.createServer(app);

const wsClients = setupWebSocket(server);
setupMQTT(wsClients);


app.use(cors());
app.use(express.static('public'));
app.use(express.json()); // Thêm middleware để parse JSON

// API endpoint để điều khiển servo
app.post('/control/servo', (req, res) => {
    try {
        const { value } = req.body;
        
        // Kiểm tra giá trị hợp lệ (0 hoặc 1)
        if (value !== 0 && value !== 1) {
            return res.status(400).json({ error: 'Giá trị phải là 0 hoặc 1' });
        }

        // Gửi lệnh điều khiển qua MQTT
        publishServoControl(value);
        
        console.log(`Servo control: ${value}`);
        res.json({ success: true, message: `Đã gửi lệnh servo: ${value}` });
        
    } catch (error) {
        console.error('Error controlling servo:', error);
        res.status(500).json({ error: 'Lỗi server khi điều khiển servo' });
    }
});

app.get('/data_sensor', async (req, res) => {
    try {
        const { from, to } = req.query;
        console.log(`Fetching data from ${from} to ${to}`);

        const q = query(
            ref(db, 'data_sensor'),
            orderByChild('timestamp'),
            startAt(from + " 00:00:00"),
            endAt(to + " 23:59:59")
        );

        const snap = await get(q);
        const result = [];

        snap.forEach(child => {
            result.push(child.val());
        });

        result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const limitedResult = result.slice(-20);

        console.log(`Found ${limitedResult.length} records (limited to 20 latest points)`);
        res.json(limitedResult);

    } catch (error) {
        console.error('Error fetching sensor data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


server.listen(3000, () => console.log('Server on http://localhost:3000'));
