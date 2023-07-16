import { parse as parseStackTrace } from 'stacktrace-parser';
import {
	maxCategorySize,
	maxMessageSize,
	maxMetaCount,
	maxMetaKeySize,
	maxMetaValueSize,
	maxStackTraceCount,
	maxStackTracePathSize,
	maxTTL,
	maxTagSize,
	maxTagsCount
} from './limits.js';

/**
 * Create a new logger.
 * 
 * @param {import('./client').Client} client 
 * @param {Number} bucketId 
 * @param {Number} defaultEntryTTL 
 * @param {Number} defaultMetaTTL 
 */
export function createLogger(client, bucketId, defaultEntryTTL = 0, defaultMetaTTL = 0) {
	return {

		/**
		 * System is unusable - a panic condition.
		 * @param  {...any} args Anything that should be logged
		 * @returns {String} Unique ID for the logged entry
		 */
		emerg(...args) {
			return sendEntry(EMERGENCY, client, bucketId, defaultEntryTTL, defaultMetaTTL, args);
		},

		/**
		 * Action must be taken immediately, e.g. corrupted system database, or backup failures.
		 * @param  {...any} args Anything that should be logged
		 * @returns {String} Unique ID for the logged entry
		 */
		alert(...args) {
			return sendEntry(ALERT, client, bucketId, defaultEntryTTL, defaultMetaTTL, args);
		},

		/**
		 * Critical condition that prevents a specific task, e.g. fatal error.
		 * @param  {...any} args Anything that should be logged
		 * @returns {String} Unique ID for the logged entry
		 */
		crit(...args) {
			return sendEntry(CRITICAL, client, bucketId, defaultEntryTTL, defaultMetaTTL, args);
		},

		/**
		 * Non-critical errors, but that must be fixed.
		 * @param  {...any} args Anything that should be logged
		 * @returns {String} Unique ID for the logged entry
		 */
		err(...args) {
			return sendEntry(ERROR, client, bucketId, defaultEntryTTL, defaultMetaTTL, args);
		},

		/**
		 * Warnings about unexpected conditions that might lead to errors further on.
		 * @param  {...any} args Anything that should be logged
		 * @returns {String} Unique ID for the logged entry
		 */
		warn(...args) {
			return sendEntry(WARNING, client, bucketId, defaultEntryTTL, defaultMetaTTL, args);
		},

		/**
		 * Normal but significant conditions, e.g. problems that were maneuvered but should be prevented.
		 * @param  {...any} args Anything that should be logged
		 * @returns {String} Unique ID for the logged entry
		 */
		notice(...args) {
			return sendEntry(NOTICE, client, bucketId, defaultEntryTTL, defaultMetaTTL, args);
		},

		/**
		 * Informational events of normal operations, e.g. taken actions or user errors.
		 * @param  {...any} args Anything that should be logged
		 * @returns {String} Unique ID for the logged entry
		 */
		info(...args) {
			return sendEntry(INFORMATIONAL, client, bucketId, defaultEntryTTL, defaultMetaTTL, args);
		},

		/**
		 * Helpful information for troubleshooting.
		 * @param  {...any} args Anything that should be logged
		 * @returns {String} Unique ID for the logged entry
		 */
		debug(...args) {
			return sendEntry(DEBUG, client, bucketId, defaultEntryTTL, defaultMetaTTL, args);
		},
	};
}

const EMERGENCY = 0;
const ALERT = 1;
const CRITICAL = 2;
const ERROR = 3;
const WARNING = 4;
const NOTICE = 5;
const INFORMATIONAL = 6;
const DEBUG = 7;

/**
 * 
 * @param {Number} severity 
 * @param {import('./client').Client} client 
 * @param {Number} bucketId 
 * @param {Number} defaultEntryTTL 
 * @param {Number} defaultMetaTTL 
 * @param {any[]} args 
 * @returns {String} XID
 */
function sendEntry(severity, client, bucketId, ttlEntry, ttlMeta, args) {

	/** @type {import('./entry').Entry} */
	const entry = {
		severity,
		bucketId,
		message: '',
		ttlEntry,
		ttlMeta,
		tags: [],
		metaKeys: [],
		metaValues: []
	};

	for(let arg of args) {
		if(arg instanceof Error) {
			setStackTrace(entry, arg);
			arg = arg.message;
		} else {
			arg = maybeStringify(arg);
		}

		if(typeof arg === 'object') {
			if(arg._category) entry.category = minMax(arg._category, 0, maxCategorySize);
			else if(arg._entryTTL) entry.ttlEntry = minMax(arg._entryTTL, 0, maxTTL);
			else if(arg._metaTTL) entry.ttlMeta = minMax(arg._metaTTL, 0, maxTTL);
			else if(Array.isArray(arg)) {
				for(const tag of arg) {
					append(entry.tags, truncate(stringify(tag), maxTagSize), maxTagsCount);
				}
			}
			else {
				for(const key in arg) {
					if(entry.metaKeys.length >= maxMetaCount) break;

					entry.metaKeys.push(truncate(key, maxMetaKeySize));
					entry.metaValues.push(truncate(stringify(arg[key]), maxMetaValueSize));
				}
			}
		} else if(entry.message === '') {
			entry.message = truncate(arg, maxMessageSize);
		} else {
			append(entry.tags, truncate(arg, maxTagSize), maxTagsCount);
		}
	}

	if(!entry.tracePaths) {
		setStackTrace(entry);
	}

	return client.write(entry);
}

/**
 * 
 * @param {Number} value 
 * @param {Number} min 
 * @param {Number} max 
 * @returns {Number}
 */
function minMax(value, min, max) {
	if(value < min) return min;
	if(value > max) return max;

	return parseInt(value, 10);
}

/**
 * 
 * @param {any[]} arr 
 * @param {any} val 
 * @param {Number} max 
 */
function append(arr, val, max) {
	if(arr.length < max) {
		arr.push(val);
	}
}

/**
 * 
 * @param {String} str 
 * @param {Number} max 
 */
function truncate(str, max) {
	return str.substring(0, max);
}

/**
 * 
 * @param {any} val 
 * @returns {String}
 */
function stringify(val) {
	if(val === null) return 'null';
	if(val === true) return 'true';
	if(val === false) return 'false';

	if(typeof val === 'object') {
		if(val.toString !== Object.prototype.toString) {
			return val.toString();
		}

		return JSON.stringify(val);
	}

	return '' + val;
}

/**
 * 
 * @param {any} val 
 * @returns {String|any}
 */
function maybeStringify(val) {
	if(val === null) return 'null';
	if(val === true) return 'true';
	if(val === false) return 'false';

	if(typeof val === 'object') {
		if(val.toString !== Object.prototype.toString) {
			return val.toString();
		}

		return val;
	}

	return '' + val;
}

/**
 * 
 * @param {import('./entry').Entry} entry 
 * @param {Error?} error 
 */
function setStackTrace(entry, error = null) {
	error = error || new Error();
	let trace = parseStackTrace(error.stack);

	if(!trace?.length) return;

	entry.tracePaths = [];
	entry.traceLines = [];

	for(const frame of trace) {
		if(!frame.file || frame.file.endsWith('/logger.js')) continue;

		append(entry.tracePaths, truncate(frame.file, maxStackTracePathSize), maxStackTraceCount);
		append(entry.traceLines, frame.lineNumber || 0, maxStackTraceCount);
	}
}