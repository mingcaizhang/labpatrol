import * as WS  from 'ws'
import logger from './logger';
import {AXOSDiag} from "./AXOSDiag"
import {DiagWSHeader, DiagWSMsgType, DiagWSMsgAllOntReq, DiagWSMsgAllOntRes, 
        DiagWSMsgOntDiagReq, DiagWSMsgOntDiagRes,DiagOntAllFlowStats,
        DiagWSMsgOntFlowStatsReq, DiagWSMsgOntFlowStatsRes} from "./DiagPub"

logger.setLogLevel('std', 'error')
logger.setLogLevel('file', 'info')
logger.closeStdout();

interface DiagSocketInfo {
    socket: WS.WebSocket
    axosDiag:AXOSDiag
}
class ClusterDiag {
    wsServerPort: number = 8082
    sockets: DiagSocketInfo[] = []
    init() {
        const server = new WS.Server({port:this.wsServerPort});
        let that = this
        server.on('connection', function(socket) {
          console.log('receive connection')
          let socketInfo = <DiagSocketInfo>{socket:socket}
          that.sockets.push(socketInfo)
          // When you receive a message, send that message to every socket.
          socket.on('message', async function(msg) {
            // that.sockets.forEach(s => s.send(msg));
            logger.info(msg.toString())
            let header = JSON.parse(msg.toString())
            
            switch(header.header.cmdId) {
                case DiagWSMsgType.DiagWSMsgTypeAllOntREQ:
                    {
                        console.log('hanlde DiagWSMsgTypeAllOntREQ')
                        let axosDiag:AXOSDiag
                        if (!socketInfo.axosDiag) {
                            axosDiag = new AXOSDiag()
                            socketInfo.axosDiag = axosDiag
                        }else {
                            axosDiag = socketInfo.axosDiag
                        }
                        
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

                        let ontRes = await axosDiag.semExecBuildAllOntsWithLinkinfo()
                        let msgRes:DiagWSMsgAllOntRes = {
                            header:{cmdId:DiagWSMsgType.DiagWSMsgTypeAllOntRES, resCode:0},
                            ipAddr:allOntReq.ipAddr,
                            ontList:[...ontRes]
                        }
                        console.log(ontRes)
                        socket.send(JSON.stringify(msgRes))           
                    }
                    break
                case DiagWSMsgType.DiagWSMsgTypeOntDiagREQ:
                    {
                    let axosDiag:AXOSDiag
                    if (!socketInfo.axosDiag) {
                        axosDiag = new AXOSDiag()
                        socketInfo.axosDiag = axosDiag
                    }else {
                        axosDiag = socketInfo.axosDiag
                    }
                    let ontReq:DiagWSMsgOntDiagReq = header as unknown as DiagWSMsgOntDiagReq
                    console.log('hanlde DiagWSMsgTypeOntDiagREQ ontID:' + ontReq.ontId)
                    let connRet = await axosDiag.login(ontReq.ipAddr)
                    if (connRet === -1) {
                        let msgRes:DiagWSMsgOntDiagRes = {
                            header:{cmdId:DiagWSMsgType.DiagWSMsgTypeOntDiagRES, resCode:-1},
                            ipAddr:ontReq.ipAddr,
                            ontId: ontReq.ontId,
                            OntCompose:null
                        }
                        socket.send(JSON.stringify(msgRes))
                        return
                    }
            
                    let res = await axosDiag.SemExecBuildOntDiagCompose(ontReq.ontId)
                    let msgRes:DiagWSMsgOntDiagRes = {
                        header:{cmdId:DiagWSMsgType.DiagWSMsgTypeOntDiagRES, resCode:0},
                        ipAddr:ontReq.ipAddr,
                        ontId: ontReq.ontId,
                        OntCompose:res
                    }
                    // console.log(JSON.stringify(msgRes))
                    socket.send(JSON.stringify(msgRes))

                    }
                    break

                case DiagWSMsgType.DiagWSMsgTypeOntFlowStatREQ:
                    {
                        
                        let ontReq:DiagWSMsgOntFlowStatsReq = header as unknown as DiagWSMsgOntFlowStatsReq
                        let msgRes:DiagWSMsgOntFlowStatsRes = {
                            header:{cmdId:DiagWSMsgType.DiagWSMsgTypeOntFlowStatRES, resCode:-1},
                            ontId: ontReq.ontId,
                            flowStats:null
                        }
                        console.log('hanlde DiagWSMsgTypeOntFlowStatREQ ontID:' + ontReq.ontId)
                        if (!socketInfo.axosDiag) {
                            logger.error(`DiagWSMsgTypeOntFlowStatREQ no connection before`)
                            socket.send(JSON.stringify(msgRes))
                            return
                        }

                        let axosDiag = socketInfo.axosDiag
                        let res = await axosDiag.getOntAllFlowStats(ontReq.ontId)
                        if (res === -1) {
                            socket.send(JSON.stringify(msgRes))
                            return
                        }

                        msgRes.header.resCode = 0
                        msgRes.flowStats = res as DiagOntAllFlowStats
                        // console.log(JSON.stringify(msgRes))
                        socket.send(JSON.stringify(msgRes))

                        }                    
                    break
                
                default:
                    console.log(`error cmd ${header.cmdId}`)
                    
                    break
            }
          });

        
          // When a socket closes, or disconnects, remove it from the array.
          socket.on('close', async function() {
            for (let socketEntry of that.sockets) {
                if (socketEntry.socket === socket) {
                    if (socketEntry.axosDiag) {
                        await socketEntry.axosDiag.disconnect()
                    }
                }
            }

            that.sockets = that.sockets.filter(s => s.socket !== socket);
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