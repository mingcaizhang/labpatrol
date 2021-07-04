import * as DNS from 'dns'
const {networkInterfaces} = require('os')

let localIps:string[] = []
export async function reverseIP(address:string):Promise<string|number> {
    return new Promise((resolve)=>{
        DNS.reverse(address, (error, hostName)=>{
            if (error) {
                resolve(-1)
            }else {
                if (hostName) {
                    resolve(hostName[0])
                }
               
            }
        })
    })

}

export async function getLocalIpv4Address():Promise<string[]> {
    if (localIps.length != 0) {
        return localIps
    }

    const nets = networkInterfaces();
    // console.log(nets)
    let strRes:string[] =[]
    let matchIpv4 = /\d+.\d+.\d+.\d+/
    for (let key in nets) {
        if (key === 'Local Area Connection') {
            for (let ii = 0; ii < nets[key].length; ii++) {
                if (nets[key][ii] && nets[key][ii].address) {
                    if (matchIpv4.exec(nets[key][ii].address)) {
                        strRes.push(nets[key][ii].address)
                    }
                }
            }
        }
    }
    localIps = strRes
    return strRes
}

