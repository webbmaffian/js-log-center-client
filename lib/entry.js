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

/**
 * @typedef {Object} EntryData
 */

/**
 * Organize entry in specified bucket category.
 * @param {Number} categoryId - Category ID (1-255)
 * @returns {EntryData}
 */
export function category(categoryId) {
	return { _category: categoryId };
}

/**
 * Specify an entry TTL
 * @param {Number} days - Number of days that the entry should be kept.
 * @returns {EntryData}
 */
export function TTL(days) {
	return { _entryTTL: days };
}

/**
 * Specify a meta TTL
 * @param {Number} days - Number of days that meta should be kept.
 * @returns {EntryData}
 */
export function metaTTL(days) {
	return { _metaTTL: days };
}

/**
 * Add metric key-value pair
 * @param {String} key 
 * @param {Number} value 
 * @returns {EntryData}
 */
export function metric(key, value) {
	return { _metricKey: key, _metricValue: value };
}