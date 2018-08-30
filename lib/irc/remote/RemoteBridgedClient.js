
var Promise = require("bluebird");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
const LegacyBridgedClient = require("../BridgedClient");
var promiseutil = require("../../promiseutil");
var ident = require("../ident");
var ConnectionInstance = require("../ConnectionInstance");
var IrcRoom = require("../../models/IrcRoom");

const log = require("../../logging").get("RemoteBridgedClient");

class RemoteBridgedClient {
    constructor(clientPool, server, ircClientConfig, matrixUser, isBot, eventBroker, identGenerator,
        ipv6Generator) {
        this._clientPool = clientPool;
        this._eventBroker = eventBroker;
        this._identGenerator = identGenerator;
        this._ipv6Generator = ipv6Generator;
        this._clientConfig = ircClientConfig;
        this.matrixUser = matrixUser;
        this.server = server;
        this.userId = matrixUser ? this.matrixUser.getId() : null;
        this.displayName = matrixUser ? this.matrixUser.getDisplayName() : null;
        this.nick = LegacyBridgedClient.getValidNick(
            ircClientConfig.getDesiredNick() || server.getNick(this.userId, this.displayName),
            false);
        this.password = (
            ircClientConfig.getPassword() ? ircClientConfig.getPassword() : server.config.password
        );
    
        this.isBot = Boolean(isBot);
        this.lastActionTs = Date.now();
        this.inst = null;
        this.instCreationFailed = false;
        this.explicitDisconnect = false;
        this.chanList = [];
        this._connectDefer = promiseutil.defer();
        this._id = "not-connected";
        // decorate log lines with the nick and domain, along with an instance id
        this.log = {
            debug: function () {
                arguments[0] = this.logPrefix + arguments[0];
                log.debug.apply(log, arguments);
            },
            info: function ()  {
                arguments[0] = this.logPrefix + arguments[0];
                log.info.apply(log, arguments);
            },
            error: function () {
                arguments[0] = this.logPrefix + arguments[0];
                log.error.apply(log, arguments);
            }
        };
    
        this._cachedOperatorNicksInfo = {
            // $channel : info
        };
    }

    get connect() {
        return this._connect;
    }

    joinChannel(channel, key, attemptCount) {
        this._clientPool.sendCommand(this._id, "joinchannel", {
            channel: channel,
            key: key,
        });
    }

    getClientConfig () {
        return this._clientConfig;
    }
    
    get logPrefix() {
        const prefix = "<" + this.nick + "@" + this.server.domain + "#" + this._id + "> ";
        if (this.userId) {
            prefix += "(" + this.userId + ") ";
        }
        return prefix;
    }
}

RemoteBridgedClient.prototype._connect = Promise.coroutine(function*() {
    const nameInfo = yield this._identGenerator.getIrcNames(
        this._clientConfig, this.matrixUser
    );
    if (this.server.getIpv6Prefix()) {
        // side-effects setting the IPv6 address on the client config
        yield this._ipv6Generator.generate(
            this.server.getIpv6Prefix(), this._clientConfig
        );
    }
    this.log.info(
        "Connecting to IRC server %s as %s (user=%s)",
        this.server.domain, this.nick, nameInfo.username
    );
    console.log("Awoo");
    this._eventBroker.sendMetadata(this,
        `Connecting to the IRC network '${this.server.domain}' as ${this.nick}...`
    );

    const connectionOpts = {
        nick: this.nick,
        userName: nameInfo.username,
        realName: nameInfo.realname,
        password: this.password,
        localAddress: this.server.getIpv6Prefix() ? this._clientConfig.getIpv6Address() : undefined,
        autoConnect: false,
        autoRejoin: false,
        floodProtection: true,
        port: this.server.getPort(),
        selfSigned: this.server.useSslSelfSigned(),
        certExpired: this.server.allowExpiredCerts(),
        retryCount: 0,
        family: this.server.getIpv6Prefix() || this.server.getIpv6Only() ? 6 : null,
        bustRfc3484: true,
        sasl: this.password ? this.server.useSasl() : false,
    };

    if (this.server.useSsl()) {
        connectionOpts.secure = { ca: this.server.getCA() };
    }
    console.log("Awoo");
    const uuid = yield this._clientPool.createConnection(
        this.server, {
        nick: this.nick,
    });
    this._id = uuid;
});

module.exports = RemoteBridgedClient;
