import logger from "./logger"
import {AXOSCard} from "./AXOSCard"
import {DiagOnt} from "./DiagOnt"
import {DiagOltPortPortrait, DiagOltPortrait, DiagOntPortrait, DiagOntIfPortrait, DiagFlowPortrait, DiagCompose} from "./DiagPub"
import { map } from "cheerio/lib/api/traversing"


export class AXOSDiag extends AXOSCard {
    connectIp:string
    runningCfg:string
    diagOnt:DiagOnt
    constructor() {
        super()
        this.connectIp = ''
        this.runningCfg = ''
        this.diagOnt = new DiagOnt()
    }

    async login(ipAddr:string):Promise<number> {
        this.connectIp = ipAddr
        let res = await this.connect(ipAddr)
        if (res === -1) {
            return res
        }
        res = await this.invesClient?.sendCommand('paginate false')
        return res
    }

    async getRunningCfg():Promise<number> {
        if (this.invesClient === undefined) {
            return -1
        }
        let res = await this.invesClient.sendCommand('show  running-config', 30000)
        if (res === -1) {
            return -1
        }
        this.runningCfg = res
        this.diagOnt.setRunningConfig(res)
        return 0
    }

    
    async buildOntPortrait(ontId:string):Promise<DiagOntPortrait> {
        let ontLinked = false
        let cmdRes = await this.invesClient?.sendCommand(`show  ont ${ontId} linkage`)
        let resLinkState = this.diagOnt.findOntLink(cmdRes)
        let etherPorts: DiagOntIfPortrait[] = []
        let errRes:DiagOntPortrait = {
            ontId:ontId,
            connPon:'',
            ontOutInterface:[],
            ontInInterface:[]
        }
        if (resLinkState.length != 0) {
            if (resLinkState[0][0] === 'Confirmed') {
                ontLinked = true
            }
        }
        logger.info(`ONT ${ontId} linked ${ontLinked}`)

        cmdRes = await this.invesClient?.sendCommand(`show running interface ont-ethernet ${ontId}/*`)
        let resRole = this.diagOnt.fidnOntEtherRole('', cmdRes)

        if (resRole.length === 0) {
            logger.error(`ont ${ontId} no provision interface`)
            return errRes
        }

        for (let role of resRole) {
            let portPortrait:DiagOntIfPortrait
            let ifname = /(\S+)\/(\S+)/.exec(role[0])
            if (!ifname) {
                continue
            }
            portPortrait = {
                ifname:ifname[2],
                veipIf:"",
                adminState:"disable",
                operState:"down"
            }
            if (role[1] === 'rg') {
                portPortrait.veipIf = "G1"
            }else if (role[1] === 'fullbridge') {
                portPortrait.veipIf = "F1"
            }
            etherPorts.push(portPortrait)
        }

        if (ontLinked === false) {
            let ontReturn:DiagOntPortrait = {
                ontId: ontId,
                connPon:'',
                ontOutInterface:etherPorts,
                ontInInterface:[]
            }
            return ontReturn
        }

        let ontReturn:DiagOntPortrait = {
            ontId: ontId,
            connPon:'',
            ontOutInterface:etherPorts,
            ontInInterface:[]
        }
        cmdRes = await this.invesClient?.sendCommand(`show interface ont-ethernet ${ontId}/* status`)
        let resStatus = this.diagOnt.findOntEtherStatus('', cmdRes)

        cmdRes = await this.invesClient?.sendCommand(`show ont-linkages ont-linkage ont-id ${ontId}`)
        let resLink = this.diagOnt.findOntLinkage(cmdRes)

        if (resRole.length != resStatus.length) {
            logger.error(`buildOntPortrait: role length ${resRole.length} not match status length ${resStatus.length}`)
            return errRes
        }

        for (let ii = 0; ii < resStatus.length; ii++) {
            etherPorts[ii].adminState = resStatus[ii][1] === 'enable'? 'enable':"disable"
            etherPorts[ii].operState = resStatus[ii][2] === 'up'? 'up':'down'
        }

        if (resLink.length > 0) {
            ontReturn.connPon = `${resLink[0][1]}/${resLink[0][2]}/${resLink[0][3]}`
        }
        return ontReturn
    }

    async buildAllVlanOutPorts():Promise<Map<number, string[]>> {
        let cmdRes =   await this.invesClient?.sendCommand(`show running-config transport-service-profile`)
        let transRes = this.diagOnt.findTransProfile(cmdRes)
        cmdRes = await this.invesClient?.sendCommand(`show running-config interface ethernet`)
        let inniTrans = this.diagOnt.findEtherTransProfile(cmdRes)

        let findPortByTrans = (trans:string):string[]=>{
            let ret:string[] = []
            for (let inniTran of inniTrans) {
                if (inniTran[2] === trans) {
                    ret.push(inniTran[0])
                }
            }
            return ret
        }


        let mapVlan = new Map<number, string[]>()
        for (let oo of transRes) {
            let transName = oo[0]
            let vlanStrList = oo[1].split(',')
            let portStr = findPortByTrans(transName)
            if (portStr.length ===  0) {
                logger.error(`buildAllVlanOutPorts no ${transName} found`)
                continue
            }
            for (let vlanItem of vlanStrList) {
                if (vlanItem.indexOf('-') != -1) {
                    let vlanScope = vlanItem.split('-')
                    let startV = parseInt(vlanScope[0])
                    let vlanE = parseInt(vlanScope[1])
                    for (let ii = startV; ii <=vlanE; ii++) {
                        let mapItem = mapVlan.get(ii)
                        if (mapItem) {
                            mapItem.push(...portStr)
                        }else {
                            mapVlan.set(ii, [...portStr])
                        }
                    }
                }else {
                    let vlan = parseInt(vlanItem)
                    let mapItem = mapVlan.get(vlan)
                    if (mapItem) {
                        mapItem.push(...portStr)
                    }else {
                        mapVlan.set(vlan, [...portStr])
                    }               
                }
            }

        }
        return mapVlan
    }

    async buildOntFlowPortrait(ontId:string):Promise<DiagFlowPortrait[]>{
        let cmdRes =   await this.invesClient?.sendCommand(`show running interface ont-ethernet ${ontId}/*`)
        let resSvlan = this.diagOnt.findOntEtherSVlanServ(ontId, cmdRes)
        let resSCvlan = this.diagOnt.findOntEtherSCVlanServ(ontId, cmdRes)
        let usedPolicyMap = new Set<string>()
        
        let flowId = 0
        for (let svlanSer of resSvlan) {
            usedPolicyMap.add(svlanSer[2])
        }

        for (let scvlanSer of resSCvlan) {
            usedPolicyMap.add(scvlanSer[2])
        }
        if (usedPolicyMap.size === 0) {
            logger.error('buildOntFlowPortrait no service with policymap created ')
            return []
        }
        // find all the policymap and classmap
        cmdRes = await this.invesClient?.sendCommand(`show running policy-map`, 20000)
        let resPolicy = this.diagOnt.findPolicyMap(cmdRes)
        let resPolicyClassMap = this.diagOnt.findPolicyMapEthClassMap(cmdRes)

        cmdRes = await this.invesClient?.sendCommand('show running-config class-map ethernet', 20000)
        let resClassmap = this.diagOnt.findClassMapEtherRule('', cmdRes)

        let findClasMap= (policy:string):string=>{
            for (let oo of resPolicyClassMap) {
                if (oo[0] === policy) {
                    return oo[1]
                }
            }
            return ''
        }

        let findRule=(classMap:string):string[]=>{
            let res:string[] = []
            for (let oo of resClassmap) {
                if (oo[0] === classMap) {
                    let regex = /(\d+)/
                    res.push(oo[2].replace(regex, '').replace('match','').trim())
                }
            }
            return res
        }
        
        let vlanPortsMap = await this.buildAllVlanOutPorts()
        let vlanPortsPortraitMap = new Map<number, DiagOltPortPortrait[]>()
        for (let entry of vlanPortsMap.entries()) {
            let outPorts = entry[1]
            let portPortraits:DiagOltPortPortrait[] = []

            for (let port of outPorts) {
                let regRes = /(\d+)\/(\d+)\/(\S+)/.exec(port)
                if (regRes) {
                    let portrait:DiagOltPortPortrait = {
                        shelf:parseInt(regRes[1]),
                        slot:parseInt(regRes[2]),
                        ifname:regRes[3]
                    }
                    portPortraits.push(portrait)
                }else {
                    logger.error(`buildOntFlowPortrait ${port} invalid`)
                    continue
                }
           }
           vlanPortsPortraitMap.set(entry[0], portPortraits)
        }

        let flowList:DiagFlowPortrait[] = []
        for (let svlanSer of resSvlan) {
           flowId++
           let regRes = /\S+\/(\S+)/.exec(svlanSer[0])
           let SVlan = parseInt(svlanSer[1])
           let policyMap = svlanSer[2]
           let classMap = findClasMap(policyMap)
           let matchRules = findRule(classMap)
           let ifname:string = ''
           let outPorts = vlanPortsPortraitMap.get(SVlan)
           if (!outPorts) {
               logger.error(`buildOntFlowPortrait: ${SVlan} no output port`)
               outPorts = []
           }
           if (regRes) {
             ifname = regRes[1]
           }else {
               logger.error(`buildOntFlowPortrait: port ${svlanSer[0]} invalid`)
               continue
           }
           let flowInfo:DiagFlowPortrait= {
            flowId: flowId,
            ontId: ontId, 
            ontPort: ifname,
            match: matchRules,
            ontOutVlan: SVlan,
            gemId: [],
            oltPonPort: '', 
            tid:[],
            oltOutVlan: SVlan, 
            oltVlanAction: 'none', 
            oltOutPorts: [...outPorts]
           }
           flowList.push(flowInfo)
        }      
        return flowList
    }
    
    async buildOltPortrait():Promise<DiagOltPortrait[]>{
        let cmdRes = await this.invesClient?.sendCommand('show interface ethernet status admin-state')
        let resAdmin = this.diagOnt.findEtherPortAdmin(cmdRes)
        cmdRes = await this.invesClient?.sendCommand('show interface ethernet status oper-state')
        let resOpera = this.diagOnt.findEtherPortOpera(cmdRes)
        
        if (resAdmin.length != resOpera.length) {
            logger.error(`buildOltPortrait: admin length ${resAdmin.length} doesn't match ${resOpera.length}`)
            return []
        }
        for (let ii = 0; ii < resAdmin.length; ii++) {
            resAdmin[ii].push(resOpera[ii][1])    
        }

        let mapPorts = new Map<string, DiagOltPortPortrait[]>()
        for (let adminItem of resAdmin) {
            let port = adminItem[0]
            let regexRes = /(\d+)\/(\d+)\/(\S+)/.exec(port)
            let shelf, slot, name, mapStr
            if (regexRes) {
                shelf = parseInt(regexRes[1])
                slot = parseInt(regexRes[2])
                name = regexRes[3]
                mapStr = `${regexRes[1]}/${regexRes[2]}` 
            }else {
                continue
            }
            let portraitArr = mapPorts.get(mapStr)
            let addItem: DiagOltPortPortrait = {
                shelf:shelf,
                slot:slot,
                ifname:name,
                adminState:adminItem[1] === 'enable'? "enable":"disable",
                operState: adminItem[2] === 'up'? "up":'down'
            }
            if (portraitArr) {
                portraitArr.push(addItem)
            }else {
                mapPorts.set(mapStr, [addItem])
            }
        }

        let oltPortraitList:DiagOltPortrait[] = []
        for (let item of mapPorts.entries()) {
            if (item[1].length === 0) {
                continue
            }
            let oltPortrait:DiagOltPortrait = {
                shelf:item[1][0].shelf,
                slot:item[1][0].slot,
                ponPorts:[],
                ethPorts:[]
            }
            oltPortrait.ethPorts.push(...item[1])
            oltPortraitList.push(oltPortrait)
        }
        return oltPortraitList
    }

    async buildOntDiagCompose(OntId:string) {
        let res = await this.buildOltPortrait()

        let res1 = await this.buildOntPortrait(OntId)

        let res2 = await this.buildOntFlowPortrait(OntId)
        let diagCompose:DiagCompose ={
            olts:res,
            ont:res1,
            flows:res2
        }
        return diagCompose
    }
    
    async testOntRelaCfg() {

        let cmdRes = await this.invesClient?.sendCommand('show running-config ont')

        let res = this.diagOnt.findOnt(cmdRes)
        console.log(res)
        cmdRes = await this.invesClient?.sendCommand('show ont linkage')
        if (cmdRes === -1) {
            logger.error('getOntRelaCfg: show ont linkage no res')
            return -1
        }

        res = await this.diagOnt.findOntLink(cmdRes)
        console.log(res)

        cmdRes = await this.invesClient?.sendCommand('show ont-linkages ont-linkage')
        if (cmdRes === -1) {
            logger.error('getOntRelaCfg: show ont ont-linkages ont-linkage no res')
            return -1
        }

        res = await this.diagOnt.findOntLinkage(cmdRes)
        console.log(res)        

        cmdRes = await this.invesClient?.sendCommand('show running-config interface ont-ethernet')
        res = this.diagOnt.findOntEtherSCVlanServ('', cmdRes)
        console.log(res)

        res = this.diagOnt.findOntEtherSVlanServ('', cmdRes)
        console.log(res)        

        cmdRes = await this.invesClient?.sendCommand('show running-config class-map ethernet')
        res = this.diagOnt.findClassMap(cmdRes)
        console.log(res)

        res = this.diagOnt.findClassMapEtherRule('', cmdRes)
        console.log(res)        

        cmdRes = await this.invesClient?.sendCommand('show interface ont-ethernet status')
        res = this.diagOnt.findOntEtherStatus('', cmdRes)
        console.log(res)      

        cmdRes = await this.invesClient?.sendCommand(`show running policy-map`)
        res = this.diagOnt.findPolicyMapEthClassMap(cmdRes)
        console.log(res)   
        return 0
    }


    async BuildAllOnts():Promise<string[]> {
        let cmdRes = await this.invesClient?.sendCommand('show running-config ont')
        let ontRes = this.diagOnt.findOnt(cmdRes)
        let ret:string[] = []
        for (let ont of ontRes) {
            ret.push(ont[0])
        }
        return ret
    }
}


if (__filename === require.main?.filename) {
    (async()=>{
        let axosDiag = new AXOSDiag()
        await axosDiag.login('10.245.34.156')
        logger.setLogLevel('std', 'error')
        logger.setLogLevel('file', 'info')
        // logger.closeStdout()        
        // await axosDiag.getRunningCfg()
        // await axosDiag.testOntRelaCfg()
        // let res = await axosDiag.buildOltPortrait()
        // console.log(res)
        // let res1 = await axosDiag.buildOntPortrait('836')
        // console.log(res1)

        // let res2 = await axosDiag.buildOntFlowPortrait('836')
        // console.log(JSON.stringify(res2))

        let res = await axosDiag.buildOntDiagCompose('836')
        console.log(JSON.stringify(res))
    })()


}