import * as WS  from 'ws'

const server = new WS.Server({port:8080});

let sockets: WS.WebSocket[] = []
server.on('connection', function(socket) {
  sockets.push(socket);
  console.log('receive connection')
  // When you receive a message, send that message to every socket.
  socket.on('message', function(msg) {
    console.log(msg)
    console.log(JSON.parse(msg.toString()))
    sockets.forEach(s => s.send(msg));
  });

  // When a socket closes, or disconnects, remove it from the array.
  socket.on('close', function() {
    console.log('close')
    sockets = sockets.filter(s => s !== socket);
  });
});