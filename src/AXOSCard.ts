import { InvestigateClient } from "./Connectivity"
import logger from "./logger"
import { CliResFormatMode, ResultSplit } from "./ResultSplit"
import { LabPatroType, LabPatroResult, LabPatroAny, getAxosModuleHeader, AxosModuleHeaderChgMap, CommandType } from "./LabPatrolPub"
import { getLocalIpv4Address, reverseIP } from "./NetUtil"
import { DiagGradeParse } from "./DiagGradeParse"
import {AspenCardMonitor} from "./LabPatrolPri"
import { exec } from "child_process"
type OntOut = {
    [attr: string]: string,
}
type AnyOut = {
    [attr: string]: string,
}

export enum ConnectMode {
    ConnectMode_SHELL = 1,
    ConnectMode_CLI = 2
}

export class AXOSCard {
    invesClient: InvestigateClient | undefined
    shellIpList: string[] = []
    connectMode: ConnectMode = ConnectMode.ConnectMode_SHELL  
    currentMode: ConnectMode = ConnectMode.ConnectMode_CLI
    connectTimeOut = 8000 // ms
    execCrackStr = 'python ecrack.py'
    async connect(ipAddr: string): Promise<number> {
        let rc = -1;
        this.invesClient = new InvestigateClient()
        this.invesClient.setPromptFormat('root@((\\S)+):~#', '#')
        rc = await this.invesClient.connect(ipAddr, 'root', 'root')
        if (rc != 0) {
            this.connectMode = ConnectMode.ConnectMode_CLI
            this.invesClient.setPromptFormat(`using ssh on (\\S+)`, '#')
            rc = await this.invesClient.connect(ipAddr, 'calixsupport', 'calixsupport')
            if (rc != 0) {
                return -1;
            }
        } else {
            this.connectMode = ConnectMode.ConnectMode_SHELL
            let ipAddrList: string[] = []
            let sessionRes = await this.invesClient.sendCommand('who')
            if (!sessionRes || sessionRes === -1) {
                logger.error('AXOSCard who ' + ipAddr + 'no who ' + JSON.stringify(sessionRes))
            } else {
                let sessionSplit = sessionRes.split('\r\n')
                let matchReg = /\s+(\d+\.\d+\.\d+\.\d+)/
                for (let ii = 0; ii < sessionSplit.length; ii++) {
                    let matchRes = matchReg.exec(sessionSplit[ii])
                    if (matchRes && matchRes[1]) {
                        if (ipAddrList.indexOf(matchRes[1]) === -1) {
                            ipAddrList.push(matchRes[1])
                        }
                    }
                }
            }
            this.shellIpList = ipAddrList

            rc = await this.invesClient.sendCommand('/opt/confd/bin/confd_cli')
            if (rc === -1) {
                this.invesClient.disconnect()
                return -1;
            }
        }
        this.currentMode = ConnectMode.ConnectMode_CLI
        return 0
    }


    async disconnect() {
        this.invesClient?.disconnect();
    }

    filterSimOnt(ontInfo: OntOut): boolean {
        for (let key in ontInfo) {
            if (key === 'CLEI') {
                if (ontInfo[key].indexOf('SIM') != -1) {
                    return true
                }
            }
        }
        return false
    }

    async checkLldpNeighbor(ipAddr: string): Promise<number | any[]> {
        try {
            let rc: number = -1;
            if (this.invesClient === undefined) {
                rc = await this.connect(ipAddr)
                if (rc != 0) {
                    return rc
                }
            }
            if (this.invesClient === undefined) {
                return -1
            }

            let lldpOut = await this.invesClient.sendCommand('show lldp neighbor summary | csv')
            if (!lldpOut || lldpOut === -1) {
                logger.error('AXOScard checkLldpNeighbor ' + ipAddr + 'no lldp summary')
                return []
            }

            this.invesClient.resultSplit.splitResult(lldpOut, CliResFormatMode.CliResFormatTableCsv)

            let lldpFormatOut = this.invesClient.resultSplit.getTableFormatOut()
            let lldpList = []
            for (let ii = 0; ii < lldpFormatOut.length; ii++) {
                let outCombine: AnyOut = {}
                for (let jj = 0; jj < lldpFormatOut[ii].childs.length; jj++) {
                    outCombine[lldpFormatOut[ii].childs[jj].name] = lldpFormatOut[ii].childs[jj].value;
                }
                lldpList.push(outCombine)
            }
            // logger.info(JSON.stringify(ontList))
            return lldpList;
        } catch (e) {
            logger.error(e)
            return []
        }


    }
    async checkDiscoverOnt(ipAddr: string): Promise<number | any[]> {
        try {
            let rc: number = -1;
            if (this.invesClient === undefined) {
                rc = await this.connect(ipAddr)
                if (rc != 0) {
                    return rc
                }
            }
            if (this.invesClient === undefined) {
                return -1
            }


            await this.invesClient.sendCommand('paginate false')

            let disOnt = await this.invesClient.sendCommand('show discovered-ont')
            if (!disOnt || disOnt === -1) {
                logger.error('AXOScard checkDiscoverOnt ' + ipAddr + 'no discovered ont ')
                return []
            }

            this.invesClient.resultSplit.splitResult(disOnt, CliResFormatMode.CliResFormatTable)

            let disOntOut = this.invesClient.resultSplit.getTableFormatOut()
            let ontList = []
            for (let ii = 0; ii < disOntOut.length; ii++) {
                let ontCombine: OntOut = {}
                for (let jj = 0; jj < disOntOut[ii].childs.length; jj++) {
                    ontCombine[disOntOut[ii].childs[jj].name] = disOntOut[ii].childs[jj].value;
                }
                if (Object.keys(ontCombine).length > 0 && this.filterSimOnt(ontCombine) != true) {
                    ontList.push(ontCombine)
                }
            }
            // logger.info(JSON.stringify(ontList))
            return ontList;
        } catch (e) {
            logger.error(e)
            return []
        }
    }

    moduleMapChg(moduleOne: LabPatroAny) {
        for (let key in moduleOne) {
            if (Object.keys(AxosModuleHeaderChgMap).indexOf(key) != -1) {
                let newKey = AxosModuleHeaderChgMap[key]
                moduleOne[newKey] = moduleOne[key]
                delete moduleOne[key]
            }
        }
    }

    async checkEtherModule(ipAddr: string): Promise<number | any[]> {
        try {
            let rc: number = -1;
            if (this.invesClient === undefined) {
                rc = await this.connect(ipAddr)
                if (rc != 0) {
                    return rc
                }
            }
            if (this.invesClient === undefined) {
                return -1
            }


            await this.invesClient.sendCommand('paginate false')

            let moduleRes = await this.invesClient.sendCommand('show interface ethernet module', 60000)
            if (!moduleRes || moduleRes === -1) {
                logger.error('AXOScard checkEtherModule ' + ipAddr + 'no result ')
                return []
            }

            this.invesClient.resultSplit.splitResult(moduleRes, CliResFormatMode.CliResFormatLine)
            let moduleOut = this.invesClient.resultSplit.getLineFormatOut()
            let moduleReslist: LabPatroAny[] = []
            const headerList = getAxosModuleHeader()
            for (let ii = 0; ii < moduleOut.length; ii++) {
                if (moduleOut[ii].name.indexOf('interface') != -1) {
                    let moduleOne: LabPatroAny = {}
                    // result is name:interface   value:ethernet x/x/x
                    moduleOne["portPosition"] = moduleOut[ii].value.replace('ethernet', '').trim()
                    if (moduleOut[ii].childs && moduleOut[ii].childs[0] && moduleOut[ii].childs[0].name === 'module') {
                        for (let kk = 0; kk < moduleOut[ii].childs[0].childs.length; kk++) {
                            if (headerList.indexOf(moduleOut[ii].childs[0].childs[kk].name) != -1) {
                                moduleOne[moduleOut[ii].childs[0].childs[kk].name] = moduleOut[ii].childs[0].childs[kk].value
                            }
                        }
                    }
                    if (Object.keys(moduleOne).length > 1) {
                        // change some map 
                        this.moduleMapChg(moduleOne)
                        moduleReslist.push(moduleOne)
                    }
                }
            }
            // logger.info(JSON.stringify(moduleReslist))

            return moduleReslist;
        } catch (e) {
            logger.error(e)
            return []
        }


    }

    async checkPonModule(ipAddr: string): Promise<number | any[]> {
        try {
            let rc: number = -1;
            if (this.invesClient === undefined) {
                rc = await this.connect(ipAddr)
                if (rc != 0) {
                    return rc
                }
            }
            if (this.invesClient === undefined) {
                return -1
            }


            await this.invesClient.sendCommand('paginate false')

            let moduleRes = await this.invesClient.sendCommand('show interface pon module', 60000)
            if (!moduleRes || moduleRes === -1) {
                logger.error('AXOScard checkPonModule ' + ipAddr + 'no result ')
                return []
            }

            this.invesClient.resultSplit.splitResult(moduleRes, CliResFormatMode.CliResFormatLine)
            let moduleOut = this.invesClient.resultSplit.getLineFormatOut()
            let moduleReslist: LabPatroAny[] = []
            const headerList = getAxosModuleHeader()
            for (let ii = 0; ii < moduleOut.length; ii++) {
                if (moduleOut[ii].name.indexOf('interface') != -1) {
                    let moduleOne: LabPatroAny = {}
                    // result is name:interface   value:pon x/x/x
                    if (moduleOut[ii].childs && moduleOut[ii].childs[0] && moduleOut[ii].childs[0].name === 'module') {
                        moduleOne["portPosition"] = moduleOut[ii].value.replace('pon', '').trim()
                        for (let kk = 0; kk < moduleOut[ii].childs[0].childs.length; kk++) {
                            if (headerList.indexOf(moduleOut[ii].childs[0].childs[kk].name) != -1) {
                                moduleOne[moduleOut[ii].childs[0].childs[kk].name] = moduleOut[ii].childs[0].childs[kk].value
                            }
                        }
                    }

                    if (Object.keys(moduleOne).length > 1) {
                        this.moduleMapChg(moduleOne)
                        moduleReslist.push(moduleOne)
                    }
                }
            }
            // logger.info(JSON.stringify(moduleReslist))

            return moduleReslist;
        } catch (e) {
            logger.error(e)
            return []
        }
    }

    async checkCard(ipAddr: string): Promise<number | any[]> {
        let rc: number = -1;
        type CardCombineOut = {
            cardPosition: string,
            [attr: string]: string,
        }
        try {
            if (this.invesClient === undefined) {
                rc = await this.connect(ipAddr)
                if (rc != 0) {
                    return rc
                }
            }
            if (this.invesClient === undefined) {
                return -1
            }

            await this.invesClient.sendCommand('paginate false')
            // await invesClient.sendCommand('show running')
            let cardResult = await this.invesClient.sendCommand('show card')
            if (!cardResult || cardResult === -1) {
                logger.error('AXOScard checkCard ' + ipAddr + 'no show card ')
                return []
            }

            // logger.info('\r\n' + cardResult)
            // invesClient.resultSplit.setOutput(cardResult)
            this.invesClient.resultSplit.splitResult(cardResult, CliResFormatMode.CliResFormatTable)

            let showCardRes = this.invesClient.resultSplit.getTableFormatOut()

            cardResult = await this.invesClient.sendCommand('show version')
            if (!cardResult || cardResult === -1) {
                logger.error('AXOScard checkCard ' + ipAddr + 'no show version ')
                return []
            }
            this.invesClient.resultSplit.splitResult(cardResult, CliResFormatMode.CliResFormatLine)

            let showVerRes = this.invesClient.resultSplit.getLineFormatOut()
            let cardInfos: CardCombineOut[] = []
            for (let ii = 0; ii < showCardRes.length; ii++) {
                let cardOut: CardCombineOut = {
                    cardPosition: ''
                }
                for (let jj = 0; jj < showCardRes[ii].childs.length; jj++) {
                    if (showCardRes[ii].childs[jj].name === 'CARD') {
                        cardOut.cardPosition = showCardRes[ii].childs[jj].value
                    } else {
                        cardOut[showCardRes[ii].childs[jj].name] = showCardRes[ii].childs[jj].value
                    }
                }
                cardInfos.push(cardOut)
            }


            for (let ii = 0; ii < showVerRes.length; ii++) {
                if (showVerRes[ii].name === 'version') {
                    let cardPos = showVerRes[ii].value
                    for (let jj = 0; jj < cardInfos.length; jj++) {
                        if (cardInfos[jj].cardPosition === cardPos) {
                            for (let kk = 0; kk < showVerRes[ii].childs.length; kk++) {
                                cardInfos[jj][showVerRes[ii].childs[kk].name] = showVerRes[ii].childs[kk].value
                            }
                        }
                    }
                }
            }

            let ipAddrList: string[] = []
            ipAddrList.push(...this.shellIpList)
            let sessionRes = await this.invesClient.sendCommand('show user-sessions | include session-ip')
            if (!sessionRes || sessionRes === -1) {
                logger.error('E7card checkCard ' + ipAddr + 'no show session ')
            } else {
                let sessionSplit = sessionRes.split('\r\n')
                let matchReg = /session-ip\s+(\d+.\d+.\d+.\d+)/
                for (let ii = 0; ii < sessionSplit.length; ii++) {
                    let matchRes = matchReg.exec(sessionSplit[ii])
                    if (matchRes && matchRes[1]) {
                        if (ipAddrList.indexOf(matchRes[1]) === -1) {
                            ipAddrList.push(matchRes[1])
                        }
                    }
                }
            }

            let localIps = await getLocalIpv4Address()
            let hostName = ''
            for (let ii = 0; ii < ipAddrList.length; ii++) {
                if (localIps.indexOf(ipAddrList[ii]) === -1) {
                    let hostRet = await reverseIP(ipAddrList[ii])
                    if (hostRet && hostRet != -1) {
                        hostName += hostRet + '; '
                    } else {
                        hostName += ipAddrList[ii] + '; '
                    }
                }
            }

            for (let ii = 0; ii < cardInfos.length; ii++) {
                cardInfos[ii]['recentUser'] = hostName
            }


            return cardInfos;

        } catch (e) {
            logger.error(e)
            return []
        }

    }



    static async doPatrolWork(ipAddr: string, patrolType: number): Promise<number | LabPatroResult> {
        let rc = -1
        let axosCard = new AXOSCard()
        let cardInfo
        let ontInfo
        let moduleInfo: LabPatroAny[] = []
        let lldpInfo: LabPatroAny[] = []

        rc = await axosCard.timeExec(axosCard.connect(ipAddr), axosCard.connectTimeOut)
        if (rc != 0) {
            return -1;
        }


        if (patrolType & LabPatroType.LabPatrolType_AXOSCard) {
            let ret = await axosCard.checkCard(ipAddr)
            if (ret != -1) {
                cardInfo = ret as unknown as LabPatroAny[]
            }
        }

        if (patrolType & LabPatroType.LabPatrolType_ONT) {
            let ret = await axosCard.checkDiscoverOnt(ipAddr)
            if (ret != -1) {
                ontInfo = ret as unknown as LabPatroAny[]
            }
        }

        if (patrolType & LabPatroType.LabPatrolType_Module) {
            let ret = await axosCard.checkPonModule(ipAddr)
            if (ret != -1) {
                moduleInfo = ret as unknown as LabPatroAny[]
            }

            ret = await axosCard.checkEtherModule(ipAddr)
            if (ret != -1) {
                moduleInfo?.push(...(ret as unknown as LabPatroAny[]))
            }

        }

        if (patrolType & LabPatroType.LabPatrolType_Lldp) {
            let ret = await axosCard.checkLldpNeighbor(ipAddr)
            if (ret != -1) {
                lldpInfo = ret as unknown as LabPatroAny[]
            }
        }

        let resInfo: LabPatroResult = {
            ontInfo: ontInfo,
            cardInfo: cardInfo,
            moduleInfo: moduleInfo,
            lldpInfo: lldpInfo
        }

        await axosCard.disconnect()
        return resInfo
    }

    timeExec(pro: Promise<any>, maxMs: number): Promise<any> {
        let timePromise = new Promise((resolve) => {
            setTimeout(() => { resolve(-1) }, maxMs)

        })
        return Promise.race([pro, timePromise])
    }

    static async executeCommands(ipAddr: string, cmdList: string[]): Promise<number | any[]> {
        let rc = -1
        let axosCard = new AXOSCard()
        rc = await axosCard.timeExec(axosCard.connect(ipAddr), axosCard.connectTimeOut)
        if (rc != 0) {
            return -1;
        }

        if (axosCard.invesClient === undefined) {
            return -1
        }
        let cmdResults = []
        await axosCard.invesClient.sendCommand('paginate false')

        for (let ii = 0; ii < cmdList.length; ii++) {
            let res = await axosCard.invesClient.sendCommand(cmdList[ii])
            cmdResults.push(res)
        }

        await axosCard.invesClient.disconnect()
        return cmdResults
    }

    async crackPass(key:string):Promise<string> {
        let that = this
        return new Promise((resolve, reject)=>{
            exec(
                that.execCrackStr + key,
                {
                  // setting fake environment variable 
                  env: {
                    NODE_ENV: "production",
                  },
                },
                (error, stdout, stderror) => {
                  // if any error while executing
                  if (error) {
                    console.error("Error: ", error);
                    return;
                  }
              
                  console.log(stdout); // output from stdout
                  resolve(stdout)
                }
              );    

        })
   
    }

    async crackLogin():Promise<number> {
        if (!this.invesClient) {
            logger.error('crackLogin: not connected')
            return -1
        }
        if (this.connectMode === ConnectMode.ConnectMode_CLI) {

            let oriPrompt = this.invesClient.prompt
            logger.info('oriPrompt: ' + oriPrompt)
            await this.invesClient.sendCommand('paginate false')
            
            
            this.invesClient.setUsingPrompt('Enter calixsupport role password')
            // 'Calix AXOS-R22.1.0 E7-2 Wed Mar 02 16:29:28 2022'
            // let res = await axosCard.invesClient.sendCommand('show card')
            let res = await this.invesClient.sendCommand('shell') 
            logger.info(res)
            let crackStr = ''
            if (res != -1) {
                let lines = res.split('\n')
                for (let line1 of lines) {
                    let regResult = /Calix AXOS-(\S*)/.exec(line1)
                    if (regResult && regResult[0]) {
                        crackStr = line1.substr(regResult[0].length)
                    }
                }
            }
            logger.info('crackStr: ' + crackStr)
            if (crackStr.length === 0) {
                logger.error(` detect crackStr faild`)
                return -1
            }
            let crackRes = await this.crackPass(crackStr)
            let crackResLines = crackRes.split('\n')
            logger.info(crackResLines)
            oriPrompt = oriPrompt.slice(0, oriPrompt.length - 1)
            for (let oo of crackResLines) {
                // console.log(oriPrompt)
                if (oo.indexOf(oriPrompt) != -1) {
                    crackRes = oo.split('\t')[1]
                    logger.info(crackRes)
                }
            }
            this.invesClient.setPromptFormat('root@((\\S)+):', '#')
            await this.invesClient.sendCommand(crackRes)
            await this.invesClient.sendCommand('cli')
            this.connectMode = ConnectMode.ConnectMode_SHELL
            this.currentMode = ConnectMode.ConnectMode_CLI
        }
        return 0

    }


    static async execAspenShell(cardMon: AspenCardMonitor, cmdList: string[]): Promise<number | any[]> {
        let rc = -1
        let axosCard = new AXOSCard()
        let cmdResults = []
        rc = await axosCard.timeExec(axosCard.connect(cardMon.ipAddr), axosCard.connectTimeOut)
        if (rc != 0) {
            return -1;
        }

        if (axosCard.invesClient === undefined) {
            return -1
        }


        if (axosCard.connectMode === ConnectMode.ConnectMode_CLI) {
            let oriPrompt = axosCard.invesClient.prompt
            logger.info('oriPrompt: ' + oriPrompt)
            await axosCard.invesClient.sendCommand('paginate false')
            
            
            axosCard.invesClient.setUsingPrompt('Enter calixsupport role password')
            // 'Calix AXOS-R22.1.0 E7-2 Wed Mar 02 16:29:28 2022'
            // let res = await axosCard.invesClient.sendCommand('show card')
            let res = await axosCard.invesClient.sendCommand('shell') 
            logger.info(res)
            let crackStr = ''
            if (res != -1) {
                let lines = res.split('\n')
                for (let line1 of lines) {
                    let regResult = /Calix AXOS-(\S*)/.exec(line1)
                    if (regResult && regResult[0]) {
                        crackStr = line1.substr(regResult[0].length)
                    }
                }
            }
            logger.info('crackStr: ' + crackStr)
            if (crackStr.length === 0) {
                logger.error(`${cardMon.ipAddr} detect crackStr faild`)
                return -1
            }
            let crackRes = await axosCard.crackPass(crackStr)
            let crackResLines = crackRes.split('\n')
            logger.info(crackResLines)
            oriPrompt = oriPrompt.slice(0, oriPrompt.length - 1)
            for (let oo of crackResLines) {
                // console.log(oriPrompt)
                if (oo.indexOf(oriPrompt) != -1) {
                    crackRes = oo.split('\t')[1]
                    logger.info(crackRes)
                }
            }
            axosCard.invesClient.setPromptFormat('root@((\\S)+):', '#')
            await axosCard.invesClient.sendCommand(crackRes)
            await axosCard.invesClient.sendCommand('cli')
            
        }


        let cardRes = await axosCard.checkCard(cardMon.ipAddr)
        if (cardRes === -1) {
            logger.error('executeCommandsWithType: check card error')
            return -1
        }
        await axosCard.invesClient.sendCommand('exit')


        cardRes = cardRes as unknown as LabPatroAny[]

        for (let ii = 0; ii < cardRes.length; ii++) {
            if (cardRes[ii]['CARD STATE'] === 'In Service' ||
                cardRes[ii]['CARD STATE'] === 'Degraded') {
                if (cardRes[ii]['PROVISION TYPE'] === 'XG801' && cardRes[ii]['cardPosition'].indexOf('1/' + cardMon.slot) != -1) {
                    if (cardRes[ii]['CARD TYPE'].indexOf('(Active)') != -1) {
                        axosCard.invesClient.setUsingPrompt('BCM.0>')
                        await axosCard.invesClient.sendCommand('/usr/bin/aspensh -transport UDP 127.0.0.1:50200')
                        for (let jj = 0; jj < cmdList.length; jj++) {
                            let res = await axosCard.invesClient.sendCommand(cmdList[jj])
                        }
                        cardMon.state = 'running'

                    } else {
                        let res = await axosCard.invesClient.sendCommand('jump2c.sh ' + cardRes[ii]['cardPosition'])
                        axosCard.invesClient.setUsingPrompt('BCM.0>')
                        await axosCard.invesClient.sendCommand('/usr/bin/aspensh -transport UDP 127.0.0.1:50200')
                        for (let jj = 0; jj < cmdList.length; jj++) {
                            res = await axosCard.invesClient.sendCommand(cmdList[jj])
                        }
                        cardMon.state = 'running'
                    }
                }
            }
        }

        let interHandler = setInterval(async () => {
            if (axosCard && axosCard.invesClient) {
                let rc = await axosCard.invesClient.sendCommand('/api/get')
                if (rc === -1) {
                    logger.error('can not connect anymore')
                    cardMon.state = 'stop'
                    clearInterval(interHandler)
                    await axosCard.invesClient.disconnect()
                }
            }
        }, 60000)
        
        return 0
    }



    static async executeCommandsWithType(ipAddr: string, cmdList: string[], cmdType: CommandType): Promise<number | any[]> {
        let rc = -1
        let axosCard = new AXOSCard()
        let cmdResults = []
        rc = await axosCard.timeExec(axosCard.connect(ipAddr), axosCard.connectTimeOut)
        if (rc != 0) {
            return -1;
        }

        if (axosCard.invesClient === undefined) {
            return -1
        }

        if (cmdType === CommandType.CommandType_SHELL) {
            if (axosCard.connectMode === ConnectMode.ConnectMode_CLI) {
                logger.error('executeCommandsWithType: can not exec shell command in cli mode')
                return -1
            }

            let cardRes = await axosCard.checkCard(ipAddr)
            if (cardRes === -1) {
                logger.error('executeCommandsWithType: check card error')
                return -1
            }
            await axosCard.invesClient.sendCommand('exit')
            cardRes = cardRes as unknown as LabPatroAny[]
            for (let ii = 0; ii < cardRes.length; ii++) {
                if (cardRes[ii]['CARD STATE'] === 'In Service' ||
                    cardRes[ii]['CARD STATE'] === 'Degraded') {
                    if (cardRes[ii]['CARD TYPE'].indexOf('(Active)') != -1 ||
                        cardRes[ii]['CARD TYPE'].indexOf('(Standalone)') != -1) {
                        for (let jj = 0; jj < cmdList.length; jj++) {
                            let res = await axosCard.invesClient.sendCommand(cmdList[jj])
                            cmdResults.push(res)
                        }
                    } else {
                        let res = await axosCard.invesClient.sendCommand('jump2c.sh ' + cardRes[ii]['cardPosition'])
                        cmdResults.push(res)
                        for (let jj = 0; jj < cmdList.length; jj++) {
                            res = await axosCard.invesClient.sendCommand(cmdList[jj])
                            cmdResults.push(res)
                        }
                        await axosCard.invesClient.sendCommand('exit')
                    }
                }
            }

        } else {
            await axosCard.invesClient.sendCommand('paginate false')
            for (let ii = 0; ii < cmdList.length; ii++) {
                let res = await axosCard.invesClient.sendCommand(cmdList[ii])
                cmdResults.push(res)
            }
        }

        await axosCard.invesClient.disconnect()
        return cmdResults
    }


}

if (__filename === require.main?.filename) {
    // (async () => {
    //     // await E7Card.checkCard('10.245.69.179')
    //     let res = await AXOSCard.doPatrolWork('10.245.36.55', LabPatroType.LabPatrolType_AXOSCard /* | LabPatroType.LabPatrolType_ONT |LabPatroType.LabPatrolType_Module */)
    //     if (res != -1) {
    //         let conRes = res as unknown as LabPatroResult
    //         console.log(JSON.stringify(conRes.cardInfo))
    //         console.log(JSON.stringify(conRes.ontInfo))
    //     }
    // })()

    (async () => {
        // let cmdList = ['show interface pon rx-power-history']

        // let res = await AXOSCard.executeCommands('10.245.34.133', cmdList)
        // console.log(res)
        // if (res != -1) {
        //     let resList = res as unknown as []
        //     for (let ii = 0; ii < resList.length; ii++) {
        //         console.log(resList[ii])
        //     }
        // }
        // cmdList = ['dcli ponmgrd sx dump']
        // // cmdList = ['show card', 'show version', "exit", "uptime", "cli", 'show version']
        // // cmdList = ['paginate false', 'exit', 'date']
        // let res = await AXOSCard.executeCommandsWithType('10.245.34.156', cmdList, CommandType.CommandType_CLI)
        // console.log('======================')
        // console.log(res)

        // let diagGradeParse = new DiagGradeParse()
        // if (typeof res === 'object') {
        //     diagGradeParse.setParseStr(res[0])
        //     let pathResult = diagGradeParse.retriveParseNode([[{prefix:"interface pon", value:''}], [{prefix:"rx-power-history", value:""}], [{prefix:"high-rx-power", value:""}],
        //                                         [{prefix:"rx-power", value:""}, {prefix:"serial-number", value:""}]])
        //     console.log(JSON.stringify(pathResult))
        // }

        // cmdList = ['show running-config policy-map ']
        //  let res = await AXOSCard.executeCommandsWithType('10.245.34.156', cmdList, CommandType.CommandType_CLI)
        // console.log('======================')
        // console.log(res)

        // let diagGradeParse = new DiagGradeParse()
        // if (typeof res === 'object') {
        //     diagGradeParse.setParseStr(res[0])
        //     let pathResult = diagGradeParse.retriveParseNode([[{prefix:"policy-map", value:'add-s-l2-match'}], [{prefix:"class-map-ethernet", value:""}]])
        //     console.log(JSON.stringify(pathResult))
        // }   




        // cmdList = ['dcli halm_dnx  show ont  sd']
        //  let res = await AXOSCard.executeCommandsWithType('10.245.34.156', cmdList, CommandType.CommandType_SHELL)


        // console.log('======================')
        // console.log(res)

        // let resultSpli = new ResultSplit()
        // if (typeof res === 'object') {
        //     let resStr = res[0] as string
        //     resStr = resStr.substring(resStr.indexOf('\n') + 1)

        //     let tableRes = resultSpli.parseContentByColumnNum(resStr, 3)
        //     console.log(JSON.stringify(tableRes))
        // }

        // let diagGradeParse = new DiagGradeParse()
        // cmdList = ['show running-config transport-service-profile']
        //  let res = await AXOSCard.executeCommandsWithType('10.245.34.156', cmdList, CommandType.CommandType_CLI)
        // console.log('======================')
        // console.log(res)        
        // if (typeof res === 'object') {
        //     diagGradeParse.setParseStr(res[0])
        //     let pathResult = diagGradeParse.retriveParseNode([[{prefix:"transport-service-profile", value:''}], [{prefix:"vlan-list", value:""}]])

        //     console.log(JSON.stringify(pathResult))
        //     let filtRes = diagGradeParse.getItemValueFromPath(pathResult, ['vlan-list'])
        //     console.log(filtRes)
        // }   

        // cmdList = ['show running-config interface ethernet']
        // res = await AXOSCard.executeCommandsWithType('10.245.34.156', cmdList, CommandType.CommandType_CLI)
        // console.log('======================')
        // console.log(res)        
        // if (typeof res === 'object') {
        //     diagGradeParse.setParseStr(res[0])
        //     let pathResult = diagGradeParse.retriveParseNode([[{prefix:"interface ethernet", value:''}], [{prefix:"role", value:""}, {prefix:"transport-service-profile", value:""}]])

        //     console.log(JSON.stringify(pathResult))
        //     let filtRes = diagGradeParse.getItemValueFromPath(pathResult, ['interface ethernet', "role", "transport-service-profile"])
        //     console.log(filtRes)
        // }   

        // cmdList = ['show running-config class-map ethernet']
        //  res = await AXOSCard.executeCommandsWithType('10.245.34.156', cmdList, CommandType.CommandType_CLI)
        // console.log('======================')
        // console.log(res)

        // if (typeof res === 'object') {
        //     diagGradeParse.setParseStr(res[0])
        //     let pathResult = diagGradeParse.retriveParseNode([[{prefix:"class-map ethernet", value:'match_pcp'}], [{prefix:"flow", value:""}],
        //     [{prefix:"rule", value:""}]])
        //     console.log(JSON.stringify(pathResult))
        //     let filtRes = diagGradeParse.getItemValueFromPath(pathResult, ['class-map ethernet', "flow", "rule"])
        //     console.log(filtRes)
        // }   
        // let axosCard = new AXOSCard()
        // let cmdResults = []


        // let res = await axosCard.checkLldpNeighbor('10.245.34.156')
        // console.log(res)
        // let cmdList = ['/log/id_set_t index=9 log_type=print',
        // '/sub/ object=onu olt_id=0 indication=omci_packet subscribe=off',
        // '/Subscribe_ind object=onu olt_id=0 indication=rei subscribe=off',
        // '/Subscribe_ind object=pon_interface olt_id=0 indication=itu_rogue_detection_completed  subscribe=off',
        // '/Subscribe_ind object=onu olt_id=0 indication=rssi_measurement_completed subscribe=off',
        //  '/Subscribe_ind object=onu olt_id=0 indication=invalid_dbru_report subscribe=off',
        //  '/Subscribe_ind object=onu olt_id=0 indication=onu_activation_completed subscribe=off',
        //  '/Subscribe_ind object=onu olt_id=0 indication=ranging_completed subscribe=off',
        //  '/Subscribe_ind object=onu olt_id=0 indication=onu_deactivation_completed subscribe=off',
        //  '/Subscribe_ind object=onu olt_id=0 indication=key_exchange_completed subscribe=off']
        // // await AXOSCard.execAspenShell({ipAddr:'10.245.51.35', slot:2, state:'init'}, cmdList)
        // // await AXOSCard.execAspenShell({ipAddr:'10.245.34.156', slot:1, state:'init'}, cmdList)
        // await AXOSCard.execAspenShell({ipAddr:'10.245.48.28', slot:1, state:'init'}, cmdList)
        // await AXOSCard.executeCommandsWithType('10.245.36.133', ['show card'], CommandType.CommandType_CLI)

                let cmdList = ['show interface pon rx-power-history']

        let res = await AXOSCard.executeCommands('10.245.36.135', cmdList)
    })()
}

