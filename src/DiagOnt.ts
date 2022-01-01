import {DiagGradeParse} from "./DiagGradeParse"
export class DiagOnt {
    runCfg:string = ''
    diagGrade:DiagGradeParse
    constructor() {
        this.diagGrade = new DiagGradeParse()

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
}

