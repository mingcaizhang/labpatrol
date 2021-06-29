import {IpPrefixInfo, LabPatroType, LabPatroResult} from './LabPatrolPub'
import {E7Card} from "./E7Card"
import {AXOSCard} from "./AXOSCard"
import {AliveFind } from './Connectivity'
import logger from "./logger"


export type oneCardInfo = {
    [attr: string]: string;
  };
  
 export  interface cardResponse {
    platform: string;
    address: string;
    cardInfos: oneCardInfo[];
  }

export type commonInfo = {
    [attr: string]: string;
}

export interface ontResponse {
    platform: string;
    address: string;
    ontInfos: commonInfo[];  

}

export class BunchWork {
    ipRange:IpPrefixInfo|undefined = undefined;
    activeIpList:string[]=[];
    axosIpList:string[] = [];
    exaIpList:string[]=[];
    patrolType:number = 0;
    cardBunchRes:cardResponse[] =[]
    ontBunchRes:ontResponse[] =[]
    workerID:number = -1;
    excludeIps:string[] = []
    constructor() {

    }

    getCardBunchRes():cardResponse[] {
        return this.cardBunchRes;
    }

    getOntBunchRes():ontResponse[] {
        return this.ontBunchRes;
    }



    setupWork(ipRange:IpPrefixInfo, patrolType:number, workerID:number, excludeIps:string[]) {
    // TODO:　
        this.ipRange = ipRange;
        this.patrolType = patrolType;
        this.workerID = workerID;
        this.excludeIps = excludeIps;
    }

    async activeIpFetch() {
        let aliveFind = new AliveFind();
        let actList = await aliveFind.AliveDetect()
        if (this.ipRange) {
            aliveFind.addPrefix(this.ipRange.ipPrefix, 24, this.ipRange.start, this.ipRange.end);
            this.activeIpList = await aliveFind.AliveDetect();
            for (let ii = 0; ii < this.excludeIps.length; ii++) {
                let idx;
                idx = this.activeIpList.indexOf(this.excludeIps[ii])
                if (idx != -1) {
                    this.activeIpList.splice(idx, 1)
                }
            }
        }
    }

    async processAxosOntWork(ipList:string[]) {
        let promiseParal = []
        let promiseNum = 0
        let checkIpList = []
        let maxParal = 1
        let needIpList = []

        if (ipList.length === 0) {
            await this.activeIpFetch();
            needIpList = this.activeIpList;
        }else {
            needIpList = ipList;
        }

        this.exaIpList = []

        for (let jj = 0; jj < needIpList.length; jj++) {
            checkIpList.push(needIpList[jj])
            promiseParal.push(AXOSCard.doPatrolWork(needIpList[jj], LabPatroType.LabPatrolType_ONT))
            promiseNum++;
            if (promiseNum == maxParal) {
                logger.info(`processAxosWork: ${JSON.stringify(checkIpList)} begin`)
                let res = await Promise.all(promiseParal)
                // logger.info('paral done')
                logger.info(`processAxosWork: ${JSON.stringify(checkIpList)} ${JSON.stringify(res)}`)
                for (let zz = 0; zz< res.length; zz++) {
                    if (res[zz] === -1) {
                        continue;
                    }else {
                        let conRes:LabPatroResult = res[zz] as unknown as LabPatroResult
                        let ontRes:ontResponse  = {address: checkIpList[zz], platform:'exa',
                            ontInfos:conRes.ontInfo as unknown as commonInfo[]}
                        this.ontBunchRes.push(ontRes);
                        this.exaIpList.push(checkIpList[zz]);
                    }
                }               
                promiseNum = 0;
                promiseParal = []
                checkIpList = []
            }
        }

        if (promiseParal.length != 0) {
            let res = await Promise.all(promiseParal)
            for (let zz = 0; zz< res.length; zz++) {
                if (res[zz] === -1) {
                    continue;
                }else {
                    let ontRes:ontResponse  = {address: checkIpList[zz], platform:'exa',
                    ontInfos:res as unknown as commonInfo[]}
                    this.ontBunchRes.push(ontRes);
                    this.exaIpList.push(checkIpList[zz]);
                }
            }        
        }

    }
    async processAxosCardWork(ipList:string[]=[]) {
        let promiseParal = []
        let promiseNum = 0
        let checkIpList = []
        let needIpList = []
        let maxParal = 1

        if (ipList.length === 0) {
            await this.activeIpFetch();
            needIpList = this.activeIpList;
        }else {
            needIpList = ipList;
        }

        this.axosIpList = []

        for (let jj = 0; jj < needIpList.length; jj++) {
            checkIpList.push(needIpList[jj])
            promiseParal.push(AXOSCard.doPatrolWork(needIpList[jj], LabPatroType.LabPatrolType_AXOSCard))
            promiseNum++;
            if (promiseNum == maxParal) {
                let res = await Promise.all(promiseParal)
                // logger.info('paral done')
                logger.info(res)
                for (let zz = 0; zz< res.length; zz++) {
                    if (res[zz] === -1) {
                        continue;
                    }else {
                        let conRes:LabPatroResult = res[zz] as unknown as LabPatroResult
                        let cardRes:cardResponse  = {address: checkIpList[zz], platform:'axos',
                            cardInfos:conRes.cardInfo as unknown as oneCardInfo[]}
                        this.cardBunchRes.push(cardRes);
                        this.axosIpList.push(checkIpList[zz]);
                    }
                }               
                promiseNum = 0;
                promiseParal = []
                checkIpList = []
            }
        }

        if (promiseParal.length != 0) {
            let res = await Promise.all(promiseParal)
            for (let zz = 0; zz< res.length; zz++) {
                if (res[zz] === -1) {
                    continue;
                }else {
                    let cardRes:cardResponse  = {address: checkIpList[zz], platform:'axos',
                        cardInfos:res as unknown as oneCardInfo[]}
                    this.cardBunchRes.push(cardRes);

                }
            }        
        }
    }

    async processExaOntWork(ipList:string[]) {
        let promiseParal = []
        let promiseNum = 0
        let checkIpList = []
        let maxParal = 1
        let needIpList = []

        if (ipList.length === 0) {
            await this.activeIpFetch();
            needIpList = this.activeIpList;
        }else {
            needIpList = ipList;
        }

        this.exaIpList = []

        for (let jj = 0; jj < needIpList.length; jj++) {
            checkIpList.push(needIpList[jj])
            promiseParal.push(E7Card.doPatrolWork(needIpList[jj], LabPatroType.LabPatrolType_ONT))
            promiseNum++;
            if (promiseNum == maxParal) {
                logger.info(`processExaWork: ${JSON.stringify(checkIpList)} begin`)
                let res = await Promise.all(promiseParal)
                // logger.info('paral done')
                logger.info(`processExaWork: ${JSON.stringify(checkIpList)} ${JSON.stringify(res)}`)
                for (let zz = 0; zz< res.length; zz++) {
                    if (res[zz] === -1) {
                        continue;
                    }else {
                        let conRes:LabPatroResult = res[zz] as unknown as LabPatroResult
                        let ontRes:ontResponse  = {address: checkIpList[zz], platform:'exa',
                            ontInfos:conRes.ontInfo as unknown as commonInfo[]}
                        this.ontBunchRes.push(ontRes);
                        this.exaIpList.push(checkIpList[zz]);
                    }
                }               
                promiseNum = 0;
                promiseParal = []
                checkIpList = []
            }
        }

        if (promiseParal.length != 0) {
            let res = await Promise.all(promiseParal)
            for (let zz = 0; zz< res.length; zz++) {
                if (res[zz] === -1) {
                    continue;
                }else {
                    let conRes:LabPatroResult = res[zz] as unknown as LabPatroResult
                    let ontRes:ontResponse  = {address: checkIpList[zz], platform:'exa',
                        ontInfos:conRes.ontInfo as unknown as commonInfo[]}
                    this.ontBunchRes.push(ontRes);
                    this.exaIpList.push(checkIpList[zz]);
                }
            }        
        }

    }


    async processExaCardWork(ipList:string[]=[]) {
        let promiseParal = []
        let promiseNum = 0
        let checkIpList = []
        let maxParal = 1
        let needIpList = []

        if (ipList.length === 0) {
            await this.activeIpFetch();
            needIpList = this.activeIpList;
        }else {
            needIpList = ipList;
        }

        this.exaIpList = []

        for (let jj = 0; jj < needIpList.length; jj++) {
            checkIpList.push(needIpList[jj])
            promiseParal.push(E7Card.doPatrolWork(needIpList[jj], LabPatroType.LabPatrolType_E7Card))
            promiseNum++;
            if (promiseNum == maxParal) {
                logger.info(`processExaWork: ${JSON.stringify(checkIpList)} begin`)
                let res = await Promise.all(promiseParal)
                // logger.info('paral done')
                logger.info(`processExaWork: ${JSON.stringify(checkIpList)} ${JSON.stringify(res)}`)
                for (let zz = 0; zz< res.length; zz++) {
                    if (res[zz] === -1) {
                        continue;
                    }else {
                        let conRes:LabPatroResult = res[zz] as unknown as LabPatroResult
                        let cardRes:cardResponse  = {address: checkIpList[zz], platform:'exa',
                            cardInfos:conRes.cardInfo as unknown as oneCardInfo[]}
                        this.cardBunchRes.push(cardRes);
                        this.exaIpList.push(checkIpList[zz]);
                    }
                }               
                promiseNum = 0;
                promiseParal = []
                checkIpList = []
            }
        }

        if (promiseParal.length != 0) {
            let res = await Promise.all(promiseParal)
            for (let zz = 0; zz< res.length; zz++) {
                if (res[zz] === -1) {
                    continue;
                }else {
                    let cardRes:cardResponse  = {address: checkIpList[zz], platform:'exa',
                        cardInfos:res as unknown as oneCardInfo[]}
                    this.cardBunchRes.push(cardRes);
                    this.exaIpList.push(checkIpList[zz]);
                }
            }        
        }


    }

    async processAxosWork(ipList:string[]=[], type:number) {
        let promiseParal = []
        let promiseNum = 0
        let checkIpList = []
        let maxParal = 1
        let needIpList = []

        if (ipList.length === 0) {
            await this.activeIpFetch();
            needIpList = this.activeIpList;
        }else {
            needIpList = ipList;
        }

        this.axosIpList = []

        for (let jj = 0; jj < needIpList.length; jj++) {
            checkIpList.push(needIpList[jj])
            promiseParal.push(AXOSCard.doPatrolWork(needIpList[jj], type))
            promiseNum++;
            if (promiseNum == maxParal) {
                logger.info(`processAxosWork: ${JSON.stringify(checkIpList)} begin`)
                let res = await Promise.all(promiseParal)
                // logger.info('paral done')
                logger.info(`processAxosWork: ${JSON.stringify(checkIpList)} ${JSON.stringify(res)}`)
                for (let zz = 0; zz< res.length; zz++) {
                    if (res[zz] === -1) {
                        continue;
                    }else {
                        let conRes:LabPatroResult = res[zz] as unknown as LabPatroResult
                        let cardRes:cardResponse  = {address: checkIpList[zz], platform:'axos',
                            cardInfos:conRes.cardInfo as unknown as oneCardInfo[]}
                        this.cardBunchRes.push(cardRes);
                        let ontRes:ontResponse =  {address: checkIpList[zz], platform:'axos',
                            ontInfos:conRes.ontInfo as unknown as commonInfo[]}
                        this.ontBunchRes.push(ontRes)
                        this.axosIpList.push(checkIpList[zz]);
                    }
                }               
                promiseNum = 0;
                promiseParal = []
                checkIpList = []
            }
        }

        if (promiseParal.length != 0) {
            let res = await Promise.all(promiseParal)
            for (let zz = 0; zz< res.length; zz++) {
                if (res[zz] === -1) {
                    continue;
                }else {
                    let conRes:LabPatroResult = res[zz] as unknown as LabPatroResult
                    let cardRes:cardResponse  = {address: checkIpList[zz], platform:'axos',
                        cardInfos:conRes.cardInfo as unknown as oneCardInfo[]}
                    this.cardBunchRes.push(cardRes);
                    this.axosIpList.push(checkIpList[zz]);

                }
            }        
        }

        
    }

    async processExaWork(ipList:string[]=[], type:number) {
        let promiseParal = []
        let promiseNum = 0
        let checkIpList = []
        let maxParal = 1
        let needIpList = []

        if (ipList.length === 0) {
            await this.activeIpFetch();
            needIpList = this.activeIpList;
        }else {
            needIpList = ipList;
        }

        this.exaIpList = []

        for (let jj = 0; jj < needIpList.length; jj++) {
            checkIpList.push(needIpList[jj])
            promiseParal.push(E7Card.doPatrolWork(needIpList[jj], type))
            promiseNum++;
            if (promiseNum == maxParal) {
                logger.info(`processExaWork: ${JSON.stringify(checkIpList)} begin`)
                let res = await Promise.all(promiseParal)
                // logger.info('paral done')
                logger.info(`processExaWork: ${JSON.stringify(checkIpList)} ${JSON.stringify(res)}`)
                for (let zz = 0; zz< res.length; zz++) {
                    if (res[zz] === -1) {
                        continue;
                    }else {
                        let conRes:LabPatroResult = res[zz] as unknown as LabPatroResult
                        let cardRes:cardResponse  = {address: checkIpList[zz], platform:'exa',
                            cardInfos:conRes.cardInfo as unknown as oneCardInfo[]}
                        this.cardBunchRes.push(cardRes);
                        let ontRes:ontResponse =  {address: checkIpList[zz], platform:'exa',
                            ontInfos:conRes.ontInfo as unknown as commonInfo[]}
                        this.ontBunchRes.push(ontRes)
                        this.exaIpList.push(checkIpList[zz]);
                    }
                }               
                promiseNum = 0;
                promiseParal = []
                checkIpList = []
            }
        }

        if (promiseParal.length != 0) {
            let res = await Promise.all(promiseParal)
            for (let zz = 0; zz< res.length; zz++) {
                if (res[zz] === -1) {
                    continue;
                }else {
                    let conRes:LabPatroResult = res[zz] as unknown as LabPatroResult
                    let cardRes:cardResponse  = {address: checkIpList[zz], platform:'exa',
                        cardInfos:conRes.cardInfo as unknown as oneCardInfo[]}
                    this.cardBunchRes.push(cardRes);
                    this.exaIpList.push(checkIpList[zz]);

                }
            }        
        }

        
    }
    async processWork() {
        let ipList:string[] = []
        this.cardBunchRes = []
        this.ontBunchRes = []
        await this.processAxosWork(ipList, LabPatroType.LabPatrolType_AXOSCard |LabPatroType.LabPatrolType_ONT);
        for (let ii = 0; ii < this.activeIpList.length; ii++) {
            if (this.axosIpList.indexOf(this.activeIpList[ii]) === -1) {
                ipList.push(this.activeIpList[ii])
            } 
        }
        await this.processExaWork(ipList, LabPatroType.LabPatrolType_E7Card |LabPatroType.LabPatrolType_ONT);
        logger.info('workerID ' + this.workerID + ' handle subnet '+ this.ipRange?.ipPrefix + ' done')       
    }


}