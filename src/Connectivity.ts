import * as SSH from 'ssh2'
import { ResultSplit } from "./ResultSplit"
import * as ping from "ping"
import logger from "./logger"
import { TelnetSocket } from "telnet-stream"
import * as net from "net"
import {IpPrefixInfo} from './LabPatrolPub'


export class AliveFind {
    ipPrefixList: IpPrefixInfo[]
    aliveList: string[]
    paralMax: number;
    constructor() {
        this.ipPrefixList = []
        this.aliveList = []
        this.paralMax = 10
    }

    detectAliveIpList(ipList: string[]): Promise<string[]> {
        let resultNum = 0
        let activeList: string[] = []
        return new Promise<string[]>((resolve) => {
            for (let loopi = 0; loopi < ipList.length; loopi++) {
                ping.sys.probe(ipList[loopi], function (isAlive) {
                    var msg = isAlive ? 'host ' + ipList[loopi] + ' is alive' : 'host ' + ipList[loopi] + ' is dead';
                    if (isAlive) {
                        activeList.push(ipList[loopi])
                        logger.info(msg)
                    }



                    resultNum++;
                    if (resultNum == ipList.length) {
                        resolve(activeList)
                    }

                    // }
                });
            }

        })
    }

    clearAll() {
        this.ipPrefixList = []
    }

    addPrefix(ipPrefix: string, subLenth:number, start: number, end: number) {
        let ipPreInfo: IpPrefixInfo = {
            ipPrefix: ipPrefix,
            subLenth:subLenth,
            start: start,
            end: end
        }
        this.ipPrefixList.push(ipPreInfo)
    }

    async AliveDetect(): Promise<string[]> {
        this.aliveList = []
        for (let ii = 0; ii < this.ipPrefixList.length; ii++) {
            for (let loopi = this.ipPrefixList[ii].start; loopi <= this.ipPrefixList[ii].end; loopi += this.paralMax) {
                let ipList = []
                for (let jj = 0; jj < this.paralMax && (loopi + jj) <= this.ipPrefixList[ii].end; jj++) {
                    let ipAddr = this.ipPrefixList[ii].ipPrefix + "." + (loopi + jj);
                    ipList.push(ipAddr)
                }
                let actList = await this.detectAliveIpList(ipList)
                this.aliveList = this.aliveList.concat(actList)
            }
        }
        return this.aliveList
    }



}

abstract class ClientBase {
    constructor() {
    }
    abstract sendCommand(cmd: string): Promise<any>;
    abstract connect(host: string, userName: string, passWord: string): Promise<unknown>;
}

export class TelnetClient extends ClientBase {
    socket: net.Socket | undefined;
    tSocket: TelnetSocket | undefined
    portNo: number;
    streamData: string;
    prompt: string;
    promisePrompt: Promise<unknown> | undefined
    loginResolve: any;
    promptResolve: any
    promptIsDeteced: boolean;
    isLogin: boolean;
    userPrompt: string;
    passwordPrompt: string
    username: string;
    password: string;
    resultSplit: ResultSplit;
    promptRegex:string;
    promptAppend:string;
    promptTimer:NodeJS.Timeout|undefined;
    loginTimer:NodeJS.Timeout|undefined;
    
    constructor() {
        super()
        this.portNo = 23
        this.streamData = ''
        this.prompt = 'xxxxx';
        this.promptIsDeteced = false;
        this.isLogin = false
        this.userPrompt = 'Username: '
        this.passwordPrompt = 'Password: '
        this.username = 'e7support'
        this.password = 'admin'
        this.resultSplit = new ResultSplit()
        this.promptRegex = ''
        this.promptAppend = ''
        this.promptTimer = undefined;
        this.loginTimer = undefined;
    }

    setPromptFormat(promptReg:string, promptAppend:string) {
        this.promptRegex = promptReg;
        this.promptAppend = promptAppend;
    }

    detectPrompt(strCheck: string) {
        if (this.promptIsDeteced === true) {
            return;
        }
        //  /"((\S)+)" (\S){3}/
        let promptReg = this.promptRegex;
        let match = strCheck.match(promptReg)
        if (match && match[1]) {
            this.prompt = match[1] + this.promptAppend
            logger.error('detectPrompt: is ' + this.prompt)
            this.promptIsDeteced = true;
        }

    }

    sendCommand(cmd: string, timeOut:number = 10000): Promise<any> {
        this.streamData = ''
        this.tSocket?.write(cmd + '\n')
        let that = this
        this.promisePrompt = new Promise((resolve) => {
            that.promptResolve = resolve
            if (this.promptTimer) {
                clearTimeout(this.promptTimer)
            } 
            this.promptTimer = setTimeout(()=>{
                that.promptResolve(-1);
            }, timeOut)
        })
        return this.promisePrompt;
    }

    sendCommandNoWait(outBuf: string) {
        this.tSocket?.write(outBuf + '\n');

    }

    tryLogin(inBuf: string) {
        if (inBuf.indexOf(this.userPrompt) == 0) {
            logger.info('send username ' + this.username)
            this.sendCommandNoWait(this.username)
        } else if (inBuf.indexOf(this.passwordPrompt) == 0) {
            logger.info('send password ' + this.password)
            this.sendCommandNoWait(this.password)
        } else {

        }
    }
    onData(data: Buffer) {
        let dataString = data.toString("utf8")
        this.streamData += dataString
        logger.info(dataString)
        if (!this.promptIsDeteced) {
            this.detectPrompt(dataString)
        }

        if (!this.isLogin) {
            this.tryLogin(dataString);
        }

        // logger.info('this.prompt' + this.prompt)
        if (dataString.indexOf(this.prompt) != -1) {
            if (!this.isLogin) {
                this.isLogin = true;
                if (this.loginResolve) {
                    this.loginResolve(0)
                    this.loginResolve = undefined
                    if (this.loginTimer) {
                        clearTimeout(this.loginTimer)
                    }
                } else {
                    logger.error('prompt comes but no resolve wait')
                }
            }

            // logger.info('find prompt')
            this.streamData = this.streamData.substr(this.streamData.indexOf('\n') + 1)
            this.streamData = this.streamData.substr(0, this.streamData.indexOf(this.prompt))
            if (this.promptTimer) {
                clearTimeout(this.promptTimer)
                this.promptTimer = undefined
            }
            if (this.promptResolve) {
                this.promptResolve(this.streamData)
            }            
        }

    }

    connect(host: string, userName: string, passWord: string, timeOut:number=10000): Promise<unknown> {
        logger.error('connect ' + host)
        this.socket = net.createConnection(this.portNo, host);
        this.tSocket = new TelnetSocket(this.socket);
        this.username = userName;
        this.password = passWord
        let that = this
        logger.error('connect ' + host + ' success')
        function onData(data: any) {
            that.onData(data)
        }
        this.socket.on('error', function(errorMes) {
            logger.error(errorMes)

        })

        this.tSocket.on("close", function () {
            // return process.exit();
        });


        this.tSocket.on("data", onData)

        this.tSocket.on("do", function (option) {
            return that.tSocket?.writeWont(option);
        });


        this.tSocket.on("will", function (option) {
            return that.tSocket?.writeDont(option);
        });

        let promiseReturn = new Promise((resolve) => {
            this.loginResolve = resolve
            
            this.loginTimer = setTimeout(()=>{
                if (that.loginResolve) {
                    that.loginResolve(-1)
                }
            }, timeOut)
        })

        logger.error('promise return')
        return promiseReturn;
    }

    disconnect() {
        this.tSocket?.destroy();
        this.socket?.destroy();
    }

}

export class InvestigateClient {
    stream: SSH.ClientChannel | undefined;
    conn: SSH.Client | undefined;
    streamData: string;
    prompt: string;
    promisePrompt: Promise<unknown> | undefined
    promptResolve: any
    resultSplit: ResultSplit;
    promptIsDeteced: boolean;
    promptRegex:string;
    promptAppend:string;
    promptTimer:NodeJS.Timeout|undefined;

    constructor() {
        this.promisePrompt = undefined
        this.stream = undefined;
        this.conn = undefined;
        this.streamData = '';
        this.prompt = 'xxxxx'
        this.promptIsDeteced = false;
        this.promptResolve = null
        this.resultSplit = new ResultSplit()
        this.promptRegex = ''
        this.promptAppend = ''
        this.promptTimer = undefined
        
        
    }


    detectPrompt(strCheck: string) {
        if (this.promptIsDeteced === true) {
            return;
        }
        // let promptReg = /root@((\S)+):~#/
        let bRegex = new RegExp(this.promptRegex)
        let match = strCheck.match(bRegex)
        if (match && match[1]) {
            this.prompt = match[1] + this.promptAppend
            logger.error('detectPrompt: is ' + this.prompt)
            this.promptIsDeteced = true;
        }

    }

    onData(data: Buffer) {
        let dataString = data.toString()
        this.streamData += dataString
        if (!this.promptIsDeteced) {
            this.detectPrompt(dataString)
        }
        // logger.info('this.prompt' + this.prompt)
        if (dataString.indexOf(this.prompt) != -1) {
            // logger.info('find prompt')
            this.streamData = this.streamData.substr(this.streamData.indexOf('\n') + 1)
            this.streamData = this.streamData.substr(0, this.streamData.indexOf(this.prompt))
            if (this.promptTimer) {
                clearTimeout(this.promptTimer)
                this.promptTimer = undefined
            }
            if (this.promptRegex) {
                this.promptResolve(this.streamData)
            }
        }else {
            let matchReg = new RegExp(this.promptRegex)
            let idx = dataString.search(matchReg)
            if (idx != -1) {
                this.streamData = this.streamData.substr(this.streamData.indexOf('\n') + 1)
                this.streamData = this.streamData.substr(0, idx)
                if (this.promptTimer) {
                    clearTimeout(this.promptTimer)
                    this.promptTimer = undefined
                }
                if (this.promptRegex) {
                    this.promptResolve(this.streamData)
                }              
            }
        }
        logger.info(dataString)
    }

    sendCommand(cmd: string, timeOut:number = 10000): Promise<any> {
        this.streamData = ''
        let that = this;
        if (this.stream) {
            this.stream.write(cmd + '\n')
        }
        this.promisePrompt = new Promise((resolve) => {
            that.promptResolve = resolve
            if (this.promptTimer) {
                clearTimeout(this.promptTimer)
            } 
            this.promptTimer = setTimeout(()=>{
                that.promptResolve(-1);
            }, timeOut)


        })
        return this.promisePrompt;
    }

    setPromptFormat(promptReg:string, promptAppend:string) {
        this.promptRegex = promptReg;
        this.promptAppend = promptAppend;
    }

    disconnect() {
        this.conn?.end()
        this.conn?.destroy()
    }

    connect(host: string, userName: string, passWord: string): Promise<number> {
        this.conn = new SSH.Client();
        let that = this

        function onData(data: any) {
            that.onData(data)
        }
        
            let promiseWait = new Promise<number>((resolve) => {
                if (this.conn) {
                    this.conn.on('ready', function () {
                        logger.info('Client :: ready');
                        if (that.conn) {
                            that.conn.shell(function (err, stream) {
                                if (err) {
                                    logger.error(err)
                                    throw err;
                                }
                                that.stream = stream
                                stream.on('close', function () {
                                    logger.info('Stream :: close');
                                    if (that.conn) {
                                        that.conn.end();
                                    }
                                }).on('data', onData);
                                resolve(0)
                            });
                        }

                    }).on('error', function(){
                        logger.error('failed to ssh login '+ host + ` with user:${userName}`)
                        resolve(-1)
                    }).connect({
                        host: host,
                        port: 22,
                        username: userName,
                        password: passWord,
                        readyTimeout:5000
                        // privateKey: require('fs').readFileSync('/here/is/my/key')
                    })

                }


            })
            return promiseWait


    }

}




