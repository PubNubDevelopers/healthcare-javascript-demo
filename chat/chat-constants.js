/**
 * This file contains various constants associated with the chat portion of the demo.
 * Private Groups are hardcoded in the client, which is clearly not
 * good practice in a production app where they would be stored on the server.
 * For more notes about transitioning between this demo and a production app, see chat.js.
 * Public groups are stored in Channel App Context
 */
var predefined_groups = {
  private_groups: [
    //  Private groups are named 'Private.<name>' in this demo.  PubNub does not impose restrictions on names (beyond length & allowed characters) but
    //  it is a good idea to choose a sensible naming convention.
    //  To keep channels specific to an individual user, this demo will include the user's ID as part of the channel name, for example
    //  'Private.a54as68df1as-iot'.  Since the groups are hardcoded, the channel name will replace any instance of 'uuid' with the user's actual ID
    {
      channel: 'Private.uuid-iot',
      name: 'Medical Devices',
      profileIcon: 'group-medicaldevices.png',
      description:
        'Used by the IoT demo.  Notifications from your smart home, only shared with members of your household',
      info: "From the <a href='../iot/iot.html'>Devices</a> demo"
    },
    {
      channel: 'Private.chatgpt.yourdoctoruuid',
      name: 'Your Doctor',
      profileIcon: 'doctor-3.png',
      description:
        'A virtual consultation with your doctor.  Please wait until your doctor becomes available',
      info: "Virtual consultation"
    },
    {
      channel: 'Private.chatgpt.uuid',
      name: 'AI Doctor',
      profileIcon: 'group-chatbot2.png',
      description:
        'Interact with an AI Doctor (Chatbot) powered by OpenAI.  To build your own chatbot based on OpenAI with PubNub see our <a href=\'https://www.pubnub.com/blog/building-a-chatbot-with-openai-gpt3-and-pubnub/\'>blog</a>',
      info: "Powered by OpenAI"
    }
  ]
}

//  Public groups are held in app context and will be cached
var cached_groups = {
  public_groups: []
}
