import {AXOSCard,ConnectMode} from "./AXOSCard"
import {AspenCardMonitor} from "./LabPatrolPri"
import {LabPatroAny} from "./LabPatrolPub"
import * as Vorpal from "vorpal"
import logger from './logger';

interface HeaderDef {
    [propName: string]: any;
}

logger.setLogLevel('std', 'error')
logger.setLogLevel('file', 'info')
logger.closeStdout();
class AspenCardMon {
    cardMon: AspenCardMonitor[] =[]
    cmdStrList:string[] =  ['/log/id_set_t index=9 log_type=print',
                            '/sub/ object=onu olt_id=0 indication=omci_packet subscribe=off',
                            '/Subscribe_ind object=onu olt_id=0 indication=rei subscribe=off',
                            '/Subscribe_ind object=pon_interface olt_id=0 indication=itu_rogue_detection_completed  subscribe=off',
                            '/Subscribe_ind object=onu olt_id=0 indication=rssi_measurement_completed subscribe=off',
                            '/Subscribe_ind object=onu olt_id=0 indication=invalid_dbru_report subscribe=off',
                            '/Subscribe_ind object=onu olt_id=0 indication=onu_activation_completed subscribe=off',
                            '/Subscribe_ind object=onu olt_id=0 indication=ranging_completed subscribe=off',
                            '/Subscribe_ind object=onu olt_id=0 indication=onu_deactivation_completed subscribe=off',
                            '/Subscribe_ind object=onu olt_id=0 indication=key_exchange_completed subscribe=off']
    constructor() {

    }


    setupMonitorCards(cardMon:AspenCardMonitor[]) {
        this.cardMon = cardMon
    }

    aspenFaultCheck(cardMon:AspenCardMonitor, errlog:string) {
        let errlogLine = errlog.split('\r\n')
        for (let oo of errlogLine) {
            if (oo.indexOf('must not exceed 510') != -1 || 
                oo.indexOf('Number of CBR-rt accesses per map') != -1) {
                logger.error(`${cardMon.ipAddr} find error based on pon`)
                console.error(`${cardMon.ipAddr} find error based on pon`)
            }


        }

    }

    async setupMonitorCard(cardMon:AspenCardMonitor) {
        let rc = -1
        let axosCard = new AXOSCard()
        let cmdResults = []
        rc = await axosCard.timeExec(axosCard.connect(cardMon.ipAddr), axosCard.connectTimeOut)
        if (rc != 0) {
            return -1;
        }

        if (axosCard.invesClient === undefined) {
            return -1
        }


        if (axosCard.connectMode === ConnectMode.ConnectMode_CLI) {
            let oriPrompt = axosCard.invesClient.prompt
            logger.info('oriPrompt: ' + oriPrompt)
            await axosCard.invesClient.sendCommand('paginate false')
            
            
            axosCard.invesClient.setUsingPrompt('Enter calixsupport role password')
            // 'Calix AXOS-R22.1.0 E7-2 Wed Mar 02 16:29:28 2022'
            // let res = await axosCard.invesClient.sendCommand('show card')
            let res = await axosCard.invesClient.sendCommand('shell') 
            logger.info(res)
            let crackStr = ''
            if (res != -1) {
                let lines = res.split('\n')
                for (let line1 of lines) {
                    let regResult = /Calix AXOS-(\S*)/.exec(line1)
                    if (regResult && regResult[0]) {
                        crackStr = line1.substr(regResult[0].length)
                    }
                }
            }
            logger.info('crackStr: ' + crackStr)
            if (crackStr.length === 0) {
                logger.error(`${cardMon.ipAddr} detect crackStr faild`)
                return -1
            }
            let crackRes = await axosCard.crackPass(crackStr)
            let crackResLines = crackRes.split('\n')
            logger.info(crackResLines)
            oriPrompt = oriPrompt.slice(0, oriPrompt.length - 1)
            for (let oo of crackResLines) {
                // console.log(oriPrompt)
                if (oo.indexOf(oriPrompt) != -1) {
                    crackRes = oo.split('\t')[1]
                    logger.info(crackRes)
                }
            }
            axosCard.invesClient.setPromptFormat('root@((\\S)+):', '#')
            await axosCard.invesClient.sendCommand(crackRes)
            await axosCard.invesClient.sendCommand('cli')
            
        }


        let cardRes = await axosCard.checkCard(cardMon.ipAddr)
        if (cardRes === -1) {
            logger.error('executeCommandsWithType: check card error')
            return -1
        }
        await axosCard.invesClient.sendCommand('exit')


        cardRes = cardRes as unknown as LabPatroAny[]

        for (let ii = 0; ii < cardRes.length; ii++) {
            if (cardRes[ii]['CARD STATE'] === 'In Service' ||
                cardRes[ii]['CARD STATE'] === 'Degraded') {
                if (cardRes[ii]['PROVISION TYPE'] === 'XG801' && cardRes[ii]['cardPosition'].indexOf('1/' + cardMon.slot) != -1) {
                    if (cardRes[ii]['CARD TYPE'].indexOf('(Active)') != -1) {
                        await axosCard.invesClient.sendCommand('tail -F /var/log/olttcmgrd.log &')
                        cardMon.state = 'running'
                    } else {
                        let res = await axosCard.invesClient.sendCommand('jump2c.sh ' + cardRes[ii]['cardPosition'])
                        await axosCard.invesClient.sendCommand('tail -F /var/log/olttcmgrd.log &')
                        cardMon.state = 'running'
                    }
                }
            }
        }



        let interFetchLog = setInterval(async () => {
            if (axosCard && axosCard.invesClient) {
                let rc =  axosCard.invesClient.peekAndClearRecvData()
               //  if (rc != '') {
                    logger.error(`peek: ${rc}`)
                //}
                
            }
        }, 10000)

        
        let interHandler = setInterval(async () => {
            if (axosCard && axosCard.invesClient) {
                let rc1 =  axosCard.invesClient.peekAndClearRecvData()
                logger.error(`peek: ${rc1}`)
                let rc = await axosCard.invesClient.sendCommand('ls -l')
                if (rc === -1) {
                    logger.error('can not connect anymore')
                    cardMon.state = 'stop'
                    clearInterval(interHandler)
                    clearInterval(interFetchLog)
                    await axosCard.invesClient.disconnect()
                }
            }
        }, 60000)
        return 0      

    }

    async startUpMonitor() {
        for (let aa of this.cardMon) {
            this.setupMonitorCard(aa);
        }

        setInterval(()=>{
            for (let aa of this.cardMon) {
                if (aa.state === 'init' || aa.state === 'stop') {
                    logger.error(`card ${aa.ipAddr} slot ${aa.slot} restart`)
                    this.setupMonitorCard(aa);
                }
            }
        }, 15*60000)
    }

 

    showWorkInfo(vorpal: Vorpal) {
        for (let oo of this.cardMon) {
            vorpal.log(`ip: ${oo.ipAddr} slot:${oo.slot}  state:${oo.state}`)
        }
    }

}

function setupVorpal(vorpal: Vorpal, aspenMo: AspenCardMon) {

    vorpal.command('showworkinfo', 'showworkinfo')
        .action(async (args) => {
            aspenMo.showWorkInfo(vorpal)
        })  
         
        vorpal
        .delimiter('myapp$')
        .show();         
}


if (__filename === require.main?.filename) {

    (async () =>{
        let aspenMo = new AspenCardMon()
        let cardsInfo: AspenCardMonitor[]= [
            { 'ipAddr':'10.245.115.156'  ,   'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.30.109' ,  'slot': 1, 'state': 'init'} ,    
            // { 'ipAddr':'10.245.30.109' ,   'slot': 2, 'state': 'init'} ,    
            // { 'ipAddr':'10.245.30.105' ,   'slot': 2, 'state': 'init'} ,    
            // { 'ipAddr':'10.245.34.156' ,   'slot': 1, 'state': 'init'} ,    
            // { 'ipAddr':'10.245.36.55'  ,   'slot': 1, 'state': 'init'} ,    
            // { 'ipAddr':'10.245.36.135' ,   'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.36.135' ,   'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.36.133' ,   'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.38.35'  ,   'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.46.240' ,   'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.45.142' ,   'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.48.28'  ,   'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.48.30'  ,   'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.48.30'  ,   'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.48.240' ,   'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.51.35'  ,   'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.51.35'  ,   'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.59.112' ,   'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.61.81'  ,   'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.93.103' ,   'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.105.123' ,  'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.106.102' ,  'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.106.102' ,  'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.109.16'  ,  'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.109.16'  ,  'slot':2 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.108.70'  ,  'slot':1 , 'state': 'init'} ,    
            // { 'ipAddr':'10.245.108.70'  ,  'slot':2 , 'state': 'init'} ,    
        ]
        aspenMo.setupMonitorCards(cardsInfo)
        aspenMo.startUpMonitor()
        const vorpal = require('vantage')()
        setupVorpal(vorpal, aspenMo)
    })()
}