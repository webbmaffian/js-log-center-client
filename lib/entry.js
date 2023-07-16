/**
 * @typedef {Object} Entry
 * @property {Number} bucketId
 * @property {Number} severity
 * @property {String} message
 * @property {Number} category
 * @property {String[]} tags
 * @property {String[]} metaKeys
 * @property {String[]} metaValues
 * @property {String[]} metricKeys
 * @property {Number[]} metricValues
 * @property {String[]} tracePaths
 * @property {Number[]} traceLines
 * @property {Number} ttlEntry
 * @property {Number} ttlMeta
 */

export function category(categoryId) {
	return { _category: categoryId };
}

export function TTL(days) {
	return { _entryTTL: days };
}

export function metaTTL(days) {
	return { _metaTTL: days };
}