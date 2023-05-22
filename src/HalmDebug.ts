import {AXOSCard} from "./AXOSCard"
import {AspenCardMonitor} from "./LabPatrolPri"
import * as Vorpal from "vorpal"
import logger from './logger';
import {  sleepMs } from "./LabPatrolPub"


class HalmDebug{
    axosCard:AXOSCard = new AXOSCard()


    async execHalmDebug(ipAddr:string, debugXg3201:boolean = false, loopCnt:number=1): Promise<number | any[]> {
        let rc = -1
        let cmdResults = []
        let axosCard = this.axosCard
        let res:string = ''
        let watchPointer1 = '52' 
        let watchPointer2 = '84'
        let lpNo = 0;

        rc = await axosCard.timeExec(axosCard.connect(ipAddr), axosCard.connectTimeOut)
        if (rc != 0) {
            return -1;
        }
    
        if (axosCard.invesClient === undefined) {
            return -1
        }
    
        await axosCard.invesClient.sendCommand('exit')
        await axosCard.invesClient.sendCommand('disable.inithack.warnings')
        await axosCard.invesClient.sendCommand('arc.disable')
        
        while (lpNo < loopCnt) {
            await axosCard.invesClient.sendCommand('kill -9 `pidof halm_dnx`')
            await axosCard.invesClient.sendCommand('rm -rf /tmp/cdb_data/DnxHalMgr; rm -rf /tmp/checkpoint/LOCAL-DIR/halm_dnx')
            axosCard.invesClient.setUsingPrompt('(gdb)')
             await axosCard.invesClient.sendCommand('gdb /usr/sbin/halm_dnx')
           //  await axosCard.invesClient.sendCommand('gdb /FLASH/persist/inithacks/core/halm_dnx_qmx_no_gcc')
            if (debugXg3201) {
                await axosCard.invesClient.sendCommand('set environment LD_LIBRARY_PATH=/usr/lib/bcmdnx_qmx:/usr/lib:')
                await axosCard.invesClient.sendCommand('set environment DPP_DB_PATH=/usr/lib/bcmdnx_qmx/dnxsignals')
            }else {
                await axosCard.invesClient.sendCommand('set environment LD_LIBRARY_PATH=/usr/lib/bcmdnx_qax:/usr/lib:')
                await axosCard.invesClient.sendCommand('set environment DPP_DB_PATH=/usr/lib/bcmdnx_qax/dnxsignals')
            }
    
            await axosCard.invesClient.sendCommand('b dnx_SizingInit')
            await axosCard.invesClient.sendCommand('set pagination off')
            res = await axosCard.invesClient.sendCommand('run -L -k 1 -r Proto1 -q cccc -b none -f', 200000)
            await axosCard.invesClient.sendCommand('finish')
            res = await axosCard.invesClient.sendCommand('info reg')
    
    
            let resLines = res.split('\n')
            let spReg = /sp\s+(\S+)/
            let spPointer = ''
            for (let line of resLines) {
                let spResult = spReg.exec(line)
                if (spResult && spResult[1]) {
                    spPointer = spResult[1]
                    break
                }
            }
    
            logger.error(`sp pointer ${spPointer}`)
            
            await axosCard.invesClient.sendCommand(`watch *(spPointer + ${watchPointer1})`)
            await axosCard.invesClient.sendCommand(`watch *(spPointer + ${watchPointer2})`)
            res = await axosCard.invesClient.sendCommand(`finish`, 100000)
            
            if (res.indexOf("hit Hardware watchpoint") != -1) {
                res = await axosCard.invesClient.sendCommand(`thread apply all bt`)
                break
            }else {
                logger.error(' no hit watch point')
                // axosCard.invesClient.setUsingPrompt('Quit anyway')
                // await axosCard.invesClient.sendCommand(`quit`)
                // axosCard.invesClient.restorePrompt()
                // await axosCard.invesClient.sendCommand(`y`)
                // await sleepMs(10000)
            }
            lpNo ++    
        }
    
    
        return 0
    }
    
    async execArbitraryCmd(cmd:string) {
        console.log(cmd)
        if (cmd === 'quit') {
            // let buf = Buffer.from('3','hex')
            // console.log('exec quit')
            // // await this.axosCard.invesClient?.conn?.exec('INT')
            // this.axosCard.invesClient?.conn?.exec('INT', (err, stream) => {
            //     console.log(err)
            //     console.log(stream)
            // })

            await this.axosCard.invesClient?.sendCommand('\x03zz')
            
            
        }else {
            await this.axosCard.invesClient?.sendCommand(cmd)
        }
        
    }
    
}

function setupVorpal(vorpal: Vorpal, halmDebug:HalmDebug) {

    vorpal.command('execgdb', 'execgdb')
        .option('-c --cmd <value>', 'cmd')
        .action(async (args) => {
            let cmd = (args.options.cmd) ? args.options.cmd : undefined;
            if (cmd) {
                halmDebug.execArbitraryCmd(cmd)
            }
           
        })  
         
        vorpal
        .delimiter('myapp$')
        .show();         
}
 

if (__filename === require.main?.filename) {

    (async () =>{

        // let res = await AXOSCard.execHalmDebug('10.245.116.147')

        // let res = await AXOSCard.execHalmDebug('10.245.115.156')
        let halDebug = new HalmDebug();
        // halDebug.execHalmDebug('10.245.115.156')
        halDebug.execHalmDebug('10.245.116.147', true)
        
        const vorpal = require('vantage')()
        setupVorpal(vorpal, halDebug)

    })()
}