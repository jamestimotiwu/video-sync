var ws = null;

const messageBox = document.getElementById('messages');
const messageButton = document.getElementById('btn');
const createButton = document.getElementById('create-btn');
const joinButton = document.getElementById('join-btn');
const sessionBox = document.getElementById('session-box');
const port = "9000";
var myId = -1;
//var currPeer = null;
var peers = [];

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
                                console.log(msg)
                                // Set id of self
                                console.log("create new", msg.data.id)
                                console.log("session id: ", msg.data.session_id)
                                myId = msg.data.id;
                                break;
                        case "joinResp":
                                console.log("join as", msg.data.id)
                                if(myId == -1) myId = msg.data.id;
                                handleJoinSession(msg.data.peers) 
                                break;
                        case "rtc":
                                console.log("send rtc from", msg.data.src)
                                handleRtc(msg);
                                break;
                        case "error":
                                console.log(msg.data.message);
                                break;
                }
        });
}

function sendMessage() {
        var message = "test"
        var newMessage = {
                type: "rtc",
                data: {
                        src: 1,
                        dest: 1,
                        message: message,
                }
        }
        // Send message on websocket
        ws.send(JSON.stringify(newMessage));
}

function createMessage() {
        // Connect to signaling serve
        initWebSocket();
        var newMessage = {
                type: "create",
                data: {},
        }
        ws.onopen = () => {
                ws.send(JSON.stringify(newMessage));
        };
}

function joinMessage() {
        // Connect to signaling serve
        initWebSocket();
        var newMessage = {
                type: "join",
                data: {
                        src: 0,
                        dest: 0,
                        message: sessionBox.value,
                }
        }
        ws.onopen = () => {
                ws.send(JSON.stringify(newMessage));
        };
}

// Go over list of ids and attempt to connect to each peer
function handleJoinSession(ids) {
        console.log(ids)
        for(var i=0;i<ids.length;i++) {
                handleNewJoin(ids[i], true);
        }
}

// id -> id to connect peer with
function handleNewJoin(id, initiator) {
        console.log("peer "+id+" has joined")
        currPeer = new SimplePeer({initiator: initiator, trickle: false})
        // Offer initiated upon creation of object
        currPeer.on('signal', (data) => {
                var newMessage = {
                        type: "rtc",
                        data: {
                                src: myId,
                                dest: id,
                                message: JSON.stringify(data),
                        }
                }
                // Send to relay to peer id
                ws.send(JSON.stringify(newMessage));
        });
        currPeer.on('connect', () => {
                console.log("connected!");
        });
        // Add to peer list
        peers[id] = {
                id: id,
                p: currPeer,
        }
}

function handleRtc(msg) {
        let srcId = msg.data.src;
        if(!(srcId in peers)) {
                // Create new SimplePeer and send to id where it came from
                handleNewJoin(srcId, false)
        }
        console.log(msg.data.message);
        peers[srcId].p.signal(msg.data.message);
}

messageButton.addEventListener('click', (e) => {
        sendMessage();
});

createButton.addEventListener('click', (e) => {
        createMessage();
});

joinButton.addEventListener('click', (e) => {
        joinMessage();
});
