import {DiagGradeParse} from "./DiagGradeParse"
import logger from "./logger"
import {ResultSplit, CliResFormatMode} from "./ResultSplit"
export class DiagOnt {
    runCfg:string = ''
    diagGrade:DiagGradeParse
    resultSplit:ResultSplit
    constructor() {
        this.diagGrade = new DiagGradeParse()
        this.resultSplit = new ResultSplit()
    }

    setRunningConfig(runCfg:string) {
        this.runCfg = runCfg
        this.diagGrade.setParseStr(runCfg)
    }
    /* 
        [[ '1/1/x2', 'up']]
    */
    findEtherPortOpera(cfg:string):string[][] {
        let diagGrade = new DiagGradeParse()
        diagGrade.setParseStr(cfg)

        let pathResult = diagGrade.retriveParseNode([[{prefix:"interface ethernet", value:''}], [{prefix:"status", value:""}], [{prefix:"oper-state", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['interface ethernet', 'oper-state'])
        return filtRes
    }

    /* 
        [[ '1/1/x2', 'enable']]
    */
    findEtherPortAdmin(cfg:string):string[][] {
        let diagGrade = new DiagGradeParse()
        diagGrade.setParseStr(cfg)

        let pathResult = diagGrade.retriveParseNode([[{prefix:"interface ethernet", value:''}], [{prefix:"status", value:""}], [{prefix:"admin-state", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['interface ethernet', 'admin-state'])
        return filtRes
    }    

    /*
      [[ 'SYSTEM_TSP', '999,1021-1022']]
    */
    findTransProfile(cfg:string):string[][] {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"transport-service-profile", value:''}], [{prefix:"vlan-list", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['transport-service-profile', 'vlan-list'])
        // let filtRes = this.diagGrade.getItemValueFromPath(pathResult, ['interface ethernet', "role", "transport-service-profile"])
        return filtRes
    }

    /*
    [
    [ '1/1/q3', 'inni', 'SYSTEM_TSP' ],
    [ '1/1/x3', 'inni', 'SYSTEM_TSP' ],
    [ '1/1/x4', 'inni', 'SYSTEM_TSP' ]
    ]
    */
    findEtherTransProfile(cfg:string) :string[][]{
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"interface ethernet", value:''}], [{prefix:"role", value:""}, {prefix:"transport-service-profile", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['interface ethernet', "role", "transport-service-profile"])
        // let filtRes = this.diagGrade.getItemValueFromPath(pathResult, ['interface ethernet', "role", "transport-service-profile"])
        return filtRes
    }

    /* [["836/g1","1021 22","add-s-untag"]] */
    findOntDtagServ(ontId:string='', cfg:string='', portType:string):string[][] {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:`interface ${portType}`, value:ontId}], [{prefix:"dtag-vlan", value:""}],
             [{prefix:"policy-map", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, [`interface ${portType}`, "dtag-vlan", "policy-map"])

        return filtRes
    }


    findOntSVlanServ(ontId:string='', cfg:string='', portType:string) {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:`interface ${portType}`, value:ontId}], [{prefix:"vlan", value:""}],
             [{prefix:"policy-map", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, [`interface ${portType}`, "vlan", "policy-map"])

        return filtRes
    }

    findOntSCVlanServ(ontId:string='', cfg:string='', portType:string) {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:`interface ${portType}`, value:ontId}], [{prefix:"vlan", value:""}],
                     [{prefix:"c-vlan", value:""}],  [{prefix:"policy-map", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, [`interface ${portType}`, "vlan", "c-vlan", "policy-map"])

        return filtRes
    }

    /* [["836/g1","1021","add-s-untag"]] */
    findOntEtherSVlanServ(ontId:string='', cfg:string=''):string[][] {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"interface ont-ethernet", value:ontId}], [{prefix:"vlan", value:""}],
             [{prefix:"policy-map", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['interface ont-ethernet', "vlan", "policy-map"])

        return filtRes
    }
    /* [["836/g1","1022","100","add-s-untag"]] */
    findOntEtherSCVlanServ(ontId:string='', cfg:string=''):string[][] {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"interface ont-ethernet", value:ontId}], [{prefix:"vlan", value:""}],
                     [{prefix:"c-vlan", value:""}],  [{prefix:"policy-map", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['interface ont-ethernet', "vlan", "c-vlan", "policy-map"])

        return filtRes
    }

    findClassMap(cfg:string = ''):string[][]{
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"class-map ethernet", value:''}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['class-map ethernet'])
        return filtRes
    }

    /*
    [
        [ 'double-data', '1', '1 match vlan 911' ],
        [ 'match_any', '1', '1 match any' ],
        [ 'match_pcp', '1', '1 match priority-tagged pcp 0' ],
        [ 'match_pcp', '1', '2 match priority-tagged pcp 1' ],
        [ 'match_pcp', '1', '3 match priority-tagged pcp 2' ],
    ]
    */
    findClassMapEtherRule(classMap:string='', cfg:string=''):string[][]{
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"class-map ethernet", value:classMap}], [{prefix:"flow", value:""}],
                     [{prefix:"rule", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['class-map ethernet', "flow", "rule"])
        return filtRes
    }

    findPolicyMap(cfg:string='') :string[][]{
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"policy-map", value:''}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['policy-map'])     
        return filtRes
    }
    /*
    [
    [ 'Business', 'match_any' ],
    [ 'add-s-cir', 'untag' ]
    ]
    */
    findPolicyMapEthClassMap(cfg:string='') :string[][]{
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"policy-map", value:''}], [{prefix:"class-map-ethernet", value:''}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['policy-map', 'class-map-ethernet'])     
        return filtRes
    }


    /*
    [
    [ '836', '762GX','138133' ],
    ]
    */
    findOnt(cfg:string='') :string[][]{
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"ont", value:''}], [{prefix:"profile-id", value:""}, {prefix:"serial-number", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['ont','profile-id', 'serial-number'])     
        return filtRes       
    }

    /*
      [[ '836', 'Confirmed']]
      or 
      [['Confirmed']]
    */
    findOntLink(cfg:string='', specificOnt:boolean=false):string[][] {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }
        if (specificOnt) {
            let pathResult = diagGrade.retriveParseNode([[{prefix:"ont", value:''}], [{prefix:"linkage", value:""}], [{prefix:"status", value:""}]])
            let filtRes = diagGrade.getItemValueFromPath(pathResult, ['ont',"status"])     
            return filtRes   
        }else {
            let pathResult = diagGrade.retriveParseNode([[{prefix:"linkage", value:""}], [{prefix:"status", value:""}]])
            let filtRes = diagGrade.getItemValueFromPath(pathResult, ["status"])     
            return filtRes             
        }

    }
     /*
      [[ '836', '1', '1', 'xp5']]
    */
    findOntLinkage(cfg:string=''):string[][] {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }
        let pathResult = diagGrade.retriveParseNode([[{prefix:"ont-linkages ont-linkage ont-id", value:''}], [{prefix:"shelf-id", value:""},
                         {prefix:"slot-id", value:""}, {prefix:"pon-port", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['ont-linkages ont-linkage ont-id',"shelf-id","slot-id","pon-port"])     
        return filtRes   
    }    
     /*
      [[ '836/g1', 'enable', 'up]]
    */
    findOntEtherStatus(etherPort:'', res:string):string[][] {
        let    diagGrade = new DiagGradeParse()
        diagGrade.setParseStr(res)

        let pathResult = diagGrade.retriveParseNode([[{prefix:"interface ont-ethernet", value:etherPort}], [{prefix:"status", value:""}],
                         [{prefix:"admin-state", value:""}, {prefix:"oper-state", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['interface ont-ethernet',"admin-state","oper-state"])     
        return filtRes           
    }

     /*
      [[ '836/g1', 'rg']]
    */
    fidnOntEtherRole(etherPort:'', res:string):string[][] {
        let    diagGrade = new DiagGradeParse()
        diagGrade.setParseStr(res)

        let pathResult = diagGrade.retriveParseNode([[{prefix:"interface ont-ethernet", value:etherPort}], [{prefix:"role", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['interface ont-ethernet',"role"])     
        return filtRes         
    }

    findInterfaceQos() {

    }

    /*
    [['1021','-','gp1100_2/x1','cos-1','BE-1','0','15000','-','0','15104']]
    only ingress
    */
    findOntQosInfo(res:string):string[][] {
    // CSV mode output
    /* INDEX,VLAN,C VLAN,PORT,DIRECTION,TYPE,PON COS,DBA PRIORITY,CIR,EIR,PON COS CIR,PON COS AIR,PON COS EIR
        0,1021,-,836/g1,ingress,meter,cos-1,AF-1,400000,1000000,-,400000,840000
        1,1021,-,836/g2,ingress,meter,cos-1,AF-1,0,1000000,-,400000,840000
    */
        this.resultSplit.splitResult(res, CliResFormatMode.CliResFormatTableCsv)
        let formatOut = this.resultSplit.getTableFormatOut()
        let output:string[][] = []
        let filterAttr:string[] = [
            'VLAN','C VLAN','PORT','PON COS','DBA PRIORITY','CIR','EIR','PON COS CIR','PON COS AIR','PON COS EIR']
 
        for (let ii = 0; ii < formatOut.length; ii++) {
            let outRecord:string[] = []
            for (let jj = 0; jj < formatOut[ii].childs.length; jj++) {
                if (filterAttr.indexOf(formatOut[ii].childs[jj].name) != -1) {
                    outRecord.push(formatOut[ii].childs[jj].value)
                }
            }
            output.push(outRecord)
        }
        // logger.info(JSON.stringify(ontList))
        return output;

    }

    /*
    [
    ['present'],
    ]
    */
    findOntStatus(res:string) :string[][]{
        let    diagGrade = new DiagGradeParse()
        diagGrade.setParseStr(res)
        let pathResult = diagGrade.retriveParseNode([[{prefix:"status", value:''}], [{prefix:"oper-state", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['oper-state'])     
        return filtRes       
    }

    /*
        PON     SERVICE   COS    TID        PID 
    [
        ['7','5/0/0.2000','1'  '7-    6',  '141']
    ]   
    */
    findOntTidPidMap(res:string, ontId:string):string[][] {
        // tm tid pid info first through  tm tid show -ont
        let splitLines = res.split('\n')
        let tmTidStartLine = -1; 
        let tmTidEndLine = -1 // next is "tm pid show"
        for (let idx = 0; idx < splitLines.length; idx++) {
            if (splitLines[idx].indexOf('tm tid show') != -1) {
                tmTidStartLine = idx + 1
            }
            if (splitLines[idx].indexOf('tm pid show') != -1) {
                tmTidEndLine = idx - 1
            }

            if (tmTidEndLine != -1 && tmTidEndLine != -1) {
                break
            }
        }

        /*
        tm tid show -ont 5

        PON        SERVICE       COS    TID    PID 
        --- -------------------- --- -------- -----
          7 5/0/0.2000             1  7-    6   141
          7 5/2/1.1021             1  7-    3   134
          7 5/2/2.1021             1  7-    4   135
        */

        if (tmTidStartLine === -1 || tmTidEndLine === -1) {
            logger.error(`findOntTidPidMap: tmTidStartLine:${tmTidStartLine} tmTidEndLine:${tmTidEndLine}`)
            return []
        }

        let parseStrList = splitLines.slice(tmTidStartLine, tmTidEndLine + 1)
        let parseStr = parseStrList.join('\n')
        this.resultSplit.splitResult(parseStr, CliResFormatMode.CliResFormatTableWithSeparator)
        let formatOut = this.resultSplit.getTableFormatOut()
        let output:string[][] = []
        let filterAttr:string[] = [
            'PON','SERVICE','COS','TID','PID']
 
        for (let ii = 0; ii < formatOut.length; ii++) {
            let outRecord:string[] = []
            for (let jj = 0; jj < formatOut[ii].childs.length; jj++) {
                if (filterAttr.indexOf(formatOut[ii].childs[jj].name) != -1) {
                    outRecord.push(formatOut[ii].childs[jj].value)
                }
            }
            output.push(outRecord)
        }
        return output
    }

    /*
    [
        ['1/1','XG801','In Service','"Controller 2 QSFP-DD, 4 10G, 8 XGSPON ports (Active)"','XG801']
    ]
    */
    findCardList(res:string):string[][] {
        // XG801# show card |csv
        // CARD,PROVISION TYPE,CARD STATE,CARD TYPE,MODEL,SERIAL NO,SOFTWARE VERSION
        // 1/1,XG801,In Service,"Controller 2 QSFP-DD, 4 10G, 8 XGSPON ports (Active)",XG801,472101001379,N/A

        this.resultSplit.splitResult(res, CliResFormatMode.CliResFormatTableCsv)
        let formatOut = this.resultSplit.getTableFormatOut()
        let output:string[][] = []
        let filterAttr:string[] = [
            'CARD','PROVISION TYPE','CARD STATE','CARD TYPE','MODEL','SERIAL NO']
 
        for (let ii = 0; ii < formatOut.length; ii++) {
            let outRecord:string[] = []
            for (let jj = 0; jj < formatOut[ii].childs.length; jj++) {
                if (filterAttr.indexOf(formatOut[ii].childs[jj].name) != -1) {
                    outRecord.push(formatOut[ii].childs[jj].value)
                }
            }
            output.push(outRecord)
        }
        // logger.info(JSON.stringify(ontList))
        return output;       
    }

    findDiscoverOnts(res:string):string[][] {
        /* 
        VENDOR ID,SERIAL NUMBER,SHELF ID,SLOT ID,PORT,ONT ID,REG ID,MODEL,CURR VERSION,ONU MAC ADDR,CLEI,ALT VERSION,CURR COMMITTED,MTA MAC ADDR,PRODUCT CODE
        CXNK,11000010,1,1,xp1,844GE,-,844GE,8.0.z.42,00:91:10:00:0a:00,SIM844GE,7.0.z.99,true,00:91:10:00:0a:01,P0        
        */

        this.resultSplit.splitResult(res, CliResFormatMode.CliResFormatTableCsv)
        let formatOut = this.resultSplit.getTableFormatOut()
        let output:string[][] = []
        let filterAttr:string[] = [
            'VENDOR ID','SERIAL NUMBER','SHELF ID','SLOT ID','PORT','ONT ID','REG ID','MODEL','CURR VERSION','ONU MAC ADDR','CLEI','ALT VERSION','CURR COMMITTED','MTA MAC ADDR','PRODUCT CODE']
 
        for (let ii = 0; ii < formatOut.length; ii++) {
            let outRecord:string[] = []
            for (let jj = 0; jj < formatOut[ii].childs.length; jj++) {
                if (filterAttr.indexOf(formatOut[ii].childs[jj].name) != -1) {
                    outRecord.push(formatOut[ii].childs[jj].value)
                }
            }
            output.push(outRecord)
        }
        // logger.info(JSON.stringify(ontList))
        return output;       
    }

    findAspenGemStats(res:string):string[][] {
        /*
        PON PORTID  ONU   Us_Pkts       Us_bytes          Ds_Pkts       Ds_bytes
        --- ------ ----- ---------- -------------------- ---------- --------------------
          0   4093 65535          0                    0          0                    0
          1    129 65535          0                    0          0                    0
          2    129 65535          0                    0          0                    0
          3   4093 65535          0                    0          0                    0
          5   4093 65535          0                    0          0                    0
          */
        // need strip the first line for dcli command result
        res = res.substring(res.indexOf('\n') + 1)

        this.resultSplit.splitResult(res, CliResFormatMode.CliResFormatTableWithSeparator)
        let formatOut = this.resultSplit.getTableFormatOut()
        let output:string[][] = []
        let filterAttr:string[] = [
            'PON','PORTID','ONU','Us_Pkts','Us_bytes','Ds_Pkts','Ds_bytes']
 
        for (let ii = 0; ii < formatOut.length; ii++) {
            let outRecord:string[] = []
            for (let jj = 0; jj < formatOut[ii].childs.length; jj++) {
                if (filterAttr.indexOf(formatOut[ii].childs[jj].name) != -1) {
                    outRecord.push(formatOut[ii].childs[jj].value)
                }
            }
            output.push(outRecord)
        }
        // logger.info(JSON.stringify(ontList))
        return output;              
    }

    findFpgaGemStats(res:string):string[][] {
        /*
         PON  PID   Byte Count     UC Pkts     BC Pkts    MC Pkts   Drop Pkts Snoop Pkts
        ---- ---- ------------- ------------ ---------- ---------- ---------- ----------
        1 1076         63128          994        233        184          0          0
          */
        // need strip the first line for dcli command result
        res = res.substring(res.indexOf('\n') + 1)

        this.resultSplit.splitResult(res, CliResFormatMode.CliResFormatTableWithSeparator)
        let formatOut = this.resultSplit.getTableFormatOut()
        let output:string[][] = []
        let filterAttr:string[] = [
            'PON','PID','Byte Count','UC Pkts','BC Pkts','MC Pkts','Drop Pkts','Snoop Pkts']
 
        for (let ii = 0; ii < formatOut.length; ii++) {
            let outRecord:string[] = []
            for (let jj = 0; jj < formatOut[ii].childs.length; jj++) {
                if (filterAttr.indexOf(formatOut[ii].childs[jj].name) != -1) {
                    outRecord.push(formatOut[ii].childs[jj].value)
                }
            }
            output.push(outRecord)
        }
        // logger.info(JSON.stringify(ontList))
        return output;              
    }

    findOntProfileId(cfg:string, ontId:string):string[][] {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"ont", value:ontId}], [{prefix:"profile-id", value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['ont', "profile-id"])

        return filtRes
    }

    findOntProfilePortInfo(cfg:string, profile:string, portType:string):string[][] {
        let diagGrade 
        if (cfg != '') {
            diagGrade = new DiagGradeParse()
            diagGrade.setParseStr(cfg)
        }else {
            diagGrade = this.diagGrade
        }

        let pathResult = diagGrade.retriveParseNode([[{prefix:"ont-profile", value:profile}], [{prefix:`interface ${portType}`, value:""}]])
        let filtRes = diagGrade.getItemValueFromPath(pathResult, ['ont-profile', `interface ${portType}`])

        return filtRes
    }

}

