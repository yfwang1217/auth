class Util {
	static cloneObject(obj, ...keys) {
		const result = {};
		keys.forEach(key => {
			if (obj[key] !== undefined) {
				result[key] = obj[key];
			}
		});
		return result;
	}

	static enqueueJob(job, queueName) {
		setImmediate(job);
	}

	static trimMongoDocument(doc, ...keys) {
		const result = { ...doc };
		keys.forEach(key => delete result[key]);
		return result;
	}
}

export default Util;
