import * as cluster from 'cluster';
import {Worker} from 'cluster';
import * as events from 'events'
import logger from './logger';
import { BunchCommands, WSBunchCmdsResponse, WSBunchCmdsRequest, WSBunchCmdsMessgeID } from './LabPatrolPub'
// mport Vorpal = require('vorpal');
import * as Vorpal from "vorpal"
import { AXOSCard } from './AXOSCard';
// var Vorpal = require("vantage")();A
// import {DataStore, TableSchema} from './DataStore'
import * as WS  from 'ws'
logger.setLogLevel('std', 'error')
logger.setLogLevel('file', 'info')
logger.closeStdout();

interface WorkInfo {
    worker: Worker,
    hasTask:boolean,
}

class MessageInfo {
    cmd: number;
    content: any;
    constructor() {
        this.cmd = 0
        this.content = undefined
    }
}

enum MessageID {
    MSG_AXOS_ONE_DEV_BUNCH_COMMANDS = 1,
    MSG_AXOS_ONE_DEV_BUNCH_COMMANDS_RES = 2,

}

enum BunchCommandHandleCode {
    BunchCommandHandleCodeInit = 0,
    BunchCommandHandleCodeInProcess = 1,
    BunchCommandHandleCodeDone = 2,
    BunchCommandHandleCodeError = 3,
}


type BunchCommandsResult = {
    res:string,
    resCode:number
}


interface BunchCommandsState {
    bunchCommands: BunchCommands
    handleIdx: number
    state: number
    DevResponse : Map<string, BunchCommandsResult>
    wsSocket?: WS.WebSocket
}

interface DevBunchCmdResponse {
    ipAddr : string
    devResponse: BunchCommandsResult
}


class ClusterExec {
    workerList: WorkInfo[] = [];
    emitter: events.EventEmitter | undefined = undefined    
    // bunchCmdsList: BunchCommandsState[] = []
    bunchCmdsMap = new Map<number, BunchCommandsState>()
    cookie:number = 0
    currentIdx: number = -1
    sockets: WS.WebSocket[] = []
    wsServerPort: number = 8081
    maxBufFinish = 10  // max store 10 finished task

    init() {
        const server = new WS.Server({port:this.wsServerPort});
        let that = this
        server.on('connection', function(socket) {
          that.sockets.push(socket);
          console.log('receive connection')
          // When you receive a message, send that message to every socket.
          socket.on('message', function(msg) {
            // that.sockets.forEach(s => s.send(msg));
            logger.info(msg)
            let res: WSBunchCmdsRequest = JSON.parse(msg.toString()) 
            switch(res.msgId) {
                case WSBunchCmdsMessgeID.WSBunchMessgeID_Cmds_Request:
                    if (res.cmds) {
                        let cookieIdx = that.addBunchExecCmds(res.cmds, socket)
                        if (cookieIdx != that.currentIdx) {
                            that.sendPendInfo(cookieIdx)
                        }
                    }
                    break;
                default:
                    console.log(`error message ${res.msgId}`)
                    break
            }

          });

        
          // When a socket closes, or disconnects, remove it from the array.
          socket.on('close', function() {
            console.log("close   ")
            that.sockets = that.sockets.filter(s => s !== socket);
            for(let entry of that.bunchCmdsMap.values()) {
                if (entry.wsSocket === socket) {
                    entry.wsSocket = undefined
                }
            }
          });
        });
    }

    sendPendInfo(sendIdx: number = -1) {
        let waitCnt = 1 // start from 1 as one is in process
        for (let [key, entry] of this.bunchCmdsMap.entries()) {
            if (key === this.currentIdx) {
                continue
            }

            if (entry.state === BunchCommandHandleCode.BunchCommandHandleCodeInit &&
                entry.wsSocket) {
                if ((sendIdx != -1 && sendIdx === key) || sendIdx === -1) {
                    let wsRes: WSBunchCmdsResponse = {
                        msgId: WSBunchCmdsMessgeID.WSBunchMessgeID_Cmds_Res_Pend,
                        res: {
                            ipAddr: '',
                            response: `waiting ${waitCnt} ... `,
                        }
                    }
                    entry.wsSocket.send(JSON.stringify(wsRes))
                }
                waitCnt++
            }
        }
    }

    /*
    One bunch commands done condition:
    1  all thw worker is idle
    2  all the devices have response 
    */
    scheduler() {
        if (this.currentIdx === -1) {
            for (let ii = 0; ii < this.workerList.length; ii++) {
                if (this.workerList[ii].hasTask) {
                    logger.error(`worker ${ii + 1} still has task`)
                    return
                }
            }

            if (this.bunchCmdsMap.size === 0) {
                logger.error('no bunchcmds work left')
                return
            }

            
            let handleBunchCmds
            for (let [key,entry] of this.bunchCmdsMap.entries()) {
                if (entry.state === BunchCommandHandleCode.BunchCommandHandleCodeInit) {
                    handleBunchCmds = entry
                    handleBunchCmds.state = BunchCommandHandleCode.BunchCommandHandleCodeInProcess
                    this.currentIdx = key
                    break
                }
            }
            if (handleBunchCmds === undefined) {
                logger.error('no bunchcmds work left')
                return
            }

            this.sendPendInfo(-1)
            // find commands not handled, and send to idle worker
            let idleWorkIdx = 0
            for (let [key,value] of handleBunchCmds.DevResponse) {
                if (value.resCode == BunchCommandHandleCode.BunchCommandHandleCodeInit) {
                    let devCmd: BunchCommands = {
                        cmdList: handleBunchCmds.bunchCommands.cmdList,
                        ipList:[key]
                    }
                    this.workerList[idleWorkIdx].worker.send({
                        cmd:  MessageID.MSG_AXOS_ONE_DEV_BUNCH_COMMANDS,
                        content: devCmd
                    })

                    value.resCode = BunchCommandHandleCode.BunchCommandHandleCodeInProcess

                    idleWorkIdx++;
                    if (idleWorkIdx >= this.workerList.length) {
                        return
                    }

                }
            }
            return
        }

        // this.currentIdx not -1, there is one in handle
        // find a device need handle
        let handleBunchCmds = this.bunchCmdsMap.get(this.currentIdx)
        if (handleBunchCmds === undefined) {
            logger.error(`currentIdx ${this.currentIdx} no bunchCmds` )
            return
        }
        let idleWorkIdxList: number[] = []
        let idx = 0
        for (let ii = 0; ii < this.workerList.length; ii++) {
            if (!this.workerList[ii].hasTask) {
                idleWorkIdxList.push(ii)
            }
        }

        if (idleWorkIdxList.length === 0) {
            return
        }

        for (let [key,value] of handleBunchCmds.DevResponse) {
            if (value.resCode == BunchCommandHandleCode.BunchCommandHandleCodeInit) {
                let devCmd: BunchCommands = {
                    cmdList: handleBunchCmds.bunchCommands.cmdList,
                    ipList:[key]
                }

                value.resCode = BunchCommandHandleCode.BunchCommandHandleCodeInProcess

                this.workerList[idleWorkIdxList[idx]].worker.send({
                    cmd:  MessageID.MSG_AXOS_ONE_DEV_BUNCH_COMMANDS,
                    content: devCmd
                })
                idx++
                if (idx >= idleWorkIdxList.length) {
                    return
                }
            }
        }


        // in here, check whether all are done
        for (let [key,value] of handleBunchCmds.DevResponse) {
            if (value.resCode != BunchCommandHandleCode.BunchCommandHandleCodeDone &&
                value.resCode != BunchCommandHandleCode.BunchCommandHandleCodeError) {
                return
            }
        }      

        handleBunchCmds.state = BunchCommandHandleCode.BunchCommandHandleCodeDone
        if (handleBunchCmds.wsSocket) {
            let wsRes:WSBunchCmdsResponse = {
                msgId: WSBunchCmdsMessgeID.WSBunchMessgeID_Cmds_Res_Finish,
                res: {ipAddr: '', response:'done'}
            }
            handleBunchCmds.wsSocket.send(JSON.stringify(wsRes))
            /* max buffer this.maxBufFinish finish task*/ 
            let deletKey = -1 
            let finCnt = 0
            for (let [key, entry] of this.bunchCmdsMap.entries()) {
                if (entry.state === BunchCommandHandleCode.BunchCommandHandleCodeDone) {
                    if (deletKey === -1) {
                        deletKey = key
                    }
                    finCnt++
                    if (finCnt > this.maxBufFinish) {
                        break
                    }
                }
            }

            if (finCnt > this.maxBufFinish) {
                this.bunchCmdsMap.delete(deletKey)
            }
        }

        this.currentIdx = -1
        this.scheduler()

    }

    addBunchExecCmds(cmds: BunchCommands, wsSocket?: WS.WebSocket):number{
        this.cookie ++
        let bunchCmd:BunchCommandsState = {
            bunchCommands: cmds,
            handleIdx: this.cookie,
            state: BunchCommandHandleCode.BunchCommandHandleCodeInit,
            DevResponse: new Map(),
            wsSocket: wsSocket
        }     
        
        for (let ii = 0; ii < cmds.ipList.length; ii++) {
            bunchCmd.DevResponse.set(cmds.ipList[ii], {
                res: '',
                resCode: BunchCommandHandleCode.BunchCommandHandleCodeInit
            })
        }

        this.bunchCmdsMap.set(this.cookie, bunchCmd)
        this.scheduler()

        return this.cookie
    }

    async setupWokerProcess() {
       let numCores = require('os').cpus().length;
        let that = this;
        // numCores = 4
        for (let ii = 0; ii < numCores; ii++) {
            // @ts-ignore: Unreachable code error
            let worker = cluster.fork();
            let workerInfo: WorkInfo = {
                worker: worker,
                hasTask: false,
            }
            
            this.workerList.push(workerInfo)
        }  

        // @ts-ignore: Unreachable code error
        cluster.on('online', async (worker: Worker) => {
            logger.info('worker ' + 'id ' + worker.id + ' pid: ' + worker.process.pid + ' online')
            if (worker.id > numCores) {
                logger.error(`workid ${worker.id} exceed the max cores ${numCores}`)
                return
            }
            let index = worker.id - 1
        })
        // @ts-ignore: Unreachable code error
        cluster.on('message', async function (worker: Worker, message: MessageInfo) {
            let index = worker.id - 1;
            if (message.cmd == undefined) {
                return;
            }
            logger.info(`Master: receive worker ${worker.id} message ${JSON.stringify(message)}`)
            switch (message.cmd) {
                case MessageID.MSG_AXOS_ONE_DEV_BUNCH_COMMANDS_RES:
                {
                    that.workerList[index].hasTask = false
                    let resBunch:DevBunchCmdResponse = message.content as DevBunchCmdResponse
                    let resDevResIP = resBunch.ipAddr
                    let resDevRes = resBunch.devResponse
                    
                    let currentBunchCmds = that.bunchCmdsMap.get(that.currentIdx)
                    if (!currentBunchCmds) {
                        logger.error('currentBunchCmds undefined')
                        that.scheduler()
                        return
                    }

                    if (!resDevRes) {
                        logger.error('resDevRes undefined')
                        that.scheduler()
                        return
                    }
                    if (currentBunchCmds && resDevRes) {
                        currentBunchCmds.DevResponse.set(resDevResIP, resDevRes)     
                        if (currentBunchCmds.wsSocket) {
                            let wsRes:WSBunchCmdsResponse = {
                                msgId: WSBunchCmdsMessgeID.WSBunchMessgeID_Cmds_Response,
                                res: {
                                    ipAddr: resDevResIP,
                                    response: resDevRes.res
                                }
                            }
                            currentBunchCmds.wsSocket.send(JSON.stringify(wsRes))

                        }
                        
                        that.scheduler()
                        return            
                    }
                    
                }
                break;
            }

        })


    }

    setupWokerExecute(workId: Worker) {
        let index = workId.id - 1;

        let that = this;
        logger.info(`work ${index} executing`)
        let emitter = new events.EventEmitter();
        that.emitter = emitter

        process.on('message', async (message: MessageInfo) => {
            if (message.cmd === MessageID.MSG_AXOS_ONE_DEV_BUNCH_COMMANDS) {
                let devCmd: BunchCommands = message.content as BunchCommands
                let res = await AXOSCard.executeCommands(devCmd.ipList[0], devCmd.cmdList)
                let response: DevBunchCmdResponse

                if (res === -1) {
                    response = {
                        ipAddr: devCmd.ipList[0],
                        devResponse: {res:"NULL",
                                    resCode: BunchCommandHandleCode.BunchCommandHandleCodeError}
                    }
                }else {


                    response = {
                        ipAddr:  devCmd.ipList[0],
                        devResponse: {res: (res as string []).join(''),
                        resCode: BunchCommandHandleCode.BunchCommandHandleCodeDone }
                    }
                }
                (<any>process).send({
                    cmd: MessageID.MSG_AXOS_ONE_DEV_BUNCH_COMMANDS_RES,
                    content: response
                })

            }
        })
    }

    showWorkInfo(vorpal: Vorpal, mode:string, type:string) {
        vorpal.log(`current handle index ${this.currentIdx}`)
        let currBunch = this.bunchCmdsMap.get(this.currentIdx)
        if (type === 'all' || type == 'inprocess') {
            if (currBunch != undefined) {
                vorpal.log('================== Currenty work=================')
                vorpal.log(`handle index: ${currBunch.handleIdx}`)
                vorpal.log(`state: ${currBunch.state}`)
                vorpal.log(`bunchCommands: ${JSON.stringify(currBunch.bunchCommands)}`)
                if (mode === 'detail') {
                    vorpal.log('device response:')
                    for (let [dev, Result] of currBunch.DevResponse.entries()) {
                        vorpal.log(`<<<<<<<< IP: ${dev}>>>>>>>>>`)
                        vorpal.log(Result.res)
                    }
                }
            }else {
                vorpal.log('no work handling')
            }
        }

        if (type=== 'inprocess') {
            return
        }
        
        for (let [key,entry] of this.bunchCmdsMap.entries()) {
            if (key == this.currentIdx) {
                continue
            }
            vorpal.log(`================== work ${key}=================`)
            vorpal.log(`handle index: ${entry.handleIdx}`)
            vorpal.log(`state: ${entry.state}`)
            vorpal.log(`bunchCommands: ${JSON.stringify(entry.bunchCommands)}`)
            if (mode === 'detail') {
                vorpal.log('device response:')
                for (let [dev, Result] of entry.DevResponse.entries()) {
                    vorpal.log(`<<<<<<<< IP: ${dev}>>>>>>>>>`)
                    vorpal.log(Result.res)
                }
            }
        }

    }
}


function setupVorpal(vorpal: Vorpal, clusterMaster: ClusterExec) {

    vorpal.command('showworkinfo', 'showworkinfo')
        .option('-type, --type <type>', 'type.', ['all', 'inprocess', 'pend'])
        .option('-mode, --mode <mode>', 'mode.', ['brief', 'detail'])
        .action(async (args) => {
            let mode = (args.options.mode) ? args.options.mode : 'brief';
            let type = (args.options.type) ? args.options.type: 'all'
            
            clusterMaster.showWorkInfo(vorpal, mode, type)
        })  
         
        vorpal
        .delimiter('myapp$')
        .show();         
}


(async () => {
    let cluterExecInst = new ClusterExec()
    // @ts-ignore: Unreachable code error
    if (cluster.isMaster) {
        cluterExecInst.init()
        cluterExecInst.setupWokerProcess();
        const vorpal = require('vantage')()
        setupVorpal(vorpal, cluterExecInst)
        let bCmds:BunchCommands = {
            ipList:['10.245.34.155', '10.245.34.156'],
            cmdList:['show card', 'show version']
        }
        let bCmds1:BunchCommands = {
            ipList:['10.245.34.155', '10.245.34.156'],
            cmdList:['show discover', 'show ont']
        }
        // setTimeout(()=>{
            
        //     cluterExecInst.addBunchExecCmds(bCmds)

        // }, 10000)

        // setTimeout(()=>{
            
        //     cluterExecInst.addBunchExecCmds(bCmds1)

        // }, 10000)        
    } else {
        // @ts-ignore: Unreachable code error
        cluterExecInst.setupWokerExecute(cluster.worker);
    }

})()
