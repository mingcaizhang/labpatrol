// Type definitions for Util.js
// Project: [LIBRARY_URL_HERE] 
// Definitions by: [YOUR_NAME_HERE] <[YOUR_URL_HERE]> 
// Definitions: https://github.com/borisyankov/DefinitelyTyped


/**
 * 
 */
export  class BaseHttps {
		
	/**
	 * 
	 */
	constructor ();
		
	/**
	 * 
	 * @param msg 
	 * @return  
	 */
	async doRequest(msg : any)
		
	/**
	 * 
	 * @param reqUrl 
	 * @param params 
	 * @param proxy 
	 * @param cookie 
	 * @param headerIn 
	 * @return  
	 */
	synchronous_delete(reqUrl : string, params : any, proxy : any, cookie : any, headerIn : any): /* BaseHttps.prototype.+Promise */ Promise;
		
	/**
	 * 
	 * @param reqUrl 
	 * @param params 
	 * @param proxy 
	 * @param cookie 
	 * @return  
	 */
	synchronous_delete_rest(reqUrl : any, params : any, proxy : any, cookie : any): /* BaseHttps.prototype.+Promise */ Promise;
		
	/**
	 * 
	 * @param reqUrl 
	 * @param params 
	 * @param proxy 
	 * @param cookie 
	 * @param headerIn 
	 * @return  
	 */
	synchronous_post_rest(reqUrl : any, params : any, proxy : any, cookie : any, headerIn : any): /* BaseHttps.prototype.+Promise */ Promise;
		
	/**
	 * 
	 * @param reqUrl 
	 * @param params 
	 * @param proxy 
	 * @param cookie 
	 * @param headerIn 
	 * @return  
	 */
	synchronous_post(reqUrl : string, params : any, proxy : any, cookie : any, headerIn : /* BaseHttps.prototype.synchronous_delete.!4 */ any): /* BaseHttps.prototype.+Promise */ Promise;
		
	/**
	 * 
	 * @param reqUrl 
	 * @param proxy 
	 * @param cookie 
	 * @param headerIn 
	 * @return  
	 */
	synchronous_get(reqUrl : string, proxy : any, cookie : any, headerIn : any): Promise;
}
