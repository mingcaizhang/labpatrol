import * as WebSocket from "ws"
const ws = new WebSocket('ws://localhost:8080');


ws.on('open', function open() {
    ws.send(JSON.stringify({res: "first websocket", resCode: 1}))
})

ws.on('message', function mesage(data) {
    console.log(data)
     ws.close()
} )