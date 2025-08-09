const { initializeApp } = require("firebase/app");
const { getDatabase, ref, push, get, query, orderByChild, startAt, endAt } = require("firebase/database");

const firebaseConfig = {
    apiKey: "AIzaSyDC93hbl-CNhf7BGml6aCdTYsILo5r6_08",
    authDomain: "project-iot-final.firebaseapp.com",
    databaseURL: "https://project-iot-final-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "project-iot-final",
    storageBucket: "project-iot-final.firebasestorage.app",
    messagingSenderId: "827084968699",
    appId: "1:827084968699:web:bf843748486c71c214165e",
    measurementId: "G-X3X1ZGC0M8"
};


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

module.exports = { db, ref, push, get, query, orderByChild, startAt, endAt };
