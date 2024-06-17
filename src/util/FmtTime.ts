import moment from 'moment';

class FmtTime {
	static now() {
		return moment();
	}

	static fromTimeString(timeString) {
		return moment(timeString);
	}

	static getElapsedTime(time) {
		return moment.duration(moment().diff(time));
	}
}

export default FmtTime;
