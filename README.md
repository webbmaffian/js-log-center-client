# Log Center Client
A JavaScript client for sending logs to Log Center.

## Usage
```js
import { createTlsClient, createLogger } from 'log-center-client';

// Initialize client
const client = createTlsClient({
	host: 'wm.log.center',
	port: 4610,
	key: readFileSync('./example/live/private.key'),
	cert: readFileSync('./example/live/certificate.pem'),
	ca: readFileSync('./example/live/root-ca.pem'),
});

// Initialize logger
const logger = createLogger(client, 1687515986);

// Log away
const entryId = logger.info('order %d created', 123456, {
	foobar: 'some meta data'
});

// Contains an entry-unique 20 character XID
console.log(entryId);

// Logging an Error will extract that log message and its stack trace
try {
	throw new Error('oh no!');
} catch(err) {
	logger.err(err);
}
```