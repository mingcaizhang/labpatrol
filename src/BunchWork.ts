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

export interface moduleResponse {
    platform: string;
    address: string;
    moduleInfos: commonInfo[];
}

export class BunchWork {
    ipRange:IpPrefixInfo|undefined = undefined;
    activeIpList:string[]=[];
    axosIpList:string[] = [];
    exaIpList:string[]=[];
    patrolType:number = 0;
    cardBunchRes:cardResponse[] =[]
    ontBunchRes:ontResponse[] =[]
    moduleBunchRes:moduleResponse[] = []
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

    getModuleBunchRes():moduleResponse[] {
        return this.moduleBunchRes;
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
                        let moduleRes:moduleResponse =  {address: checkIpList[zz], platform:'axos',
                        moduleInfos:conRes.moduleInfo as unknown as commonInfo[]}
                        this.moduleBunchRes.push(moduleRes)
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
                        let moduleRes:moduleResponse =  {address: checkIpList[zz], platform:'exa',
                        moduleInfos:conRes.moduleInfo as unknown as commonInfo[]}
                        this.moduleBunchRes.push(moduleRes)
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
        this.moduleBunchRes = []

        let matchStr = /\d+.\d+.\d+.(\d+)/
        // check if has subnet excludes 
        for (let ii = 0; ii < this.excludeIps.length; ii++) {
            let matchRes = matchStr.exec(this.excludeIps[ii])
            // this is a subnet match has format 'xx.xx.xx.0'
            if (matchRes && matchRes[1] && matchRes[1] === '0') {
                let subStr = this.excludeIps[ii].substr(0, this.excludeIps[ii].length -2)
                // subnet same , return directly
                if (this.ipRange?.ipPrefix.indexOf(subStr) != -1) {
                    logger.info(`ip prefix ${this.ipRange?.ipPrefix} match excluds`)
                    return 
                }

            }

        }

        await this.processAxosWork(ipList, LabPatroType.LabPatrolType_AXOSCard |LabPatroType.LabPatrolType_ONT| LabPatroType.LabPatrolType_Module)
        for (let ii = 0; ii < this.activeIpList.length; ii++) {
            if (this.axosIpList.indexOf(this.activeIpList[ii]) === -1) {
                ipList.push(this.activeIpList[ii])
            } 
        }
        await this.processExaWork(ipList, LabPatroType.LabPatrolType_E7Card |LabPatroType.LabPatrolType_ONT | LabPatroType.LabPatrolType_Module);
        logger.info('workerID ' + this.workerID + ' handle subnet '+ this.ipRange?.ipPrefix + ' done')       
    }


}

if (__filename === require.main?.filename) {
    (async () => {
        // await E7Card.checkCard('10.245.69.179')
        let bunchWork = new BunchWork()
        let ipPrefix:IpPrefixInfo = {
            ipPrefix: '10.245.6',
            subLenth:24,
            start: 1,
            end: 2     
        }
        let excludeIps = ["10.245.29.180",
        "10.245.29.190",
        "10.245.30.184",
        "10.245.29.194",
        "10.245.106.67",
        "10.245.106.76",
        "10.245.106.66",
        "10.245.29.210",
        "10.245.29.196",
        "10.245.29.181",
        "10.245.29.182",
        "10.245.29.192",
        "10.245.29.183",
        "10.245.30.185",
        "10.245.66.0",
        "10.245.110.0",
        "10.245.111.0"]
        bunchWork.setupWork(ipPrefix, LabPatroType.LabPatrolType_AXOSCard, 1, excludeIps)
        await bunchWork.processWork()
    })()
}