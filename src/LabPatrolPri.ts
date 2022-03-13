export interface AspenCardMonitor {
    ipAddr: string,
    slot: number,
    state: 'running'|'stop'|'init'
}