package main

import (
        "log"
        "net/http"
        "github.com/gorilla/websocket"
        "strconv"
)

var (
        clients = make(map[*websocket.Conn]bool)
        broadcast = make(chan Message)
        upgrader = websocket.Upgrader{}
        clientIdCount = 0
        peers = make(map[int]*Peer)
)

const (
        port = 9000
)


type Peer struct {
        Id int
        Name string
        SessionId string
        inSession bool
        conn *websocket.Conn
}

type Message struct {
        Type string `json:"type"`
        Src int `json:"src"`
        Dest int `json:"dest"`
        Message string `json:"message"`
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

func handleNewConn(w http.ResponseWriter, r *http.Request) {
        // Upgrade request to websocket
        ws, err := upgrader.Upgrade(w, r, nil)
        if err != nil {
                log.Fatal(err)
        }
        // Close connection
        defer ws.Close()

        // Add ws client to client list
        peer := NewPeer(ws)
        //clients[ws] = true
        peers[peer.Id] = peer

        // Listen to messages
        for {
                var msg Message
                err := ws.ReadJSON(&msg)
                // If err client may have disconnected
                if err != nil {
                        log.Println(err);
                        delete(clients, ws)
                        break
                }

                switch msg.Type {
                case "create":
                        newMsg := Message{
                                Type: "createResp",
                                Src: peer.Id,
                                Dest: 0,
                                Message: "",
                        }
                        SendMessage(peer.Id, newMsg)
                case "join":
                        // Add peer to the other peer
                        otherId := findOtherId(peer.Id)
                        newMsg := Message{
                                Type: "joinResp",
                                Src: peer.Id,
                                Dest: otherId,
                                Message: "",
                        }
                        SendMessage(peer.Id, newMsg)
                case "rtc":
                        SendMessage(msg.Dest, msg)
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

func Listener() {
        for {
                msg := <-broadcast
                // Send message to all clients/broadcast
                log.Println(msg)
                //SendBroadcast(msg)
        }
}

/*
func SendBroadcast(msg Message) {
        for client := range clients {
                err := client.WriteJSON(msg)
                if err != nil {
                        log.Printf("err!")
                        break
                }
        }
}*/

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

        // Listener
        go Listener()

        // Start http server
        log.Println("Started http listener on :" + strconv.Itoa(port))
        err := http.ListenAndServe(":" + strconv.Itoa(port), nil)
        if err != nil {
                log.Fatal(err)
        }
}


