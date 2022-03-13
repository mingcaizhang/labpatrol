export type DiagGradeItem = {
    prefix: string,
    value:string
}

export type DiagGradeItemList = DiagGradeItem []
export type DiagGradePath = DiagGradeItemList []

export type DiagTableItem = {
    value:string
}

export type DiagTableRow = DiagTableItem[]

export type DiagTable = {
    rows:DiagTableRow[]
    columnName:string[]
}
export interface DiagCardPos {
    shelf:number,
    slot:number
}

export interface DiagFlowIngressQos {
    provCir:number,
    provEir:number,
    ponCos:string, 
    dbaPriority:string, 
    ponCosCir:number,
    ponCosAir:number,
    ponCosEir:number
}

export interface DiagFlowEgressQos {
    minimum:number,
    minBurst:number,
    maximum:number,
    maxBurst:number,
    schedulingType:string,
    weight:number,
    queueDep:number,
    discardPolicy:string, 
    bwp:string,
    minParentCos:string,
    maxParentCos:string
}
export interface DiagFlowPortrait {
    flowId: number
    ontId: string, 
    ontPort: string,
    match: string[], 
    ontOutVlan: number,
    gemId: number[],
    oltPonPort: string, 
    tid:number[],
    oltOutVlan: number, 
    oltVlanAction: 'none'|'add', 
    oltOutPorts: DiagOltPortPortrait[]
    ingressQos:DiagFlowIngressQos[]
    egressQos:DiagFlowEgressQos[]
}

export interface DiagOntIfPortrait {
    ifname:string, 
    veipIf:string,
    adminState:"enable" | "disable"
    operState: 'up'|'down'
}

export interface DiagOntPortrait {
    ontId: string,
    connPon: string,
    ontOutInterface:DiagOntIfPortrait[],
    ontInInterface:DiagOntIfPortrait[]
}

export interface DiagOltPortPortrait {
    shelf:number,
    slot:number,
    ifname:string, 
    adminState?: "enable" | "disable",
    operState?:'up'|'down'
}
export interface DiagOltPortrait {
    shelf:number,
    slot:number,
    ponPorts:DiagOltPortPortrait[],
    ethPorts:DiagOltPortPortrait[],
}

export interface DiagCompose {
    olts:DiagOltPortrait[],
    ont: DiagOntPortrait,
    flows:DiagFlowPortrait[]
}

export enum DiagWSMsgType {
    DiagWSMsgTypeAllOntREQ = 1,
    DiagWSMsgTypeAllOntRES,
    DiagWSMsgTypeOntDiagREQ,
    DiagWSMsgTypeOntDiagRES 
}

export interface DiagWSHeader {
    cmdId: number,
    resCode: number,
}
export interface DiagWSMsgAllOntReq {
    header: DiagWSHeader,
    ipAddr:string
}

export interface DiagWSMsgAllOntRes {
    header:DiagWSHeader,
    ipAddr:string,
    ontList:string[]
}

export interface DiagWSMsgOntDiagReq {
    header:DiagWSHeader,
    ipAddr:string
    ontId:string
}

export interface DiagWSMsgOntDiagRes {
    header:DiagWSHeader,
    ipAddr:string,
    ontId:string,
    OntCompose?: DiagCompose|null
}

