package main

import (
        "log"
        "net/http"
        "github.com/gorilla/websocket"
        "github.com/speps/go-hashids"
        "strconv"
)

var (
        upgrader = websocket.Upgrader{}
        clientIdCount = 0
        sessionIdCount = 0
        peers = make(map[int]*Peer)
        sessions = make(map[string]*SharedSession)
)

const (
        port = 9000
)

type SharedSession struct {
        Id string
        Peers []int
        Cap int
}

type Peer struct {
        Id int
        Name string
        SessionId string
        inSession bool
        conn *websocket.Conn
}

type TextMessage struct {
        Src int `json:"src"`
        Dest int `json:"dest"`
        Message string `json:"message"`
}

type JoinResponse struct {
        Id int `json:"id"`
        SessionId string `json:"session_id"`
        Peers []int `json:"peers"`
}

type Message struct {
        Type string `json:"type"`
        Data interface{} `json:"data"`
}

func getNextSessionId() string {
        // TODO: lock protect
        sessionIdCount += 1
        hd := hashids.NewData()
        hd.Salt = "sharedSession"
        hd.MinLength = 8
        h, _ := hashids.NewWithData(hd)
        e, _ := h.Encode([]int{sessionIdCount})
        return e
}

func NewSession(peerId int, capacity int) *SharedSession {
        newPeers := []int{peerId}
        newId := getNextSessionId()
        sess := &SharedSession{
                Id: newId,
                Peers: newPeers,
                Cap: capacity,
        }
        return sess
}

func NewPeer(conn *websocket.Conn) *Peer {
        clientIdCount += 1
        peer := &Peer{
                Id: clientIdCount,
                Name: "",
                SessionId: "",
                inSession: false,
                conn: conn,
        }
        return peer
}

func handleCreateSession(peerId int, msg Message) {
        // TODO: Check if peer already in session
        // TODO: Initialize new session obj, add to session map
        sessionCap := 255
        sess := NewSession(peerId, sessionCap)
        sessions[sess.Id] = sess
        log.Println("create session")
        log.Println(sessions[sess.Id])

        // Reply to session creation
        newMsg := Message{
                Type: "createResp",
                Data: JoinResponse{
                        Id: peerId,
                        SessionId: sess.Id,
                        Peers: []int{},
                },
        }
        SendMessage(peerId, newMsg)
}

/* Join message:
Type: join
Src: peerId
Dest: 0
Message: sessionId
*/
func handleJoinSession(peerId int, msg Message) {
        // Add peer to the other peer
        //otherId := findOtherId(peerId)
        // Send peer list in session
        var peerList []int
        // ok
        log.Println(msg)
        txtMsg := msg.Data.(map[string]interface{})
        sessionId := txtMsg["message"].(string)
        if sess, ok := sessions[sessionId]; ok {
                peerList = sess.Peers
        } else {
                // Send message with failure
                err := Message{
                        Type: "error",
                        Data: TextMessage{
                                Src: -1,
                                Dest: -1,
                                Message: "error: sessionId dne",
                        },
                }
                SendMessage(peerId, err)
                return
        }
        //peersJson, _ := json.Marshal(peerList)
        newMsg := Message{
                Type: "joinResp",
                Data: JoinResponse{
                        Id: peerId,
                        SessionId: sessionId,
                        Peers: peerList,
                },
        }
        SendMessage(peerId, newMsg)
        // Add self to peer list
        if sess, ok := sessions[sessionId]; ok {
                log.Println("New join to session: " + sessionId)
                sessions[sessionId].Peers = append(sess.Peers, peerId)
        }
        log.Println(sessions[sessionId])
}

func handleNewConn(w http.ResponseWriter, r *http.Request) {
        // Upgrade request to websocket
        ws, err := upgrader.Upgrade(w, r, nil)
        if err != nil {
                log.Fatal(err)
        }
        // Close connection
        defer ws.Close()

        // Add ws client to client list
        //clients[ws] = true
        peer := NewPeer(ws)
        peers[peer.Id] = peer

        // Listen to messages
        for {
                var msg Message
                err := ws.ReadJSON(&msg)
                // If err client may have disconnected
                if err != nil {
                        log.Println(err);
                        //delete(clients, ws)
                        delete(peers, peer.Id)
                        break
                }

                switch msg.Type {
                case "create":
                        handleCreateSession(peer.Id, msg)
                case "join":
                        handleJoinSession(peer.Id, msg)
                case "rtc":
                        // ok
                        txtMsg := msg.Data.(map[string]interface{})
                        SendMessage(int(txtMsg["dest"].(float64)), msg)
                }

                //SendMessage(msg.Dest, msg)
                // Send message to handler/listener
                //broadcast <- msg
        }
}

// Find other id not current peer
func findOtherId(id int) int {
        for k := range peers {
                if k != id {
                        return k
                }
        }
        return -1
}

func SendMessage(destId int, msg Message) {
        log.Printf("sent message to %d", destId)
        err := peers[destId].conn.WriteJSON(msg)
        if err != nil {
                log.Printf("send fail!")
        }
}

func main() {
        // File server to serve html
        fs := http.FileServer(http.Dir("./static"))
        http.Handle("/", fs)
        log.Println("Started file server")

        // Create websocket route to callback
        http.HandleFunc("/ws", handleNewConn)

        // go Listener()

        // Start http server
        log.Println("Started http listener on :" + strconv.Itoa(port))
        err := http.ListenAndServe(":" + strconv.Itoa(port), nil)
        if err != nil {
                log.Fatal(err)
        }
}


