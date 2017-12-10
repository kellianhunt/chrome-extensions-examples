/**
 * Copyright (c) 2011 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

var iconFlashTimer = null;
var ringing_alarms = {};
var listen_for_pin = false;
var pin_timer = "alexa_pin_listener";
var pinCodes = [];
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var analyser = audioCtx.createAnalyser();
var instantVolume;
var isTalkingToAlexa = false;

// grab saved pins
chrome.storage.sync.get(['pin_codes'], function(result) {
  if(result.pin_codes !== undefined && result.pin_codes !== null) {
    pinCodes = result.pin_codes;
  }
});

// Override from common.js
window.stopFlashingIcon = function() {
  /**
   * Stop the clock extension icon flashing
   */
  window.clearTimeout(iconFlashTimer);
  chrome.browserAction.setIcon({'path': 'clock-19.png'});
};

// Override from common.js
window.flashIcon = function() {
  /**
   * Make the clock extension icon flash when an alarm is going off
   */
  var flashes = 10;
  function flash() {
    if (flashes == 0) {
      stopFlashingIcon();
      return;
    }

    if (flashes % 2 == 0) {
      chrome.browserAction.setIcon({'path': 'clock-highlighted-19.png'});
    } else {
      chrome.browserAction.setIcon({'path': 'clock-19.png'});
    }
    flashes--;
    iconFlashTimer = window.setTimeout(flash, 500);
  }
  flash();
};

function addMessageListeners() {
  /**
   * Receive messages from popup.js or other scripts to create or delete alarms.
   */
  chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        // Delete an alarm
        if (request.msg === "delete_alarm") {
          // Extract the alarm_id and clear it from the Chrome Alarms API
          var alarm_id = request.alarm_id;
          chrome.alarms.clear(alarm_id, function(wasCleared) {
            console.log("Was alarm " + alarm_id + " deleted? " + wasCleared);
          });
        }

        // Create or change an alarm
        if (request.msg === "activate_alarm") {
          // Extract requested alarm info
          var alarm_id = request.alarm_id;
          var alarm_time = request.alarm_time;
          var hour_minute = alarm_time.split(":");
          var hours = parseInt(hour_minute[0]);
          var mins = parseInt(hour_minute[1]);
          var alarm_date = timeToEpoch(hours, mins); // Get a date object for the alarm

          chrome.alarms.create(
              alarm_id, // Alarm name
              { when: alarm_date.getTime() } // Alarm parameters
          );   //, periodInMinutes: 1});
          console.log("Alarm " + alarm_id + " has been activated for " + alarm_date.toLocaleString());
        }

        // List active alarms
        chrome.alarms.getAll(function(alarms) {
          console.log("Current active alarms:");
          alarms.map(function(alarm) {
            var alarm_date = new Date(alarm.scheduledTime);
            console.log("  " + alarm.name + " @ " + alarm_date.toLocaleString());
          });
        });
      }
  );

  // Add a listener for activated alarms; when it's time for an alarm
  // to go off, the onAlarm callback will be activated and we can set off
  // the ringer.
  chrome.alarms.onAlarm.addListener(function(alarm) {
    console.log("Got an alarm!", alarm);
    if (alarm.name.startsWith("alarm")) {
      var date = new Date(alarm.scheduledTime);
      ringing_alarms[alarm] = true; // add the alarm to a list of ringing alarms
      ringAlarm(date.getHours(), date.getMinutes()); // activate the ringer
    } else if (alarm.name === pin_timer) {
      listen_for_pin = false;
    }
  });
};

function timeToEpoch(hour, minute) {
  /**
   * Create a date object for the time an alarm should ring.
   * @type {Date} A Date object for the time/date of an alarm
   */
  var date = new Date();

  // This time has passed today; add a day to date to ring alarm tomorrow
  if ((date.getHours() > hour) ||
      (date.getHours() == hour && date.getMinutes() > minute)) {
    date.setDate(date.getDate() + 1)
  }

  date.setMinutes(minute);
  date.setHours(hour);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
};

var stopAlarm = function() {
  /**
   * When the extension hears the voice command "OFF", stop all ringing alarms.
   */
  console.log("received OFF command");

  // Remove all ringing alarms from alarm API so they don't repeat after the
  // specified period
  for (const alarm_id in ringing_alarms) {
    chrome.alarms.clear(alarm_id, function(wasCleared) {
      console.log("Stopped and cleared " + alarm_id + " == " + wasCleared);
    });
  }
  ringing_alarms = {}; // reset the ringing_alarms object
  stopAll();           // stop all sounds
};

var listenForPin = function() {
  var now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  listen_for_pin = true;

  chrome.alarms.create(
      pin_timer, // Alarm name
      { when: now.getTime() } // Alarm parameters
  );   //, periodInMinutes: 1});
};

function recordPin(str) {
  /**
   * Add a pin code to the possible pin code list
   */
  pinCodes.push(str);

  chrome.storage.sync.set({
    'pin_codes': pinCodes,
  }, function() {
    console.log('Updated pin codes: ' + pinCodes);
  });
};

function isRecordedPin(str) {
  /**
   * Check if str is a pin code already heard and recorded
   */
  return pinCodes.indexOf(str) > -1;
};

function isNumeric(words) {
  /**
   * Check if the string is a plain, 4-digit number
   */
  for (var i = 0; i < words.length; i++) {
    if (!/\d/.test(words[i])) {
      return false;
    }
  }
  return true;
};

function digitToNumeric(str) {
  switch(str) {
    case "zero": return "0";
    case "one": return "1";
    case "two": return "2";
    case "three": return "3";
    case "four": return "4";
    case "five": return "5";
    case "six": return "6";
    case "seven": return "7";
    case "eight": return "8";
    case "nine": return "9";
    default: return str;
  }
}

function splitIntoWords(str) {
  return str.split(/(\s+)/)
}

function pingAlexa(){
	isTalkingToAlexa = true;
	console.log("starting to ping Alexa...");
	isTalkingToAlexa = false;
}

var analyzeWords = function(words) {
  /**
   * Detect if the words said are either the "STOP" command or a pin code
   */
  console.log("analyzing words");
  // defer to offcommand function for the alarm clock if "STOP" was spoken
  var str = words;
  if (str === "stop" || str === "off"){
    stopAlarm();
  }

  if (listen_for_pin) {
    // delete whitespace, periods, and dashes
    str = str.replace(/\s|\.|\-|^\s+|\s+$/g,' ');
    // delete trailing and leading whitespaces
    str = str.replace(/^\s+|\s+$/g, "");

    // replace word-digits to number-digits - e.g. "four" == "4"
    var words = splitIntoWords(str);
    var newStr = "";
    for (var i = 0, len = words.length; i < len; i++) {
      newStr += digitToNumeric(words[i]);
    }
    // avoid changing code below
    str = newStr;
    console.log(str);

    // change "to" to 2 - e.g. "to 562"
    str = str.replace(/to/g,'2');
    // change "for" to 4 - e.g. "for 562"
    str = str.replace(/for/g,'4');

    // log the possible pin code if the phrase was 4 characters long and a plain number
    var numbers = splitIntoWords(str).filter(function(w){ return w !== ' '});
    var pinLength = numbers.length;
    console.log(numbers);
    if (pinLength === 4 && isNumeric(numbers)) {
      // check if the pin code has already been seen
      if (!isRecordedPin(str)) {
        recordPin(str);
        console.log("found pin: " + str);
      } else {
        console.log("pin " + str + " already found.")
      }
    }
  }
};

function NoiseLevel(context) {
  // Adapted from https://github.com/webrtc/samples
  this.context = context;
  this.instantVolume = 0.0;
  this.script = context.createScriptProcessor(2048, 1, 1);
  var that = this;
  this.script.onaudioprocess = function(event) {
    var input = event.inputBuffer.getChannelData(0);
    var i;
    var sum = 0.0;
    for (i = 0; i < input.length; ++i) {
      sum += input[i] * input[i];
    }
    that.instantVolume = Math.sqrt(sum / input.length);
  };
}

NoiseLevel.prototype.connectToSource = function(stream, callback) {
  try {
    this.mic = this.context.createMediaStreamSource(stream);
    this.mic.connect(this.script);
    this.script.connect(this.context.destination);
    if (typeof callback !== 'undefined') {
      callback(null);
    }
  } catch (e) {
    console.error(e);
    if (typeof callback !== 'undefined') {
      callback(e);
    }
  }
};

function listenForNoiseLevel(stream) {
  /**
   * Test the noise level of the room. If the room has been quiet for 1 full minute, 
   * try to talk to Alexa.
   */
  var noiseLevel = new NoiseLevel(window.audioContext);
  var silentTime = 0;
  noiseLevel.connectToSource(stream, function(e) {
    if (e) {
      alert(e);
      return;
    }
    setInterval(function() {
      instantVolume = noiseLevel.instantVolume.toFixed(3) * 1000;
	  //console.log(instantVolume);
	  instantVolume === 0 ? silentTime++ : silentTime = 0;
	  // if the room has been silent for 1 minute and we are not already talking to Alexa, ping her
	  if (silentTime === 300 && !isTalkingToAlexa) {
        silentTime = 0;
        pingAlexa(); 
	  };
    }, 200);
  });
}

function handleError(error) {
  console.log('navigator.getUserMedia error: ', error);
}

function enableNoiseLevelRecognition() {
  try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    window.audioContext = new AudioContext();
  } catch (e) {
    alert('Web Audio API not supported.');
  }

  navigator.mediaDevices.getUserMedia({audio: true, video: false}).
    then(listenForNoiseLevel).catch(handleError);
}

function openWelcomePage() {
  /**
   * Redirect to the welcome.html page once when the extension is installed.
   * This page will give the alarm access to the user's microphone.
   */
  chrome.runtime.onInstalled.addListener(function(details) {
    // If the extension was already installed, do nothing and return.
    if (details.reason.search(/install/g) === -1) {
      return;
    }

    // If this is the first time a user has enabled the extension,
    // open a new tab for the welcome page to request microphone permission.
    chrome.tabs.create({
      url: chrome.extension.getURL("welcome.html"),
      active: true
    });
  });
};

function enableVoiceRecognition() {
  /**
   * Enable a voice recognition module to respond to vocal commands.
   */
  // If the browser supports annyang, enable it
  if (annyang) {
    // Create a commands object with string commands and callback functions
    var commands = {
      'off': stopAlarm,
      'stop': stopAlarm,
      'tell me your voice code': listenForPin,
      '*words': analyzeWords
    }

    // enter debug mode -- TODO find a way to disable this if not in developer mode
    annyang.debug();
    // Add our commands to annyang
    annyang.addCommands(commands);

    // Start listening. You can call this here, or attach this call to an event, button, etc.
    annyang.start();
    console.log("annyang voice recognition initialized");
  }
}

function initBackground() {
  /**
   * Initialize the background script. This script will be re-run each time an extension
   * is reloaded.
   */
  openWelcomePage();
  enableVoiceRecognition();
  addMessageListeners();
  enableNoiseLevelRecognition();
}

initBackground();
