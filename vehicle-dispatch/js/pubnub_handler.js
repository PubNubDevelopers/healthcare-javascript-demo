/**
 * Main entry point for communication coming from PubNub
 * The internal state of the application is managed by the 'iotDevices' object.
 * This is designed to show the principle of what IoT with PubNub would look like - obviously storing these entities as part of the client app state does not lend itself to multiple clients viewing the same simulated device(!).  PubNub App Context would be a good approach to managing your IoT devices on the server - see the ReadMe for more information.
 * Note: I used an auto-formatter on this code but I'm not sure I like how it turned out.
 */

var pubnub = null;
var iotDevices = null;
var selectedId = null;
//  The channel name will be based on the URL query string (if provided), allowing us to efficiently retrieve historical messages, required to determine deliveries in progress when the page is launched
var channelName = null;
//  Array of deliveries which, according to PN history, are in progress before we loaded
var potentialInFlightDeliveries = [];

async function onload() {
  iotDevices = {};
  if (!testPubNubKeys()) {
    document.getElementById("noKeysAlert").style.display = "block";
  } else {
    //  The interactive demo provides a unique ID for the user in the URL query string, ideally use this for our ID to produce a superior experience on multiple devices so they have the same view of dispatched vehicles.
    var queryString = new URL(window.location.href).search.substring(1);
    var identifier = null;
    const urlParamsArray = queryString.split("&");
    for (let i = 0; i < urlParamsArray.length; i++) {
      if (
        urlParamsArray[i].startsWith("identifier") &&
        urlParamsArray[i].includes("=")
      ) {
        var identifierPair = urlParamsArray[i].split("=");
        identifier = identifierPair[1];
      }
    }
    if (identifier === null) {
      console.log(
        "Not running within Interactive demo.  When running app in multiple windows, be sure to load the second window before requesting vehicle"
      );
    }
    pubnub = await createPubNubObject(identifier);
    channelName = "vehicle." + pubnub.getUUID();

    //  Retrieve the past 100 messages on the channel (channel name here is based on URL query string, where specified).  There are 2 messages associated with each delivery, one to say the delivery has started and one to say the delivery has finished, so this will capture up to 100 in-flight deliveries, but in reality it will depend on whether some of those deliveries have finished in the mean-time and how many messages were sent to the vehicle driver.  Practically, you are going to capture all the deliveries the user has requested but increasing this number will not have a negative impact.
    try {
      const result = await pubnub.fetchMessages({
        channels: [channelName],
        count: 100,
      });
      processHistoricalMessages(result);
    } catch (status) {
      console.log(
        "PubNub History call failed.  Do you have persistence enabled on your keyset?"
      );
    }

    await pubnub.addListener({
      //  Status events
      status: async (statusEvent) => {},
      //  Messages from remote IOT devices.  Update the internal object that stores information about all these devices
      message: async (payload) => {
        //if (
        //  iotDevices[payload.publisher] == null ||
        //  payload.publisher === pubnub.uuid
        //)
        //  return
        if (payload.message.state === "START_LEG") {
          if (iotDevices[payload.publisher] == null) {
            //  We didn't create this device, but still want to display it.  Only display
            createDevice(
              payload.publisher,
              payload.message.vehicleName,
              payload.message.sensorName,
              payload.message.sensorType,
              channelName == payload.channel
            );
            document.getElementById("developer-note").style.display = "none";
          }
          if (iotDevices[payload.publisher].routeInfo != null) {
            //  Tried to start duplicate route (sometimes happens when debugging web workers)
            return;
          }
          //  New Route
          initializeDeliveryRoute(
            payload.publisher,
            payload.message.route,
            payload.channel,
            false
          );
          iotDevices[payload.publisher].lat = payload.message.lat;
          iotDevices[payload.publisher].long = payload.message.lng;
          locationUpdateReceived(
            payload.publisher,
            payload.message.lat,
            payload.message.lng,
            0
          );
          updateDeliveryInfo(
            payload.publisher,
            payload.message.route,
            payload.message.remainingDeliveries
          );
          updateRegisteredDeviceLocation(payload.publisher);
        } else if (payload.message.state === "END_LEG") {
          //  Hide the route on the UI
          clearDestinationMarker(payload.publisher);
          clearVehicleMarker(payload.publisher);
          clearMapRoute(payload.publisher);
          iotDevices[payload.publisher].routeInfo = null;
          if (payload.message.routeFinished) {
            deleteDevice(payload.publisher);
          }
        } else if (payload.message.state === "ADD_INFO_WINDOW") {
          //  Display the message in an info window on the Google Map
          showInfoWindow(payload.publisher, payload.message.data);
          setTimeout(function () {
            hideInfoWindow(payload.publisher);
          }, 4000);
        }
      },
      presence: (presenceEvent) => {
        //  Will be invoked regardless of the 'Announce Max' setting on the key
        if (iotDevices[presenceEvent.uuid]) {
          if (presenceEvent.action === "join")
            iotDevices[presenceEvent.uuid].online = "yes";
          else iotDevices[presenceEvent.uuid].online = "no";
          updateRegisteredDevicePresence(presenceEvent.uuid);
        }
      },
      signal: async (payload) => {
        if (payload.message.t === "l") {
          //  Consider whether this signal was related to a delivery which started before the page was loaded
          for (var inFlight in potentialInFlightDeliveries) {
            if (potentialInFlightDeliveries[inFlight].id == payload.publisher) {
              createDevice(
                potentialInFlightDeliveries[inFlight].id,
                potentialInFlightDeliveries[inFlight].vehicleName,
                potentialInFlightDeliveries[inFlight].sensorName,
                potentialInFlightDeliveries[inFlight].sensorType,
                true
              );
              initializeDeliveryRoute(
                potentialInFlightDeliveries[inFlight].id,
                potentialInFlightDeliveries[inFlight].route,
                potentialInFlightDeliveries[inFlight].originalChannel,
                false
              );
              potentialInFlightDeliveries.splice(inFlight, 1);
            }
          }
          if (iotDevices[payload.publisher]) {
            iotDevices[payload.publisher].lat = payload.message.lat;
            iotDevices[payload.publisher].long = payload.message.lng;
            locationUpdateReceived(
              payload.publisher,
              payload.message.lat,
              payload.message.lng,
              payload.message.tick
            );
            updateRegisteredDeviceLocation(payload.publisher);
            var remainingSteps =
              iotDevices[payload.publisher].routeInfo.route.length -
              1 -
              iotDevices[payload.publisher].routeInfo.driverProgress;
            updateDeliveryEta(
              payload.publisher,
              remainingSteps,
              TICK_INTERVAL_BASE
            );
          }
        } else if (payload.message.t === "sig") {
          //  Received sensor update
          if (iotDevices[payload.publisher]) {
            iotDevices[payload.publisher].sensors[0].sensor_value =
              Math.round((payload.message.v + Number.EPSILON) * 100) / 100;
            updateRegisteredDeviceSensor(payload.publisher);
          }
        } else {
          //  Unrecognized signal type
        }
      },
    });

    //  Wildcard subscribe, to listen for all devices in a scalable manner
    pubnub.subscribe({
      channels: ["vehicle.*"],
      withPresence: true,
    });
  }
}

//  Handler to process messages retrieved from history, to cater for a window loaded after a delivery is en-route
//  This whole section can be ignored for your production app, I am just setting up the demo so it can catch-up
//  on in-flight vehicles using the route mechanism previously established.  So, you can see the same vehicle 
//  in multiple windows, regardless of whether the vehicle is already moving or not.
function processHistoricalMessages(history) {
  var started = [];
  var stopped = [];
  //  If we load a new window whilst a delivery is in progress we want to display that delivery on the map.
  //  The problem is we missed the original set-up message, telling us to initialise the route
  //  Search the history for vehicles that are en-route
  if (history != null && history.channels[channelName] != null) {
    for (var i = 0; i < history.channels[channelName].length; i++) {
      if (history.channels[channelName][i].message.state == "START_LEG") {
        started.push({
          id: history.channels[channelName][i].uuid,
          route: history.channels[channelName][i].message.route,
          originalChannel: history.channels[channelName][i].channel,
          legId: history.channels[channelName][i].message.legId,
          vehicleName: history.channels[channelName][i].message.vehicleName,
          sensorName: history.channels[channelName][i].message.sensorName,
          sensorType: history.channels[channelName][i].message.sensorType,
        });
      } else if (history.channels[channelName][i].message.state == "END_LEG") {
        stopped.push(history.channels[channelName][i].message.legId);
      }
    }
  }
  for (var i = 0; i < started.length; i++) {
    if (!stopped.includes(started[i].legId)) {
      potentialInFlightDeliveries.push({
        id: started[i].id,
        route: started[i].route,
        originalChannel: started[i].originalChannel,
        vehicleName: started[i].vehicleName,
        sensorName: started[i].sensorName,
        sensorType: started[i].sensorType,
      });
      //  bit of a hack to keep track of what we have started
      stopped.push(started[i].legId);
    }
  }
}
