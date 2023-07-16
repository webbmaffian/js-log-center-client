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

	const conn = connect(connOpt);

	conn.on('error', err => {
		console.error(err);
	});

	conn.on('secureConnect', () => {
		console.log('connected');
	});

	conn.on('close', hadError => {
		console.log('disconnected');

		if(reconnect && !hadError) {
			console.log('reconnecting')
			conn.connect(connOpt);
		}
	});
	
	const mid = machineId();
	const pid = process.pid & 0xffff;
	let seq = randInt();
	let time = Date.now() / 1000 | 0;

	const buf = Buffer.allocUnsafe(maxEntrySize);
	const ofsSize = 0;
	const ofsBucket = 2;
	const ofsTime = 6;
	const ofsMid = buf.writeUInt32BE(time, ofsTime);
	const ofsPid = buf.writeUIntBE(mid, ofsMid, 3);
	const ofsSeq = buf.writeUInt16BE(pid, ofsPid);
	const ofsSev = ofsSeq + 3;

	function writeStr(str, size) {
		size = buf.writeUInt8(bytes(str), size);
		size += buf.write(str, size, 'utf8');
		return size;
	}

	function writeBigStr(str, size) {
		size = buf.writeUint16BE(bytes(str), size);
		size += buf.write(str, size, 'utf8');
		return size;
	}

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
			if(!conn.writable) {
				console.error('not writable - skipping');
				return;
			}
			
			let size = ofsSev;

			// Bucket ID
			buf.writeUInt32BE(entry.bucketId, ofsBucket);

			// Entry ID
			const now = Date.now() / 1000 | 0;

			if (time !== now) {
				buf.writeUInt32BE(now, ofsTime);
				time = now;
			}

			const c = seq & 0xffffff;
			seq++;
			buf.writeUIntBE(c, ofsSeq, 3);
			
			// Severity
			size = buf.writeUInt8(entry.severity, size);

			// Message
			size = writeStr(entry.message, size);

			// Category ID
			size = buf.writeUInt8(entry.category || 0, size);

			// Tags
			size = buf.writeUInt8(entry.tags?.length || 0, size);
			if(entry.tags?.length) {
				for(const tag of entry.tags) {
					size = writeStr(tag, size);
				}
			}
			
			// Metric
			size = buf.writeUInt8(entry.metricKeys?.length || 0, size);
			if(entry.metricKeys?.length) {
				for(let i = 0; i < entry.metricKeys.length; i++) {
					size = writeStr(entry.metricKeys[i], size);
					size = buf.writeInt16BE(entry.metricValues[i], size);
				}
			}

			// Meta
			size = buf.writeUInt8(entry.metaKeys?.length || 0, size);
			if(entry.metaKeys?.length) {
				for(let i = 0; i < entry.metaKeys.length; i++) {
					size = writeStr(entry.metaKeys[i], size);
					size = writeBigStr(entry.metaValues[i], size);
				}
			}

			// Stack trace
			size = buf.writeUInt8(entry.tracePaths?.length || 0, size);
			if(entry.tracePaths?.length) {
				for(let i = 0; i < entry.tracePaths.length; i++) {
					size = writeStr(entry.tracePaths[i], size);
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
			conn.write(buf.subarray(0, size));

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