class Global {
	static envParam(param, defaultValue) {
		return process.env[param] || defaultValue;
	}

	static workDir() {
		return process.cwd();
	}
}

export default Global;
