const HOST_URL = "https://pubnub-healthcare.netlify.app/"

/////////////////////////
//  Default Channels

var default_channels = {
  public_channels: [
    {
      channel: 'Public.healthcare',
      name: 'Healthcare Chat',
      profileIcon: 'doctor-1.png',
      description: 'Build HIPAA-compliant telemedicine apps with PubNub as well as GDPR and SOC2 compliant apps',
      info: "HIPAA & GDPR compliant"
    }
  ]
}

/////////////////////////
//  Emoji logic

function messageInputEmoji () {
  if (document.getElementById('emojiPicker').style.visibility == 'visible')
    document.getElementById('emojiPicker').style.visibility = 'hidden'
  else document.getElementById('emojiPicker').style.visibility = 'visible'
}

function selectEmoji (data) {
  var messageInput = document.getElementById('input-message')
  messageInput.value += data.native
}

function hideEmojiWindow () {
  document.getElementById('emojiPicker').style.visibility = 'hidden'
}

////////////////////////
//  Utilities

async function imageExists (url) {
  return new Promise(function (resolve, success) {
    var img = new Image()
    img.src = url
    img.onerror = () => {
      resolve(false)
    }
    img.onload = () => {
      resolve(img.height != 0)
    }
  })
}

async function testForLoggedInUser () {
  //  Do we have an existing login?
  var savedUUID = null
  try {
    savedUUID = sessionStorage.getItem('userId')
  } catch (err) {
    console.log('Session storage is unavailable')
    alert('This demo requires session storage')
  }
  //  If there is a previous login, check it is still valid
  if (savedUUID != null) {
    try {
      pubnub = await createPubNubObject()
      const userInfo = await pubnub.objects.getUUIDMetadata(savedUUID)
      //  There is a valid user associated with this login
      return true
    } catch (ex) {
      //  There is no PubNub user data associated with the login.
      sessionStorage.clear()
      return false
    }
  } else {
    //  The user has not yet logged in
    return false
  }
  return true
}

var developerMessages = {}

function developerMessage (message) {
  return  //  Do not show developer messages in this build
  if (developerMessages[message] == null) {
    developerMessages[message] = true
    const style1 =
      'background-color: #0000AA; color: white; font-size: 1em; border:4px solid #0000AA'
    const style2 = ''
    console.info('%cPN Showcase:' + '%c ' + message, style1, style2)
  }
}

function toggleShowcase() {
  document.getElementById('bottomNav').classList.add

  if (document.getElementById('carousel').style.display == 'none') {
      //  Show carousel
      document.getElementById('bottomNav').classList.add('navbar-custom')
      document.getElementById('carousel').style.display = 'block'
      document.getElementById('nav-discover').classList.add('bottom-nav-selected')
  }
  else {
      //  Show carousel
      document.getElementById('bottomNav').classList.remove('navbar-custom')
      document.getElementById('carousel').style.display = 'none'
      document.getElementById('nav-discover').classList.remove('bottom-nav-selected')
  }
}

function appendSearchParams(targetUrl)
{
  if (window.location.href.indexOf('?') > -1)
    {
      window.location = (targetUrl + window.location.href.slice(window.location.href.indexOf('?')))
    }
  else
  {
    window.location = targetUrl
  }
}

function escapeHTML (unsafe_str) {
  return unsafe_str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/\'/g, '&#39;')
    .replace(/\//g, '&#x2F;')
}