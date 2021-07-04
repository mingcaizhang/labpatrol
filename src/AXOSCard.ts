import { InvestigateClient } from "./Connectivity"
import logger from "./logger"
import { CliResFormatMode } from "./ResultSplit"
import { LabPatroType, LabPatroResult, LabPatroAny, getAxosModuleHeader, AxosModuleHeaderChgMap} from "./LabPatrolPub"
import { getLocalIpv4Address, reverseIP} from "./NetUtil"
type OntOut = {
    [attr: string]: string,
}
export class AXOSCard {
    invesClient: InvestigateClient | undefined
    shellIpList:string[] = []

    async connect(ipAddr: string): Promise<number> {
        let rc = -1;
        this.invesClient = new InvestigateClient()
        this.invesClient.setPromptFormat('root@((\\S)+):~#', '#')
        rc = await this.invesClient.connect(ipAddr, 'root', 'root')
        if (rc != 0) {
            this.invesClient.setPromptFormat(`using ssh on (\\S+)`, '#')
            rc = await this.invesClient.connect(ipAddr, 'calixsupport', 'calixsupport')
            if (rc != 0) {
                return -1;
            }
        } else {
            let ipAddrList:string[] = []
            let sessionRes = await this.invesClient.sendCommand('who')
            if (!sessionRes || sessionRes === -1) {
                logger.error('AXOSCard who ' + ipAddr + 'no who ')   
            }else {
                let sessionSplit = sessionRes.split('\r\n')
                let matchReg = /\s+(\d+.\d+.\d+.\d+)/
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
        return 0
    }

    async disconnect() {
        this.invesClient?.disconnect();
    }

    filterSimOnt(ontInfo:OntOut):boolean {
        for (let key in ontInfo) {
            if (key === 'CLEI') {
                if (ontInfo[key].indexOf('SIM') != -1) {
                    return true
                }
            }
        }
        return false
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

    moduleMapChg( moduleOne:LabPatroAny) {
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

            let moduleRes = await this.invesClient.sendCommand('show interface ethernet module', 20000)
            if (!moduleRes || moduleRes === -1) {
                logger.error('AXOScard checkEtherModule ' + ipAddr + 'no result ')
                return []
            }

            this.invesClient.resultSplit.splitResult(moduleRes, CliResFormatMode.CliResFormatLine)
            let moduleOut = this.invesClient.resultSplit.getLineFormatOut()
            let moduleReslist:LabPatroAny[] =[]
            const headerList = getAxosModuleHeader()
            for (let ii = 0; ii < moduleOut.length; ii++) {
                if (moduleOut[ii].name.indexOf('interface') != -1) {
                    let moduleOne:LabPatroAny = {}
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

            let moduleRes = await this.invesClient.sendCommand('show interface pon module')
            if (!moduleRes || moduleRes === -1) {
                logger.error('AXOScard checkPonModule ' + ipAddr + 'no result ')
                return []
            }

            this.invesClient.resultSplit.splitResult(moduleRes, CliResFormatMode.CliResFormatLine)
            let moduleOut = this.invesClient.resultSplit.getLineFormatOut()
            let moduleReslist:LabPatroAny[] =[]
            const headerList = getAxosModuleHeader()
            for (let ii = 0; ii < moduleOut.length; ii++) {
                if (moduleOut[ii].name.indexOf('interface') != -1) {
                    let moduleOne:LabPatroAny = {}
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
            
            let ipAddrList:string[] = []
            ipAddrList.push(...this.shellIpList)
            let sessionRes = await this.invesClient.sendCommand('show user-sessions | include session-ip')
            if (!sessionRes || sessionRes === -1) {
                logger.error('E7card checkCard ' + ipAddr + 'no show session ')   
            }else {
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
                    }else {
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
        let moduleInfo:LabPatroAny[] = []
        rc = await axosCard.connect(ipAddr)
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

        let resInfo: LabPatroResult = {
            ontInfo: ontInfo,
            cardInfo: cardInfo,
            moduleInfo:moduleInfo
        }

        await axosCard.disconnect()
        return resInfo
    }
}

if (__filename === require.main?.filename) {
    (async () => {
        // await E7Card.checkCard('10.245.69.179')
        let res = await AXOSCard.doPatrolWork('10.245.36.55', LabPatroType.LabPatrolType_AXOSCard /* | LabPatroType.LabPatrolType_ONT |LabPatroType.LabPatrolType_Module */)
        if (res != -1) {
            let conRes = res as unknown as LabPatroResult
            console.log(JSON.stringify(conRes.cardInfo))
            console.log(JSON.stringify(conRes.ontInfo))
        }


        
    })()
}
