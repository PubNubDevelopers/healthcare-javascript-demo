/**
 * Functions to handle the 'Edit Device' modal.
 */

function editDevice(target) {
  var deviceId = target;
  if (deviceId instanceof HTMLLIElement) deviceId = target.id;
  if (deviceId != null) {
    var editModal = new bootstrap.Modal(
      document.getElementById("editModal"),
      {}
    );
    document.getElementById("editModalTitle").innerHTML =
      "Vehicle: " + iotDevices[deviceId].name;
    var old_rereoute_button = document.getElementById("editModalReroute");
    var new_reroute_button = old_rereoute_button.cloneNode(true);
    old_rereoute_button.parentNode.replaceChild(
      new_reroute_button,
      old_rereoute_button
    );
    document
      .getElementById("editModalReroute")
      .addEventListener("click", function () {
        reroute(deviceId);
      });

    deviceId, (document.getElementById("editModalPushMessage").value = "");
    var old_send_push_button = document.getElementById(
      "editModalPushMessageBtn"
    );
    var new_send_push_button = old_send_push_button.cloneNode(true);
    old_send_push_button.parentNode.replaceChild(
      new_send_push_button,
      old_send_push_button
    );
    document
      .getElementById("editModalPushMessageBtn")
      .addEventListener("click", function () {
        pushMessage(
          deviceId,
          document.getElementById("editModalPushMessage").value
        );
      });

    editModal.show();
  }
}

function UpdateEditModalIntervalRangeLabel() {
  document.getElementById("editModalIntervalRangeLabel").innerHTML =
    "Sensor Reporting Interval: " +
    document.getElementById("editModalIntervalRange").value / 1000 +
    "s";
}

async function pushMessage(deviceId, messageText) {
  //  You can send Push Messages (FCM on Android, APNS on Apple) from PubNub, this can greatly simplify your
  //  application logic, allowing you to seamlessly integrate with mobile push technologies without worrying
  //  about application-specific code by sending a specific payload in your PubNub message.  This demo simulates
  //  Push to show what it might look like in production, but you can see a real Push Message being
  //  sent / received over PubNub from our Push demo: https://www.pubnub.com/demos/push/.
  if (messageText !== "") {
    await pubnub.publish({
      channel: iotDevices[deviceId].channelName,
      message: {
        action: "pushMessage",
        text: messageText,
      },
    });

    $("#editModal").modal("hide");
  } else {
    //  message text is empty
    document.getElementById("editModalPushMessage").focus();
  }
}

//  Handler for the request to reroute the vehicle.  
//  Generates a new route (in reality, just a single leg), and sends a message to the web worker over PubNub with the new route
async function reroute(deviceId) {
  //  Create a new route from the driver's current location
  var legs = [];
  var lastLocation = {"lat":iotDevices[deviceId].lat,"lng":iotDevices[deviceId].long};
  for (var i = 0; i < 1; i++) { //  Deliberately choosing to only send one leg here for simplicity
    var currentLeg = await generateLeg(lastLocation);
    if (currentLeg.length > 0) {
      legs.push(...currentLeg);
      lastLocation = currentLeg[currentLeg.length - 1];
    }
  }
  //  New route is now within legs
  if (legs.length > 0) {
      await pubnub.publish({
      channel: iotDevices[deviceId].channelName,
      message: {
        action: "reroute",
        route: legs
      }
    })

    $("#editModal").modal("hide");
  } else {
    //  For example, if the user is on some remote island, this is a failsafe
    console.log(
      "Error: Could not find sensible route"
    );
  }
}

//  Not strictly part of the edit modal but fits here
//  Although we don't allow the deletion of vehicles from the UI, like the IoT demo did, this logic
//  is still used after a vehicle completes its route.
async function deleteDevice(target) {
  var deviceId = target;
  if (deviceId instanceof HTMLLIElement) deviceId = target.id;
  if (deviceId != null) {
    await pubnub.publish({
      channel: iotDevices[deviceId].channelName,
      message: {
        action: "stop",
      },
    });

    if (iotDevices[deviceId].worker != null)
      iotDevices[deviceId].worker.terminate(); //  Should really wait until we get the status message to say the client is disconnected but this is only for the simulator.
    removeRegisteredDevice(deviceId);
    activeVehicles--;
    if (activeVehicles < MAX_ACTIVE_VEHICLES) {
      setTimeout(
        "document.getElementById('btnDispatchVehicle').disabled = false;",
        500
      );
    }
  }
}
