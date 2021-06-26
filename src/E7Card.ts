import { TelnetClient } from "./Connectivity"
import logger from "./logger"
import { CliResFormatMode } from "./ResultSplit"
import { LabPatroResult, LabPatroAny, LabPatroType } from "./LabPatrolPub"
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
                if (Object.keys(ontCombine).length > 0) {
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

            // invesClient.resultSplit.setOutput(cardResult)
            this.invesClient.resultSplit.splitResult(cardResult, CliResFormatMode.CliResFormatTableWithSeparator)
            let showCardRes = this.invesClient.resultSplit.getTableFormatOut()
            let cardInfos: CardCombineOut[] = []
            logger.info(showCardRes)
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
            logger.info(cardInfos)
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

        let resInfo: LabPatroResult = {
            ontInfo: ontInfo,
            cardInfo: cardInfo
        }

        return resInfo;
    }

}


if (__filename === require.main?.filename) {
    (async () => {
        // await E7Card.checkCard('10.245.69.179')
        let res = await E7Card.doPatrolWork('10.245.24.101', LabPatroType.LabPatrolType_E7Card | LabPatroType.LabPatrolType_ONT)
        if (res != -1) {
            let conRes = res as unknown as LabPatroResult
            console.log(JSON.stringify(conRes.cardInfo))
            console.log(JSON.stringify(conRes.ontInfo))
        }
    })()
}
