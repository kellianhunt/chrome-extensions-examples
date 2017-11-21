/**
 * Copyright (c) 2011 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

var iconFlashTimer = null;
var ringingAlarms = {};

// Override from common.js
window.stopFlashingIcon = function() {
  window.clearTimeout(iconFlashTimer);
  chrome.browserAction.setIcon({'path': 'clock-19.png'});
};

// Override from common.js
window.flashIcon = function() {
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
  chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        if (request.msg === "delete_alarm") {
          var alarm_id = request.alarm_id;
          chrome.alarms.clear(alarm_id, function(wasCleared) {
            console.log("Alarm " + alarm_id + " was deleted = " + wasCleared);
          });
        }
        if (request.msg === "activate_alarm") {
          var alarm_id = request.alarm_id;
          var alarm_time = request.alarm_time;
          var hour_minute = alarm_time.split(":");
          var hours = parseInt(hour_minute[0]);
          var mins = parseInt(hour_minute[1]);
          var time_since_epoch = timeToEpoch(hours, mins);

          console.log("Alarm " + alarm_id + " has been activated for " + time_since_epoch.toLocaleString());
          chrome.alarms.create(alarm_id, {when: time_since_epoch.getTime()});   //, periodInMinutes: 1});
        }
      }
  );

  chrome.alarms.onAlarm.addListener(function( alarm ) {
    console.log("Got an alarm!", alarm);
    var date = new Date(alarm.scheduledTime);
    ringingAlarms[alarm] = true;
    ringAlarm(date.getHours(), date.getMinutes());
  });
}

function timeToEpoch(hour, minute) {
  var date = new Date();

  // add a day
  if ((date.getHours() > hour) ||
      (date.getHours() == hour && date.getMinutes() > minute)) {
    date.setDate(date.getDate() + 1)
  }

  date.setMinutes(minute);
  date.setHours(hour);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
}

function initBackground() {
  addMessageListeners();
}

chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason.search(/install/g) === -1) {
    return;
  }
  chrome.tabs.create({
    url: chrome.extension.getURL("welcome.html"),
    active: true
  });
});

var offCommand = function() {
  console.log("received OFF command");
  stopAll();
}


if (annyang) {
  // Let's define our first command. First the text we expect, and then the function it should call
  var commands = {
    'off': offCommand
  }

  annyang.debug();
  // Add our commands to annyang
  // annyang.addCommands(commands);
  annyang.addCommands(commands);

  // Start listening. You can call this here, or attach this call to an event, button, etc.
  annyang.start();
  console.log("annyang voice recognition initialized");
}


initBackground();
