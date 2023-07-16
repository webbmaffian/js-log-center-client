import { createTlsClient } from "../lib/client.js";
import { createLogger } from "../lib/logger.js";
import { readFileSync } from 'fs';

const client = createTlsClient({
	// host: 'wm.log.center',
	// port: 4610,
	// key: readFileSync('./example/live/private.key'),
	// cert: readFileSync('./example/live/certificate.pem'),
	// ca: readFileSync('./example/live/root-ca.pem'),

	host: '127.0.0.1',
	port: 4610,
	key: readFileSync('./example/local/private.key'),
	cert: readFileSync('./example/local/certificate.pem'),
	ca: readFileSync('./example/local/root-ca.pem'),
});

const logger = createLogger(client, 1687784227);

console.log('sent', logger.info('räksmörgås 1 %s', 'abc', 123, {
	foo: 'bar'
}));

console.log('sent', logger.info('räksmörgås 2 %s', 'abc', 123, {
	foo: 'bar'
}));

console.log('sent', logger.info('räksmörgås 3 %s', 'abc', 123, {
	foo: 'bar'
}));

// process.stdin.resume();


