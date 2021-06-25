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


export function getExaOntHeader():string[] {
    return ['address',
          'platform',
          'Serial #', 'Vendor', 'Model', 
         'Product Code',   'CLEI',        "Registration ID",  "ONU MAC", "MTA MA C",
         "Current SW version",  "Alternate SW version",  "PON port"]
}

export function getAxosOntHeader():string[] {
    return ['address', 'platform' , 'VENDOR ID', 'SERIAL NUMBER',
     'REG ID' ,     'MODEL',      'CLEI' ,      'CURR VERSION',
       'ALT VERSION',   'ONU MAC ADDR',      'MTA MAC ADDR',       'PRODUCT CODE']
}

export function getAxosCard():string[] {
   // ['address', 'platform',  'cardPosition',  'PROVISION TYPE',  'CARD STATE',  'CARD TYPE'                                      'MODEL'       'SERIAL NO'     'SOFTWARE VERSION'  'image-partition'  'full-release-version'  'live-release-version'  'image-type'   'patches'     'features'                            distro                                  schema      timestamp              details           
    return []
}
