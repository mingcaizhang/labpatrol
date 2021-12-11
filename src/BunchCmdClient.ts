import * as WebSocket from "ws"
import {WSBunchCmdsRequest, WSBunchCmdsMessgeID, BunchCommands, WSBunchCmdsResponse, CommandType, LabPatroType} from "./LabPatrolPub"
const ws = new WebSocket('ws://localhost:8081');


ws.on('open', function open() {
    let wsRequest: WSBunchCmdsRequest = {
        msgId: WSBunchCmdsMessgeID.WSBunchMessgeID_Cmds_Request,
        cmds: {
            ipList:  /* ["10.245.16.233"], */ ['10.245.34.133'],
            cmdList: ["dcli ponmgrd sx dump"],
            cardType: LabPatroType.LabPatrolType_AXOSCard,
            cmdType: CommandType.CommandType_SHELL
        }
    }
    ws.send(JSON.stringify(wsRequest))

})

ws.on('close', ()=>{
    console.log('close')
})
ws.on('message', function mesage(data) {
    let res:WSBunchCmdsResponse = JSON.parse(data.toString())
    if (!res) {
        return
    }

    switch(res.msgId) {
        case WSBunchCmdsMessgeID.WSBunchMessgeID_Cmds_Response:
             console.log(res.res)
            break
        case WSBunchCmdsMessgeID.WSBunchMessgeID_Cmds_Res_Finish:
            console.log('done')
            break
        case WSBunchCmdsMessgeID.WSBunchMessgeID_Cmds_Res_Pend:
            console.log(res.res)
            break
        default:

            break
    }
} )


// setTimeout(() => {
//     ws.close()
// }, 12000);