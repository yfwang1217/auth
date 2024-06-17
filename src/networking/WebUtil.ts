class WebUtil {
	static ensureValidParams(req, ...params) {
		for (const param of params) {
			if (!req.body[param]) {
				throw new Error(`Missing parameter: ${param}`);
			}
		}
	}

	static body(req) {
		return req.body;
	}

	static onResponse(res, data) {
		res.send(data);
	}

	static onError(req, res, error) {
		res.status(500).send(error.message);
	}
}

export default WebUtil;
