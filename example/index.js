import { createTlsClient, createLogger } from '../index.js';
import { readFileSync } from 'fs';

const client = createTlsClient({
	host: '127.0.0.1',
	port: 4610,
	key: readFileSync('./example/live/private.key'),
	cert: readFileSync('./example/live/certificate.pem'),
	ca: readFileSync('./example/live/root-ca.pem'),
});
const logger = createLogger(client, 1687515986);

console.log('sent', logger.info('node test 1 %s', 'abc', 123, {
	foo: 'bar'
}));

console.log('sent', logger.info('node test 2 %s', 'abc', 123, {
	foo: 'bar'
}));

console.log('sent', logger.info('node test 3 %s', 'abc', 123, {
	foo: 'bar'
}));

// Server will disconnect after 60 seconds of inactivity - test if
// the client reconnects when logging something after that.
setTimeout(() => {
	console.log('sent', logger.info('node test 4 %s', 'abc', 123, {
		foo: 'bar'
	}));
}, 65 * 1000);



