const rest = require('restler-base')

const request = require('request');
const logger = require('./logger');

class BaseHttps {
	async doRequest(msg) {
		let data = null;
		if(msg != null) {
			// get方法
			if(msg.method == "GET") {
				try {
					data = await this.synchronous_get(msg.url, msg.proxy, msg.cookie, msg.headers);
					// console.log(data)
                    return data.body;
				} catch(err) {
					return err.response.body
				}
			// post方法
			} else if(msg.method == "POST") {
				try {
					// logger.info(msg)
					data = await this.synchronous_post(msg.url,  msg.params, msg.proxy, msg.cookie, msg.headers)
					// data = await this.synchronous_post_rest(msg.url, msg.params, msg.proxy, msg.cookie, msg.headers);
					return data;
				} catch(err) {
					// console.log(err)
				}
			}else if(msg.method == "DELETE") {
				try {
					// logger.info(msg)
					data = await this.synchronous_delete(msg.url,  msg.params, msg.proxy, msg.cookie, msg.headers)
					// data = await this.synchronous_post_rest(msg.url, msg.params, msg.proxy, msg.cookie, msg.headers);
					return data;
				} catch(err) {
					logger.error(err.response.body)
				}
			}
		}
	}    

    synchronous_delete(reqUrl, params,proxy, cookie, headerIn) {
		let headers = { 
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
			'Content-Type' : 'application/x-www-form-urlencoded',
		}  
		if (cookie != null && cookie != undefined) {
			headers.cookie = cookie
		}
		if (headerIn) {
			for (let headerKey in headerIn) {
				headers[headerKey] = headerIn[headerKey]
			}
		}
		console.log(params)
		let options = {
			url: reqUrl,
			method: "DELETE",
            body: JSON.stringify(params),
            headers: headers
		};
		if (proxy) {
			console.log("当前代理ip: "+proxy)
			options.proxy = proxy;
        }
        // logger.info(options)
		return new Promise(function(resolve, reject) {
			request(options, function(error, response, body) {
				if(error || response.statusCode != 200) {
					reject({
						error,
						response
					});
				} else {
                    
					resolve({
						body
					});
				}
			});
		});      
    }

    synchronous_delete_rest(reqUrl, params,proxy, cookie) {
		let headers = { 
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
			'Content-Type' : 'application/x-www-form-urlencoded',
		}  
		if (cookie != null && cookie != undefined) {
			headers.cookie = cookie
		}

		return new Promise((resolve, reject)=> {
			rest.del(reqUrl, {
				multipart: true,
				data:params,
				headers:headers
			}).on('complete', function(data) {
                // logger.info(data)
                resolve(data)
                
			});
		})        
    }


    synchronous_post_rest(reqUrl, params,proxy, cookie=null, headerIn=null) {
		let headers = { 
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
			'Content-Type' : 'application/x-www-form-urlencoded',
		}  
		if (cookie != null && cookie != undefined) {
			headers.cookie = cookie
		}
		if (headerIn) {
			for (let headerKey in headerIn) {
				headers[headerKey] = headerIn[headerKey]
			}
		}
		


		return new Promise((resolve, reject)=> {
			rest.post(reqUrl, {
				multipart: true,
				data:params,
				headers:headers
			}).on('complete', function(data) {
                // logger.info(data)
                resolve(data)
                
			});
		})        
    }

	synchronous_post(reqUrl, params,proxy, cookie, headerIn) {

		let headers = { 
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
			'Content-Type' : 'application/x-www-form-urlencoded',
		}  
		if (cookie != null && cookie != undefined) {
			headers.cookie = cookie
		}
		if (headerIn) {
			for (let headerKey in headerIn) {
				headers[headerKey] = headerIn[headerKey]
			}
		}

		let options = {
			url: reqUrl,
			method: "POST",
            body: JSON.stringify(params),
            headers: headers
		};
		if (proxy) {
			console.log("当前代理ip: "+proxy)
			options.proxy = proxy;
        }
        // logger.info(options)
		return new Promise(function(resolve, reject) {
			request(options, function(error, response, body) {
				if(error || response.statusCode != 200) {
					reject({
						error,
						response
					});
				} else {
                    
					resolve({
						body
					});
				}
			});
		});
	}


	synchronous_get(reqUrl, proxy=null, cookie=null, headerIn=null) {
		let headers = { 
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
			'Content-Type' : 'application/x-www-form-urlencoded',
		}     
		if (cookie != null && cookie != undefined) {
			headers.cookie = cookie
		}
		if (headerIn) {
			for (let headerKey in headerIn) {
				headers[headerKey] = headerIn[headerKey]
			}
		}

		let options = {
			url: reqUrl,
			method: "GET",
            headers: headers	
        };
        
        if (proxy != null && proxy != undefined) {
            options.proxy = proxy
        }

		return new Promise(function(resolve, reject) {
			request(options, function(error, response, body) {
				if(error || response.statusCode != 200) {
					reject({
						error,
						response
					});
				} else {
					// console.log(response.headers)
					resolve({
						body
					});
				}
			});
		});
    }
}

if (__filename == process.mainModule.filename) {
	// eslint-disable-next-line no-constant-condition
	if (1== 0) {
		(async()=>{
			let baseHttp = new BaseHttps()
			let msg = {}
			msg.url = 'https://shuwu.yrsw.vip/api.php/sell/sell_search'
			msg.method = 'POST'
			msg.params = {
				'isbn':'9780545289382',
				'cookie':`au5PxjcBNzjFEZ6B9ZtWF0NJp8aLPTl2dzlG4iXJoQy4bo2%2BSbWTHlpYKi%2FUIERaVcs%2B6VdMhn7rs4SJOrW8nA%3D%3D`,
				'uid':'15873',
				'client':'wx'
			}
			let data = await baseHttp.doRequest(msg)
			console.log(data)
	
		})()
	
		
	}

	// eslint-disable-next-line no-constant-condition
	if (1 == 1) {
		(async ()=>{
			let baseHttp = new BaseHttps()
			let msg = {}
			let headers = {}
			
			
			headers.Authorization = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MDEyMDM1MDQsInVpZCI6IktOWDZKbDdra01qWiJ9.9_wsydI3jpLZ0maSYlcFMUnngiHstiSSPAllwfCoEUc'
			headers["User-Agent"] = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36 MicroMessenger/7.0.9.501 NetType/WIFI MiniProgramEnv/Windows WindowsWechat'
			headers["content-type"] = 'application/json'
			// headers.Referer = `https://servicewechat.com/wx816dc6e826dcc6b5/324/page-frame.html`
			// headers["Accept-Encoding"] = `gzip, deflate, br`

			// let bookISBN = '9787537402910'
			let bookISBN = '9787544270878'
			msg.url = `https://app.manyoujing.net/v2/recycle/cart/book?scan_value=${bookISBN}&mode=1`
			msg.method = 'GET'
			msg.headers = headers
			let data = await baseHttp.doRequest(msg)
			console.log(data)

			// msg.url = `https://app.manyoujing.net/v2/recycle/cart?is_standard=true`
			// let data = await baseHttp.doRequest(msg)
			// console.log(data)
		})()
        
	}



}

module.exports =  {BaseHttps}
