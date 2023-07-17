import { hostname } from 'os';
import { randomBytes, createHash } from 'crypto';
import { connect } from 'tls';
import { encode } from './base32.js';
import { maxEntrySize } from './limits.js';

/**
 * @typedef {Object} Client
 * @property {() => any} close
 * @property {EntryWriter} write
 */

/**
 * @callback EntryWriter
 * @param {Entry} entry
 * @returns {String} XID
 */

/**
 * @typedef {Object} ClientOptions
 * @property {String} host
 * @property {Number} port
 * @property {String|Buffer} key
 * @property {String|Buffer} cert
 * @property {String|Buffer} ca
 */

/**
 * Create a new TLS client.
 * 
 * @param {ClientOptions} options
 * @param {Boolean} reconnect
 * @returns {Client}
 */
export function createTlsClient(options, reconnect = true) {

	/** @type {import('tls').ConnectionOptions} */
	const connOpt = {
		host: options.host,
		port: options.port,
		key: options.key,
		cert: options.cert,
		ca: options.ca,
		minVersion: 'TLSv1.3',
		maxVersion: 'TLSv1.3',
		requestCert: true,
	};

	/** @type {import('tls').TLSSocket?} */
	let conn = null;

	/** @type {Function[]} */
	const queue = [];

	/**
	 * 
	 * @param {Function} cb 
	 */
	function ensureConnected(cb) {
		if(conn?.writable) {
			cb();
			return;
		}

		queue.push(cb);

		if(conn?.connecting) {
			return;
		}

		if(conn) {
			conn.destroy();
			conn = null;
		}

		conn = connect(connOpt, () => {
			conn.setNoDelay();
			let cb = queue.shift();

			if(cb) {
				cb();
			}
		});

		conn.on('error', err => {
			console.error(err);
		});
	
		conn.on('close', hadError => {

			// Clear queue if an error occured
			if(hadError) {
				queue.splice(0, queue.length);
			}
	
			conn = null;
		});
	}
	
	const mid = machineId();
	const pid = process.pid & 0xffff;
	let seq = randInt();

	const ofsSize = 0;
	const ofsBucket = 2;
	const ofsTime = 6;
	const ofsMid = 10;
	const ofsPid = 13;
	const ofsSeq = 15;
	const ofsSev = 18;

	return {

		/**
		 * @memberof Client
		 * @method close
		 */
		close() {
			reconnect = false;
			conn.destroy();
		},

		/**
		 * Write entry to stream.
		 * 
		 * @param {import('./entry.js').Entry} entry 
		 * @returns {String} XID
		 */
		write(entry) {
			const buf = Buffer.allocUnsafe(maxEntrySize);
			let size = ofsSev;

			// Bucket ID
			buf.writeUInt32BE(entry.bucketId, ofsBucket);

			// Entry ID
			buf.writeUInt32BE(Date.now() / 1000 | 0, ofsTime);
			buf.writeUIntBE(mid, ofsMid, 3);
			buf.writeUInt16BE(pid, ofsPid);
			buf.writeUIntBE(seq++ & 0xffffff, ofsSeq, 3);
			
			// Severity
			size = buf.writeUInt8(entry.severity, size);

			// Message
			size = writeStr(buf, entry.message, size);

			// Category ID
			size = buf.writeUInt8(entry.category || 0, size);

			// Tags
			size = buf.writeUInt8(entry.tags?.length || 0, size);
			if(entry.tags?.length) {
				for(const tag of entry.tags) {
					size = writeStr(buf, tag, size);
				}
			}
			
			// Metric
			size = buf.writeUInt8(entry.metricKeys?.length || 0, size);
			if(entry.metricKeys?.length) {
				for(let i = 0; i < entry.metricKeys.length; i++) {
					size = writeStr(buf, entry.metricKeys[i], size);
					size = buf.writeInt16BE(entry.metricValues[i], size);
				}
			}

			// Meta
			size = buf.writeUInt8(entry.metaKeys?.length || 0, size);
			if(entry.metaKeys?.length) {
				for(let i = 0; i < entry.metaKeys.length; i++) {
					size = writeStr(buf, entry.metaKeys[i], size);
					size = writeBigStr(buf, entry.metaValues[i], size);
				}
			}

			// Stack trace
			size = buf.writeUInt8(entry.tracePaths?.length || 0, size);
			if(entry.tracePaths?.length) {
				for(let i = 0; i < entry.tracePaths.length; i++) {
					size = writeStr(buf, entry.tracePaths[i], size);
					size = buf.writeUInt16BE(entry.traceLines[i], size);
				}
			}

			// TTL: Entry
			size = buf.writeUInt16BE(entry.ttlEntry || 0, size);

			// TTL: Meta
			size = buf.writeUInt16BE(entry.ttlMeta || 0, size);

			// Set the size of the message
			buf.writeUInt16BE(size, ofsSize);

			// Write to stream
			ensureConnected(() => conn.write(buf.subarray(0, size)));

			return encode(buf.subarray(ofsTime, ofsTime + 12));
		}
	};
}

function randInt() {
	return randomBytes(3).readUIntBE(0, 3);
}

function machineId() {
	const host = hostname();

	if (undefined === host) {
		return randInt();
	}

	return createHash('md5')
		.update(host)
		.digest()
		.subarray(0, 3)
		.readUIntBE(0, 3);
}

function bytes(str) {
	return Buffer.byteLength(str, 'utf8');
}

/**
 * @param {Buffer} buf 
 * @param {String} str 
 * @param {Number} size 
 * @returns {Number}
 */
function writeStr(buf, str, size) {
	size = buf.writeUInt8(bytes(str), size);
	size += buf.write(str, size, 'utf8');
	return size;
}

/**
 * @param {Buffer} buf 
 * @param {String} str 
 * @param {Number} size 
 * @returns {Number}
 */
function writeBigStr(buf, str, size) {
	size = buf.writeUint16BE(bytes(str), size);
	size += buf.write(str, size, 'utf8');
	return size;
}