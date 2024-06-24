var activeVehicles = 0;
var userLocation = {
  lat: PUBNUB_LAT,
  lng: PUBNUB_LNG,
};

function dispatchVehicle_click() {
  document.getElementById("developer-note").style.display = "none";
  //  Rate limit the speed that vehicles can be summoned (directions api is rate limited)
  document.getElementById("btnDispatchVehicle").disabled = true;
  activeVehicles++;
  if (activeVehicles < MAX_ACTIVE_VEHICLES) {
    setTimeout(
      "document.getElementById('btnDispatchVehicle').disabled = false;",
      2000
    ); 
  }

  zoomOnPosition(userLocation);
  server_dispatchVehicle(userLocation);
}

//  Handler for the checkbox the user taps to find their physical location.
function handleChkFindMyLocation() {
  var chk = document.getElementById("chkFindMyLocation");
  if (chk.checked) {
    //  Find current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        handlePosition,
        findMyLocationFailed
      );
      updateLocationSpan("Please Wait...");
    } else {
      //  Browser does not support navigator object
      findMyLocationFailed(error.POSITION_UNAVAILABLE);
    }
  } else {
    //  Do not find current location
    updateLocationSpan("");
    hideUserLocationMarker();
    userLocation = {
      lat: PUBNUB_LAT,
      lng: PUBNUB_LNG,
    };
  }
}

//  When the user's physical location is found, this function handles the successful return of the user's lat/long
function handlePosition(position) {
  userLocation = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
  updateLocationSpan("User Found");
  zoomOnPosition(userLocation);
  showUserLocationMarker(userLocation);
}

//  Handler for when some issue happens retrieving the user's physical location.  Just default to PubNub offices.
function findMyLocationFailed(error) {
  document.getElementById("chkFindMyLocation").checked = false;
  userLocation = {
    lat: PUBNUB_LAT,
    lng: PUBNUB_LNG,
  };
  switch (error.code) {
    case error.PERMISSION_DENIED:
      updateLocationSpan("User denied the request for Geolocation.");
      break;
    case error.POSITION_UNAVAILABLE:
      updateLocationSpan("Location information is unavailable.");
      break;
    case error.TIMEOUT:
      updateLocationSpan("Location information is unavailable.");
      break;
    case error.UNKNOWN_ERROR:
      updateLocationSpan("An unknown error occurred.");
      break;
  }
}

function updateLocationSpan(newText) {
  document.getElementById("spanDetectedLocation").innerText = newText;
}
