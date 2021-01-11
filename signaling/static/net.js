var ws = null;

const messageBox = document.getElementById('messages');
const messageButton = document.getElementById('btn');
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
                src: 1,
                dest: 1,
                message: message,
        }
        // Send message on websocket
        ws.send(JSON.stringify(newMessage));
}

initWebSocket();
messageButton.addEventListener('click', (e) => {
        sendMessage();
});
