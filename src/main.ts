import { InvestigateClient, AliveFind } from './Connectivity'
import logger from "./logger"
import { AXOSCard } from "./AxosCard"
import * as fs from "fs"
import * as path from "path"
import { E7Card } from './E7Card'
import {LabPatroType} from "./LabPatrolPub"

function appendFile(content: string, fileName: string) {
    fileName = path.join(__dirname, fileName);
    fs.appendFileSync(fileName, content + '\r\n')
}

function sleepMs(timems:number) {
    return new Promise((resolve)=>{
        setTimeout(()=>{
            resolve(0)
        }, timems)
    })

}

async function loopCheckCardTest() {
    for (let zz = 0; zz< 100; zz++) {
        let actList = ['10.245.15.100','10.245.15.111','10.245.15.123', '10.245.15.133', '10.245.15.132']
        // let actList = ['10.245.15.123']
        //  let actList = ['10.245.15.100','10.245.15.111', '10.245.15.133', '10.245.15.132']
        let promiseParal = []
        let promiseNum = 0
        let maxParal = 1
        for (let ii = 0; ii < actList.length; ii++) {
            promiseParal.push(AXOSCard.doPatrolWork(actList[ii], LabPatroType.LabPatrolType_AXOSCard))
            promiseNum++;
            if (promiseNum == maxParal) {
                let res = await Promise.all(promiseParal)
                console.log(res)
                promiseParal = []
                promiseNum =0;
            }
        }
    
        if (promiseNum != 0) {
            let res = await Promise.all(promiseParal)
            console.log(res)
            promiseParal = []
            promiseNum =0;
        }
        // await sleepMs(10000);
    }

}

async function checkCardTest() {
    // let actList = [' 10.245.59.99',' 10.245.59.100','10.245.59.110', '10.245.59.254', '10.245.34.156']
    let actList = ['10.245.48.28']
    let promiseParal = []
    let promiseNum = 0
    let maxParal = 5
    for (let ii = 0; ii < actList.length; ii++) {
        promiseParal.push(AXOSCard.doPatrolWork(actList[ii], LabPatroType.LabPatrolType_AXOSCard))
        promiseNum++;
    }

    let res = await Promise.all(promiseParal)
    for (let ii = 0; ii < res.length; ii++) {
        console.log('ii ' + JSON.stringify(res[ii]))

    }

}

async function checkExaCardTest() {
    // let actList = [' 10.245.59.99',' 10.245.59.100','10.245.59.110', '10.245.59.254', '10.245.34.156']
    let actList = [ '10.245.37.2', '10.245.37.1']
    let promiseParal = []
    let promiseNum = 0
    let maxParal = 1

    let checkIpList = []

    for (let ii = 0; ii < actList.length; ii++) {
        checkIpList.push(actList[ii])
        
        
        promiseParal.push(E7Card.doPatrolWork(actList[ii], LabPatroType.LabPatrolType_E7Card))
        promiseNum++;
        if (promiseNum == maxParal) {
            
            logger.error(`check IP ${JSON.stringify(checkIpList)}`)
            let res = await Promise.all(promiseParal)
            // logger.info('paral done')
            logger.info(res)
            promiseParal = []
            checkIpList = []
            promiseNum = 0;
        }
    }


}

async function batchWork() {
    let aliveFind = new AliveFind()
    let maxParal = 1


    for (let ii = 35; ii < 225; ii++) {
        aliveFind.clearAll()
        aliveFind.addPrefix('10.245.' + ii, 24, 1, 255)
        let actList = await aliveFind.AliveDetect()

        let promiseParal = []
        let promiseNum = 0
        let checkIpList = []
        for (let jj = 0; jj < actList.length; jj++) {
            checkIpList.push(actList[jj])
            promiseParal.push(AXOSCard.doPatrolWork(actList[jj], LabPatroType.LabPatrolType_AXOSCard))
            promiseNum++;
            if (promiseNum == maxParal) {
                let res = await Promise.all(promiseParal)
                // logger.info('paral done')
                logger.info(res)
                promiseNum = 0;
                let strOut = '';
                for (let zz = 0; zz < res.length; zz++) {
                    strOut += 'IP: ' + checkIpList[zz] + '\r\n';
                    strOut += JSON.stringify(res[zz]) + '\r\n';
                }

                appendFile(strOut, 'Card_result.txt')
                promiseParal = []
                checkIpList = []
            }
        }

        if (promiseParal.length != 0) {
            let res = await Promise.all(promiseParal)
            let strOut = '';
            for (let jj = 0; jj < res.length; jj++) {
                strOut += 'IP: ' + checkIpList[jj] + '\r\n';
                strOut += JSON.stringify(res[jj]) + '\r\n';
            }
            appendFile(strOut, 'Card_result.txt')          
        }

        logger.info('handle subnet '+ '10.245.' + ii + 'done!')
    }

}

(async () => {
    // let aliveFind = new AliveFind()
    // let maxParal = 5

    // aliveFind.addPrefix('10.245.59', 1, 255) 
    // let actList = await aliveFind.AliveDetect()
    // logger.info(typeof(actList))



    // // logger.info(actList.length)

    // let promiseParal = []
    // let promiseNum = 0
    // for (let ii = 0; ii < actList.length; ii++) {
    //     promiseParal.push(AXOSCard.checkCard(actList[ii]))
    //     promiseNum++;
    //     if (promiseNum == maxParal) {
    //         await Promise.all(promiseParal)
    //         logger.info('paral done')
    //         promiseNum = 0;
    //         promiseParal = []
    //     }
    // }


    // if (promiseParal.length != 0) {
    //     await Promise.all(promiseParal)
    //     logger.info('paral done')
    // }



    // appendFile('await Promise', 'cardOut.txt')
    // appendFile('await Promise', 'cardOut')
    // appendFile('await Promise', 'cardOut')
   // await batchWork();
  //  await checkCardTest();
   console.log(process.cwd())
   await checkExaCardTest();
})()

