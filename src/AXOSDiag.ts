import logger from "./logger"
import {AXOSCard, ConnectMode} from "./AXOSCard"
import {DiagOnt} from "./DiagOnt"
import { CliResFormatMode, ResultSplit } from "./ResultSplit"
import {DiagOltPortPortrait, DiagOltPortrait, DiagOntPortrait, 
        DiagOntIfPortrait, DiagFlowPortrait, DiagCompose,
        DiagFlowIngressQos, DiagOntLink, DiagFlowStats, DiagOntAllFlowStats} from "./DiagPub"
import {Semaphore} from "./Semaphore"

enum AXOSCardType {
    AXOSCard_Type_Unknown,
    AXOSCard_Type_GPON8,
    AXOSCard_Type_NGPON2X4,
    AXOSCard_Type_XG801,
    AXOSCard_Type_NG1601,
    AXOSCard_Type_GP1601,
    AXOSCard_Type_GP1611,   
    AXOSCard_Type_E3,
    AXOSCard_Type_E3Combi,
    AXOSCard_Type_NOPON,
}

enum AXOSCardState {
    AXOSCard_State_Unknown,
    AXOSCard_State_InService,
    AXOSCard_State_Degrade,
    AXOSCard_State_offLine,
}
interface AXOSCardInfo {
    shelf:number,
    slot:number,
    pos:string,
    cardType:AXOSCardType
    cardState:AXOSCardState
    IsActive:boolean
}

interface GemStats {
    usPkts:number,
    usBytes:number,
    dsPkts:number,
    dsBytes:number,
    timeStamp:number
}

interface FlowStat {
    flowkey:string,
    curIdx:number,
    gemStats:GemStats[]
}

type FlowHistStat = Map<string, FlowStat>

interface OntDiagStatMonitor {
    diagCom:DiagCompose
    intervalHandler:NodeJS.Timer|undefined,
    flowStats:FlowHistStat,
}

export class AXOSDiag extends AXOSCard {
    runningCfg:string
    diagOnt:DiagOnt
    cardsInfo:AXOSCardInfo[] = []
    activeCard:AXOSCardInfo|undefined
    connectIp:string = ''
    connectCard:string = ''
    statInterval = 10 // 10 seconds
    ontPortraitMap = new Map<string, OntDiagStatMonitor>()
    maxStatRecord = 10
    semControl = new Semaphore(1)
    constructor() {
        super()
        this.runningCfg = ''
        this.diagOnt = new DiagOnt()
    }

    async semExecLogin(ipAddr:string) {
        return this.semControl.callFunction(this.login.bind(this), ipAddr)
    }

    async login(ipAddr:string):Promise<number> {
        if (this.connectIp === ipAddr) {
            return 0
        }

        if (this.invesClient) {
            await this.disconnect()
        }

        this.connectIp = ipAddr
        let res = await this.connect(ipAddr)
        if (res === -1) {
            return res
        }
        
        await this.execCliCommand('paginate false')
        await this.retrieveCardList()
        this.connectCard =  `${this.activeCard?.shelf}/${this.activeCard?.slot}`       
        return 0
    }


    async disconnect() {
        this.connectIp = ''
        await super.disconnect()
        for (let oo of this.ontPortraitMap.values()) {
            if (oo.intervalHandler) {
                clearInterval(oo.intervalHandler)
            }
        }
        this.ontPortraitMap.clear()
    }

    async execCliCommand(cmd:string, cmdTimeOut:number=20000):Promise<string> {
        if (!this.invesClient) {
            return ''
        }

        if (this.currentMode === ConnectMode.ConnectMode_SHELL) {
            if (this.connectCard != `${this.activeCard?.shelf}/${this.activeCard?.slot}`) {
                await this.invesClient.sendCommand('exit')
            }
            await this.invesClient.sendCommand('cli')
            await this.invesClient.sendCommand('paginate false')
            this.currentMode = ConnectMode.ConnectMode_CLI
            this.connectCard =  `${this.activeCard?.shelf}/${this.activeCard?.slot}`
        }
        return this.invesClient.sendCommand(cmd, cmdTimeOut)
    } 

    async execShellCommand(cmd:string, card:string='', timeout:number = 20000):Promise<string|number> {

        if (!this.invesClient) {
            return -1
        }

        if (card === '') {
            card = this.connectCard
        }
        // need use crack.py to login the linux 
        if (this.connectMode === ConnectMode.ConnectMode_CLI) {
            let rc = await this.crackLogin()
            if (rc != 0) {
                return rc
            }
        }

        if (this.currentMode === ConnectMode.ConnectMode_CLI) {
            await this.invesClient.sendCommand('exit')
            if (this.connectCard != card) {
                await this.invesClient.sendCommand('jump2c.sh ' + card)
            }
            this.connectCard = card
            this.currentMode = ConnectMode.ConnectMode_SHELL
        }else {
            if (this.connectCard != card) {
                if (this.connectCard === `${this.activeCard?.shelf}/${this.activeCard?.slot}`) {
                    await this.invesClient.sendCommand('jump2c.sh ' + card)
                }else {
                    await this.invesClient.sendCommand('exit')
                    await this.invesClient.sendCommand('jump2c.sh ' + card)
                }
                this.connectCard = card
            }
        }
        
        let rc = await this.invesClient.sendCommand(cmd, timeout)
        return rc
    }
    async retrieveCardList():Promise<number|AXOSCardInfo[]>{
        let res = await  this.execCliCommand("show card | csv")
        if (res === '') {
            return -1
        }
        this.cardsInfo = []

        let cardList = this.diagOnt.findCardList(res as string)
        for (let card of cardList) {
            let cardInfo:AXOSCardInfo = {} as AXOSCardInfo
            cardInfo.cardType = AXOSCardType.AXOSCard_Type_Unknown
            cardInfo.IsActive = false
            let shelfSlot = /(\d+)\/(\d+)/.exec(card[0])
            if (!shelfSlot) {
                logger.error(`getCardList: card position ${card[0]} invalid`)
                continue
            }

            cardInfo.shelf = parseInt(shelfSlot[1])
            cardInfo.slot = parseInt(shelfSlot[2])
            cardInfo.pos = card[0]
            
            if (card[2].indexOf('In Service') != -1) {
                cardInfo.cardState = AXOSCardState.AXOSCard_State_InService
            }else if (card[2].indexOf('Degraded') != -1) {
                cardInfo.cardState = AXOSCardState.AXOSCard_State_Degrade
            }else {
                cardInfo.cardState = AXOSCardState.AXOSCard_State_offLine
            }

            if (card[1].indexOf('GPON-8r2') != -1) {
                cardInfo.cardType = AXOSCardType.AXOSCard_Type_GPON8
            }else if (card[1].indexOf('XG801') != -1) {
                cardInfo.cardType = AXOSCardType.AXOSCard_Type_XG801
            }else if (card[1].indexOf('NGPON2-4') != -1) {
                cardInfo.cardType = AXOSCardType.AXOSCard_Type_NGPON2X4
            }else if (card[1].indexOf('NG1601') != -1) {
                cardInfo.cardType = AXOSCardType.AXOSCard_Type_NG1601
            }else if (card[1].indexOf('GP1601') != -1) {
                cardInfo.cardType = AXOSCardType.AXOSCard_Type_GP1601
            }else if (card[1].indexOf('GP1611') != -1) {
                cardInfo.cardType = AXOSCardType.AXOSCard_Type_GP1611
            }else {
                cardInfo.cardType = AXOSCardType.AXOSCard_Type_NOPON
            }

            if (card[3].indexOf('Active') != -1) {
                cardInfo.IsActive = true
                this.activeCard = cardInfo
            }

            this.cardsInfo.push(cardInfo)
           
        }    
        // console.log(this.cardsInfo)
        return this.cardsInfo    
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
        let cmdRes = await this.execCliCommand(`show  ont ${ontId} linkage`)
        let resLinkState = this.diagOnt.findOntLink(cmdRes)
        let etherPorts: DiagOntIfPortrait[] = []
        let veipPorts:DiagOntIfPortrait[]=[]

        let errRes:DiagOntPortrait = {
            ontId:ontId,
            profileId:'',
            state:'missing',
            connPon:'',
            ontOutInterface:[],
            ontInInterface:[],
            ontVeipInterface:veipPorts
        }

        if (resLinkState.length != 0) {
            if (resLinkState[0][0] === 'Confirmed') {
                ontLinked = true
            }
        }
        logger.info(`ONT ${ontId} linked ${ontLinked}`)

        cmdRes = await this.execCliCommand(`show running ont ${ontId}`)
        let profIds = this.diagOnt.findOntProfileId(cmdRes, ontId)
        let profId = ''
        if (profIds && profIds[0]) {
            profId = profIds[0][1]
        }


        cmdRes = await this.execCliCommand(`show running interface ont-ethernet ${ontId}/*`)
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

        cmdRes =  await this.execCliCommand(`show running-config ont-profile ${profId}`)
        let veip = this.diagOnt.findOntProfilePortInfo(cmdRes, profId, 'full-bridge')
        let veiptmp = this.diagOnt.findOntProfilePortInfo(cmdRes, profId, 'rg')
        veip.concat(veiptmp)
        veiptmp = this.diagOnt.findOntProfilePortInfo(cmdRes, profId, 'rg')
        veip.concat(veiptmp)
        
        for (let oo of veip) {
            veipPorts.push({
                ifname: oo[1],
                veipIf:'',
                adminState:"enable",
                operState: 'up'
            })
        }



        if (ontLinked === false) {
            let ontReturn:DiagOntPortrait = {
                ontId: ontId,
                profileId:profId,
                state:'missing',
                connPon:'',
                ontOutInterface:etherPorts,
                ontInInterface:[],
                ontVeipInterface:veipPorts
            }
            return ontReturn
        }

        
        let ontReturn:DiagOntPortrait = {
            ontId: ontId,
            profileId:profId,
            state: 'missing',
            connPon:'',
            ontOutInterface:etherPorts,
            ontInInterface:[],
            ontVeipInterface:veipPorts
        }

        cmdRes = await this.execCliCommand(`show  ont ${ontId} status`)
        let ontSt = this.diagOnt.findOntStatus(cmdRes)
        
        if (ontSt && ontSt[0][0] === 'present') {
            ontReturn.state = 'present'
        }

        cmdRes = await this.execCliCommand(`show interface ont-ethernet ${ontId}/* status`)
        let resStatus = this.diagOnt.findOntEtherStatus('', cmdRes)

        cmdRes = await this.execCliCommand(`show ont-linkages ont-linkage ont-id ${ontId}`)
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
        let cmdRes =   await this.execCliCommand(`show running-config transport-service-profile`)
        let transRes = this.diagOnt.findTransProfile(cmdRes)
        cmdRes = await this.execCliCommand(`show running-config interface ethernet`)
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

    // if ONT has ont-ua provision, append the ont-ua interface to ont Portrait
    async appendOntInterInterface(ontPortrait:DiagOntPortrait, flowPortrait:DiagFlowPortrait[]) {
        for (let flow of flowPortrait) {
            if (flow.ontPort.indexOf('i') === 0) {
                ontPortrait.ontInInterface.push({
                    ifname:flow.ontPort, 
                    veipIf:"",
                    adminState:"enable",
                    operState: 'up'          
                })
            }
        }
    }

    async appendOntVeipInterface(ontPortrait:DiagOntPortrait, flowPortrait:DiagFlowPortrait[]) {

    }

    async buildOntFlowPortrait(ontId:string):Promise<DiagFlowPortrait[]>{
        let cmdRes =   await this.execCliCommand(`show running interface ont-ethernet ${ontId}/*`)
        let resSvlan = this.diagOnt.findOntEtherSVlanServ(ontId, cmdRes)
        let resSCvlan = this.diagOnt.findOntEtherSCVlanServ(ontId, cmdRes)
        let etherPortRes = this.diagOnt.fidnOntEtherRole('', cmdRes)
        let etherPorts = etherPortRes.map((a)=>a[0])
        let resDtagVlan = this.diagOnt.findOntDtagServ(ontId, cmdRes, 'ont-ethernet')
        


        cmdRes =   await this.execCliCommand(`show running interface rg ${ontId}/*`)
        let tmpServ = this.diagOnt.findOntSVlanServ(ontId, cmdRes, 'rg')
        resSvlan = resSvlan.concat(tmpServ)
        tmpServ = this.diagOnt.findOntSCVlanServ(ontId, cmdRes, 'rg')
        resSCvlan = resSCvlan.concat(tmpServ)
        tmpServ = this.diagOnt.findOntDtagServ(ontId, cmdRes, 'rg')
        resDtagVlan.concat(tmpServ)


        cmdRes =   await this.execCliCommand(`show running interface ont-ua ${ontId}/*`)
        tmpServ = this.diagOnt.findOntSVlanServ(ontId, cmdRes, 'ont-ua')
        resSvlan = resSvlan.concat(tmpServ)
        tmpServ = this.diagOnt.findOntSCVlanServ(ontId, cmdRes, 'ont-ua')
        resSCvlan = resSCvlan.concat(tmpServ)
        tmpServ = this.diagOnt.findOntDtagServ(ontId, cmdRes, 'ont-ua')
        resDtagVlan.concat(tmpServ)        

        cmdRes =   await this.execCliCommand(`show running interface full-bridge ${ontId}/*`)
        tmpServ = this.diagOnt.findOntSVlanServ(ontId, cmdRes, 'full-bridge')
        resSvlan = resSvlan.concat(tmpServ)
        tmpServ = this.diagOnt.findOntSCVlanServ(ontId, cmdRes, 'full-bridge')
        resSCvlan = resSCvlan.concat(tmpServ)
        tmpServ = this.diagOnt.findOntDtagServ(ontId, cmdRes, 'full-bridge')
        resDtagVlan.concat(tmpServ)       

        let usedPolicyMap = new Set<string>()
        
        let flowId = 0
        for (let svlanSer of resSvlan) {
            usedPolicyMap.add(svlanSer[2])
        }

        for (let scvlanSer of resSCvlan) {
            usedPolicyMap.add(scvlanSer[3])
        }
        for (let dtagSvc of resDtagVlan) {
            usedPolicyMap.add(dtagSvc[2])
        }


        if (usedPolicyMap.size === 0) {
            logger.error('buildOntFlowPortrait no service with policymap created ')
            return []
        }
        // find all the policymap and classmap
        cmdRes = await this.execCliCommand(`show running policy-map`, 20000)
        let resPolicyClassMap = this.diagOnt.findPolicyMapEthClassMap(cmdRes)

        cmdRes = await this.execCliCommand('show running-config class-map ethernet', 20000)
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

        cmdRes = await this.execCliCommand(`show ont ${ontId} qos|csv`, 20000)
        /*
        [['1021','-','gp1100_2/x1','cos-1','BE-1','0','15000','-','0','15104']]
        only ingress
        */
        let ontQos = this.diagOnt.findOntQosInfo(cmdRes)

        let findQos = (svlan:string, cvlan:string, ontport:string):string[]=>{
            for (let qos of ontQos) {
                if (qos[0] === svlan && cvlan === qos[1] && ontport === qos[2]) {
                    return qos
                }
            }
            return []
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

        cmdRes = await this.execCliCommand(`show ont ${ontId} qos|csv`, 20000)
        let tmTidMap = await this.parseOntTidPidMap(ontId)

        let findTidPid = (port:string, vlan:number):{interPon:number, tid:number[], pid:number[]}=>{
            let iType = -1
            let portNum = -1
            let ret = {} as {interPon:number, tid:number[], pid:number[]}
            ret.tid = []
            ret.pid = []
            ret.interPon = 0


            if (!isNaN(parseInt(port))) {
                iType = 0
                portNum = parseInt(port)
            }else {
                let regRes = /(\S)(\d)/.exec(port)
                if (regRes) {
                    switch(regRes[1]) {
                        case 'G':
                            iType = 5
                            portNum = 2
                            break
                        case 'g':
                        case 'x':
                            portNum = etherPorts.indexOf(`${ontId}/${port}`) + 1
                            iType = 2
                            break
                        default:
                            break
                    }
                }else {
                    logger.error('findTidPid:invalid port ' + port)
                }
            }            

            let buildService = `${iType}/${portNum}.${vlan}`
            for (let tidPidItem of tmTidMap) {
                if (tidPidItem[1].indexOf(buildService) != -1) {
                    let cos = parseInt(tidPidItem[2])
                    if (isNaN(cos)) {
                        logger.error('findTidPid: parse cos error' + JSON.stringify(tidPidItem))
                        break
                    }
                    let tidRegRes = /\d-\s+(\d+)/.exec(tidPidItem[3])
                    if (!tidRegRes) {
                        logger.error('findTidPid: parse tid error' + JSON.stringify(tidPidItem))
                        break
                    }
                    let tid = parseInt(tidRegRes[1])
                    let startPid = parseInt(tidPidItem[4])
                    if (isNaN(startPid)) {
                        logger.error('findTidPid: parse pid error' + JSON.stringify(tidPidItem))
                        break
                    }

                    let interPon = parseInt(tidPidItem[0])
                    if (isNaN(interPon)) {
                        logger.error('findTidPid: parse internal pon error' + JSON.stringify(tidPidItem))
                        break
                    }
                    ret.interPon = interPon
                    ret.tid.push(tid)
                    for (let ii = 0; ii < cos; ii++) {
                        ret.pid.push(startPid + ii)
                    }

                }

            }
            return ret
        }

        let flowList:DiagFlowPortrait[] = []
        let buildFlow = (vlanSer:string[][], isSC:boolean)=>{
            for (let svlanSer of vlanSer) {
                flowId++
                let regRes = /\S+\/(\S+)/.exec(svlanSer[0])
                let SVlan = parseInt(svlanSer[1])
                let Cvlan = isSC?parseInt(svlanSer[2]):0
                let policyMap = isSC?svlanSer[3]:svlanSer[2]
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
                let qos = findQos(svlanSer[1], isSC?svlanSer[2]:'-', ontId + '/' + ifname)
     
                let ingQos:DiagFlowIngressQos = {
                 provCir:parseInt(qos[5])?parseInt(qos[5]):0,
                 provEir:parseInt(qos[6])?parseInt(qos[6]):0,
                 ponCos:qos[3], 
                 dbaPriority:qos[4], 
                 ponCosCir:parseInt(qos[7])?parseInt(qos[7]):0,
                 ponCosAir:parseInt(qos[8])?parseInt(qos[8]):0,
                 ponCosEir:parseInt(qos[9])?parseInt(qos[9]):0,
             }
                let tidPid = findTidPid(ifname,  isSC?Cvlan:SVlan)

                let flowInfo:DiagFlowPortrait= {
                 flowId: flowId,
                 key:ontId + '/' + ifname + '.' +  (isSC?`${SVlan}.${Cvlan}`:`${SVlan}`),
                 ontId: ontId, 
                 ontPort: ifname,
                 match: matchRules,
                 ontOutVlan: isSC?Cvlan:SVlan,
                 gemId: tidPid.pid,
                 oltPonPort: '', 
                 tid:tidPid.tid,
                 oltOutVlan: SVlan, 
                 oltVlanAction: isSC?'add':"none", 
                 oltOutPorts: [...outPorts],
                 ingressQos:[ingQos],
                 egressQos:[],
                 interPon:tidPid.interPon
                }
                flowList.push(flowInfo)
             }      

        }



        buildFlow(resSvlan, false)
        buildFlow(resSCvlan, true)
        for (let oo of resDtagVlan) {
            let dtagvlans = oo[1].split(' ')
            oo.splice(1,1, dtagvlans[0])
            oo.splice(2,0, dtagvlans[1])
        }

        buildFlow(resDtagVlan, true)

        // Dtag service follow SC servcie


        // append 'i' to the ont-ua 
        for (let flow of flowList) {
            if (flow.ontPort.length === 1 && !isNaN(parseInt(flow.ontPort))) {
                flow.ontPort = 'i' + flow.ontPort
            }
        }

        return flowList
    }
    
    async buildOltPortrait():Promise<DiagOltPortrait[]>{
        let cmdRes = await this.execCliCommand('show interface ethernet status admin-state')

        let resAdmin = this.diagOnt.findEtherPortAdmin(cmdRes)
        cmdRes = await this.execCliCommand('show interface ethernet status oper-state')
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

    async semExecOntFlowsStatCollect(ontDiag:OntDiagStatMonitor, that:AXOSDiag) {
        return await that.semControl.callFunction(that.OntFlowsStatCollect, ontDiag, that)
    }
    // callback of the stats interval , can not use this 
    async OntFlowsStatCollect(ontDiag:OntDiagStatMonitor, that:AXOSDiag) {
        for (let flow of ontDiag.diagCom.flows) {
            let stat = await that.retrieveFlowStat(flow)
            if (stat === -1) {
                logger.error(`OntFlowsStatCollect: flow ${flow.key} no stat`)
                continue
            }
            let flowStatItem = ontDiag.flowStats.get(flow.key)
            if (!flowStatItem) {
                let flowStat:FlowStat = {
                    flowkey: flow.key,
                    gemStats:[stat as GemStats],
                    curIdx:0
                } 
                ontDiag.flowStats.set(flow.key, flowStat)
            }else {
                if (flowStatItem.gemStats.length < that.maxStatRecord) {
                    flowStatItem.gemStats.push(stat as GemStats)
                    flowStatItem.curIdx = flowStatItem.gemStats.length - 1
                }else {
                    let curidx = (flowStatItem.curIdx  + 1) % that.maxStatRecord
                    flowStatItem.gemStats[curidx] = stat as GemStats
                    flowStatItem.curIdx =curidx
                }
            }
        }        

        for (let flowstat of ontDiag.flowStats.values()) {
            logger.error(JSON.stringify(flowstat))
        }
        
    }

    async SemExecBuildOntDiagCompose(ontId:string) {
        for (let oo of this.ontPortraitMap.values()) {
            if (oo.intervalHandler) {
                clearInterval(oo.intervalHandler)
                oo.intervalHandler = undefined
            }
        }
        return await this.semControl.callFunction(this.buildOntDiagCompose.bind(this), ontId)
  
    }
    async buildOntDiagCompose(OntId:string) {
        let that = this
        let res = await this.buildOltPortrait()

        let res1 = await this.buildOntPortrait(OntId)

        let res2 = await this.buildOntFlowPortrait(OntId)
        await this.appendOntInterInterface(res1, res2)

        // update the flow PON port 
        for (let flow of res2) {
            flow.oltPonPort = res1.connPon 
        }
        let diagCompose:DiagCompose ={
            olts:res,
            ont:res1,
            flows:res2
        }

        let item = this.ontPortraitMap.get(OntId)
        if (item) {
            item.diagCom = diagCompose
        }else {
            let ontMointor:OntDiagStatMonitor = {
                diagCom:diagCompose,
                intervalHandler:<NodeJS.Timer>{},
                flowStats: new  Map<string, FlowStat>()
            }
            this.ontPortraitMap.set(OntId, ontMointor)    
            ontMointor.intervalHandler = setInterval(that.semExecOntFlowsStatCollect, that.statInterval*1000, ontMointor, that)
        }


        return diagCompose
    }
    
    async testOntRelaCfg() {

        let cmdRes = await this.execCliCommand('show running-config ont')
        if (cmdRes === '') {
            logger.error('getOntRelaCfg: show running-config ont')
            return -1          
        }
        let res = this.diagOnt.findOnt(cmdRes as string)
        console.log(res)
        cmdRes = await this.execCliCommand('show ont linkage')
        if (cmdRes === '') {
            logger.error('getOntRelaCfg: show ont linkage no res')
            return -1
        }

        res = await this.diagOnt.findOntLink(cmdRes as string)
        console.log(res)

        cmdRes = await this.execCliCommand('show ont-linkages ont-linkage')
        if (cmdRes === '') {
            logger.error('getOntRelaCfg: show ont ont-linkages ont-linkage no res')
            return -1
        }

        res = await this.diagOnt.findOntLinkage(cmdRes)
        console.log(res)        

        cmdRes = await this.execCliCommand('show running-config interface ont-ethernet')
        res = this.diagOnt.findOntEtherSCVlanServ('', cmdRes)
        console.log(res)

        res = this.diagOnt.findOntEtherSVlanServ('', cmdRes)
        console.log(res)        

        cmdRes = await this.execCliCommand('show running-config class-map ethernet')
        res = this.diagOnt.findClassMap(cmdRes)
        console.log(res)

        res = this.diagOnt.findClassMapEtherRule('', cmdRes)
        console.log(res)        

        cmdRes = await this.execCliCommand('show interface ont-ethernet status')
        res = this.diagOnt.findOntEtherStatus('', cmdRes)
        console.log(res)      

        cmdRes = await this.execCliCommand(`show running policy-map`)
        res = this.diagOnt.findPolicyMapEthClassMap(cmdRes)
        console.log(res)   
        return 0
    }


    async BuildAllOnts():Promise<string[]> {
        let cmdRes = await this.execCliCommand('show running-config ont')
        let ontRes = this.diagOnt.findOnt(cmdRes)
        let ret:string[] = []
        for (let ont of ontRes) {
            ret.push(ont[0])
        }
        return ret
    }

    async semExecBuildAllOntsWithLinkinfo():Promise<DiagOntLink[]>{
        let ret = this.semControl.callFunction(this.BuildAllOntsWithLinkinfo.bind(this))
        return ret as DiagOntLink[]
    }

    async BuildAllOntsWithLinkinfo():Promise<DiagOntLink[]> {
        let cmdRes = await this.execCliCommand('show running-config ont')
        let ontRes = this.diagOnt.findOnt(cmdRes)
        let ret:DiagOntLink[] = []
        for (let ont of ontRes) {
            ret.push({
                ontId:ont[0],
                linkPon:'',
                state:'missing'
            })
        }

        cmdRes = await this.execCliCommand('show ont-linkages ont-linkage')
        let ontLinkage = await this.diagOnt.findOntLinkage(cmdRes)
        for (let ontLink of ontLinkage) {
            let ontId = ontLink[0] 
            
            for (let ont of ret) {
                if (ont.ontId === ontId) {
                    ont.linkPon = ontLink[1] + '/'+ ontLink[2] + '/' + ontLink[3]
                    break
                }
            }
        }

        cmdRes = await this.execCliCommand('show discovered-onts|csv')
        let ontDiscovers = await this.diagOnt.findDiscoverOnts(cmdRes)
        for (let ontDis of ontDiscovers) {
            let ontId = ontDis[5] 
            
            for (let ont of ret) {
                if (ont.ontId === ontId) {
                    ont.state = 'present'
                    break
                }
            }
        }       
       
        ret = ret.sort((a:DiagOntLink,b:DiagOntLink)=>{
            if (a.linkPon === '') {
                return 1
            }
            if (b.linkPon === '') {
                return -1
            }

            if (a.linkPon < b.linkPon) {
                return -1
            }else if (a.linkPon > b.linkPon) {
                return 1
            }else {
                if (a.ontId < b.ontId) {
                    return -1
                }else {
                    return 1
                }
            }


        })
        return ret
    }

    async parseOntTidPidMap(ontId:string):Promise<string[][]>{
        let cmdRes = await this.execCliCommand(`ont-debug diag-info ont-id ${ontId}`)
        let ontRes = this.diagOnt.findOntTidPidMap(cmdRes, ontId)
        return ontRes
    }


    async retrieveFlowStat(flow:DiagFlowPortrait):Promise<GemStats | number> {
        let cardPosReg = /(\d+)\/(\d+)\//.exec(flow.oltPonPort)
        let cmdRes:any
        if (!cardPosReg) {
            logger.error('retrieveFlowStat: pon ' + flow.oltPonPort + ' invalid')
            return -1
        }
        let flowPos = `${cardPosReg[1]}/${cardPosReg[2]}`
        let cardInfo:AXOSCardInfo | undefined
        for (let card of this.cardsInfo) {
            if (flowPos === card.pos) {
                cardInfo = card
                break
            }
        }

        if (cardInfo === undefined) {
            logger.error('retrieveFlowStat: No card, pon ' + flow.oltPonPort)
            return -1
        }
        let usBytes = 0, dsBytes = 0
        let usPkts = 0, dsPkts = 0
        // ASPEN card
        if (cardInfo.cardType === AXOSCardType.AXOSCard_Type_E3Combi || cardInfo.cardType === AXOSCardType.AXOSCard_Type_XG801) {
            cmdRes = await this.execShellCommand(`dcli olttcmgrd aspen gem stats show pon ${flow.interPon} start_gem ${flow.gemId[0]} count ${flow.gemId.length}`, flowPos)
            if (cmdRes != -1) {
                let gemStats = this.diagOnt.findAspenGemStats(cmdRes)

                for (let gemStat of gemStats) {
                    usBytes += parseInt(gemStat[4])
                    dsBytes += parseInt(gemStat[6])
                    usPkts += parseInt(gemStat[3])
                    dsPkts += parseInt(gemStat[5])
                }
            }
        }else {
            cmdRes = await this.execShellCommand(`dcli olttcmgrd -- te uspid  show  -count  ${flow.gemId.length} ${flow.interPon} ${flow.gemId[0]} `, flowPos)
            if (cmdRes != -1) {
                let gemStats = this.diagOnt.findFpgaGemStats(cmdRes)

                for (let gemStat of gemStats) {
                    usBytes += parseInt(gemStat[2])
                    usPkts += parseInt(gemStat[3]) + parseInt(gemStat[4]) + parseInt(gemStat[5])
                }
            }
            cmdRes = await this.execShellCommand(`dcli olttcmgrd -- te dspid  show  -count  ${flow.gemId.length} ${flow.interPon} ${flow.gemId[0]} `, flowPos)
            if (cmdRes != -1) {
                let gemStats = this.diagOnt.findFpgaGemStats(cmdRes)

                for (let gemStat of gemStats) {
                    dsBytes += parseInt(gemStat[2])
                    dsPkts += parseInt(gemStat[3]) + parseInt(gemStat[4]) + parseInt(gemStat[5])
                }
            }

        }

        return <GemStats>{
            usPkts:usPkts,
            usBytes:usBytes,
            dsPkts:dsPkts,
            dsBytes:dsBytes,
            timeStamp: Date.now()
        }
    }

    async getOntAllFlowStats(ontId:string):Promise<DiagOntAllFlowStats|number> {
        let ontMonitor = this.ontPortraitMap.get(ontId)
        if (!ontMonitor) {
            return -1
        }

        let ontFlowStats:DiagOntAllFlowStats = {
            ontId:ontId,
            flows:[]
        }
        
        for (let oo of ontMonitor.flowStats.values()) {
            let usRate = 0, dsRate = 0
            let preIdx = -1
            try {
                if (oo.gemStats.length > 1) {
                    preIdx = oo.curIdx -1
                    if (preIdx < 0) {
                        preIdx += this.maxStatRecord
                    }
                    usRate = ((oo.gemStats[oo.curIdx].usBytes - oo.gemStats[preIdx].usBytes) * 8*1000)
                             /(oo.gemStats[oo.curIdx].timeStamp - oo.gemStats[preIdx].timeStamp)
                    dsRate = ((oo.gemStats[oo.curIdx].dsBytes - oo.gemStats[preIdx].dsBytes) * 8*1000)
                            /(oo.gemStats[oo.curIdx].timeStamp - oo.gemStats[preIdx].timeStamp)
                }
            }catch(e){

            }

            let flow:DiagFlowStats = {
                key:oo.flowkey,
                usRate:usRate,
                dsRate:dsRate
            }
            ontFlowStats.flows.push(flow)
        }

        return ontFlowStats
    }
}


if (__filename === require.main?.filename) {
    (async()=>{
        let axosDiag = new AXOSDiag()
        let ret = await axosDiag.login('10.245.66.134')
        console.log(ret)
        logger.setLogLevel('std', 'error')
        logger.setLogLevel('file', 'info')

        // let rc = await axosDiag.execShellCommand('dcli ponmgrd history')
        // console.log(rc)
        // rc = await axosDiag.execShellCommand('dcli olttcmgrd aspen ont show')
        // console.log(rc)
        // rc = await axosDiag.execCliCommand('show discovered-onts')
        // console.log(rc)
        
        // logger.closeStdout()        
        // await axosDiag.getRunningCfg()
        // await axosDiag.testOntRelaCfg()
        // let res = await axosDiag.buildOltPortrait()
        // console.log(res)
        // let res1 = await axosDiag.buildOntPortrait('836')
        // console.log(res1)

        // let res2 = await axosDiag.buildOntFlowPortrait('836')
        // console.log(JSON.stringify(res2))

        // await axosDiag.parseOntTidPidMap('836')
        // let res = await axosDiag.buildOntDiagCompose('x1101')
        // console.log(JSON.stringify(res))

        // let res =  axosDiag.semExecBuildAllOntsWithLinkinfo()
        // console.log(res)
        let res 
        res =  await axosDiag.SemExecBuildOntDiagCompose('szang_xgs');
        console.log(JSON.stringify(res))

        // axosDiag.semExecBuildAllOntsWithLinkinfo()
        // console.log(res)     
        // let rc = await axosDiag.execShellCommand('dcli olttcmgrd aspen gem stats show pon 7 start_gem 1028 count 1', '1/2')
        // rc = await axosDiag.execShellCommand('dcli olttcmgrd aspen gem stats show pon 7 start_gem 1028 count 8', '1/2')
        // console.log(rc)
        // for (let flow of res.flows) {
        //     let stat = await axosDiag.retrieveFlowStat(flow)
        //     console.log(stat)
        // }

    })()


}