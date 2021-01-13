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
  if(ws !== null) {
    console.log("Already connected to signaling server!")
    return;
  }
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
        // Set location hash
        location.hash = msg.data.session_id;
        sessionBox.value = msg.data.session_id;
        addPeerToDisplay(myId);
        break;

      case "joinResp":
        console.log("join as", msg.data.id)
        if(myId == -1) {
          myId = msg.data.id;
          addPeerToDisplay(myId);
        }
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

// Peer display functions
function addPeerToDisplay(peerId) {
  console.log("try add peer to display")
  var peerBox = document.getElementById('peer-box');
  if(peerBox === null) {
    // create peer box
    peerBox = document.createElement('div')
    peerBox.id = 'peer-box';
    peerBox.style.maxWidth = '300px';
    peerBox.style.border = '1px solid #000';
    document.body.appendChild(peerBox);
  }
  const liItem = document.createElement('li');
  liItem.id = 'peer-'+peerId;
  liItem.appendChild(document.createTextNode('Peer '+peerId));
  peerBox.appendChild(liItem);
}

function removePeerFromDisplay(peerId) {
  const peerBox = document.getElementById('peer-box');
  if(peerBox === null) {
    return;
  }
  peerBox.removeChild(document.getElementById('peer-'+peerId));
}

// Rtc signaling functions
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
        // Set location hash
        location.hash = sessionBox.value;
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
      addPeerToDisplay(this.id);
      console.log(this.id + " connected!");
    });
    this.p.on('data', (data) => {
      this.handleData(data)
    });

    this.p.on('close', () => {
      console.log("peer " + this.id + "closed connection");
      removePeerFromDisplay(this.id);
      delete peers[id]
    });

    this.p.on('error', (err) => {
      console.log(err);
    });
    this.consumer = null;
    this.producer = null;

    // Media controls
    this.video = null;
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
    //console.log(msg);
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
      case 'video':
        this.handleVideoAction(msg.data);
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
      (data) => { this.p.write(data) },
      () => {
        // Create local video
        this.video = new VideoSync(
          URL.createObjectURL(file),
          (data) => { this.p.send(data) }
        );
        this.producer = null 
      }
    );
  }

  handleBlob(blob) {
    console.log("file received");
    //console.log(blob);
    this.video = new VideoSync(
      URL.createObjectURL(blob),
      (data) => { this.p.send(data) }
    );
  }

  handleVideoAction(msg) {
    switch(msg.action) {
      case 'seeked':
        this.video.remoteSeek(msg.time);
        break;
      case 'play':
        this.video.remotePlay();
        break;
      case 'pause':
        this.video.remotePause();
        break;
      case 'default':
        break;
    }
  }
}

/** file transfer **/
class FileProducer {
  constructor(file, sendCallback, stopCallback) {
    this.file = file;
    this.chunkSize = 16 * KB;
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
    //console.log(this)
  }

  getChunk(chunk) {
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

class VideoSync {
  constructor(url, sendCallback) {
    this.send = sendCallback;
    this.video = document.createElement('video');
    //this.video.muted = true;
    //this.video.autoplay = true;
    this.video.controls = true;
    this.video.src = url;
    // Pass reference or else func will be invoked immediately
    this.video.addEventListener('seeked', () => { this.handleSeek(this.video.currentTime) });
    this.video.addEventListener('play', () => { this.handlePlay(true) });
    this.video.addEventListener('pause', () => { this.handlePlay(false) });
    //this.video.play();
    this.isRemote = false;
    document.body.appendChild(this.video);
  }

  remoteSeek(time) {
    this.isRemote = true;
    this.video.currentTime = time;
  }

  remotePlay() {
    this.isRemote = true;
    this.video.play();
  }

  remotePause() {
    this.isRemote = true;
    this.video.pause();
  }

  handleSeek(time) {
    // Check if seeking was handled remotely so it doesn't fire twice
    if(this.isRemote) {
      this.isRemote = false;
      return;
    }
    const msg = {
      type: "video",
      data: {
        action: "seeked",
        time: time,
      },
    }
    console.log("sending seek", Date.now());
    this.send(JSON.stringify(msg));
  }

  handlePlay(play) {
    if(this.isRemote) {
      this.isRemote = false;
      return;
    }
    const msg = {
      type: "video",
      data: {
        action: play ? "play" : "pause",
      },
    }
    console.log("sending play/pause", Date.now())
    this.send(JSON.stringify(msg));
  }

}










