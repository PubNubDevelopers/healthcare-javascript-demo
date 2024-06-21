/**
 * Logic related to creating predefined and user-specified simulators.
 */

async function initializeSimulators () {
  var id = 'sim_1';
  await createSimulator({
    id: id,
    name: 'Blood Pressure',
    type: SensorType.BloodPressure,
    alarmSettings: {
      minValue: 90,
      maxValue: 120,
      lowerBound: 80,
      upperBound: 130
    },
    setValue: 50
  }).then(webWorker => {
    iotDevices[id].worker = webWorker
  });
  iotDevices[id].worker.postMessage({ action: 'start' });

  var id = 'sim_2';
  await createSimulator({
    id: id,
    name: 'Glucose Level',
    type: SensorType.GlucoseLevel,
    alarmSettings: {
      minValue: 70,
      maxValue: 100,
      lowerBound: 60,
      upperBound: 130
    },
    setValue: -18
  }).then(webWorker => {
    iotDevices[id].worker = webWorker
  });
  iotDevices[id].worker.postMessage({ action: 'start' });

  var id = 'sim_3';
  await createSimulator({
    id: id,
    name: 'Body Temperature',
    type: SensorType.BodyTemperature,
    alarmSettings: {
      minValue: 94,
      maxValue: 102,
      lowerBound: 90,
      upperBound: 110,
    },
    setValue: 22
  }).then(webWorker => {
    iotDevices[id].worker = webWorker
  });
  iotDevices[id].worker.postMessage({ action: 'start' });

  var id = 'sim_4';
  await createSimulator({
    id: id,
    name: 'Insulin Level',
    type: SensorType.InsulinLevel,
    alarmSettings: {
      minValue: 2,
      maxValue: 15,
      lowerBound: 0,
      upperBound: 35
    },
    setValue: 20
  }).then(webWorker => {
    iotDevices[id].worker = webWorker
  });
  iotDevices[id].worker.postMessage({ action: 'start' });

  var id = 'sim_6';
  await createSimulator({
    id: id,
    name: 'Sleep Monitor',
    type: SensorType.SleepMonitor,
    setValue: 10
  }).then(webWorker => {
    iotDevices[id].worker = webWorker
  });
  iotDevices[id].worker.postMessage({ action: 'start' });

  var id = 'sim_7';
  await createSimulator({
    id: id,
    name: 'Ward Door Alarm',
    type: SensorType.DoorAlarm,
    setValue: 10
  }).then(webWorker => {
    iotDevices[id].worker = webWorker
  });
  iotDevices[id].worker.postMessage({ action: 'start' });
}

async function createSimulator (args) {
  return new Promise((resolve, reject) => {
    var simulatorTask = new Worker(URL.createObjectURL(new Blob(["("+worker_node.toString()+")()"], {type: 'text/javascript'})));;

    simulatorTask.onmessage = async function (event) {
      if (event.data.command === 'provisionDevice') {
        //  A NOTE ON PROVISIONING:
        //  Whilst it may seem silly to assign the simulator an ID and then ask the simulator for the ID it was assigned, the intention is to show that these two pieces of information would usually come from a provisioning server, in production.
        var channelName = event.data.values.channelName;
        var deviceId = event.data.values.deviceId;
        var deviceName = event.data.values.deviceName;
        var alarmSettings = event.data.values.hasOwnProperty("alarmSettings") ? event.data.values.alarmSettings : null;
        var setValue = event.data.values.hasOwnProperty("setValue") ? event.data.values.setValue : null;
        var type = event.data.values.type;
        var url = getFilePath(type);
        if (!iotDevices[deviceId]) {
          iotDevices[deviceId] = {
            online: 'yes',
            selected: false,
            name: deviceName,
            channelName: channelName,
            alarmSettings: alarmSettings,
            setValue: setValue,
            worker: simulatorTask,
            url: url
          }
          // Add Device to HTML
          addRegisteredDevice(deviceId, iotDevices[deviceId].alarmSettings ? ++tempDeviceCounter : ++alarmDeviceCounter)
        }
        simulatorTask.postMessage({
          action: 'finalizeProvisioning',
          params: { sub: subscribe_key, pub: publish_key, url: url}
        })
      }
      else if (event.data.command === 'provisionComplete') {
        var deviceId = event.data.values.deviceId
        resolve(simulatorTask)
      }
    }
    simulatorTask.postMessage({
      action: 'init',
      params: {
        UUID: pubnub.getUUID(),
        id: args.id,
        name: args.name,
        type: args.type,
        alarmSettings: args.alarmSettings,
        setValue: args.setValue
      }
    })
  });
}

function getFilePath(type){
  return '../img/icons/icon-healthchat.png';
}