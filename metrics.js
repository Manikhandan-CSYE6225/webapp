const StatsD = require('node-statsd');

function closeStatsDClient() {
    if (client) {
        client.socket.close();
    }
}

const client = new StatsD({
    host: 'localhost',
    port: 8125,
    prefix: 'webapp.'
});

const incrementApiCall = (route) => {
    client.increment(`api.${route}.calls`);
};

const timingApiCall = (route, time) => {
    client.timing(`api.${route}.duration`, time);
};

const timingDbQuery = (queryName, time) => {
    client.timing(`db.${queryName}.duration`, time);
};

const timingS3Call = (action, time) => {
    client.timing(`s3.${action}.duration`, time);
};

module.exports = {
    incrementApiCall,
    timingApiCall,
    timingDbQuery,
    timingS3Call,
    closeStatsDClient
};
