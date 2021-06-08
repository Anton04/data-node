
// changed 2021-05-20

class Broker extends Paho.MQTT.Client {
  constructor(origin="ws://op-en.se:9001",clientId = getUUID()) {



    var url = MyURL(origin);


    var port = url.port

    //console.log("Proto:  " + url.protocol);
    //console.log("Port: " + port + "<");

    if (port == "") {
      if (url.protocol=="wss:") {
         port = 443
       }
      else {
         port = 80
      }
    }


    //console.log("Port: " + port + "<");

    super(url.hostname, Number(port), clientId);
    this.subscribers = {};
    this.origin = origin;
    var self = this;



    // set callback handlers
    this.onConnectionLost = function (responseObject) {
      if (responseObject.errorCode !== 0) {

        console.log("Connection lost: "+responseObject.errorMessage);

        this.connect({onSuccess:function () {
          self.onConnectHandler();
        }, useSSL:url.protocol=="wss:",reconnect :true});




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
    }, useSSL:url.protocol=="wss:"});

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
    console.log("Connected to: " + this.origin);
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
        console.log("New topic: " + url.topic);
        this.subscribers[url.topic]=[{"target":target,"subproperty":url.subproperty}];
    }
    else {
        console.log("Existing topic");
        this.subscribers[url.topic].push({"target":target,"subproperty":url.subproperty});
    }

    if (this.isConnected()){
      this.subscribe(url.pathname.substring(1))
    }



  }

  unsubscribe2(topic,target) {
    if (!(topic in this.subscribers))
    {
        return;
    }

    var url = this.parseTopic(topic);

    for (var i = this.subscribers[url.topic].length - 1; i >= 0; i--) {

      if (this.subscribers[url.topic][i].target == target) {
          this.subscribers[url.topic].splice(i, 1);
          break;
      }

    }

    if (this.subscribers[url.topic].length == 0)
    {
      this.unsubscribe(url.pathname.substring(1))
      delete this.subscribers[url.topic]
    }




  }

  publish2(topic,payload,retain=false){
    var url = this.parseTopic(topic);
    //this.publish(url.topic,payload,1,retain)

    console.log("Publishing to: " + url.pathname.substring(1));

    var message = new Paho.MQTT.Message(payload);
    message.destinationName = url.pathname.substring(1);
    message.retained = retain;
    //message.disconnectedPublishing = true;
    this.send(message);
  }




  parseTopic(topic) {

    var mqtt = false;

    var url = MyURL(topic);


    var path = url.pathname.split("[");
    url.pathname = path[0];
    if (path.length < 2){
      url.subproperty = "";
    }
    else {
      url.subproperty = path[1].split("]")[0];
    }

    if (mqtt){
      url.topic = url.origin.replace("wss://","mqtt://") + url.pathname;
    }
    else {
      url.topic = url.origin + url.pathname;
    }

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

    subscribe(topic,target=LogMessage) {


      var url = MyURL(topic);
      //console.log("url");
      //console.log(topic);
      //console.log(url);




      if (!(url.origin in this.brokers))
      {
          console.log("New Origin: " + url.origin);
          var broker = new Broker(url.origin);
          this.brokers[url.origin] = broker;
      }
      else {
        broker = this.brokers[url.origin];
      }

      broker.subscribe2(topic,target);
      return broker;
    }

    unsubscribe(topic,target) {
      var url = MyURL(topic);
      console.log("Unsubscribing " + topic);

      if (!(url.origin in this.brokers))
      {
          return null;
      }
      else {
        var broker = this.brokers[url.origin];
      }

      broker.unsubscribe2(topic,target);
      return broker;
    }

    publish(topic,payload,retain=false)
    {
      var url = MyURL(topic);
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

      broker.publish2(topic,payload,retain);
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


function MyURL(url){

  if (url.search("mqtt://") == 0) {
      //mqtt = true;
      url_obj = copy(new URL(url.replace("mqtt://","wss://")));
      //console.log(url);

      url_obj.origin = url_obj.origin.replace("wss://","mqtt://");
      //console.log("origin " + url_obj.origin);


  }
  else
    url_obj = copy(new URL(url));

  return url_obj;
}

function copy(obj){

  var copy = {}

  for (var key in obj) {
    copy[key] = obj[key];
  }

  return copy;
}

function LogMessage(message) {
  console.log("Topic: " + message.topic + " Payload:" + message.payload);
}


window.top.datahub = new DataHub();
