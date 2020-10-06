

class Broker extends Paho.MQTT.Client {
  constructor(origin="ws://op-en.se:9001",clientId = getUUID()) {

    var url = new URL(origin);
    super(url.hostname, Number(url.port), clientId);
    this.subscribers = {};
    this.origin = origin;
    var self = this;

    // set callback handlers
    function onConnectionLost(responseObject) {
      if (responseObject.errorCode !== 0) {

        console.log("onConnectionLostMethod:"+responseObject.errorMessage);
      }
    }
    //this.onConnectionLost = onConnectionLost;

    // called when a message arrives

    this.onMessageArrived = function (message) {
      self.onMessageHandler(message);
    };

    //.setWill("pahodemo/clienterrors", "crashed".getBytes(),2,true);

    this.connect({onSuccess:function () {
      self.onConnectHandler();
    }});

    // connect the client
    //self.connect({onSuccess:onConnect});

  }

  onMessageHandler(message) {

    var full_topic = this.origin + "/" + message.destinationName;
    //console.log(full_topic);

    //console.log("onMessageArrivedMethod:"+message.payloadString);
    message.topic = full_topic;
    message.payload = message.payloadString;
    message.raw = message.payloadBytes;

    window.message = message;

    var targets = this.subscribers[full_topic];

    var arrayLength = targets.length;
    for (var i = 0; i < arrayLength; i++) {
      var target = targets[i];

      if (target.subproperty == "")
      {
        message.value = message.payloadString;
      }
      else {
        message.value = JSON.parse(message.payloadString)[target.subproperty]
      }



      try {
        target.target(message);
      } catch (error) {
        console.error(error);
      }

    }

  }

  onConnectHandler() {
    // Once a connection has been made, make a subscription and send a message.
    console.log("onConnect method");
    //console.log("test/clients/" + this.clientId + "/connected");
    //this.subscribe("test/signalA");

    for (var key in this.subscribers) {
      var topic = key;
      topic = topic.replace(this.origin + "/","" );
      console.log("Subscribing to: " + topic);
      this.subscribe(topic);

    console.log("Sending connection message at: test/clients/" + this.clientId + "/status");
    var time = (new Date()).getTime()/1000.0;
    var text = JSON.stringify({"time":time,"connected":true});
    var message = new Paho.MQTT.Message(text);
    message.destinationName = "test/clients/" + this.clientId + "/status";
    this.send(message);

    }
  }

  subscribe2(topic,target) {
    var url = this.parseTopic(topic);
    //console.log(url);
    if (!(topic in this.subscribers))
    {
        console.log("New topic");
        console.log(url.topic);
        this.subscribers[url.topic]=[{"target":target,"subproperty":url.subproperty}];
    }
    else {
        console.log("Existing topic");
        this.subscribers[url.topic].append({"target":target,"subproperty":url.subproperty});
    }

    if (this.isConnected()){
      this.subscribe(url.pathname.substring(1))
    }



  }



  parseTopic(topic) {
    var url = new URL(topic);
    var path = url.pathname.split(".");
    url.pathname = path[0];
    if (path.length < 2){
      url.subproperty = "";
    }
    else {
      url.subproperty = path[1];
    }

    url.topic = url.origin + url.pathname;

    return url;

  }

  test()
  {
    var message = new Paho.MQTT.Message("Hello");
    message.destinationName = "test/clients/" + this.clientId + "/connected";
    this.send(message);
  }

}

//***************
//
//***************
class DataHub {

    constructor() {
        this.brokers = {};
    }

    subscribe(topic,target) {
      var url = new URL(topic);
      //console.log(url);

      if (!(url.origin in this.brokers))
      {
          console.log("New Origin");
          var broker = new Broker(url.origin);
          this.brokers[url.origin] = broker;
      }
      else {
        broker = this.brokers[url.origin];
      }

      broker.subscribe2(topic,target);
      return broker;
    }

    GetFirst(){
      return datahub.brokers[Object.keys(datahub.brokers)[0]];
    }


}

//export { DataHub };




function uuidv4() {

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getUUID(){
  UUID = getCookie("UUID") || uuidv4();
  setCookie("UUID",UUID,9999);

  return UUID;
}

function getCookie(name) {
    // Split cookie string and get all individual name=value pairs in an array
    var cookieArr = document.cookie.split(";");

    // Loop through the array elements
    for(var i = 0; i < cookieArr.length; i++) {
        var cookiePair = cookieArr[i].split("=");

        /* Removing whitespace at the beginning of the cookie name
        and compare it with the given string */
        if(name == cookiePair[0].trim()) {
            // Decode the cookie value and return
            return decodeURIComponent(cookiePair[1]);
        }
    }

    // Return null if not found
    return null;
}

function setCookie(name, value, daysToLive) {
    // Encode value in order to escape semicolons, commas, and whitespace
    var cookie = name + "=" + encodeURIComponent(value);

    if(typeof daysToLive === "number") {
        /* Sets the max-age attribute so that the cookie expires
        after the specified number of days */
        cookie += "; max-age=" + (daysToLive*24*60*60);

        document.cookie = cookie;
    }
}

window.top.datahub = new DataHub();
