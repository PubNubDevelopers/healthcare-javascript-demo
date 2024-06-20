/**
 * Functions update the data in the selected device and registered devices tables.
 */
function updateRegisteredDeviceLocation(deviceId) {
  var latSpan = document.getElementById(deviceId + "-lat");
  var lngSpan = document.getElementById(deviceId + "-lng");
  if (latSpan) latSpan.innerHTML = iotDevices[deviceId].lat;
  if (lngSpan) lngSpan.innerHTML = iotDevices[deviceId].long;
}

function updateRegisteredDevicePresence(deviceId) {
  var presenceSpan = document.getElementById(deviceId + "-presence");
  if (iotDevices[deviceId].online === "yes") {
    if (presenceSpan) presenceSpan.classList.remove("presence-dot-gray");
    if (presenceSpan) presenceSpan.classList.add("presence-dot-online");
  } else {
    if (presenceSpan) presenceSpan.classList.add("presence-dot-gray");
    if (presenceSpan) presenceSpan.classList.remove("presence-dot-online");
  }
  updateRegisteredDeviceSensor(deviceId);
}

function updateRegisteredDeviceSensor(deviceId) {
  var sensorValue = document.getElementById(deviceId + "-sensorValue");
  if (sensorValue) {
    if (iotDevices[deviceId].online === "yes")
      sensorValue.innerHTML = iotDevices[deviceId].sensors[0].sensor_value;
    else
      sensorValue.innerHTML =
        "<i class='fas fa-exclamation-triangle'></i> Offline";
  }
}

async function updateDeliveryInfo(deviceId, route, remainingDeliveries) {
  var destination = {
    lat: route[route.length - 1].lat,
    lng: route[route.length - 1].lng,
  };
  var destinationAddress = await server_resolveLatLongToAddress(destination);
  var nextDelivery = document.getElementById(deviceId + "-nextDelivery");
  if (nextDelivery) nextDelivery.innerHTML = destinationAddress;
  var remaining = document.getElementById(deviceId + "-remainingDeliveries");
  if (remaining) remaining.innerHTML = remainingDeliveries;
}

async function updateDeliveryEta(deviceId, stepsLeft, simulationInterval) {
  var etaText = "";
  var etaInMs = stepsLeft * simulationInterval;

  if (etaInMs < 1000) {
    etaText = "Your driver has arrived";
  }

  var etaInMins = Math.floor(etaInMs / (60 * 1000));
  var etaInSecs =
    etaInMs >= 60000
      ? Math.floor((etaInMs % (etaInMins * 60 * 1000)) / 1000)
      : Math.floor(etaInMs / 1000);
  etaText = etaInMins + "m " + etaInSecs + "s";

  var eta = document.getElementById(deviceId + "-eta");
  if (eta) eta.innerHTML = etaText;
}

function addRegisteredDevice(deviceId) {
  var ul = document.getElementById("registeredVehiclesList");
  var li = document.createElement("li");
  li.setAttribute("class", "list-group-item small cursor-hand");
  li.setAttribute("id", deviceId);
  li.innerHTML = registeredDeviceRow(deviceId, li);
  ul.appendChild(li);
}

function removeRegisteredDevice(deviceId) {
  var ul = document.getElementById("registeredVehiclesList");
  var li = document.getElementById(deviceId);
  ul.removeChild(li);
}

function registeredDeviceRow(deviceId) {
  var row = "";
  if (deviceId != null) {
    row = `\
    <div class='vehicleSensor-heading'>\
      <div class='heading-5'>${iotDevices[deviceId].name}</div>\
      <div class='vehicleSensor-options'>
        <div class='vehicleSensor-option' onclick='editDevice(${deviceId})'><H5><i class='fa-regular fa-pen-to-square'></i></H5></div>
      </div>
    </div>\
      <div class='text-body-3'><span class='heading-6'>Next Delivery:</span> <span id='${deviceId}-nextDelivery'></span></div>\
      <div class='text-body-3'><span class='heading-6'>ETA to next Delivery:</span> <span id='${deviceId}-eta'></span></div>\
      <div class='text-body-3'><span class='heading-6'>Remaining Deliveries:</span> <span id='${deviceId}-remainingDeliveries'></span></div>\
      <div class='cargoSensor-heading'>\
        <div class='heading-4'>${iotDevices[deviceId].sensors[0].sensor_name}</div>\
        <div id='${deviceId}-presence' class='presence-dot-online vehicleSensor-option'></div>\
      </div>
      <div class='text-body-3'><span class='heading-6'>Type:</span> ${iotDevices[deviceId].sensors[0].sensor_type}</div>\
      <div class='text-body-3'><span class='heading-6'>Reading:</span> <span id='${deviceId}-sensorValue'>${iotDevices[deviceId].sensors[0].sensor_value}</span> ${iotDevices[deviceId].sensors[0].sensor_units}</div>\
      <div class='heading-4'>Driver's Phone</div>\
      <div class='text-body-3'>Location: [<span id='${deviceId}-lat'></span>, <span id='${deviceId}-lng'></span>]</div>`;
  }

  return row;
}

function registeredDeviceRow_click(e) {
  var targetElement = e.target.closest("[id]");
  if (
    targetElement !== null &&
    targetElement.id !== null &&
    iotDevices[targetElement.id]
  ) {
    focusOnMarker(targetElement.id);
  }
}

function formatDate(dateString) {
  let formattedDate = new Date(dateString);
  const options = {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  };

  return formattedDate.toLocaleDateString("en-US", options);
}

var ul = document.getElementById("registeredVehiclesList");
ul.addEventListener("click", registeredDeviceRow_click);
