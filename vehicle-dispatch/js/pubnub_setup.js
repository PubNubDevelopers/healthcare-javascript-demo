/**
 * Configure the PubNub object.
 * Please specify your publish and subscribe keys here.
 * See Readme for details of the required key configuration
 */

//  See Keys.js for the PubNub Publish and Subscribe keys

async function createPubNubObject(presetUUID) {
  var UUID = presetUUID; // Allows you to force a uuid
  let savedUUID = null;
  if (!UUID) {
    try {
      savedUUID = sessionStorage.getItem("uuid");
    } catch (err) {
      console.log("Session storage is unavailable");
    } //  Session storage not available
    if (!savedUUID) {
      UUID = makeid(20); // Make new UUID
    } else {
      UUID = savedUUID;
    }
  }
  try {
    sessionStorage.setItem("uuid", UUID);
  } catch (err) {} //  Session storage is not availalbe

  var pubnub = new PubNub({
    publishKey: publish_key,
    subscribeKey: subscribe_key,
    uuid: UUID,
  });
  //  This sample uses Access Manager to protect the Pub/Sub keys
  //  IN PRODUCTION: Replace with your own logic to request an Access Manager token
  var accessManagerToken = await requestAccessManagerToken(UUID);
  if (accessManagerToken == null) {
    console.log("Error retrieving access manager token");
  } else {
    pubnub.setToken(accessManagerToken);
    //  The server that provides the token for this app is configured to grant a time to live (TTL)
    //  of 360 minutes (i.e. 6 hours).  IN PRODUCTION, for security reasons, you should set a value
    //  between 10 and 60 minutes and refresh the token before it expires.
    //  For simplicity, this app does not refresh the token
  }
  pubnub.setFilterExpression("uuid != '" + pubnub.getUUID() + "'");
  return pubnub;
}

function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function testPubNubKeys() {
  if (publish_key === "" || subscribe_key === "") return false;
  else return true;
}

//  IN PRODUCTION: Replace with your own logic to request an Access Manager token
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
    console.log("failed to create token " + e);
    return null;
  }
}
