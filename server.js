var _ = require('underscore');
var Data = require('../data');
var async = require('async');

exports.initialize = function(server, graph, config) {
  
  // AJAX interface
  // --------------
  
  server.get('/graph/read', function(req, res) {
    var callback = req.query.callback,
        query = JSON.parse(req.query.qry),
        options = JSON.parse(req.query.options)
    graph.adapter.read(JSON.parse(req.query.qry), JSON.parse(req.query.options), function(err, g) {
      err ? res.send(callback+"("+JSON.stringify(err)+");")
          : res.send(callback+"("+JSON.stringify(g)+");");
    }, req.session);
  });

  server.put('/graph/write', function(req, res) {
    graph.adapter.write(req.body, function(err, g) {
      err ? res.send(err) : res.send(JSON.stringify({"status": "ok", "graph": g}));
    }, req.session);
  });
  
  server.get('/graph/watch', function(req, res) {
    send('no-op');
    // var callback = req.query.callback,
    //     query = JSON.parse(req.query.qry),
    //     options = JSON.parse(req.query.options)
    // graph.adapter.read(JSON.parse(req.query.qry), JSON.parse(req.query.options), function(err, g) {
    //   err ? res.send(callback+"("+JSON.stringify(err)+");")
    //       : res.send(callback+"("+JSON.stringify(g)+");");
    // }, req.session);
  });
  
  
  // NowJS interface
  // --------------
  
  var nowjs = require('now');
  var everyone = nowjs.initialize(server);
  
  // Watcher groups
  var channels = {};
  
  everyone.connected(function() {});
  everyone.disconnected(function(){});
  
  // Dispatch to all interested parties
  function dispatchUpdates(nodes) {
    var notifications = {};
  
    // For each node, check channels
    _.each(nodes, function(node, key, index) {
      _.each(channels, function(channel) {
        if (Data.matches(node, channel.query)) {
          notifications[channel.name] = notifications[channel.name] ? notifications[channel.name] : {};
          notifications[channel.name][key] = node;
        }
      });
    });
    
    // Dispatch
    _.each(notifications, function(nodes, groupName) {
      nowjs.getGroup(groupName).now.update(groupName, nodes);
    });
  };
  
  // Register a new watcher
  everyone.now.watch = function(channel, query, callback) {
    var group  = nowjs.getGroup(channel);
    group.addUser(this.user.clientId);
    channels[channel] = {
      name: channel,
      group: group,
      query: query
    };
    callback();
  };
  
  everyone.now.unwatch = function(name, callback) {
    var group = nowjs.getGroup(name);
    group.removeUser(this.user.clientId);
    // TODO: remove the whole group and channel if empty
  };
  
  // Read graph
  everyone.now.read = function(query, options, callback) {
    graph.adapter.read(query, options, function(err, g) {      
      callback(err, g);
    }, this.user);
  };
  
  // Write graph
  everyone.now.write = function(nodes, callback) {
    graph.adapter.write(nodes, function(err, g) {
      callback(err, g);
      
      // Notify channel users
      dispatchUpdates(g);
    }, this.user);
    callback();
  };
};