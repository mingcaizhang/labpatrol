import * as cluster from 'cluster'
import { Worker } from 'cluster';
import * as events from 'events'
import { BunchWork, cardResponse, ontResponse, moduleResponse} from "./BunchWork"
import { IpPrefixInfo, LabPatroType, sleepSecond, DBType } from './LabPatrolPub'
import logger from './logger';
import Vorpal = require('vorpal');
// var Vorpal = require("vantage")();
import {DataStore, TableSchema} from './DataStore'

logger.setLogLevel('std', 'error')
logger.setLogLevel('file', 'info')
logger.closeStdout()

interface WorkInfo {
    worker: Worker,
    hasTask:boolean,
    handleIp:IpPrefixInfo|undefined
}

enum MessageID {
    MSG_AXOSCARD_PATROL_REQ = 1,
    MSG_EXACARD_PATROL_REQ = 2,
    MSG_PATROL_REQ = 3,
    MSG_CARD_PATROL_RPL = 4,
    MSG_ONT_PATROL_RPL = 5,
    MSG_MODULE_PATROL_RPL = 6,


};



enum PatroType {
    PatrolType_Card = 0x1,
    PatrolType_Ont = 0x2,
    PatrolType_Module = 0x4,
}

interface DBTableDesc {


}
interface PatrolReqInfo {
    reqType: number;
    ipRange: string;
}

interface UsedDBTableName {
    axosCardTableName:string,
    axosOntTableName:string,
    exaCardTableName:string,
    exaOntTableName:string,
    axosModuleTableName:string,
    exaModuleTableName:string
}

class MessageInfo {
    cmd: number;
    content: any;
    excludeIps:string[] =[]
    constructor() {
        this.cmd = 0
        this.content = undefined
    }
}

class ClusterWork {
    workerList: WorkInfo[] = [];
    emitter: events.EventEmitter | undefined = undefined
    ipL1: number = -1;
    ipL2: number = -1;
    ipRange: IpPrefixInfo | undefined;
    cardResponseList: cardResponse[] = []
    ontResponseList:ontResponse[] = []
    moduleResponseList:moduleResponse[] = []
    currTableNamePrefix:string=''
    cardFilterCol: string[] = ['cardPosition',
        'CARD STATE',
        'MODEL',
        'SERIAL NO',
        'details']
    dataStore:DataStore|undefined = undefined;
    currDesctableName = 'tbCurrDesc'
    availableDescTableName = 'tbAvailableDesc'
    axosCardTableName =''
    axosOntTableName = ''
    exaCardTableName = ''
    exaOntTableName= ''
    axosModuleTableName =  ''
    exaModuleTableName = ''
    axosCardTableColumn:string[] = []
    axosOntTableColumn:string[] = []
    exaCardTableColumn:string[] =[]
    exaOntTableColumn:string[]= []
    axosModuleColumn:string[] = []
    exaModuleColumn:string[]=[]
    hisDBName:UsedDBTableName[] =[]
    excludeIps:string[]= []
    sleepTimeforNext:number = 7200 // 7200 seconds
    constructor() {

    }

    showState(vorpal: Vorpal) {
       for (let ii = 0; ii < this.workerList.length; ii++) {
            vorpal.log(`work ID: ${ii+1} hasTask: ${this.workerList[ii].hasTask} hanleIP: ${this.workerList[ii].handleIp?.ipPrefix}`)
        }

        vorpal.log(`axosCardTableName:${this.axosCardTableName} axosOntTableName:${this.axosOntTableName}`)
        vorpal.log(`exaCardTableName:${this.exaCardTableName} exaOntTableName:${this.exaOntTableName}`)
        
        vorpal.log('\r\naxosCardTableSchema:')
        vorpal.log(JSON.stringify(this.axosCardTableColumn))
        vorpal.log('\r\naxosOntTableSchema:')
        vorpal.log(JSON.stringify(this.axosOntTableColumn))
        vorpal.log('\r\nexaCardTableSchema:')
        vorpal.log(JSON.stringify(this.exaCardTableColumn))
        vorpal.log('\r\nexaOntTableSchema:')
        vorpal.log(JSON.stringify(this.exaOntTableColumn))        
        vorpal.log('\r\nexaModuleTableSchema:')
        vorpal.log(JSON.stringify(this.exaModuleTableName))              
        vorpal.log('\r\naxosModuleTableSchema:')
        vorpal.log(JSON.stringify(this.axosModuleTableName))              

        vorpal.log('history record:')
        vorpal.log(JSON.stringify(this.hisDBName))
        
    }



    showCardResult(vorpal: Vorpal, filter: string) {
        vorpal.log('total system ' + this.cardResponseList.length)
        if (filter === 'all') {
            for (let ii = 0; ii < this.cardResponseList.length; ii++) {
                for (let jj = 0; jj < this.cardResponseList[ii].cardInfos.length; jj++) {
                    let outputLine = `IP ${this.cardResponseList[ii].address} platform ${this.cardResponseList[ii].platform}`
                    outputLine +=  JSON.stringify(this.cardResponseList[ii].cardInfos[jj])
                    vorpal.log(outputLine)
    
                }
            }
        }else if (filter === 'brief'){
            for (let ii = 0; ii < this.cardResponseList.length; ii++) {
                for (let jj = 0; jj < this.cardResponseList[ii].cardInfos.length; jj++) {
                    let outputLine = `IP ${this.cardResponseList[ii].address} platform ${this.cardResponseList[ii].platform}`
                    for (let key in this.cardResponseList[ii].cardInfos[jj]) {
                        if (this.cardFilterCol.indexOf(key) != -1) {
                            outputLine += key + ':' +   this.cardResponseList[ii].cardInfos[jj][key] + ' '
                        }
                    }
                    vorpal.log(outputLine)
                }
            }      
        }else if (filter === 'count') {
            let totalCard = 0;
            for (let ii = 0; ii < this.cardResponseList.length; ii++) {
                for (let jj = 0; jj < this.cardResponseList[ii].cardInfos.length; jj++) {
                    totalCard++;
                }
            }  
            vorpal.log('total card '+ totalCard)

        }

    }

    showCardCount(vorpal: Vorpal) {
        vorpal.log('total card ' + this.cardResponseList.length)
    }

    showOntResult(vorpal: Vorpal, filter: string) {
        if (filter === 'all') {
            for (let ii = 0; ii < this.ontResponseList.length; ii++) {
                for (let jj = 0; jj < this.ontResponseList[ii].ontInfos.length; jj++) {
                    let outputLine = `IP ${this.ontResponseList[ii].address} platform ${this.ontResponseList[ii].platform}`
                    outputLine +=  JSON.stringify(this.ontResponseList[ii].ontInfos[jj])
                    vorpal.log(outputLine)
    
                }
            }
        }else if (filter === 'brief'){
            for (let ii = 0; ii < this.ontResponseList.length; ii++) {
                for (let jj = 0; jj < this.ontResponseList[ii].ontInfos.length; jj++) {
                    let outputLine = `IP ${this.ontResponseList[ii].address} platform ${this.ontResponseList[ii].platform}`
                    for (let key in this.ontResponseList[ii].ontInfos[jj]) {
                        if (this.cardFilterCol.indexOf(key) != -1) {
                            outputLine += key + ':' +   this.ontResponseList[ii].ontInfos[jj][key] + ' '
                        }
                    }
                    vorpal.log(outputLine)
                }
            }      
        }else if (filter === 'count') {
            let totalOnt = 0;
            for (let ii = 0; ii < this.ontResponseList.length; ii++) {
                for (let jj = 0; jj < this.ontResponseList[ii].ontInfos.length; jj++) {
                    totalOnt++;
                }
            }  
            vorpal.log('total card '+ totalOnt)

        }

    }

    showModuleResult(vorpal: Vorpal, filter: string) {
        if (filter === 'all') {
            for (let ii = 0; ii < this.moduleResponseList.length; ii++) {
                for (let jj = 0; jj < this.moduleResponseList[ii].moduleInfos.length; jj++) {
                    let outputLine = `IP ${this.moduleResponseList[ii].address} platform ${this.moduleResponseList[ii].platform}`
                    outputLine +=  JSON.stringify(this.moduleResponseList[ii].moduleInfos[jj])
                    vorpal.log(outputLine)
    
                }
            }
        }else if (filter === 'brief'){
            for (let ii = 0; ii < this.moduleResponseList.length; ii++) {
                for (let jj = 0; jj < this.moduleResponseList[ii].moduleInfos.length; jj++) {
                    let outputLine = `IP ${this.moduleResponseList[ii].address} platform ${this.moduleResponseList[ii].platform}`
                    for (let key in this.moduleResponseList[ii].moduleInfos[jj]) {
                        if (this.cardFilterCol.indexOf(key) != -1) {
                            outputLine += key + ':' +   this.moduleResponseList[ii].moduleInfos[jj][key] + ' '
                        }
                    }
                    vorpal.log(outputLine)
                }
            }      
        }else if (filter === 'count') {
            let totalModule = 0;
            for (let ii = 0; ii < this.moduleResponseList.length; ii++) {
                for (let jj = 0; jj < this.moduleResponseList[ii].moduleInfos.length; jj++) {
                    totalModule++;
                }
            }  
            vorpal.log('total module '+ totalModule)

        }

    }

    showOntCount(vorpal: Vorpal) {
        let totalOnt = 0;
        for (let ii = 0; ii < this.ontResponseList.length; ii++) {
            for (let jj = 0; jj < this.ontResponseList[ii].ontInfos.length; jj++) {
                totalOnt++;
            }
        }          
        vorpal.log('total ont ' + totalOnt)
    }

    async showCardDBRecord(dbType:DBType, vorpal:Vorpal, filter:string) {
        let records = await this.getDbRecord(dbType, true);
        if (filter === 'all') {
            for (let ii = 0; ii < records.length; ii++) {
                vorpal.log(JSON.stringify(records[ii]))
            }           
        }else if (filter === 'brief') {
            for (let ii = 0; ii < records.length; ii++) {
                let outputLine = ''
                for (let key in records[ii]) {
                    if (key in this.cardFilterCol) {
                        outputLine += key + ':' +   this.cardResponseList[ii].cardInfos[ii][key] + ' '
                    }
                } 
                vorpal.log(outputLine)
            }          

        }else if (filter === 'count') {
            vorpal.log('total card ' + records.length)
        }
    }

    async showOntDBRecord(dbType:DBType, vorpal:Vorpal, filter:string) {
        let records = await this.getDbRecord(dbType, true);
        if (filter === 'all') {
            for (let ii = 0; ii < records.length; ii++) {
                vorpal.log(JSON.stringify(records[ii]))
            }           
        }else if (filter === 'brief') {
            for (let ii = 0; ii < records.length; ii++) {
                let outputLine = ''
                for (let key in records[ii]) {
                    if (key in this.cardFilterCol) {
                        outputLine += key + ':' +   this.cardResponseList[ii].cardInfos[ii][key] + ' '
                    }
                } 
                vorpal.log(outputLine)
            }          

        }else if (filter === 'count') {
            vorpal.log('total card ' + records.length)
        }
    }

    async showModuleDBRecord(dbType:DBType, vorpal:Vorpal, filter:string) {
        let records = await this.getDbRecord(dbType, true);
        if (filter === 'all') {
            for (let ii = 0; ii < records.length; ii++) {
                vorpal.log(JSON.stringify(records[ii]))
            }           
        }else if (filter === 'brief') {
            for (let ii = 0; ii < records.length; ii++) {
                let outputLine = ''
                for (let key in records[ii]) {         
                    outputLine += key + ':' +   records[ii][key]
                } 
                vorpal.log(outputLine)
            }          

        }else if (filter === 'count') {
            vorpal.log('total card ' + records.length)
        }
    }

    getNextIpRange(): IpPrefixInfo | undefined {
        if (this.ipRange) {
            if (this.ipRange?.subLenth == 24) {
                if (this.ipL1 === 255) {
                    return undefined;
                } else {
                    this.ipL1 = 255;
                    return {
                        ipPrefix: this.ipRange.ipPrefix,
                        subLenth: 24,
                        start: 1,
                        end: 255,
                    };
                }
            } else if (this.ipRange.subLenth === 16) {
                if (this.ipL1 > this.ipRange.end) {
                    return undefined;
                } else {
                    let ipSub = this.ipL1;
                    this.ipL1++;
                    return {
                        ipPrefix: this.ipRange.ipPrefix + '.' + ipSub,
                        subLenth: 24,
                        start: 1,
                        end: 255,
                    };

                }
            } else {
                return undefined
            }
        } else {
            return undefined
        }


    }

    async initMaster() {
        this.dataStore = new DataStore()
        await this.dataStore.createDb('./labpatrol.db')

    }

    async getDbRecord(dbType:DBType, current:boolean = true):Promise<TableSchema[]> {
        let tableNameList:string[] = []
        let output:TableSchema[] = []
        if(current) {
            if (this.currTableNamePrefix === ''){
                return [];
            }
            if (dbType === DBType.DBType_AXOS_CARD) {
                tableNameList.push('axoscard' + this.currTableNamePrefix)
            }else if (dbType === DBType.DBType_EXA_CARD) {
                tableNameList.push('exacard' + this.currTableNamePrefix )
            }else if (dbType === DBType.DBType_AXOS_ONT) {
                tableNameList.push('axosont' + this.currTableNamePrefix )
            }else if (dbType === DBType.DBType_EXA_ONT) {
                tableNameList.push('exaont' + this.currTableNamePrefix )
            }else if (dbType === DBType.DBType_AXOS_MODULE) {
                tableNameList.push('axosmodule' + this.currTableNamePrefix )
            }else if (dbType === DBType.DBType_EXA_MODULE){
                tableNameList.push('examodule' + this.currTableNamePrefix )
            }
        }else {
            if (dbType === DBType.DBType_AXOS_CARD) {

            }else if (dbType === DBType.DBType_EXA_CARD) {

            }
        }

        for (let ii = 0; ii < tableNameList.length; ii++) {
            let ret = await this.dataStore?.queryAll(tableNameList[ii])
            if (ret) {
                output.push(...ret as TableSchema[])
            }   
        }

        return output;

    }

    async addCardDbRecord(cardRes:cardResponse) {
        if (this.currTableNamePrefix === '') {
            let dataStr = Date()
            //Thu Jun 24 2021 12:36:21 GMT+0800 (GMT+08:00)
            let regExStr =  /(?:\w+) (\w+) (\d+) (\d+) (\d+):(\d+):(\d+)/
            let searchRes = regExStr.exec(dataStr)
            if (searchRes) {
                this.currTableNamePrefix = '' + searchRes[3] + searchRes[1] + searchRes[2] + searchRes[4] + searchRes[5]
            }else {
                logger.error('addCardDbRecord: invalid dataStr')
                this.currTableNamePrefix =  new Date().getTime().toString()
            }
            
            
        }
        let tableName=  ''
        if (cardRes.platform === 'axos') {
            tableName = 'axoscard'+ this.currTableNamePrefix;
            this.axosCardTableName = tableName

        }else if (cardRes.platform === 'exa') {
            tableName = 'exacard' + this.currTableNamePrefix;
            this.exaCardTableName = tableName
        }

        if (cardRes.cardInfos.length === 0) {
            logger.error('addCardDbRecord no cardInfo');
            return;
        }

        let tableSchema:TableSchema = {}  
        tableSchema['address'] = '';
        tableSchema['platform'] = '';
        for (let key in cardRes.cardInfos[0]) {
            tableSchema[key] = ''
        }

        await this.dataStore?.createDbTable(tableName, tableSchema);
        tableSchema['address'] = cardRes.address
        tableSchema['platform'] = cardRes.platform
        let colunmInfo:string[] = []
        // Add the header record if not have
        if (cardRes.platform === 'axos') {
            if (this.axosCardTableColumn.length == 0) {
                for (let key in tableSchema) {
                    this.axosCardTableColumn.push(key)
                }
            }
            colunmInfo = this.axosCardTableColumn
        }else if (cardRes.platform === 'exa') {
            if (this.exaCardTableColumn.length == 0) {
                for (let key in tableSchema) {
                    this.exaCardTableColumn.push(key)
                }
            }
            colunmInfo = this.exaCardTableColumn
        }

        
        for (let ii = 0; ii < cardRes.cardInfos.length; ii++) {
            
            // make sure the schema match the db struct
            tableSchema = {}
            for (let jj = 0; jj < colunmInfo.length; jj++) {
                tableSchema[colunmInfo[jj]] = ''
            }

            tableSchema['address'] = cardRes.address
            tableSchema['platform'] = cardRes.platform
            for (let key in cardRes.cardInfos[ii]) {
                 // filter out the unknown column
                if (colunmInfo.indexOf(key) != -1) {
                    tableSchema[key] = cardRes.cardInfos[ii][key]
                }
            }
            await this.dataStore?.insertData(tableName, tableSchema)
        }

    }

    async reStartWork(force:boolean = false):Promise<number> {
        for (let ii = 0; ii < this.workerList.length; ii++) {
            if (this.workerList[ii].hasTask === true) {
                logger.error(`reStartWork worker ${ii+1} still has work to handle`)
                return -1
            }
        }

        if (force === false) {
            logger.error(`begin wait ${this.sleepTimeforNext} seconds for the next time work`)
            await sleepSecond(this.sleepTimeforNext);
        }

        logger.info(`== reStartWork ====`)

        if (this.ipRange) {
            this.ipL1 = this.ipRange.start;
        }


        this.ipL2 = 0;
        this.cardResponseList = []
        this.ontResponseList = []
        this.currTableNamePrefix =''

        let dbHist:UsedDBTableName = {
            axosCardTableName:this.axosCardTableName,
            axosOntTableName:this.axosOntTableName,
            exaCardTableName:this.exaCardTableName,
            exaOntTableName:this.exaOntTableName,
            axosModuleTableName:this.axosModuleTableName,
            exaModuleTableName:this.exaModuleTableName
        }
        this.hisDBName.push(dbHist)

        this.axosCardTableName =''
        this.axosOntTableName = ''
        this.exaCardTableName = ''
        this.exaOntTableName= ''
        this.axosModuleTableName = ''
        this.exaModuleTableName = ''
        this.axosCardTableColumn = []
        this.axosOntTableColumn = []
        this.exaCardTableColumn =[]
        this.exaOntTableColumn = []
        this.exaModuleColumn = []
        this.axosModuleColumn = []

        for (let ii = 0; ii < this.workerList.length; ii++) {
            let ipRange = this.getNextIpRange();
            if (ipRange != undefined) {
                this.workerList[ii].worker.send({
                    cmd: MessageID.MSG_PATROL_REQ,
                    content: ipRange,
                    excludeIps:this.excludeIps
                } as MessageInfo)
                this.workerList[ii].hasTask = true
                this.workerList[ii].handleIp = ipRange
            } else {
                logger.error('Master: online no left IP for the work')

            }       
        }
        return 0
    }
    async updateAvailableTable() {
      if (this.axosCardTableName != '') {
        await this.updateDbDescTable(this.availableDescTableName, DBType.DBType_AXOS_CARD, this.axosCardTableName)
      }
     
      if (this.axosOntTableName != '') {    
        await this.updateDbDescTable(this.availableDescTableName, DBType.DBType_AXOS_ONT, this.axosOntTableName)
      }
      
      if (this.exaCardTableName != '') {
        await this.updateDbDescTable(this.availableDescTableName, DBType.DBType_EXA_CARD, this.exaCardTableName)         
      }

      if (this.exaOntTableName != '') {
        await this.updateDbDescTable(this.availableDescTableName, DBType.DBType_EXA_ONT, this.exaOntTableName)
      }

      if (this.exaModuleTableName != '') {
        await this.updateDbDescTable(this.availableDescTableName, DBType.DBType_EXA_MODULE, this.exaModuleTableName)
      }

      if (this.axosModuleTableName != '') {
        await this.updateDbDescTable(this.availableDescTableName, DBType.DBType_AXOS_MODULE, this.axosModuleTableName)
      }
    }

    async updateDbDescTable(tableName:string, dbType:number, name:string) {
        // inpro
        let tableItem:TableSchema = {'id':"1",
                                        'axosCard':"",
                                         'axosOnt':"", 
                                         'exaCard':"",
                                        'exaOnt':"",
                                        'axosModule':"",
                                        "exaModule":""}

        let tableCond:TableSchema = {'id':"1"}
        let tableChg:TableSchema = {
        }

        await this.dataStore?.createDbTable(tableName, tableItem)

        let rows = await this.dataStore?.queryAll(tableName)
        switch(dbType) {
            case DBType.DBType_AXOS_CARD:
                tableChg['axosCard'] = name
                tableItem['axosCard'] = name
                break;
            case DBType.DBType_AXOS_ONT:
                tableChg['axosOnt'] = name
                tableItem['axosOnt'] = name
                break;
            case DBType.DBType_EXA_CARD:
                tableChg['exaCard'] = name
                tableItem['exaCard'] = name
                break;
            case DBType.DBType_EXA_ONT:
                tableChg['exaOnt'] = name
                tableItem['exaOnt'] = name
                break;
            case DBType.DBType_AXOS_MODULE:
                tableChg['axosModule'] = name
                tableItem['axosModule'] = name
                break;
            case DBType.DBType_EXA_MODULE:
                tableChg['exaModule'] = name
                tableItem['exaModule'] = name
                break;    
            default:
                break;
        }

        if (!rows || (rows as []).length ===0) {
            await this.dataStore?.insertData(tableName, tableItem)

        }else {
            await this.dataStore?.updateData(tableName, tableChg, tableCond)

        }
    }
    
    async addOntDbRecord(ontRes:ontResponse) {
        if (this.currTableNamePrefix === '') {
            let dataStr = Date()
            //Thu Jun 24 2021 12:36:21 GMT+0800 (GMT+08:00)
            let regExStr =  /(?:\w+) (\w+) (\d+) (\d+) (\d+):(\d+):(\d+)/
            let searchRes = regExStr.exec(dataStr)
            if (searchRes) {
                this.currTableNamePrefix = `${searchRes[3]}-${searchRes[1]}-${searchRes[2]}-${searchRes[4]}-${searchRes[5]}`
            }else {
                logger.error('addCardDbRecord: invalid dataStr')
                this.currTableNamePrefix =  new Date().getTime().toString()
            }
        }
        let tableName=  ''
        if (ontRes.platform === 'axos') {
            tableName = 'axosont'+ this.currTableNamePrefix;
            this.axosOntTableName = tableName

        }else if (ontRes.platform === 'exa') {
            tableName = 'exaont' + this.currTableNamePrefix;
            this.exaOntTableName = tableName
        }

        if (ontRes.ontInfos.length === 0) {
            logger.error('addOntDbRecord no ontInfo');
            return;
        }


        let tableSchema:TableSchema = {}  
        tableSchema['address'] = '';
        tableSchema['platform'] = '';
        for (let key in ontRes.ontInfos[0]) {
            tableSchema[key] = ''
        }
        tableSchema['address'] = ontRes.address
        tableSchema['platform'] = ontRes.platform

        let colunmInfo:string[] = []
        // Add the header record if not have
        if (ontRes.platform === 'axos') {
            if (this.axosOntTableColumn.length == 0) {
                for (let key in tableSchema) {
                    this.axosOntTableColumn.push(key)
                }
            }
            colunmInfo = this.axosOntTableColumn
        }else if (ontRes.platform === 'exa') {
            if (this.exaOntTableColumn.length == 0) {
                for (let key in tableSchema) {
                    this.exaOntTableColumn.push(key)
                }
            }
            colunmInfo = this.exaOntTableColumn
        }


        await this.dataStore?.createDbTable(tableName, tableSchema);
        for (let ii = 0; ii < ontRes.ontInfos.length; ii++) {
            // make sure schema matches the DB struct
            tableSchema = {}
            for (let jj = 0; jj < colunmInfo.length; jj++) {
                tableSchema[colunmInfo[jj]] = ''
            }
            tableSchema['address'] = ontRes.address
            tableSchema['platform'] = ontRes.platform
            for (let key in ontRes.ontInfos[ii]) {
                if (colunmInfo.indexOf(key) != -1) {
                    tableSchema[key] = ontRes.ontInfos[ii][key]
                }
            }
            await this.dataStore?.insertData(tableName, tableSchema)
        }

    }    

    async addModuleRecord(moduleRes:moduleResponse) {
        if (this.currTableNamePrefix === '') {
            let dataStr = Date()
            //Thu Jun 24 2021 12:36:21 GMT+0800 (GMT+08:00)
            let regExStr =  /(?:\w+) (\w+) (\d+) (\d+) (\d+):(\d+):(\d+)/
            let searchRes = regExStr.exec(dataStr)
            if (searchRes) {
                this.currTableNamePrefix = '' + searchRes[3] + searchRes[1] + searchRes[2] + searchRes[4] + searchRes[5]
            }else {
                logger.error('addModuleRecord: invalid dataStr')
                this.currTableNamePrefix =  new Date().getTime().toString()
            }
            
            
        }
        let tableName=  ''
        if (moduleRes.platform === 'axos') {
            tableName = 'axosmodule'+ this.currTableNamePrefix;
            this.axosModuleTableName = tableName

        }else if (moduleRes.platform === 'exa') {
            tableName = 'examodule' + this.currTableNamePrefix;
            this.exaModuleTableName = tableName
        }

        if (moduleRes.moduleInfos.length === 0) {
            logger.error('addModuleRecord no cardInfo');
            return;
        }

        let tableSchema:TableSchema = {}  
        tableSchema['address'] = '';
        tableSchema['platform'] = '';
        for (let key in moduleRes.moduleInfos[0]) {
            tableSchema[key] = ''
        }

        await this.dataStore?.createDbTable(tableName, tableSchema);
        tableSchema['address'] = moduleRes.address
        tableSchema['platform'] = moduleRes.platform
        let colunmInfo:string[] = []
        // Add the header record if not have
        if (moduleRes.platform === 'axos') {
            if (this.axosModuleColumn.length == 0) {
                for (let key in tableSchema) {
                    this.axosModuleColumn.push(key)
                }
            }
            colunmInfo = this.axosModuleColumn
        }else if (moduleRes.platform === 'exa') {
            if (this.exaModuleColumn.length == 0) {
                for (let key in tableSchema) {
                    this.exaModuleColumn.push(key)
                }
            }
            colunmInfo = this.exaModuleColumn
        }

        
        for (let ii = 0; ii < moduleRes.moduleInfos.length; ii++) {
            
            // make sure the schema match the db struct
            tableSchema = {}
            for (let jj = 0; jj < colunmInfo.length; jj++) {
                tableSchema[colunmInfo[jj]] = ''
            }

            tableSchema['address'] = moduleRes.address
            tableSchema['platform'] = moduleRes.platform
            for (let key in moduleRes.moduleInfos[ii]) {
                 // filter out the unknown column
                if (colunmInfo.indexOf(key) != -1) {
                    tableSchema[key] = moduleRes.moduleInfos[ii][key]
                }
            }
            await this.dataStore?.insertData(tableName, tableSchema)
        }



    }
    async setupWokerProcess(ipRange: IpPrefixInfo, ipFilter:string[]) {
        await this.initMaster();
        let numCores = require('os').cpus().length;
        let that = this;
        this.excludeIps = ipFilter


        if (ipRange.subLenth != 16 && ipRange.subLenth != 24) {
            logger.error('setupWokerProcess: does not support sublength' + ipRange.subLenth)
            return;
        }
        this.ipRange = ipRange;
        this.ipL1 = ipRange.start;
        this.ipL2 = 0;

        for (let ii = 0; ii < numCores; ii++) {
            let worker = cluster.fork();
            let workerInfo: WorkInfo = {
                worker: worker,
                hasTask: false,
                handleIp:undefined
            }
            
            this.workerList.push(workerInfo)
        }

        cluster.on('online', async (worker: Worker) => {
            logger.info('worker ' + 'id ' + worker.id + ' pid: ' + worker.process.pid + ' online')
            if (worker.id > numCores) {
                logger.error(`workid ${worker.id} exceed the max cores ${numCores}`)
                return
            }
            let index = worker.id - 1
            if (that)
                setTimeout(() => {


                    let ipRange = that.getNextIpRange();
                    if (ipRange != undefined) {
                        that.workerList[index].worker.send({
                            cmd: MessageID.MSG_PATROL_REQ,
                            content: ipRange,
                            excludeIps: that.excludeIps
                        } as MessageInfo)
                        that.workerList[index].hasTask = true
                        that.workerList[index].handleIp = ipRange
                    } else {
                        logger.error('Master: online no left IP for the work')

                    }
                }, index * 1000)
        })

        cluster.on('message', async function (worker: Worker, message: MessageInfo) {
            let index = worker.id - 1;
            if (message.cmd == undefined) {
                return;
            }
            logger.info(`Master: receive worker ${worker.id} message ${JSON.stringify(message)}`)
            switch (message.cmd) {
                case MessageID.MSG_CARD_PATROL_RPL:
                {
                    let res = message.content as cardResponse[]
                    that.cardResponseList.push(...res);
                    for (let ii = 0; ii < res.length; ii++) {
                        await that.addCardDbRecord(res[ii])
                    }
                    let ipRange = that.getNextIpRange();
                    if (ipRange != undefined) {
                        that.workerList[index].worker.send({
                            cmd: MessageID.MSG_PATROL_REQ,
                            content: ipRange,
                            excludeIps: that.excludeIps
                        } as MessageInfo)
                        that.workerList[index].handleIp = ipRange
                    } else {
                        logger.error('Master: no left IP for the work')
                        that.workerList[index].hasTask = false
                        let allFinish = true
                        for (let ii = 0; ii < that.workerList.length; ii++) {
                            if (that.workerList[ii].hasTask) {
                                allFinish = false
                                break
                            }
                        }
                        if (allFinish) {
                            logger.error('=========ALl work done==========')
                            await that.updateAvailableTable()
                            await that.reStartWork()
                        }
                    }
                }
                    break;
                case MessageID.MSG_ONT_PATROL_RPL:
                {
                    let res = message.content as ontResponse[]
                    that.ontResponseList.push(...res);
                    for (let ii = 0; ii < res.length; ii++) {
                        await that.addOntDbRecord(res[ii])
                    }                    
                }
                break;

                case MessageID.MSG_MODULE_PATROL_RPL:
                {
                    let res = message.content as moduleResponse[]
                    that.moduleResponseList.push(...res)
                    for (let ii = 0; ii < res.length; ii++) {
                        await that.addModuleRecord(res[ii])
                    }
                }
                break
            }

        })
    }


    setupWokerExecute(workId: Worker) {
        let index = workId.id - 1;

        let that = this;
        logger.info(`work ${index} executing`)
        let emitter = new events.EventEmitter();
        that.emitter = emitter
        let bunchWork = new BunchWork()
        process.on('message', async (message: MessageInfo) => {
            if (message.cmd & MessageID.MSG_PATROL_REQ) {
                bunchWork.setupWork(message.content as IpPrefixInfo, LabPatroType.LabPatrolType_AXOSCard, workId.id, message.excludeIps)
                try {
                    await Promise.race([bunchWork.processWork(), sleepSecond(3600)])
                }catch(e) {
                    logger.error(`eror handle worker ${workId.id}`)
                    logger.error(e)
                }

                let res = bunchWork.getCardBunchRes();
                (<any>process).send({
                    cmd: MessageID.MSG_CARD_PATROL_RPL,
                    content: res
                })


                let ontRes = bunchWork.getOntBunchRes();
                (<any>process).send({
                    cmd: MessageID.MSG_ONT_PATROL_RPL,
                    content: ontRes
                })
                
                let moduleRes = bunchWork.getModuleBunchRes();
                (<any>process).send({
                    cmd: MessageID.MSG_MODULE_PATROL_RPL,
                    content: moduleRes
                })
            }
        })
    }
}


function setupVorpal(vorpal: Vorpal, clusterMaster: ClusterWork) {
    vorpal
        .command('showcardlist', '显示获取的card')
        .option('-m, --mode <mode>', '模式.', ['all', 'count', 'brief'])
        .action(async (args) => {
            let type = (args.options.mode) ? args.options.mode : undefined;
            if (['all', 'count', 'brief'].indexOf(type) != -1) {
                clusterMaster.showCardResult(vorpal, type)
            } else {
                clusterMaster.showCardResult(vorpal, 'all')
            }

        })

        vorpal.command('showontlist', '显示获取的ont')
        .option('-m, --mode <mode>', '模式.', ['all', 'count', 'brief'])
        .action(async (args) => {
            let type = (args.options.mode) ? args.options.mode : undefined;
            if (['all', 'count', 'brief'].indexOf(type) != -1) {
                clusterMaster.showOntResult(vorpal, type)
            } else {
                clusterMaster.showOntResult(vorpal, 'all')
            }

        })       

        vorpal.command('showmodulelist', '显示获取的ont')
        .option('-m, --mode <mode>', '模式.', ['all', 'count', 'brief'])
        .action(async (args) => {
            let type = (args.options.mode) ? args.options.mode : undefined;
            if (['all', 'count', 'brief'].indexOf(type) != -1) {
                clusterMaster.showModuleResult(vorpal, type)
            } else {
                clusterMaster.showModuleResult(vorpal, 'all')
            }

        })           
        vorpal
        .command('showcarddb', '显示获取到的')
        .option('-m, --mode <mode>', '模式.', ['all', 'count', 'brief'])
        .option('-t, --type <type>', '类型.', ['axos', 'exa'])
        .action(async (args) => {
            let mode = (args.options.mode) ? args.options.mode : undefined;
            let type = (args.options.type) ? args.options.type:undefined;
            if (['all', 'count', 'brief'].indexOf(mode) != -1 && ['axos', 'exa'].indexOf(type) != -1) {
                if (type == 'axos') {
                   await  clusterMaster.showCardDBRecord(DBType.DBType_AXOS_CARD, vorpal, mode);
                }else if (type == 'exa') {
                    await clusterMaster.showCardDBRecord(DBType.DBType_EXA_CARD, vorpal, mode);
                }
                
            } else {
                await clusterMaster.showCardDBRecord(DBType.DBType_AXOS_CARD, vorpal, 'all')
                await clusterMaster.showCardDBRecord(DBType.DBType_EXA_CARD, vorpal, 'all')
                
            }

        })
        vorpal
        .command('showontdb', '显示获取到的')
        .option('-m, --mode <mode>', '模式.', ['all', 'count', 'brief'])
        .option('-t, --type <type>', '类型.', ['axos', 'exa'])
        .action(async (args) => {
            let mode = (args.options.mode) ? args.options.mode : undefined;
            let type = (args.options.type) ? args.options.type:undefined;
            if (['all', 'count', 'brief'].indexOf(mode) != -1 && ['axos', 'exa'].indexOf(type) != -1) {
                if (type == 'axos') {
                   await  clusterMaster.showOntDBRecord(DBType.DBType_AXOS_ONT, vorpal, mode);
                }else if (type == 'exa') {
                    await clusterMaster.showOntDBRecord(DBType.DBType_EXA_ONT, vorpal, mode);
                }
                
            } else {
                await clusterMaster.showOntDBRecord(DBType.DBType_AXOS_ONT, vorpal, 'all')
                await clusterMaster.showOntDBRecord(DBType.DBType_EXA_ONT, vorpal, 'all')
                
            }

        })

        vorpal
        .command('showmoduledb', '显示获取到的module')
        .option('-m, --mode <mode>', '模式.', ['all', 'count', 'brief'])
        .option('-t, --type <type>', '类型.', ['axos', 'exa'])
        .action(async (args) => {
            let mode = (args.options.mode) ? args.options.mode : undefined;
            let type = (args.options.type) ? args.options.type:undefined;
            if (['all', 'count', 'brief'].indexOf(mode) != -1 && ['axos', 'exa'].indexOf(type) != -1) {
                if (type == 'axos') {
                   await  clusterMaster.showModuleDBRecord(DBType.DBType_AXOS_MODULE, vorpal, mode);
                }else if (type == 'exa') {
                    await clusterMaster.showModuleDBRecord(DBType.DBType_EXA_MODULE, vorpal, mode);
                }
                
            } else {
                await clusterMaster.showModuleDBRecord(DBType.DBType_AXOS_MODULE, vorpal, 'all')
                await clusterMaster.showModuleDBRecord(DBType.DBType_EXA_MODULE, vorpal, 'all')
                
            }

        })        

    vorpal.command('showstate', '显示当前状态').action(async (args)=>{
        clusterMaster.showState(vorpal)

    })

    vorpal.command('forcedbupdate', 'forcedbupdate').action(async (args)=>{
        await clusterMaster.updateAvailableTable()
    })

    vorpal.command('timewait', 'timewait')
    .option('-s --set <value>', 'wait value')
    .action(async (args)=>{
        let setvalue = (args.options.set) ? args.options.set : undefined;
        if (setvalue) {
            let value = parseInt(setvalue)
            if (value) {
                clusterMaster.sleepTimeforNext = value
            }
        }
        vorpal.log(`timeWait: ${clusterMaster.sleepTimeforNext}`)
    })

    vorpal
        .delimiter('myapp$')
        .show();
    
}
(async () => {
    let labPatrolCluster = new ClusterWork()
    if (cluster.isMaster) {
        let ipRange: IpPrefixInfo = {
            ipPrefix: '10.245',
            subLenth: 16,
            start: 2,
            end: 254,
        }
        const vorpal = require('vantage')()
        const cfg = require('./config.json')
        setupVorpal(vorpal, labPatrolCluster)
        labPatrolCluster.setupWokerProcess(ipRange, cfg.filterIp);

    } else {
        labPatrolCluster.setupWokerExecute(cluster.worker);

    }


})()
