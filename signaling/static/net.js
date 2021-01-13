var ws = null;

// Native constants
const KB = 1 << 10;

// Elements
const messageBox = document.getElementById('messages');
const messageButton = document.getElementById('btn');
const createButton = document.getElementById('create-btn');
const joinButton = document.getElementById('join-btn');
const sessionBox = document.getElementById('session-box');
const upload = document.getElementById('upload');
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
        // Simple peer opts
        let opts = {
          initiator: initiator, 
          trickle: false,
          objectMode: true,
        }
        // Add to peer list
        peers[id] = new Peer(id, opts);
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

// TODO: test send files to all connected peers
function sendFileToAll(file) {
  for(var i in peers) {
    console.log(peers);
    peers[i].sendFile(file);
  }
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

upload.addEventListener('change', (e) => {
  for(const file of upload.files) {
    sendFileToAll(file);
  }
});

// Peer object
class Peer {
  constructor(id, opts) {
    this.id = id;
    this.p = new SimplePeer(opts);
    // Offer initiated upon creation of object
    this.p.on('signal', (data) => {
      var newMessage = {
              type: "rtc",
              data: {
                      src: myId,
                      dest: id,
                      message: JSON.stringify(data),
              }
      }
      // Send to relay to peer id with signaling ws
      ws.send(JSON.stringify(newMessage));
    });
    this.p.on('connect', () => {
      console.log(id + " connected!");
    });
    this.p.on('data', (data) => {
      this.handleData(data)
    });
    this.consumer = null;
    this.producer = null;
    this.once = false
  }

  // WebRTC data channel multiplexer/listener
  handleData(data) {
    if(typeof data !== 'string') {
      // Check if file transfer in session
      if(this.consumer !== null) this.consumer.getChunk(data)
      return;
    }
    // Parse JSON
    const msg = JSON.parse(data);
    console.log(msg);
    switch(msg.type) {
      case 'file-meta':
        this.consumer = new FileConsumer(
          msg.data,
          (blob) => {
            this.handleBlob(blob)
            this.consumer = null; // destructor after finished file consuming
          },
        );
        break;
      default:
        break;
    }
  }

  sendFile(file) {
    // Send file metadata
    const meta = {
      type: 'file-meta',
      data: {
        filename: file.name,
        filetype: file.type,
        size: file.size,
      },
    }
    this.p.send(JSON.stringify(meta));
    this.producer = new FileProducer(
      file,
      (data) => { this.p.send(data) },
      () => { this.producer = null }
    );
  }

  handleBlob(blob) {
    console.log("file received");
    console.log(blob);
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.src = URL.createObjectURL(blob);
    video.play();
    document.body.appendChild(video);
  }
}

/** file transfer **/
class FileProducer {
  constructor(file, sendCallback, stopCallback) {
    this.file = file;
    this.chunkSize = 64 * KB;
    this.offset = 0;
    this.send = sendCallback;
    this.stop = stopCallback;
    this.reader = new FileReader();
    this.reader.addEventListener('load', (e) => {
      this.onChunkLoad(e.target.result)
    });
    this.getNextChunk();
  }

  getNextChunk() {
    const chunk = this.file.slice(this.offset, this.offset + this.chunkSize);
    this.reader.readAsArrayBuffer(chunk)
  }

  onChunkLoad(chunk) {
    console.log("new chunk at");
    this.offset += chunk.byteLength;
    // TODO: Send chunk
    this.send(chunk);
    if(this.offset >= this.file.size) {
      console.log("finish upload");
      this.stop();
      return
    }
    // callback readChunk()
    this.getNextChunk()
  }
}

class FileConsumer {
  constructor(metadata, stopCallback) {
    this.filename = metadata.filename;
    this.size = metadata.size;
    this.type = metadata.filetype;
    this.buffer = [];
    this.numBytes = 0;
    this.handleBlob = stopCallback;
    console.log(this)
  }

  getChunk(chunk) {
    console.log("recv chunk at");
    this.buffer.push(chunk)
    this.numBytes += chunk.byteLength;
    if(this.numBytes < this.size) return; // get more data
    console.log("finish consume");
    this.saveFile();
  }

  saveFile() {
    let blob = new Blob(
      this.buffer, 
      {type: this.type}
    );
    this.handleBlob(blob);
  }
}










