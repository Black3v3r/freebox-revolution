var http = require('http');
var querystring = require('querystring');
var crypto = require('crypto');

function Freebox(options) {
    options = options || {};

    this.hostname = options.hostname || 'mafreebox.free.fr';
    this.appId = options.appId || '';
    this.appToken = options.appToken || '';
    this.apiPath = '/api/v1';

    this.generateSession = function(callback) {
        that.login(function(json) {
            that.session(json.result.challenge, function(json) {
                if (callback && 'function' === typeof(callback)) {
                    callback();
                }
            })
        });
    }
}

Freebox.prototype.login = function(callback) {
    req = http.get('http://' + this.hostname + this.apiPath + '/login', function(res) {
        data = '';
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function() {
            json = JSON.parse(data);
            if (callback && 'function' === typeof(callback)) {
                // challenge : json.result.challenge
                callback(json);
            }
        });
    }).on('error', function(e) {
        console.log('[login] problem with request: ' + e.message);
    });
}

Freebox.prototype.session = function(challenge, callback) {
    that = this;

    data = JSON.stringify({
        app_id: this.appId,
        password: crypto.createHmac('sha1', this.appToken).update(challenge).digest('hex')
    });

    req = http.request({
        hostname: this.hostname,
        port: 80,
        path: this.apiPath + '/login/session/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': data.length,
        }
    }, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            json = JSON.parse(chunk);
            that.sessionToken = json.result.session_token;
            if (callback && 'function' === typeof(callback)) {
                callback(json);
            }
        });
    });

    req.on('error', function(e) {
        console.log('[session] problem with request: ' + e.message);
    });

    req.write(data);
    req.end();
}

Freebox.prototype.addDownload = function(link, callback) {
    that = this;

    var data = querystring.stringify({
        download_url: link
    });

    if (undefined === this.sessionToken) {
        that.generateSession(function() {
            that.addDownload(link, callback);
        });
    } else {
        req = http.request({
            hostname: this.hostname,
            port: 80,
            path: this.apiPath + '/downloads/add',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data),
                'X-Fbx-App-Auth': this.sessionToken
            }
        }, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                json = JSON.parse(chunk);
                // if session expired
                if (false === json.success && 'auth_required' === json.error_code) {
                    that.generateSession(function() {
                        that.addDownload(link, callback);
                    });
                } else if (callback && 'function' === typeof(callback)) {
                    callback();
                }
            });
        });

        req.on('error', function(e) {
            console.log('[addDownload] problem with request: ' + e.message);
        });

        req.write(data);
        req.end();
    }
}

module.exports = Freebox;