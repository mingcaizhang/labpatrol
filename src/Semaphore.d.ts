export class Semaphore {
    constructor(maxConcurrentRequests = 1);
    callFunction(fnToCall, ...args);
}