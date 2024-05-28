const express = require('express');
const bodyParser = require('body-parser');
const { ModuleClient } = require('azure-iot-device');
const { Mqtt } = require('azure-iot-device-mqtt');

// Array of connection strings for multiple devices
let connectionStrings = [
    'HostName=D7A4IHSI02.azure-devices.net;DeviceId=665427f514e2fe0ce5c8247b;SharedAccessKey=ZHPWEd21iGmjMXpDQ+8s/wuGJoXngPn2Sp8tRMJwv1Q=', // Device 01
    'HostName=D7A4IHSI02.azure-devices.net;DeviceId=6654283414e2fe48c5c824a5;SharedAccessKey=laQS5um49Ea8jgJgu1LTjgKJfB/e8Eg+ZTE4SMYIntw=', // Device 02
    'HostName=D7A4IHSI02.azure-devices.net;DeviceId=665428e114e2fe4612c8250e;SharedAccessKey=UCjFDthiXe3pCd4+79E1L8yDADcCkjHWCzpT1pxr2Mk=', // Device 03
    // Add more connection strings as needed
];

// Object to hold twins for each device
const deviceTwins = {};

async function twinUpdateListener(client, deviceId) {
    try {
        const twin = await client.getTwin();
        console.log(`Twin acquired for device: ${deviceId}`);

        // Store the twin in the deviceTwins object
        deviceTwins[deviceId] = twin;

        twin.on('properties.desired', (delta) => {
            console.log(`Twin patch received for device: ${deviceId}`);
            delete delta.$version;
            console.log('Sending Twin as reported property...');
            console.log(delta);
            twin.properties.reported.update(delta, (err) => {
                if (err) {
                    console.error(`Error updating reported properties for device ${deviceId}: ` + err.message);
                } else {
                    console.log(`Reported properties updated for device: ${deviceId}`);
                }
            });
        });
    } catch (err) {
        console.error(`Error getting twin for device ${deviceId}: ` + err.message);
    }
}

async function initClient(connectionString, deviceId) {
    try {
        const client = await ModuleClient.fromConnectionString(connectionString, Mqtt);
        await client.open();
        console.log(`IoT Hub module client initialized and connected for device: ${deviceId}`);

        twinUpdateListener(client, deviceId);
    } catch (err) {
        console.error(`Could not connect to IoT Hub with connection string for device ${deviceId}: ` + err.message);
    }
}

async function main() {
    connectionStrings.forEach((connectionString, index) => {
        const deviceId = `Device${index + 1}`;
        initClient(connectionString, deviceId);
    });

    process.on('SIGINT', () => {
        console.log('IoT Hub Device Twin device sample stopped');
        process.exit();
    });
}

// Initialize the server
const app = express();
const port = 3000;

// Use body-parser middleware to parse JSON bodies
app.use(bodyParser.json());

app.get('/desired', (req, res) => {
    const desiredProperties = {};
    for (const deviceId in deviceTwins) {
        desiredProperties[deviceId] = deviceTwins[deviceId].properties.desired;
    }
    res.json(desiredProperties);
});

app.get('/reported', (req, res) => {
    const reportedProperties = {};
    for (const deviceId in deviceTwins) {
        reportedProperties[deviceId] = deviceTwins[deviceId].properties.reported;
    }
    res.json(reportedProperties);
});

app.get('/desired/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    const twin = deviceTwins[deviceId];

    if (twin) {
        res.json(twin.properties.desired);
    } else {
        res.status(404).send('Device not found');
    }
});

app.get('/reported/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    const twin = deviceTwins[deviceId];

    if (twin) {
        res.json(twin.properties.reported);
    } else {
        res.status(404).send('Device not found');
    }
});

app.post('/update-connection-strings', (req, res) => {
    const newConnectionStrings = req.body.connectionStrings;

    if (!Array.isArray(newConnectionStrings)) {
        return res.status(400).send('Invalid connection strings format');
    }

    // Close existing connections
    for (const deviceId in deviceTwins) {
        deviceTwins[deviceId].removeAllListeners();
        delete deviceTwins[deviceId];
    }

    connectionStrings = newConnectionStrings;
    main();
    res.send('Connection strings updated and clients reinitialized');
});

// Expose the Express API as a single Cloud Function:
//exports.app = functions.https.onRequest(app);

console.log('Starting the Node.js IoT Hub Device Twin device sample for multiple devices...');
console.log('IoTHubModuleClient waiting for commands, press Ctrl-C to exit');
main();


app.listen(process.env.PORT || 3000)
  