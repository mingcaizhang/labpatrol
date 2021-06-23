export type IpPrefixInfo = {
    ipPrefix: string;
    subLenth:number;
    start: number;
    end: number;
};

export enum LabPatroType {
    LabPatrolType_AXOSCard = 0x1,
    LabPatrolType_E7Card = 0x2,
    LabPatrolType_ONT = 0x4,    
}

export interface LabPatroResult {
    cardInfo: LabPatroAny[]|undefined
    ontInfo:  LabPatroAny[]|undefined
}


export interface LabPatroAny {
    [attr: string]: string
}