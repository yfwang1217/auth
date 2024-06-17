class WebError extends Error {
	context: any;
	statusCode: number;
  
	constructor(message: string, context: any, statusCode: number) {
	  super(message);
	  this.context = context;
	  this.statusCode = statusCode;
	}
  }
  
  export default WebError;
  