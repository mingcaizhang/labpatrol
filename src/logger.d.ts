// Type definitions for logger.js
// Project: [LIBRARY_URL_HERE] 
// Definitions by: [YOUR_NAME_HERE] <[YOUR_URL_HERE]> 
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/**
 * 日志输出适配类
 */
type LogLevel = 'error' | 'warn'|  'info' | 'debug'
type LogType = 'std' | 'file' | 'both'
export class logger {
		
	/**
	 * 
	 */
	constructor ();
		
	/**
	 * 
	 * @param msg 
	 */
	debug(msg : any): void;
		
	/**
	 * 
	 * @param msg 
	 */
	info(msg : any): void;
		
	/**
	 * 输出抢宝结果
	 * @param msg 
	 */
	result(msg : any): void;
		
	/**
	 * 
	 * @param msg 
	 */
	warn(msg : any): void;
		
	/**
	 * 
	 * @param msg 
	 */
	error(msg : any): void;

	/**
	 * 
	 * @param msg 
	 */
	closeStdout(): void;	
	/**
	 * 
	 * @param msg 
	 */
	openStdout(): void;	

	setLogLevel(logTpe:LogType, level:LogLevel):void

}

export default new logger()