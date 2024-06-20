/**
 * Web worker to represent a simulated device.
 * Although the device is simulated, all communication between the simulator and the dashboard is over the (external) PubNub network.
 */
if ("function" === typeof importScripts) {
  const window = null;
  const TICK_INTERVAL_BASE = 500; //  Time in ms between each 'tick', triggering a simulation update
  importScripts("https://cdn.pubnub.com/sdk/javascript/pubnub.7.6.1.min.js");

  var deviceSimulator;
  var sharedChannelName;
  var defaultDeviceName;
  var id;
  var type;
  var route;
  var localPubNub;
  var lat;
  var long;
  var tick = 0;
  var routeSteps = 0;

  //  Message handler for the web worker - this is only used once (to start the worker).  All subsequent communication is over PubNub
  onmessage = async function (args) {
    if (args.data.action === "go") {
      id = args.data.params.id;
      sharedChannelName = args.data.params.channel;
      route = args.data.params.route;
      defaultDeviceName = args.data.params.name;
      sensorType = args.data.params.sensorType;
      sensorName = args.data.params.sensorName;

      //  Pub / Sub key will be shared with the PubNub instance used by the dashboard, defined in keys.js
      var subKey = args.data.params.sub;
      var pubKey = args.data.params.pub;
      localPubNub = new PubNub({
        publishKey: pubKey,
        subscribeKey: subKey,
        uuid: id,
        listenToBrowserNetworkEvents: false, //  Allows us to call the PubNub SDK from a web worker
      });

      var accessManagerToken = await requestAccessManagerToken(id)
      if (accessManagerToken == null)
      {
        console.log('Error retrieving access manager token')
      }
      else{
        localPubNub.setToken(accessManagerToken)
      }

      await localPubNub.addListener({
        status: async (statusEvent) => {},
        message: async (payload) => {
          //  Received a message from the client intended for the driver
          //  display that message on the map, beside the vehicle
          //  This means sending the data back over PubNub
          if (payload.publisher !== id) {
            if (payload.message.action === "reboot") {
              vehicleSimulator.reboot();
            } else if (payload.message.action == "pushMessage") {
              //  You can send Push Messages (FCM on Android, APNS on Apple) from PubNub, this can greatly simplify your
              //  application logic, allowing you to seamlessly integrate with mobile push technologies without worrying
              //  about application-specific code by sending a specific payload in your PubNub message.  This demo simulates
              //  Push to show what it might look like in production, but you can see a real Push Message being
              //  sent / received over PubNub from our Push demo: https://www.pubnub.com/demos/push/.
              var messageText = payload.message.text;
              //  Received a push message from the UI
              if (messageText !== "") {
                await localPubNub.publish({
                  channel: sharedChannelName,
                  message: {
                    state: "ADD_INFO_WINDOW",
                    data: messageText,
                  },
                });
              }
            } else if (payload.message.action === "stop") {
              vehicleSimulator.stop();
            } else if (payload.message.action === "reroute") {
              vehicleSimulator.reroute(payload.message.route)
            }
          }
        },
      });

      //  To communicate directly with this vehicle, use the id as the channel name.  SharedChannelName is used to detect presence of all sensors by the dashboard
      await localPubNub.subscribe({
        channels: [id, sharedChannelName],
        withPresence: false,
      });

      vehicleSimulator = new DeviceSimulator(
        defaultDeviceName,
        sensorType,
        route,
        id,
        sensorName
      );
      vehicleSimulator.start();
    }
  };

  class DeviceSimulator {
    interval = TICK_INTERVAL_BASE;
    intervalId;
    routeSteps = 0;
    model = function () {};
    deviceId;
    constructor(defaultDeviceName, type, route, id, sName) {
      this.deviceName = defaultDeviceName;
      this.sensorType = type;
      this.sensorName = sName;
      this.route = route;
      this.routeSteps = 0;
      this.deviceId = id;
      if (this.route != null && this.route.fileName == "") this.route = null;

      this.units = "";
      this.firmwareVersion = "1.0.0";
      if (this.sensorType === 0) {
        //  Average around a temperature of -5.  Vary by 1 (celsius)
        //  y = 1sin(x) -5
        this.model = function (x) {
          return 1 * Math.sin(x / 10.0) - 5;
        };
        this.units = "°c";
      } else if (this.sensorType == 1) {
        //  Average around a temperature of -18.  Vary by 1 (celsius)
        //  y = 1sin(x) - 18
        this.model = function (x) {
          return 1 * Math.sin(x / 10.0) - 18;
        };
        this.units = "°c";
      }
    }

    start() {
      this.publishMessage(
        localPubNub,
        sharedChannelName,
        this.model,
        this.deviceName,
        this.interval,
        this.sensorName,
        this.sensorType,
        this.units,
        this.firmwareVersion,
        this.deviceId
      );
      this.intervalId = setInterval(
        this.publishMessage,
        this.interval,
        localPubNub,
        sharedChannelName,
        this.model,
        this.deviceName,
        this.interval,
        this.sensorName,
        this.sensorType,
        this.units,
        this.firmwareVersion,
        this.deviceId
      );
    }

    stop() {
      clearInterval(this.intervalId);
    }

    //  Not used in this demo
    setName(name) {
      this.deviceName = name;
    }

    //  Not used in this demo
    changeIntervalValue(newInterval) {
      this.stop();
      this.interval = newInterval;
      this.start();
    }

    //  Simulate a device reboot (unsubscribing and resubscribing to the channel will trigger PubNub presence events 
    //  which are shown on the UI)
    async reboot() {
      await localPubNub.unsubscribe({ channels: [sharedChannelName] });
      setTimeout(this.postReboot, 5000, this);
    }

    //  Simulate a device reboot (unsubscribing and resubscribing to the channel will trigger PubNub presence events 
    //  which are shown on the UI)
    async postReboot(deviceSimulator) {
      await localPubNub.subscribe({
        channels: [sharedChannelName],
        withPresence: false,
      });
    }

    //  Handler for when the user asks to reroute the current vehicle.  Logic is quite simple, rather than generate a 
    //  whole new route, just end the current leg and create a single new leg from the current position
    async reroute(newRoute) {
      //  End the current leg
      await localPubNub.publish({
        channel: sharedChannelName,
        message: {
          state: "END_LEG",
          routeFinished: false,
          legId: this.deviceId + "" + route[0].lat, //  Need to uniquely identify the leg
        },
      });
      this.stop();
      route = newRoute
      tick = 0
      this.start();
    }

    //  Not used in this demo
    getFirmwareVersion() {
      return this.firmwareVersion;
    }

    toString() {
      return this.id;
    }

    async publishMessage(
      localPubNub,
      channelName,
      model,
      deviceName,
      interval,
      sensorName,
      sensorType,
      sensorUnits,
      firmwareVersion,
      deviceId
    ) {
      if (tick >= route.length) {
        //  This should not happen, but close the web worker if we exceed our route
        clearInterval(this.intervalId);
        close();
        return;
      }
      var sensorValue = model(tick);
      var localLatitude = route[tick].lat;
      localLatitude =
        Math.round((localLatitude + Number.EPSILON) * 10000000) / 10000000;
      var localLongitude = route[tick].lng;
      localLongitude =
        Math.round((localLongitude + Number.EPSILON) * 10000000) / 10000000;

      //  Notify the application when we start a new leg of our route
      //  All of this NEW_LEG / END_LEG logic is a bit convoluted and in production would be handled by a centralized routing computer, but
      //  this shows the idea that PubNub can report location and other sensor data that can be accumulated for the vehicle at some
      //  central point.
      //  Route info is handled in messages, but the reporting of sensor data and lat/long data is exchanged with Signals, which matches
      //  what we would recommend to use in production for this ephemeral data.
      if (route[tick].meta !== undefined) {
        //  The route element has meta associated with it, this might either be an 'END_LEG' or a start route
        if (route[tick].meta === "END_LEG") {
          //  Notify the UI that our route has finished, so the route can be cleared
          await localPubNub.publish({
            channel: channelName,
            message: {
              state: "END_LEG",
              routeFinished: tick >= route.length - 1,
              legId: deviceId + "" + route[0].lat, //  Need to uniquely identify the leg
            },
          });
        } else {
          //  The route element is a start route.  Notify the UI to draw the route
          routeSteps = 0;

          //  Calculate remaining deliveries
          var remainingDeliveriesJSON = route.slice(tick);
          var remainingDeliveriesString = JSON.stringify(
            remainingDeliveriesJSON
          );
          var remainingDeliveries = (
            remainingDeliveriesString.match(/NEW_LEG/g) || []
          ).length;

          await localPubNub.publish({
            channel: channelName,
            message: {
              state: "START_LEG",
              lat: localLatitude,
              lng: localLongitude,
              remainingDeliveries: remainingDeliveries,
              route: route.slice(tick, tick + route[tick].meta["NEW_LEG"]),
              legId: deviceId + "" + route[0].lat,
              vehicleName: deviceName,
              sensorName: sensorName,
              sensorType: sensorType,
            },
          });
        }
      } else if (tick < route.length) {
        //  Send a signal since this is just a positional update and is more efficient, though only supports a small payload
        routeSteps++;

        //  Send a signal with the lat / long of the vehicle
        await localPubNub.signal({
          channel: channelName,
          message: {
            t: "l",
            lat: localLatitude,
            lng: localLongitude,
            tick: routeSteps,
          },
        });

        //  Send a signal with the temperature sensor reading
        await localPubNub.signal({
          channel: channelName,
          message: {
            t: "sig",
            v: sensorValue,
          },
        });
      }
      tick++;
    }
  }

  //  This sample uses Access Manager to protect the Pub/Sub keys
  async function requestAccessManagerToken(userId) {
    try {
      const TOKEN_SERVER =
        "https://devrel-demos-access-manager.netlify.app/.netlify/functions/api/transportlogistics";
      
      const response = await fetch(`${TOKEN_SERVER}/grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ UUID: userId }),
      });

      const token = (await response.json()).body.token;

      return token;
    } catch (e) {
      console.log("Failed to create token " + e);
      return null;
    }
  }
}
