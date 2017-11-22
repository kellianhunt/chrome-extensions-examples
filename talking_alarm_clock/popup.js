// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var blankClockImage;
var blankClockAnim1Image;
var blankClockAnim2Image;
var animationTimer;
var currentClockImage;
var port;
var alarmCount = 1;

function loadAllImages() {
  var img = new Image();
  img.onload = function() {
    blankClockImage = img;
    currentClockImage = blankClockImage;
    drawClock();
  };
  img.src = 'blank-clock-150.png';

  // These will finish loading before they're needed, no need
  // for an onload handler.
  blankClockAnim1Image = new Image();
  blankClockAnim1Image.src = 'blank-clock-ring1-150.png';
  blankClockAnim2Image = new Image();
  blankClockAnim2Image.src = 'blank-clock-ring2-150.png';
}

function drawClock(hh, mm, ss) {
  if (hh == undefined || mm == undefined) {
    var d = new Date();
    hh = d.getHours();
    mm = d.getMinutes();
    ss = d.getSeconds() + 0.001 * d.getMilliseconds();
  }

  if (!currentClockImage) {
    loadAllImages();
    return;
  }

  var ctx = $('clock').getContext('2d');
  ctx.drawImage(currentClockImage, 0, 0);

  // Move the hour by the fraction of the minute
  hh = (hh % 12) + (mm / 60);

  // Move the minute by the fraction of the second
  mm += (ss / 60);

  var hourAngle = Math.PI * hh / 6;
  var hourX = Math.sin(hourAngle);
  var hourY = -Math.cos(hourAngle);
  var minAngle = Math.PI * mm / 30;
  var minX = Math.sin(minAngle);
  var minY = -Math.cos(minAngle);
  var secAngle = Math.PI * ss / 30;
  var secX = Math.sin(secAngle);
  var secY = -Math.cos(secAngle);

  var cx = 75;
  var cy = 77;

  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - 4 * hourX, cy - 4 * hourY);
  ctx.lineTo(cx + 20 * hourX, cy + 20 * hourY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 8 * minX, cy - 8 * minY);
  ctx.lineTo(cx + 35 * minX, cy + 33 * minY);
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#696969';
  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  ctx.moveTo(cx - 4 * hourX, cy - 4 * hourY);
  ctx.lineTo(cx + 20 * hourX, cy + 20 * hourY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 8 * minX, cy - 8 * minY);
  ctx.lineTo(cx + 35 * minX, cy + 33 * minY);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#990000';
  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  ctx.moveTo(cx - 4 * secX, cy - 4 * secY);
  ctx.lineTo(cx + 40 * secX, cy + 40 * secY);
  ctx.stroke();
}

function updateCurrentTime() {
  var now = new Date();
  var hh = now.getHours();
  var mm = now.getMinutes();
  var ss = now.getSeconds();
  var str = '';
  if (hh % 12 == 0) {
    str += '12';
  } else {
    str += (hh % 12);
  }
  str += ':';
  if (mm >= 10) {
    str += mm;
  } else {
    str += '0' + mm;
  }
  str += ':';
  if (ss >= 10) {
    str += ss;
  } else {
    str += '0' + ss;
  }
  if (hh >= 12) {
    str += " PM";
  } else {
    str += " AM";
  }
  $('current_time').innerText = str;
}

// Override from common.js
window.stopAlarmAnimation = function() {
  window.clearTimeout(animationTimer);
  currentClockImage = blankClockImage;
  drawClock();
  isAnimating = false;
};

// Override from common.js
window.displayAlarmAnimation = function() {
  isAnimating = true;
  var rings = 100;
  function ring() {
    if (rings == 0) {
      stopAlarmAnimation();
      return;
    }
    currentClockImage = (rings % 2 == 0)?
                        blankClockAnim1Image:
                        blankClockAnim2Image;
    drawClock();
    rings--;
    animationTimer = window.setTimeout(ring, 50);
  }
  ring();
};

function addOutlineStyleListeners() {
  document.addEventListener('click', function(evt) {
    document.body.classList.add('nooutline');
    return true;
  }, true);
  document.addEventListener('keydown', function(evt) {
    document.body.classList.remove('nooutline');
    return true;
  }, true);
}

function createNewAlarm() {
  /**
   * Create a new alarm element.
   */
  var newAlarm = jQuery("#alarm-template").clone(true);
  newAlarm.attr("id","alarm-" + alarmCount);

  newAlarm.show();
  alarmCount++;
  return newAlarm;
}

function getAlarmTimes() {
  /**
   * Get the times from every alarm in the UI.
   * @type {Array} Array of alarm times
   */
  var time_array = [];
  jQuery('input.alarm-time').each(function() {
    time_array.push(this.value);
  });
  return time_array;
}

function getClosestAlarm(alarmField) {
  /**
   * Find the closest alarm element - this will be the parent container.
   */
  return jQuery(alarmField).closest('.alarm')
}

function initializeAlarmList() {
  /**
   * Initialize the alarm UI with all previously created alarms.
   */
  // chrome.storage.sync.clear(); // clear local storage for debugging purposes

  // Get saved UI elements/details from local storage
  chrome.storage.sync.get(['alarm_count', 'alarm_list', 'alarm_times'], function(result) {
    // If alarm_list is undefined, this is the first time a user is using the UI
    if (result.alarm_list == null) {
      console.log("Initializing alarm UI for the first time.");
      var newAlarm = createNewAlarm();              // Create a single default alarm
      jQuery("#alarm-list").append(newAlarm);       // Add alarm to the UI
      var listHTML = jQuery("#alarm-list").html();  // Get the html from the alarm-list
      chrome.storage.sync.set({                     // Save the updated alarm-list to local storage
        'alarm_count': 1,
        'alarm_list': listHTML,
        'alarm_times': [jQuery(".alarm-time").val()]
      }, function() {
        console.log("Alarm list HTML successfully stored.");
      });
    } else {
      // Otherwise, the alarm list had already been initialized and we can reload the previous list
      alarmCount = result.alarm_count;
      var list_HTML = result.alarm_list;
      var times = result.alarm_times;

      jQuery("#alarm-list").html(list_HTML); // set the list HTML to the previous HTML
      jQuery(".alarm-time").each(function(index, alarm) {
        // Re-add all the alarm times to each alarm element
        alarm.value = times[index];
        if (times[index] != null && times[index] != "") {
          // If the alarm has a valid time, enable the "ON" button
          getClosestAlarm(jQuery(alarm)).find('.alarm-toggle').removeClass('disabled');
        }
      });
    }

    // Add the "ON" button listener to all alarm-toggle buttons
    jQuery('button.alarm-toggle').click(function(){
      // If the button is disabled, do nothing
      if(jQuery(this).hasClass('disabled')) {
        return false;
      }
      // Else, on click, toggle the active class to mark the button as ON or OFF
      jQuery(this).toggleClass("active");
      // Save the updated HTML with the active class added to this alarm
      chrome.storage.sync.set({
        'alarm_list': jQuery("#alarm-list").html(),
        'alarm_count': alarmCount
      }, function() {
        // Notify that we saved.
        console.log('Alarm ON/OFF updated.');
      });

      // If toggling the button added the active class, the user has turned the alarm ON
      if (jQuery(this).hasClass('active')) {
        var alarm_id = getClosestAlarm(this).attr('id'); // get alarm id of parent alarm element

        // Send a message to the background script that we want to activate an alarm
        chrome.runtime.sendMessage({
          msg: "activate_alarm",
          alarm_id: alarm_id,
          alarm_time: jQuery('#' + alarm_id + ' .alarm-time').val()
        });
      } else {
        // If toggling the button removed the active class, the user has turned the alarm OFF
        var alarm_id = getClosestAlarm(this).attr('id');  // get alarm id of parent alarm element
        // Send a message to the background script that we want to remove an alarm
        chrome.runtime.sendMessage({
          msg: "delete_alarm",
          alarm_id: alarm_id,
          alarm_time: jQuery('#' + alarm_id + ' .alarm-time').val()
        });
      }
      return false;
    });

    // Add listeners to the alarm delete button
    jQuery('button.alarm-delete').click(function() {
      var alarm_id = getClosestAlarm(jQuery(this)).attr('id');  // get alarm id of parent alarm element

      // If the deleted alarm was ON, send a message to the background script to delete the alarm
      if (jQuery('#' + alarm_id + ' .alarm-toggle').hasClass('active')) {
        chrome.runtime.sendMessage({
          msg: "delete_alarm",
          alarm_id: alarm_id,
          alarm_time: jQuery('#' + alarm_id + ' .alarm-time').val()
        });
      }

      jQuery(this).closest('.alarm').remove(); // remove the alarm HTML element

      // Update the stored alarm-list HTML and times
      chrome.storage.sync.set({
        'alarm_list': jQuery("#alarm-list").html(),
        'alarm_count': alarmCount,
        'alarm_times': getAlarmTimes()
      }, function() {
        console.log('Alarm ' + alarm_id + ' successfully deleted');
      });

      return false;
    });

    // Add listener to create alarm button
    jQuery('button.alarm-create').click(function() {
      var newAlarm = createNewAlarm();
      jQuery("#alarm-list").append(newAlarm); // append the new alarm to the UI

      // Update the stored alarm-list HTML and times
      chrome.storage.sync.set({
        'alarm_list': jQuery("#alarm-list").html(),
        'alarm_count': alarmCount
      }, function() {
        console.log('New alarm created');
      });

      return false;
    });

    // Add listener to alarm-time input element
    jQuery('input.alarm-time').on('input', function() {
      var timeArray = getAlarmTimes();

      // Update the alarm times array in storage
      chrome.storage.sync.set({
        'alarm_list': jQuery("#alarm-list").html(),
        'alarm_times': timeArray
      }, function() {
        // Notify that we saved.
        console.log('Alarm successfully changed');
      });

      // Find the closest alarm element, get the toggle button, and enable the ON button
      // if time is valid.
      var alarm_id = getClosestAlarm(this).attr('id');
      var toggle_button = jQuery('#' + alarm_id + ' .alarm-toggle');
      if (jQuery(this).val() != "") {
        // If time was changed to something valid, remove disabled class
        toggle_button.removeClass('disabled');
      } else {
        // If time was changed to something invalid, add disabled class
        toggle_button.addClass('disabled');
      }

      // If the button was ON=
      if (toggle_button.hasClass('active')) {
        chrome.runtime.sendMessage({
          msg: "activate_alarm",
          alarm_id: alarm_id,
          alarm_time: jQuery('#' + alarm_id + ' .alarm-time').val()
        });
      }

      return false;
    });
  });
}

function load() {
  try {
    port = chrome.runtime.connect();
    port.onMessage.addListener(function(msg) {
      if (msg.cmd == 'anim') {
        displayAlarmAnimation();
      }
    });
  } catch (e) {
  }

  addOutlineStyleListeners();

  stopAll();
  drawClock();
  setInterval(drawClock, 100);

  updateCurrentTime();
  setInterval(updateCurrentTime, 250);

  $('clock').addEventListener('click', function(evt) {
    if (isPlaying || isSpeaking || isAnimating) {
      stopAll();
    } else {
      ringAlarmWithCurrentTime();
    }
  }, false);
  $('clock').addEventListener('keydown', function(evt) {
    if (evt.keyCode == 13 || evt.keyCode == 32) {
      if (isPlaying || isSpeaking || isAnimating) {
        stopAll();
      } else {
        ringAlarmWithCurrentTime();
      }
    }
  }, false);

  initializeAlarmList();

  // Phrase
  var phrase = localStorage['phrase'] || DEFAULT_PHRASE;
  $('phrase').value = phrase;
  $('phrase').addEventListener('change', function(evt) {
    localStorage['phrase'] = $('phrase').value;
  }, false);

  // Speech parameters
  var rateElement = $('rate');
  var volumeElement = $('volume');
  var rate = localStorage['rate'] || DEFAULT_RATE;
  var volume = localStorage['volume'] || DEFAULT_VOLUME;
  rateElement.value = rate;
  volumeElement.value = volume;
  function listener(evt) {
    rate = rateElement.value;
    localStorage['rate'] = rate;
    volume = volumeElement.value;
    localStorage['volume'] = volume;
  }
  rateElement.addEventListener('keyup', listener, false);
  volumeElement.addEventListener('keyup', listener, false);
  rateElement.addEventListener('mouseup', listener, false);
  volumeElement.addEventListener('mouseup', listener, false);

  var sound = $('sound');
  var currentSound = localStorage['sound'] || DEFAULT_SOUND;
  for (var i = 0; i < sound.options.length; i++) {
    if (sound.options[i].value == currentSound) {
      sound.selectedIndex = i;
      break;
    }
  }
  localStorage['sound'] = sound.options[sound.selectedIndex].value;
  sound.addEventListener('change', function() {
    localStorage['sound'] = sound.options[sound.selectedIndex].value;
  }, false);

  var playSoundButton = $('playsound');
  playSoundButton.addEventListener('click', function(evt) {
    playSound(false);
  });

  var playSpeechButton = $('playspeech');
  playSpeechButton.addEventListener('click', function(evt) {
    speakPhraseWithCurrentTime();
  });

  var voice = $('voice');
  var voiceArray = [];
  if (chrome && chrome.tts) {
    chrome.tts.getVoices(function(va) {
      voiceArray = va;
      for (var i = 0; i < voiceArray.length; i++) {
        var opt = document.createElement('option');
        var name = voiceArray[i].voiceName;
        if (name == localStorage['voice']) {
          opt.setAttribute('selected', '');
        }
        opt.setAttribute('value', name);
        opt.innerText = voiceArray[i].voiceName;
        voice.appendChild(opt);
      }
    });
  }
  voice.addEventListener('change', function() {
    var i = voice.selectedIndex;
    localStorage['voice'] = voiceArray[i].voiceName;
  }, false);
}

document.addEventListener('DOMContentLoaded', load);
