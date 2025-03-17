const id = "signalk-mfd-plugin";
const dgram = require('dgram');
const os = require("os");
const PUBLISH_PORT = 2053;
const MULTICAST_GROUP_IP = '239.2.1.1';

// For debugging you can use
// tcpdump -i en0 -A  -v net 239.2.1.1

var plugin = {}
var intervalid;

module.exports = function(app, options) {
  var plugin = {}
  plugin.id = id
  plugin.name = "B&G/Navico MFD WebApp tiles"
  plugin.description = "Signal K plugin to add webapp tiles to B&G/Navico MFDs"

  var unsubscribes = []

  plugin.schema = {
    type: 'object',
    properties: {
      whitelist: {
        type: 'string',
        title: 'Plugin Whitelist (comma separated list of plugin names, blank to disable)',
        default: ''
      },
      blacklist: {
        type: 'string',
        title: 'Plugin Blacklist (comma separated list of plugin names, blank to disable)',
        default: ''
      }
    }
  };

  plugin.start = function(options, restartPlugin) {
    var text = [];
    //app.debug('Starting plugin');
    //app.debug('Options: %j', JSON.stringify(options));

    // const port = getExternalPort(app)
    // const protocol = app.config.settings.ssl ? 'https' : 'http'
    
    //const whitelist = ["signalk-location-info", "hoekens-anchor-alarm"];
    const whitelist = options.whitelist.split(",").map(item => item.trim());
    const blacklist = options.blacklist.split(",").map(item => item.trim());

    app.debug('Whitelist: ' + JSON.stringify(whitelist));
    app.debug('Blacklist: ' + JSON.stringify(blacklist));

    const port = 80;
    const protocol = app.config.settings.ssl ? 'https' : 'http';
  
	  intervalid = setInterval(() => publishToNavico(), 10 * 1000);
    
		const getPublishMessage = (tile, ip) => {
      // Options: "{\"tiles\":[{\"Source\":\"SignalK\",\"IP\":\"127.0.0.4\",\"FeatureName\":\"Signal K webapps\",\"Name\":\"Signal K Name\",\"Description\":\"Signal K Menu Text\",\"Icon\":\"http://127.0.0.4/admin/img/signal-k-logo-image-text.svg\",\"URL\":\"http://127.0.0.4:3000/admin/#/webapps\"}]}"
			return JSON.stringify({
			  Version: '1',
			  Source: tile.signalk.displayName,
			  IP: ip,
			  FeatureName: tile.signalk.displayName,
			  Text: [
			    {
			      Language: 'en',
			      Name: tile.signalk.displayName,
			      Description: tile.description
			    }
			  ],
			  Icon: `${protocol}://${ip}:${port}/${tile.name}/${tile.signalk.appIcon}`,
			  URL: `${protocol}://${ip}:${port}/${tile.name}/`,
			  OnlyShowOnClientIP: 'true',
			  BrowserPanel: {
			    Enable: true,
			    ProgressBarEnable: true,
			    MenuText: [
			      {
			        Language: 'en',
			        Name: "Home",
			      }
			    ]
			  }
			});
		}

		const publishToNavico = () => {
      //app.debug(`fetching ${protocol}://localhost:${port}/skServer/webapps`);
      fetch(`${protocol}://localhost:${port}/skServer/webapps`)
        .then(response => {
          // Check if the response is OK (status in the range 200-299)
          if (!response.ok) {
            app.setPluginError(`Network response was not ok: ${response.status} ${response.statusText}`);
          }
          // Parse the JSON
          return response.json();
        })
        .then(data => {
          //console.log(JSON.stringify(data));

          let addresses = [];
          for (const [_name, infos] of Object.entries(os.networkInterfaces())) {
            for (const addressInfo of infos || []) {
              if (addressInfo.family === 'IPv4') {
                addresses.push(addressInfo.address)
              }
            }
          }

          //app.debug('addresses: ' + JSON.stringify(addresses));

          // Loop through the plugin objects
          data.forEach((plugin) => {
            // Check if plugin.signalk exists and both properties exist
            if (plugin.signalk && plugin.signalk.appIcon && plugin.signalk.displayName) {

              //bail if its in our blacklist.
              if (blacklist.length > 0 && blacklist.includes(plugin.name)) {
                return;
              }
              
              //no whitelist means everything passes, otherwise need to be in the list.
              if (whitelist.length === 0 || whitelist.includes(plugin.name)) {
                addresses.forEach((address) => {

                  let message = getPublishMessage(plugin, address);
                  //app.debug('publish message: ' + message);
                
                  send(
                    message,
                    address,
                    MULTICAST_GROUP_IP,
                    PUBLISH_PORT
                  );
                })
              }
    			  }
          })
        })
        .catch(error => {
          // Handle any errors that occurred during the fetch or parsing
          app.setPluginError('Fetch error:', error);
        });
		}
    
    const send = (msg, fromAddress, toAddress, port) => {
      const socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true
      });
      socket.once('listening', () => {
        socket.send(msg, port, toAddress, () => {
          socket.close()
          //app.debug(`${fromAddress}=>${toAddress} @${port} ${msg}`)
        })
      })
      socket.bind(34232, fromAddress)
    }
  }

  plugin.stop = function() {
    app.debug("Stopping")
    unsubscribes.forEach(f => f());
    unsubscribes = [];
    clearInterval(intervalid);
    app.debug("Stopped")
  }

  return plugin;
};

module.exports.app = "app"
module.exports.options = "options"
