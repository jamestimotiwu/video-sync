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
)

const (
        port = 9000
)


type Message struct {
        UserId string `json:"user_id"`
        Message string `json:"message"`
}

func handleConn(w http.ResponseWriter, r *http.Request) {
        // Upgrade request to websocket
        ws, err := upgrader.Upgrade(w, r, nil)
        if err != nil {
                log.Fatal(err)
        }
        // Close connection
        defer ws.Close()

        // Add ws client to client list
        clients[ws] = true

        // Listen to messages
        for {
                var msg Message
                err := ws.ReadJSON(&msg)
                // If err client may have disconnected
                if err != nil {
                        log.Printf("err!");
                        delete(clients, ws)
                        break
                }

                // Send message to handler/listener
                broadcast <- msg
        }
}

func Listener() {
        for {
                msg := <-broadcast
                // Send message to all clients/broadcast
                SendBroadcast(msg)
        }
}

func SendBroadcast(msg Message) {
        for client := range clients {
                err := client.WriteJSON(msg)
                if err != nil {
                        log.Printf("err!");
                        break
                }
        }
}

func main() {
        // File server to serve html
        fs := http.FileServer(http.Dir("."))
        http.Handle("/", fs)
        log.Println("Started file server")

        // Create websocket route to callback
        http.HandleFunc("/ws", handleConn)

        // Listener
        go Listener()

        // Start http server
        log.Println("Started http listener on :" + strconv.Itoa(port))
        err := http.ListenAndServe(":" + strconv.Itoa(port), nil)
        if err != nil {
                log.Fatal(err)
        }
}


