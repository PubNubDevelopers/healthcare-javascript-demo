/**
 * Logic to handle drawing the map and the markers.
 */

var map = null;

var initialize = function () {
  var myLatlng = new google.maps.LatLng(37.7749, -40.0);
  map = new google.maps.Map(document.getElementById("map-canvas"), {
    zoom: 3,
    minZoom: 2,
    mapTypeId: "OSM",
    center: myLatlng,
    mapTypeControl: false,
    streetViewControl: false,
  });
  //Define OSM map type pointing at the OpenStreetMap tile server
  map.mapTypes.set("OSM", new google.maps.ImageMapType({
    getTileUrl: function(coord, zoom) {
        // "Wrap" x (longitude) at 180th meridian properly
        // NB: Don't touch coord.x: because coord param is by reference, and changing its x property breaks something in Google's lib
        var tilesPerGlobe = 1 << zoom;
        var x = coord.x % tilesPerGlobe;
        if (x < 0) {
            x = tilesPerGlobe+x;
        }
        // Wrap y (latitude) in a like manner if you want to enable vertical infinite scrolling

        return "https://tile.openstreetmap.org/" + zoom + "/" + x + "/" + coord.y + ".png";
    },
    tileSize: new google.maps.Size(256, 256),
    name: "OpenStreetMap",
    maxZoom: 18
}));
  //  User location marker is only shown for the user's physical location.  For manually entered addresses, the marker is handled by the same logic that draws the route
  userLocationMarker = new google.maps.Marker({
    draggable: false,
    animation: google.maps.Animation.DROP,
    position: {
      lat: 0.0,
      lng: 0.0,
    },
  });
  userLocationMarker.addListener("click", () => {
    zoomOnPosition(userLocationMarker.getPosition());
  });
};

//  Draw the line on the map between the current vehicle and the vehicle's destination.  Depends on the delivery route (received in a PN message when the delivery is first requested).
function drawMapRoute(vehicleId) {
  if (iotDevices[vehicleId].routeInfo != null) {
    if (iotDevices[vehicleId].routeInfo.deliveryPath != null) {
      iotDevices[vehicleId].routeInfo.deliveryPath.setMap(null);
      iotDevices[vehicleId].routeInfo.deliveryPath = null;
    }
    //  Only draw the route of pending distance
    iotDevices[vehicleId].routeInfo.deliveryPath = new google.maps.Polyline({
      path: iotDevices[vehicleId].routeInfo.route.slice(
        iotDevices[vehicleId].routeInfo.driverProgress,
        iotDevices[vehicleId].routeInfo.route.length - 1
      ),
      geodesic: true,
      strokeColor: routeColor,
      strokeOpacity: 1.0,
      strokeWeight: 2,
    });
    iotDevices[vehicleId].routeInfo.deliveryPath.setMap(map);
  }
}

//  Clear the current route - used when vehicles are being rerouted since the previous route needs to be cancelled
function clearMapRoute(vehicleId) {
  if (iotDevices[vehicleId].routeInfo != null) {
    if (iotDevices[vehicleId].routeInfo.deliveryPath != null) {
      iotDevices[vehicleId].routeInfo.deliveryPath.setMap(null);
      iotDevices[vehicleId].routeInfo.deliveryPath = null;
    }
  }
}

//  Logic called when a route is first created (i.e. when a PN message is received from a vehicle telling us a new route is happening).  Create an item in the global vehicles variable.
async function initializeDeliveryRoute(
  vehicleId,
  route,
  originalChannel,
  shouldZoom
) {
  var icon = {
    path: truck_svg,
    fillColor: driverIconColor,
    fillOpacity: 0.9,
    strokeWeight: 0,
    scale: 0.05,
    anchor: new google.maps.Point(250, 200),
  };
  iotDevices[vehicleId].routeInfo = {
    route: route,
    selected: false,
    driverProgress: 0, //  Number of steps the driver has traveled
  };
  iotDevices[vehicleId].routeInfo.destinationMarker = new google.maps.Marker({
    map,
    custom_id: vehicleId,
    draggable: false,
    position: {
      lat: route[route.length - 1].lat,
      lng: route[route.length - 1].lng,
    },
  });
  iotDevices[vehicleId].routeInfo.destinationMarker.addListener("click", () => {
    zoomOnPosition(
      iotDevices[vehicleId].routeInfo.destinationMarker.getPosition()
    );
  });
  iotDevices[vehicleId].routeInfo.vehicleMarker = new google.maps.Marker({
    map,
    custom_id: "v" + vehicleId,
    draggable: false,
    clickable: false,
    icon: icon,
    position: {
      lat: route[0].lat,
      lng: route[0].lng,
    },
  });

  //  Draw the Route on the map including end marker
  drawMapRoute(vehicleId);
  //  Only zoom in on the vehicle if we created it ourselves
  if (shouldZoom && channelName == originalChannel)
    zoomOnPosition(
      iotDevices[vehicleId].routeInfo.destinationMarker.getPosition()
    );
}

function focusOnMarker(deviceId) {
  if (iotDevices[deviceId].routeInfo.vehicleMarker != null) {
    map.setZoom(13);
    map.setCenter(iotDevices[deviceId].routeInfo.vehicleMarker.getPosition());
  }
}

function focusOnLatLong(latitude, longitude) {
  map.setZoom(10);
  map.setCenter({ lat: latitude, lng: longitude });
}

//  Moves the vehicle marker whenever a location update is received
function moveVehicleMarker(vehicleId, lat, lng) {
  if (iotDevices[vehicleId].routeInfo.vehicleMarker != null) {
    iotDevices[vehicleId].routeInfo.vehicleMarker.setPosition({
      lat: lat,
      lng: lng,
    });
  }
}

//  Called whenever a location update is received, either via PN message or PN signal
function locationUpdateReceived(vehicleId, lat, lng, progress) {
  if (iotDevices[vehicleId].routeInfo != null) {
    iotDevices[vehicleId].routeInfo.driverProgress = progress;
    drawMapRoute(vehicleId);
    moveVehicleMarker(vehicleId, lat, lng);
  }
}

//  When the final location update is received, a specific PN message is received from the vehicle.  This function hides the destination marker in response to that.
//  This does NOT clear the user location marker, which corresponds to the user's physical location.
function clearDestinationMarker(vehicleId) {
  if (iotDevices[vehicleId].routeInfo != null) {
    iotDevices[vehicleId].routeInfo.destinationMarker.setMap(null);
    iotDevices[vehicleId].routeInfo.destinationMarker = null;
  }
}

//  When the final location update is received, a specific PN message is received from the vehicle.  This function hides the vehicle marker in response to that.
function clearVehicleMarker(vehicleId) {
  if (iotDevices[vehicleId].routeInfo != null) {
    iotDevices[vehicleId].routeInfo.vehicleMarker.setMap(null);
    iotDevices[vehicleId].routeInfo.vehicleMarker = null;
  }
}

//  Show the marker associated with the user's physical location
function showUserLocationMarker(position) {
  userLocationMarker.setPosition(position);
  userLocationMarker.setMap(map);
}

//  Hide the marker associated with the user's physical location
function hideUserLocationMarker() {
  userLocationMarker.setMap(null);
}

function zoomOnPosition(position) {
  map.setZoom(13);
  map.setCenter(position);
}

//  The Marker info window is used to display messages sent to the driver
//  This message is sent over the PN network twice (once to the simulated vehicle, and once back to the dashboard)
function showInfoWindow(vehicleId, message) {
  if (iotDevices[vehicleId] == null) return;
  var infoMessage =
    "<img src='./pn_small.png'> <b>Push Message via PubNub</b> <br/><br/>";
  infoMessage += message;
  if (iotDevices[vehicleId].infoWindow != null)
    iotDevices[vehicleId].infoWindow.close();

  iotDevices[vehicleId].infoWindow = new google.maps.InfoWindow({
    content: infoMessage,
  });

  iotDevices[vehicleId].infoWindow.open({
    anchor: iotDevices[vehicleId].routeInfo.vehicleMarker,
    map: map,
  });

}

//  You can hide the info window by sending a blank message to the vehicle, or it is removed along with the vehicle marker once the journey is complete
function hideInfoWindow(vehicleId) {
  if (iotDevices[vehicleId].infoWindow != null)
    iotDevices[vehicleId].infoWindow.close();
}

window.initialize = initialize;
