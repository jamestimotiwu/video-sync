package main

import (
        "math/rand"
        "time"
        "fmt"
)

const (
        NUM_CHARS = 32
)
(
func uuid() {
        var uuid = ""
        for ii := 0; ii < NUM_CHARS; ii++ {
                switch ii {
                case 8:
                case 20:
                        // timelow 
                        uuid += '-'
                        uuid += fmt.Sprintf("%x", rand.Intn(16))
                        break;
                case 12:
                        uuid += '-'
                        uuid += '4'
                        break;
                case 16:
                        uuid += '-'
                        uuid += fmt.Sprintf("%x", rand.Intn(4)+8)
                        break
                default:
                        uuid += fmt.Sprintf("%x", rand.Intn(16))
                }
        }
        return uuid
}
