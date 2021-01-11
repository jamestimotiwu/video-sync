var ws = null;

const messageBox = document.getElementById('messages');
const messageButton = document.getElementById('btn');
const createButton = document.getElementById('create-btn');
const joinButton = document.getElementById('join-btn');
const port = "9000";

function initWebSocket() {
        // Create websocket
        ws = new WebSocket('ws://' + location.host +  '/ws');

        // Listen to websocket messages
        ws.addEventListener('message', (e) => {
                // Parse data into object
                var msg = JSON.parse(e.data);

                const messageItem = document.createElement('div');
                messageItem.innerHTML = msg.message;
                messageBox.appendChild(messageItem);
        });
}

function sendMessage() {
        var message = "test"
        var newMessage = {
                type: "rtc",
                src: 1,
                dest: 1,
                message: message,
        }
        // Send message on websocket
        ws.send(JSON.stringify(newMessage));
}

function createMessage() {
        var newMessage = {
                type: "create",
                src: 0,
                dest: 0,
                message: "",
        }
        ws.send(JSON.stringify(newMessage));
}

function joinMessage() {
        var newMessage = {
                type: "join",
                src: 0,
                dest: 0,
                message: "",
        }
        ws.send(JSON.stringify(newMessage));
}

initWebSocket();
messageButton.addEventListener('click', (e) => {
        sendMessage();
});

createButton.addEventListener('click', (e) => {
        createMessage();
});

joinButton.addEventListener('click', (e) => {
        joinMessage();
});
