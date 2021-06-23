"use strict"

// 引入 log4js 模块
const log4js = require('log4js');
// 文件系统模块
// 系统模块
const path = require('path');

const log4jConfig = require('./log4j.js');

// 日志输出适配类
class logger {
	
	constructor() {
		// 读取配置文件
		// let log4jConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../config/log4j.json"), 'utf-8').toString());
		try {
			// 更改日志保存路径
			console.log(process.cwd())
			log4jConfig.appenders.console.filename = path.resolve(process.cwd(), "./logs/console-" + process.pid + ".log");
			// 加载日志配置文件
			log4js.configure(log4jConfig);
			// 调试信息
			//this.logDebug = log4js.getLogger("##");
			// 结果信息
			// this.logResult = log4js.getLogger("**");

			// 日志信息
			this.logStd = log4js.getLogger("@@");
			this.logFile = log4js.getLogger("@@@");
			this.logStdEnable = true;
		} catch(e) {
			// eslint-disable-next-line no-unused-vars
			let loggerInjection = {
				debug(){},
				info(){},
				error(){},
				log(){},
				warn(){}
			}
			// 结果信息
			this.logResult = console;
			// 日志信息
			this.logFile = console;
		}
	}
	
	debug(msg) {
		//this.logDebug.debug(msg);
		if (this.logStdEnable) {
			this.logStd.debug(msg)
		}
		this.logFile.debug(msg)
	}
	info(msg) {
		//this.logDebug.info(msg);
		if (this.logStdEnable) {
			this.logStd.info(msg)
		}
		this.logFile.info(msg);
	}
	// 输出抢宝结果
	result(msg) {
		if (this.logStdEnable) {
			this.logStd.info(msg)
		}
		this.logFile.info(msg);
		// this.logResult.info(msg);
	}
	warn(msg) {
		if (this.logStdEnable) {
			this.logStd.warn(msg)
		}
		//this.logDebug.warn(msg);
		this.logFile.warn(msg);
	}
	error(msg) {
		if (this.logStdEnable) {
			this.logStd.error(msg)
		}
		//this.logDebug.error(msg);
		this.logFile.error(msg);
	}

	closeStdout() {
		this.logStdEnable = false;
		// console.log(log4jConfig.categories['@@']['appenders'])
		// log4jConfig.categories['@@']['appenders'] = ['console']
		log4js.shutdown()
		log4js.configure(log4jConfig);
		// 调试信息
		//this.logDebug = log4js.getLogger("##");
		// 结果信息
		// this.logResult = log4js.getLogger("**");
		// 日志信息
		// this.logFile = log4js.getLogger("@@");
	}

	openStdout() {
		this.logStdEnable = true;
		// console.log(log4jConfig.categories['@@']['appenders'])
		// log4jConfig.categories['@@']['appenders'] = ['out', 'console']
		log4js.shutdown()
		log4js.configure(log4jConfig);
		// 调试信息
		//this.logDebug = log4js.getLogger("##");
		// 结果信息
		// this.logResult = log4js.getLogger("**");
		// 日志信息
		// this.logFile = log4js.getLogger("@@");
	}	

	setLogLevel(logType, level) {
		if (logType == 'std') {
			log4jConfig.categories['@@']['level'] = level
		}else if (logType == 'file') {
			log4jConfig.categories['@@@']['level'] = level
		}else if (logType == 'both'){
			log4jConfig.categories['@@']['level'] = level;
			log4jConfig.categories['@@@']['level'] = level
		}else {
			return;
		}
		
		log4js.shutdown()
		log4js.configure(log4jConfig);
		// 调试信息
		//this.logDebug = log4js.getLogger("##");
		// 结果信息
		// this.logResult = log4js.getLogger("**");
		// 日志信息
		// this.logFile = log4js.getLogger("@@");
	}
}

// 导出模块
exports.default = new logger();