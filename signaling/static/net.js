var ws = null;

const messageBox = document.getElementById('messages');
const messageButton = document.getElementById('btn');
const createButton = document.getElementById('create-btn');
const joinButton = document.getElementById('join-btn');
const port = "9000";
var myId = -1;
var currPeer = null;

function initWebSocket() {
        // Create websocket
        ws = new WebSocket('ws://' + location.host +  '/ws');

        // Listen to websocket messages
        ws.addEventListener('message', (e) => {
                // Parse data into object
                var msg = JSON.parse(e.data);

                /*const messageItem = document.createElement('div');
                messageItem.innerHTML = msg.message;
                messageBox.appendChild(messageItem);*/

                switch (msg.type) {
                        case "createResp":
                                // Set id of self
                                console.log("create new", msg.src)
                                myId = msg.src;
                                break;
                        case "joinResp":
                                console.log("join as", msg.src)
                                if(myId == -1) myId = msg.src;
                                handleNewJoin(msg.dest, true);
                                break;
                        case "rtc":
                                console.log("send rtc from", msg.src)
                                handleRtc(msg);
                                break;
                }
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

// id -> id to connect peer with
function handleNewJoin(id, initiator) {
        currPeer = new SimplePeer({initiator: initiator, trickle: false})
        // Offer initiated upon creation of object
        currPeer.on('signal', (data) => {
                var newMessage = {
                        type: "rtc",
                        src: myId,
                        dest: id,
                        message: JSON.stringify(data),
                }
                // Send to relay to peer id
                ws.send(JSON.stringify(newMessage));
        });
        currPeer.on('connect', () => {
                console.log("connected!");
        });
}

function handleRtc(msg) {
        if(currPeer == null) {
                // Create new SimplePeer and send to id where it came from
                handleNewJoin(msg.src, false)
        }
        console.log(msg.message);
        currPeer.signal(msg.message);
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
