/**
 * Encodes UTF-8 string or array of bytes to base N string.
 * @param {(string|Uint8Array)} input UTF-8 string or array of bytes to be encoded.
 * @param {boolean} includePadding Whether to include "=" padding characters.
 * @param {number} g Number of bits per base N value.
 * @param {number} p Integral multiple of `p` characters in base N string.
 * @param {string} charset The base N character set (alphabet).
 * @returns {string} Base N string.
 * @throws {TypeError} Argument `input` must be a string or Uint8Array.
 */
function encodeBaseN(input, includePadding, g, p, charset) {
    if (typeof input === 'string') {
        input = new TextEncoder().encode(input)
    }
    else if (!(input instanceof Uint8Array)) {
        throw new TypeError("Argument 'input' must be a string or Uint8Array")
    }
    const bytes = input

    // Intermediate data structure to store array of bits
    // Each array element is either the value 0 or 1
    const bitArray = new Uint8Array(Math.ceil(bytes.length * 8 / g) * g)

    // Unpack each data byte to form an array of bits
    let bitIndex = 0
    for (const byte of bytes) {
        let bitmask = 0x80
        for (let i = 0; i < 8; i++) {
            bitArray[bitIndex++] = (byte & bitmask ? 1 : 0)
            bitmask >>= 1
        }
    }

    // For each `g`-bit group, obtain the corresponding
    // base N character and add it to the base N string
    let baseNstr = ''
    let baseNvalue = 0
    bitArray.forEach((bit, bitIndex) => {
        baseNvalue = baseNvalue << 1 | bit
        if ((bitIndex + 1) % g === 0) {
            baseNstr += charset[baseNvalue]
            baseNvalue = 0
        }
    })

    if (includePadding) {
        // Add "=" padding characters to form an integral multiple of `p` characters
        const paddedLength = Math.ceil(baseNstr.length / p) * p
        baseNstr = baseNstr.padEnd(paddedLength, '=')
    }
    return baseNstr
}

/**
 * Decodes base N string to UTF-8 string or array of bytes.
 * @param {string} baseNstr Base N string to be decoded.
 * @param {boolean} toStr Whether to return the result as a string.
 * @param {number} g Number of bits per base N value.
 * @param {string} charset The base N character set (alphabet).
 * @param {string} encoding Name of encoding as described in RFC 4648.
 * @returns {(string|Uint8Array)} UTF-8 string or array of bytes.
 * @throws {RangeError} Invalid base N string.
 */
function decodeBaseN(baseNstr, toStr, g, charset, encoding) {
    if (typeof baseNstr !== 'string') {
        throw new TypeError("Argument 'baseNstr' must be a string")
    }

    // Remove trailing "=" padding characters
    baseNstr = baseNstr.replace(/=+$/, '')

    // Intermediate data structure to store array of bits
    // Each array element is either the value 0 or 1
    // The array length is an integral multiple of `g` bits
    const bitArray = new Uint8Array(baseNstr.length * g)

    // For each base N character, obtain the base N value and
    // add the `g`-bit group to our bitArray
    let bitIndex = 0
    for (const baseNchar of baseNstr) {
        const baseNvalue = charset.indexOf(baseNchar)
        if (baseNvalue === -1) {
            throw new RangeError(`Invalid ${encoding} string '${baseNstr}'`)
        }
        let bitmask = 1 << (g - 1)
        for (let i = 0; i < g; i++) {
            bitArray[bitIndex++] = (baseNvalue & bitmask ? 1 : 0)
            bitmask >>= 1
        }
    }

    // For each 8-bit group, pack those bits into a single byte and
    // add it to an array of bytes. Any leftover bits are discarded
    const bytes = new Uint8Array(Math.floor(bitArray.length / 8))
    bitArray.forEach((bit, bitIndex) => {
        const i = Math.floor(bitIndex / 8)
        if (i < bytes.length) {
            bytes[i] = bytes[i] << 1 | bit
        }
    })

    return toStr ? new TextDecoder().decode(bytes) : bytes
}

const BASE32HEX_CHARSET = '0123456789abcdefghijklmnopqrstuv';

/**
 * Encodes UTF-8 string or array of bytes to base32hex string.
 * @param {(string|Uint8Array)} input UTF-8 string or array of bytes to be encoded.
 * @param {Object} options Optional object containing options.
 * @param {boolean} [options.includePadding=false] Whether to include "=" padding characters.
 * @returns {string} Base32hex string.
 * @throws {TypeError} Argument `input` must be a string or Uint8Array.
 */
export function encode(input, options = {}) {
	const { includePadding = false } = options
	return encodeBaseN(input, includePadding, 5, 8, BASE32HEX_CHARSET)
}

/**
 * Decodes base32hex string to UTF-8 string or array of bytes.
 * @param {string} base32str Base32hex string to be decoded.
 * @param {Object} options Optional object containing options.
 * @param {boolean} [options.toStr=false] Whether to return the result as a string. Optional; defaults to false if not provided.
 * @returns {(string|Uint8Array)} UTF-8 string or array of bytes.
 * @throws {RangeError} Invalid base32hex string.
 */
export function decode(base32str, options = {}) {
	const { toStr = false } = options
	return decodeBaseN(base32str, toStr, 5, BASE32HEX_CHARSET, 'base32hex')
}