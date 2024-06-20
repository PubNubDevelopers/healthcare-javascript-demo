/**
 * Logic related to creating predefined and user-specified simulators.
 */

var client = null;

//  Entry function when the user presses the 'dispatch vehicle' button
async function server_dispatchVehicle(location) {
  var legs = [];
  var lastLocation = userLocation;
  for (var i = 0; i < 4; i++) {
    var currentLeg = await generateLeg(lastLocation);
    if (currentLeg.length > 0) {
      legs.push(...currentLeg);
      lastLocation = currentLeg[currentLeg.length - 1];
    }
  }
  var route = DEFAULT_ROUTE;
  if (legs.length > 0) {
    var route = legs;
  } else {
    //  For example, if the user is on some remote island, this is a failsafe
    console.log(
      "Error: Could not find sensible route, using default route instead"
    );
  }

  server_spawnVehicleSimulator(route);
}

//  A route will comprise of several legs, this function generates a leg from a given start point
async function generateLeg(initialLocation) {
  //  Return the route to a new location, some distance from the specified location
  var route = [];
  var attempts = 0;
  while (attempts < 3) {
    var deliveryStop = server_offsetLocation(initialLocation);
    route = await server_generateRouteInfo(initialLocation, deliveryStop);
    if (route.length > 0) {
      attempts = 500;
      //route = reduceRoute(route)
      return route;
    } else {
      attempts++;
    }
  }
  return route;
}

//  Sometimes the Google Directions API will generate a route with too many waypoints, so reduce the number of waypoints
function reduceRoute(route) {
  //  For simplicity, this app will just throw away some of the intermediate points if the route is too large
  while (route.length > 300) {
    var reducedRoute = [];
    reducedRoute.push(route[0]);
    //  Keep the start and end few locations
    for (var i = 1; i < route.length - 2; i++) {
      if (i % 2 == 0) reducedRoute.push(route[i]);
    }
    reducedRoute.push(route[route.length - 1]);
    route = reducedRoute;
  }
  return route;
}

//  Use the Google Directions API to generate a route (we are only interested in the list of lat/long waypoints)
//  Given two locations.  The directions API is much more powerful than this but this is not a demo of Google's API
async function server_generateRouteInfo(origin, destination) {
  //  args are lat,lng pairs
  var sourceLatLng = origin.lat + "," + origin.lng;
  var destLatLng = destination.lat + "," + destination.lng;

  return new Promise((resolve) => {
    var directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: sourceLatLng,
        destination: destLatLng,
        travelMode: "DRIVING", //  Just assume all these routes will be driving, nothing to stop us using PubNub for cycle-based deliveries etc.
      },
      function (response, status) {
        if (
          status === "OK" &&
          response.routes.length > 0 &&
          response.routes[0].legs[0].steps.length > 0
        ) {
          //  Iterate over all the latlngs in all the steps and create
          var route = [];
          for (
            var step = 0;
            step < response.routes[0].legs[0].steps.length;
            step++
          ) {
            for (
              var latlng = 0;
              latlng < response.routes[0].legs[0].steps[step].lat_lngs.length;
              latlng++
            ) {
              var newLatLong = {
                lat: response.routes[0].legs[0].steps[step].lat_lngs[
                  latlng
                ].lat(),
                lng: response.routes[0].legs[0].steps[step].lat_lngs[
                  latlng
                ].lng(),
              };
              route.push(newLatLong);
            }
          }
          //  route now contains an array of lat/long waypoints between the start and end points, inclusive.
          if (route.length > 1) {
            route = reduceRoute(route);
            //route[0].meta = {"START_ROUTE": {"lat": route[0].lat, "lng": route[0].lng}, "STOP_ROUTE": {"lat": route[route.length-1].lat, "lng": route[route.length-1].lng}}
            route[0].meta = { NEW_LEG: route.length - 1 };
            route[route.length - 1].meta = "END_LEG";
          }
          resolve(route);
        } else {
          resolve([]);
        }
      }
    );
  });
}

//  We want to spawn a delivery vehicle at a random position between x and y km from the
//  delivery location, where x and y are configurable.  Assume the earth is a perfect sphere.
//  Return a new lat/long the specified distance away from the passed lat/long
function server_offsetLocation(location) {
  var randomAzimuthInDegrees = Math.floor(Math.random() * 359);
  var randomDistanceInMeters =
    Math.floor(Math.random() * maximumSpawnDistanceOfDriver) +
    minimumSpawnDistanceOfDriver;
  var northDisplacement =
    randomDistanceInMeters *
    (Math.cos((Math.PI / 180) * randomAzimuthInDegrees) / 111111);
  var eastDisplacement =
    (randomDistanceInMeters *
      Math.sin((Math.PI / 180) * randomAzimuthInDegrees)) /
    Math.cos((Math.PI / 180) * location.lat) /
    111111;
  var newLatitude = location.lat + northDisplacement;
  var newLongitude = location.lng + eastDisplacement;
  newLatitude =
    Math.round((newLatitude + Number.EPSILON) * 10000000) / 10000000;
  newLongitude =
    Math.round((newLongitude + Number.EPSILON) * 10000000) / 10000000;
  return { lat: newLatitude, lng: newLongitude };
}

//  In production, this code simulates a vehicle reporting its position through PubNub
//  This is implemented in a web worker for convenience - it means the demo is self-contained
//  Without having to worry about spinning up any serverless code to get things working.
function server_spawnVehicleSimulator(route) {
  var simulatorTask = new Worker("./js/simulation/worker_vehiclesim.js");
  var deviceId = "sim_" + makeid(6);
  var deviceName =
    vehicleNames[Math.floor(Math.random() * vehicleNames.length)];
  var sensorName = Math.floor(Math.random() * sensorNames.length);
  var sensorType = Math.floor(Math.random() * sensorTypes.length);

  createDevice(deviceId, deviceName, sensorName, sensorType, true);

  simulatorTask.postMessage({
    action: "go",
    params: {
      id: deviceId,
      name: deviceName,
      channel: channelName,
      sensorType: sensorType,
      sensorName: sensorName,
      route: route,
      sub: subscribe_key,
      pub: publish_key,
    },
  });
}

//  Initialization code for the device (vehicle)
function createDevice(
  deviceId,
  deviceName,
  sensorName,
  sensorType,
  addToTable
) {
  if (!iotDevices[deviceId]) {
    iotDevices[deviceId] = {
      online: "yes",
      selected: false,
      name: deviceName,
      channelName: deviceId,
      lat: 0.0,
      long: 0.0,
      sensors: [
        {
          sensor_name: sensorNames[sensorName],
          sensor_type: sensorTypes[sensorType],
          sensor_update_frequency: 0,
          sensor_value: 0.0,
          sensor_units: "°c",
          sensor_lastupdate: "",
        },
      ],
      deliveryInfo: {
        nextDelivery: "",
        etaToNextDelivery: "",
        remainingDeliveries: "",
      },
      alerts: "None",
      firmware_version: "Unknown",
    };
    if (addToTable) addRegisteredDevice(deviceId);
  }
}

//  Use the Google Geocoding API to resolve the lat/long of the destination to an address
async function server_resolveLatLongToAddress(latLng) {
  return new Promise((resolve) => {
    geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: latLng }).then((response) => {
      if (response.results[0] && response.results[0].formatted_address) {
        resolve(response.results[0].formatted_address);
      } else {
        resolve("[" + lat + "," + lng + "]");
      }
    });
  });
}
