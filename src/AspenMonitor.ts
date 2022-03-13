import {AXOSCard} from "./AXOSCard"
import {AspenCardMonitor} from "./LabPatrolPri"
import * as Vorpal from "vorpal"
import logger from './logger';

interface HeaderDef {
    [propName: string]: any;
}

logger.setLogLevel('std', 'error')
logger.setLogLevel('file', 'info')
logger.closeStdout();
class AspenMonitor {
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

    async startUpMonitor() {
        for (let aa of this.cardMon) {
            AXOSCard.execAspenShell(aa, this.cmdStrList)
        }

        setInterval(()=>{
            for (let aa of this.cardMon) {
                if (aa.state === 'init' || aa.state === 'stop') {
                    logger.error(`card ${aa.ipAddr} slot ${aa.slot} restart`)
                    AXOSCard.execAspenShell(aa, this.cmdStrList)
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

function setupVorpal(vorpal: Vorpal, aspenMo: AspenMonitor) {

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
        let aspenMo = new AspenMonitor()
        let cardsInfo: AspenCardMonitor[]= [
            { 'ipAddr':'10.245.26.40'  ,   'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.30.109' ,  'slot': 1, 'state': 'init'} ,    
            { 'ipAddr':'10.245.30.109' ,   'slot': 2, 'state': 'init'} ,    
            { 'ipAddr':'10.245.30.105' ,   'slot': 2, 'state': 'init'} ,    
            { 'ipAddr':'10.245.34.156' ,   'slot': 1, 'state': 'init'} ,    
            { 'ipAddr':'10.245.36.55'  ,   'slot': 1, 'state': 'init'} ,    
            { 'ipAddr':'10.245.36.135' ,   'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.36.135' ,   'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.36.133' ,   'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.38.35'  ,   'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.46.240' ,   'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.45.142' ,   'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.48.28'  ,   'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.48.30'  ,   'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.48.30'  ,   'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.48.240' ,   'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.51.35'  ,   'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.51.35'  ,   'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.59.112' ,   'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.61.81'  ,   'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.93.103' ,   'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.105.123' ,  'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.106.102' ,  'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.106.102' ,  'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.109.16'  ,  'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.109.16'  ,  'slot':2 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.108.70'  ,  'slot':1 , 'state': 'init'} ,    
            { 'ipAddr':'10.245.108.70'  ,  'slot':2 , 'state': 'init'} ,    
        ]
        aspenMo.setupMonitorCards(cardsInfo)
        aspenMo.startUpMonitor()
        const vorpal = require('vantage')()
        setupVorpal(vorpal, aspenMo)
    })()
}