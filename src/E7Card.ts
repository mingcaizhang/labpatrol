import { TelnetClient } from "./Connectivity"
import logger from "./logger"
import { CliResFormatMode } from "./ResultSplit"
import { LabPatroResult, LabPatroAny, LabPatroType, getExaModuleHeader} from "./LabPatrolPub"
import { getLocalIpv4Address, reverseIP} from "./NetUtil"
type OntOut = {
    [attr: string]: string,
}
export class E7Card {
    invesClient: TelnetClient | undefined;
    constructor() {

    }

    async connect(ipAddr: string): Promise<number> {
        this.invesClient = new TelnetClient()
        this.invesClient.setPromptFormat('"((\\S)+)" (\\S){3}', '>')
        let rc = await this.invesClient.connect(ipAddr, 'e7support', 'admin')
        if (rc != 0) {
            this.invesClient.disconnect();
            return -1;
        }
        return 0
    }

    async disconnect() {
        this.invesClient?.disconnect();
    }

    filterSimOnt(ontInfo:OntOut):boolean {
        for (let key in ontInfo) {
            if (key === 'CLEI') {
                if (ontInfo[key].indexOf('Calix SimO') != -1) {
                    return true
                }
            }
        }
        return false
    }    

    async checkDiscoverOnt(ipAddr: string): Promise<number | any[]> {
        let rc = -1
        type OntOut = {
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
            let result = await this.invesClient.sendCommand('set session pager disabled')
            result = await this.invesClient.sendCommand('show ont discovered detail')
            if (!result || result === -1) {
                logger.error('E7card checkDiscoverOnt ' + ipAddr + 'no discovered ont ')
                return []
            }
            this.invesClient.resultSplit.splitResult(result, CliResFormatMode.CliResFormatLineExaWithColon)
    
            let disOntRes = this.invesClient.resultSplit.getLineFormatOut()
            // console.log(disOntRes[0])
            let ontList = []
            for (let ii = 0; ii < disOntRes.length; ii++) {
                let ontCombine: OntOut = {}
                for (let jj = 0; jj < disOntRes[ii].childs.length; jj++) {
                    if (disOntRes[ii].childs[jj].value != '') {
                        ontCombine[disOntRes[ii].childs[jj].name] = disOntRes[ii].childs[jj].value
                    }
                }
                if (Object.keys(ontCombine).length > 0 && !this.filterSimOnt(ontCombine)) {
                    ontList.push(ontCombine)
                }
            }
            // (JSON.stringify(ontList))
            return ontList
        }catch (e) {
            logger.error(e)
            return []
        }

    }
    async checkEtherModule(ipAddr: string): Promise<number | any[]> {
        let rc = -1

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
            let result = await this.invesClient.sendCommand('set session pager disabled')
            result = await this.invesClient.sendCommand('show eth-port detail')
            if (!result || result === -1) {
                logger.error('E7card checkEtherModule ' + ipAddr + 'no eth-port ')
                return []
            }
            this.invesClient.resultSplit.splitResult(result, CliResFormatMode.CliResFormatLineExaWithColon)
    
            let ponPortRes = this.invesClient.resultSplit.getLineFormatOut()
            // console.log(disOntRes[0])
            let ponModuleList = []
            let headerList = getExaModuleHeader()
            let matchReg = /[g|x]\d/
            for (let ii = 0; ii < ponPortRes.length; ii++) {
                let ponModule: LabPatroAny = {}

                if (ponPortRes[ii] && ponPortRes[ii].childs[0] && matchReg.exec( ponPortRes[ii].childs[0].name)) {

                    for (let jj = 1; jj < ponPortRes[ii].childs.length; jj++) {
                        if (headerList.indexOf(ponPortRes[ii].childs[jj].name) != -1) {
                            ponModule[ponPortRes[ii].childs[jj].name] = ponPortRes[ii].childs[jj].value
                        }
                    }
                    if (Object.keys(ponModule).length > 0) {
                        ponModule['portPosition'] = ponPortRes[ii].childs[0].name
                    }
                    
                }
                if (Object.keys(ponModule).length > 1) {
                    ponModuleList.push(ponModule)
                }
            
            }
            // logger.info(JSON.stringify(ponModuleList))
            return ponModuleList
        }catch (e) {
            logger.error(e)
            return []
        }

    }

    
    async checkPonModule(ipAddr: string): Promise<number | any[]> {
        let rc = -1

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
            let result = await this.invesClient.sendCommand('set session pager disabled')
            result = await this.invesClient.sendCommand('show gpon-port detail')
            if (!result || result === -1) {
                logger.error('E7card checkPonModule ' + ipAddr + 'no gpon-port ')
                return []
            }
            this.invesClient.resultSplit.splitResult(result, CliResFormatMode.CliResFormatLineExaWithColon)
    
            let ponPortRes = this.invesClient.resultSplit.getLineFormatOut()
            // console.log(disOntRes[0])
            let ponModuleList = []
            const headerList = getExaModuleHeader()
            for (let ii = 0; ii < ponPortRes.length; ii++) {
                let ponModule: LabPatroAny = {}
                
                if (ponPortRes[ii] && ponPortRes[ii].childs[0] && ponPortRes[ii].childs[0].name.indexOf('GPON port') !=-1) {
                    ponModule['portPosition'] = ponPortRes[ii].childs[0].name.replace('GPON port', '')
                    for (let jj = 1; jj < ponPortRes[ii].childs.length; jj++) {
                        if (headerList.indexOf(ponPortRes[ii].childs[jj].name) != -1) {
                            ponModule[ponPortRes[ii].childs[jj].name] = ponPortRes[ii].childs[jj].value
                        }
                        
                    }
                }
                if (Object.keys(ponModule).length > 1) {
                    ponModuleList.push(ponModule)
                }
                
            }
            // logger.info(JSON.stringify(ponModuleList))
            // (JSON.stringify(ontList))
            return ponModuleList
        }catch (e) {
            logger.error(e)
            return []
        }

    }

    async checkCard(ipAddr: string): Promise<number | any[]> {
        let rc = -1
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
            let cardResult = await this.invesClient.sendCommand('show card')
            if (!cardResult || cardResult === -1) {
                logger.error('E7card checkCard ' + ipAddr + 'no show card ')
                return []
            }
            // invesClient.resultSplit.setOutput(cardResult)
            this.invesClient.resultSplit.splitResult(cardResult, CliResFormatMode.CliResFormatTableWithSeparator)
            let showCardRes = this.invesClient.resultSplit.getTableFormatOut()
            let cardInfos: CardCombineOut[] = []
            // logger.info(showCardRes)
            for (let ii = 0; ii < showCardRes.length; ii++) {
                let cardOut: CardCombineOut = {
                    cardPosition: ''
                }
                for (let jj = 0; jj < showCardRes[ii].childs.length; jj++) {
                    if (showCardRes[ii].childs[jj].name === 'Card') {
                        cardOut.cardPosition = showCardRes[ii].childs[jj].value
                    } else {
                        cardOut[showCardRes[ii].childs[jj].name] = showCardRes[ii].childs[jj].value
                    }
                }
                cardInfos.push(cardOut)
            }


            let showVerRes = await this.invesClient.sendCommand('show version')
            if (!showVerRes || showVerRes === -1) {
                logger.error('E7card checkCard ' + ipAddr + 'no show version ')
                return []
            }            
            this.invesClient.resultSplit.splitResult(showVerRes, CliResFormatMode.CliResFormatTableWithSeparator)
            let verResOut = this.invesClient.resultSplit.getTableFormatOut()


            for (let ii = 0; ii < verResOut.length; ii++) {
                let matchCardName = ''
                let matchIdx = -1;
                for (let jj = 0; jj < verResOut[ii].childs.length; jj++) {
                    if (verResOut[ii].childs[jj].name == 'Card') {
                        matchCardName = verResOut[ii].childs[jj].value
                        break;
                    }
                }

                for (let jj = 0; jj < cardInfos.length; jj++) {
                    if (cardInfos[jj].cardPosition == matchCardName) {
                        for (let kk = 0; kk < verResOut[ii].childs.length; kk++) {
                            cardInfos[jj][verResOut[ii].childs[kk].name] = verResOut[ii].childs[kk].value
                        }
                    }
                }
            }

            let sessionRes = await this.invesClient.sendCommand('show session')
            let sessionInfos:LabPatroAny[] = []
            if (!sessionRes || sessionRes === -1) {
                logger.error('E7card checkCard ' + ipAddr + 'no show session ')    
            }else {
                this.invesClient.resultSplit.splitResult(sessionRes, CliResFormatMode.CliResFormatTableWithSeparator, 0)
                let sessionOut = this.invesClient.resultSplit.getTableFormatOut()
               
                for (let ii = 0; ii <sessionOut.length; ii++) {
                    let sessOne:LabPatroAny = {}
                    for (let kk = 0; kk < sessionOut[ii].childs.length; kk++) {
                        sessOne[sessionOut[ii].childs[kk].name] = sessionOut[ii].childs[kk].value
                    }
                    sessionInfos.push(sessOne)
                }
            }  
            let ipAddrList:string[] = []
            let mathchReg = /from (\d+.\d+.\d+.\d+)/
            for (let ii = 0; ii < sessionInfos.length; ii++) {
                let matchRes = mathchReg.exec(sessionInfos[ii]['Login'])
                if (matchRes && matchRes[1] && ipAddrList.indexOf(matchRes[1]) === -1) {
                    ipAddrList.push(matchRes[1])
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

            // ogger.info(cardInfos)
            return cardInfos;

        } catch (e) {
            logger.error(e)
            return []
        }
        
    }

    static async doPatrolWork(ipAddr: string, patrolType: number): Promise<number | LabPatroResult> {
        let rc = -1
        let e7Card = new E7Card()
        let cardInfo
        let ontInfo
        let moduleInfo:LabPatroAny[]=[]
        rc = await e7Card.connect(ipAddr)
        if (rc != 0) {
            return -1;
        }

        if (patrolType & LabPatroType.LabPatrolType_E7Card) {
            let ret = await e7Card.checkCard(ipAddr)
            if (ret != -1) {
                cardInfo = ret as unknown as LabPatroAny[]
            }
        }

        if (patrolType & LabPatroType.LabPatrolType_ONT) {
            let ret = await e7Card.checkDiscoverOnt(ipAddr)
            if (ret != -1) {
                ontInfo = ret as unknown as LabPatroAny[]
            }
        }

        if (patrolType & LabPatroType.LabPatrolType_Module) {
            let ret = await e7Card.checkPonModule(ipAddr)
            if (ret != -1) {
                moduleInfo = ret as unknown as LabPatroAny[]
            }

            ret = await e7Card.checkEtherModule(ipAddr)
            if (ret != -1) {
                moduleInfo.push(...(ret as unknown as LabPatroAny[]))
            }
        }

        let resInfo: LabPatroResult = {
            ontInfo: ontInfo,
            cardInfo: cardInfo,
            moduleInfo: moduleInfo,
            lldpInfo:[]
        }
        await e7Card.disconnect()
        return resInfo;
    }

    static async executeCommands(ipAddr: string, cmdList:string[]): Promise<number | any[]> {
        let rc = -1
        let exaCard = new E7Card()
        rc = await exaCard.connect(ipAddr)
        if (rc != 0) {
            return -1;
        }

        if (exaCard.invesClient === undefined) {
            return -1
        }
        let cmdResults = []
        await exaCard.invesClient.sendCommand('set session pager disabled')

        for (let ii = 0; ii < cmdList.length; ii++) {
            let res = await exaCard.invesClient.sendCommand(cmdList[ii])
            cmdResults.push(res)
        }

        await exaCard.invesClient.disconnect()
        return cmdResults
    }

}


if (__filename === require.main?.filename) {
    (async () => {
        // await E7Card.checkCard('10.245.69.179')
        let res = await E7Card.doPatrolWork('10.245.12.100', LabPatroType.LabPatrolType_E7Card /* | LabPatroType.LabPatrolType_ONT |LabPatroType.LabPatrolType_Module */)
        if (res != -1) {
            let conRes = res as unknown as LabPatroResult
            console.log(JSON.stringify(conRes.cardInfo))
            console.log(JSON.stringify(conRes.ontInfo))
        }
    })()
}
