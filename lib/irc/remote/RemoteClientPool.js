const WebSocket = require('ws');
const Request = require('request');
const log = require("../../logging").get("RemoteClientPool");

class RemoteClientPool {
    constructor(ircBridge, config) {
        this.baseUrl = config.url;
        this.headers = {"Authorization": `Bearer ${config.accessToken}`};
        this.request = Request.defaults({
            baseUrl: this.baseUrl,
            headers: this.headers,
            json: true,
        });
        this.ircBridge = ircBridge;
        this.clientStates = {}; // server => Map<id,connstate>
        this.nickToId = {};
        this.websocket = null;
        this.isRemote = true; // Signals for the appservice to connect us.
    }

   connect(ircServers) {
        return Promise.all(ircServers.map(server => {
            // Get connection state for servers
            return this._requestWrapper(
                `/_irc/connections/${server.domain}?detail=state`
            ).then((res) => {
                log.info(`Got state for ${server.domain}`);
                this.clientStates[server.domain] = new Map();
                res.connections.forEach((conn) => {
                    this.clientStates[server.domain].set(conn.id, conn);
                    this.nickToId[conn.nick] = conn.id;
                });
            }).catch((response) => {
                log.error(
                    `Got error while requesting state for server: ${response.err}: ${response.body}`
                );
                throw response.err;
            });
        })).then(() => {
            // Got connected, now for the websocket.
            this.websocket = new WebSocket(this.baseUrl+"/_irc/ws", {
                headers: this.headers,
            });
            return new Promise((resolve, reject) => {
                this.websocket.once("open", () => {
                    resolve();
                });
                this.websocket.once("error", (err) => {
                    reject(err);
                });
            });
        }).then(() => {
            log.info("Connected to websocket");
            this.websocket.on("message", this._onMessage.bind(this));
            this.websocket.on("error", this._onError.bind(this));
        }).catch((err) => {
            log.error(
                `Cannot continue setting up remote client pool due to ${err}`
            );
            throw err;
        });
    }

    killAllClients() {

    }
    
    setBot() {
        
    }

    getBot() {

    }

    createIrcClient(ircClientConfig, matrixUser, isBot) {
        const bridgedClient = this.ircBridge.createBridgedClient(
            ircClientConfig, matrixUser, isBot
        );
        //var server = bridgedClient.server;
    
        // if (this._virtualClients[server.domain] === undefined) {
        //     this._virtualClients[server.domain] = {
        //         nicks: Object.create(null),
        //         userIds: Object.create(null)
        //     };
        //     this._virtualClientCounts[server.domain] = 0;
        // }
        // if (isBot) {
        //     this._botClients[server.domain] = bridgedClient;
        // }
    
        // // add event listeners
        // bridgedClient.on("client-connected", this._onClientConnected.bind(this));
        // bridgedClient.on("client-disconnected", this._onClientDisconnected.bind(this));
        // bridgedClient.on("nick-change", this._onNickChange.bind(this));
        // bridgedClient.on("join-error", this._onJoinError.bind(this));
        // bridgedClient.on("irc-names", this._onNames.bind(this));
    
        // // store the bridged client immediately in the pool even though it isn't
        // // connected yet, else we could spawn 2 clients for a single user if this
        // // function is called quickly.
        // this._virtualClients[server.domain].userIds[bridgedClient.userId] = bridgedClient;
        // this._virtualClientCounts[server.domain] = this._virtualClientCounts[server.domain] + 1;
    
        // // Does this server have a max clients limit? If so, check if the limit is
        // // reached and start cycling based on oldest time.
        // this._checkClientLimit(server);
        return bridgedClient;
    }

    getBridgedClientByUserId() {

    }

    getBridgedClientsForUserId() {

    }

    countTotalConnections() {

    }

    totalReconnectsWaiting() {

    }

    updateActiveConnectionMetrics() {

    }

    getNickUserIdMappingForChannel() {

    }

    createConnection(server, opts) {
        if (this.nickToId[opts.nick]) {
            //TODO: Ensure it definitely is still up.
            return Promise.resolve(this.nickToId[opts.nick]);
        }
        log.info(`Creating new connection for ${server} ${opts.nick}`);
        return this._requestWrapper(
            `/_irc/connections/${server.domain}/open`, "post", opts
        ).then((res) => {
            log.info(`New connection opened for ${server} ${opts.nick}`);
            return res.id;
        });
    }

    sendCommand(client_id, type, content) {
        this.websocket.send(JSON.stringify({
            client_id,
            type,
            content
        }));
    }

    _onMessage(data) {
        log.debug(`Got message ${data}`);
    }

    _onError(error) {
        log.error(
            `Got error ${error}`
        );
    }

    _requestWrapper(endpoint, method="get", contentBody) {
        log.debug(`Requesting ${endpoint}`);
        return new Promise((resolve, reject) => {
            this.request[method](endpoint, {
                body: contentBody,
            }, (err, _, body) => {
                if (err) {
                    reject({err, body});
                }
                resolve(body);
            });
        });
    }
}

module.exports = RemoteClientPool;