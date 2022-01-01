import * as WS  from 'ws'
import logger from './logger';
import {AXOSDiag} from "./AXOSDiag"
import {DiagWSHeader, DiagWSMsgType, DiagWSMsgAllOntReq, DiagWSMsgAllOntRes, DiagWSMsgOntDiagReq, DiagWSMsgOntDiagRes} from "./DiagPub"

logger.setLogLevel('std', 'error')
logger.setLogLevel('file', 'info')
logger.closeStdout();
class ClusterDiag {
    wsServerPort: number = 8082
    sockets: WS.WebSocket[] = []
    init() {
        const server = new WS.Server({port:this.wsServerPort});
        let that = this
        server.on('connection', function(socket) {
          console.log('receive connection')
          // When you receive a message, send that message to every socket.
          socket.on('message', async function(msg) {
            // that.sockets.forEach(s => s.send(msg));
            logger.info(msg.toString())
            let header = JSON.parse(msg.toString())
            
            switch(header.header.cmdId) {
                case DiagWSMsgType.DiagWSMsgTypeAllOntREQ:
                    {
                        console.log('hanlde DiagWSMsgTypeAllOntREQ')
                        let axosDiag = new AXOSDiag()
                        let allOntReq:DiagWSMsgAllOntReq= header as unknown as DiagWSMsgAllOntReq
                        let connRet = await axosDiag.login(allOntReq.ipAddr)
                        if (connRet === -1) {
                            let msgRes:DiagWSMsgAllOntRes = {
                                header:{cmdId:DiagWSMsgType.DiagWSMsgTypeAllOntRES, resCode:-1},
                                ipAddr:allOntReq.ipAddr,
                                ontList:[]
                            }
                            
                            socket.send(JSON.stringify(msgRes))
                            await axosDiag.disconnect()
                            return
                        }

                        let ontRes = await axosDiag.BuildAllOnts()
                        let msgRes:DiagWSMsgAllOntRes = {
                            header:{cmdId:DiagWSMsgType.DiagWSMsgTypeAllOntRES, resCode:0},
                            ipAddr:allOntReq.ipAddr,
                            ontList:[...ontRes]
                        }
                        console.log(ontRes)
                        socket.send(JSON.stringify(msgRes))     
                        await axosDiag.disconnect()                  
                    }
                    break
                case DiagWSMsgType.DiagWSMsgTypeOntDiagREQ:
                    {
                    let axosDiag = new AXOSDiag()
                    let ontReq:DiagWSMsgOntDiagReq = header as unknown as DiagWSMsgOntDiagReq
                    let connRet = await axosDiag.login(ontReq.ipAddr)
                    if (connRet === -1) {
                        let msgRes:DiagWSMsgOntDiagRes = {
                            header:{cmdId:DiagWSMsgType.DiagWSMsgTypeOntDiagRES, resCode:-1},
                            ipAddr:ontReq.ipAddr,
                            ontId: ontReq.ontId,
                            OntCompose:null
                        }
                        socket.send(JSON.stringify(msgRes))
                        await axosDiag.disconnect()
                        return
                    }
            
                    let res = await axosDiag.buildOntDiagCompose(ontReq.ontId)
                    let msgRes:DiagWSMsgOntDiagRes = {
                        header:{cmdId:DiagWSMsgType.DiagWSMsgTypeOntDiagRES, resCode:0},
                        ipAddr:ontReq.ipAddr,
                        ontId: ontReq.ontId,
                        OntCompose:res
                    }
                    // console.log(JSON.stringify(msgRes))
                    socket.send(JSON.stringify(msgRes))
                    await axosDiag.disconnect()
                    }
                    break
                default:
                    console.log(`error cmd ${header.cmdId}`)
                    
                    break
            }
          });

        
          // When a socket closes, or disconnects, remove it from the array.
          socket.on('close', function() {
            console.log("close   ")
          });
        });
    }



}


if (__filename === require.main?.filename) {
    (async()=>{
        let diag = new ClusterDiag()
        diag.init()
    })()


}