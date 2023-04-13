/*
"MetaSnapper" : A Progressive Web Application demonstrator.
*/
var mainModule = (function () {
  'use strict';

  let smeg = "smeg";
  let appLogLevel = 1;
  let defaultTitle = 'MetaSnap: ';

  // Check for support
  if (!('indexedDB' in window)) {
    console.log('This browser doesn\'t support IndexedDB');
    return;
  }

  /*
  * NB this creates the local indexedDB at version 2, i.e. the "version" is the second parameter
  * of window.idb.open.
  * The "oldVersion" is the version of the database detected when the JavaScript runs: i.e. the
  * existing version.
  * (oldVersion is part of the upgradeDb object passed into the callback function, that is
  * the third parameter of the idb.open call, by the idb.open library code itself)
  * You can use the case statement below to update the structure of any detected old version
  * up to that of the current database (meaning the version with the number passed in as
  * the second parameter of idb.open).
  */
  let dbPromise = window.idb.open('metasnaps', 2, function (upgradeDb) {
    switch (upgradeDb.oldVersion) {
      case 0:
        console.log('Creating the snaps object store');
        upgradeDb.createObjectStore('snaps', { keyPath: 'id', autoIncrement: 'true' });
        console.log('Creating the config object store');
        upgradeDb.createObjectStore('config', { keyPath: 'name' });
        console.log('Creating the application log store');
        upgradeDb.createObjectStore('applog', { keyPath: 'id', autoIncrement: 'true' });
        logInfo('All metasnapper object stores successfully reinitialised.');
        break;
      case 1:
        // Code to take version 1 of our indexeddb up to the latest version
        // We assume version 1 is the snaps and the config store so version 2 is all of that
        // plus the applog object store.
        console.log('Creating the application log store');
        upgradeDb.createObjectStore('applog', { keyPath: 'id', autoIncrement: 'true' });
        logInfo('All metasnapper object stores successfully reinitialised.');
        break;
      case 2:
        // So here would go the code to take an old version 2 db up to the latest version
        break;
    }
  });



  function deleteSnap(id) {
    let snapStartPos = 1;
    let snapEndPos = 10;
    let startPosEl = document.getElementById('snapStartPos');
    if (startPosEl) { snapStartPos = parseInt(startPosEl.innerHTML) }
    let endPosEl = document.getElementById('snapEndPos');
    if (endPosEl) { snapEndPos = parseInt(endPosEl.innerHTML) };
    dbPromise.then(function (db) {
      let tx = db.transaction('snaps', 'readwrite');
      let store = tx.objectStore('snaps');
      store.delete(id);
      mainModule.displaySnaps(snapStartPos, snapEndPos);
    }).catch(function (e) {
      handleError(e);
    });
  }

  function writeExifMetadata(title, notes, photoasdataurl, latitude, longitude, datetime) {
    // Do the EXIF processing to all write the metadata we have captured into the photo itself
    // EXIF is the industry standard for photo metadata.
    // NB we are attempting to assign the appropriate metasnapper metadata to all arguably
    // relevant EXIF fields as there does not seem to be much standardisation in how
    // EXIF is "read"/interpreted by other software, provided those fields are easily set
    // and not too "fragile".
    // Also, as I don't think anything other than specialised software reports on the location
    // data it is sensible to also duplicate that in the comments.
    // This will need error handling so that the app can still work even if the EXIF standard has
    // changed unexpectedly!
    // It might also be an idea to organise the error trapping so that core fields, those
    // that appear in Windows AND in the main EXIF spec, are set separately
    // from more optional fields that do not, but tags don't fail on a "one at a time basis":
    // rather they succeed or fail altogether when the dump method is called, and currently
    // we are only setting tags in the main EXIF spec anyway (though not all appear in Windows).
    // Also remember edits.
    try {
      let zeroth = {};
      let exif = {};
      let gps = {};
      // On windows the following single line results in the title appearing in the title and subject of
      // the file>properties>details
      zeroth[window.piexif.ImageIFD.ImageDescription] = title; // Core

      // Date and time
      // According to the official EXIF spec the format is YYYY:MM:DD HH:MM:SS
      // for DateTime, DateTimeOriginal and DateTimeDigitized
      let exifMonth = ('0' + (datetime.getMonth() + 1)).slice(-2); // Jan is 0, plus single digit months need to be zero padded
      // ALSO pad the day, hour, minutes and seconds!
      let exifDay = ('0' + datetime.getDate()).slice(-2);
      let exifHour = ('0' + datetime.getHours()).slice(-2);
      let exifMinutes = ('0' + datetime.getMinutes()).slice(-2);
      let exifSeconds = ('0' + datetime.getSeconds()).slice(-2);
      let exifDate = '' + datetime.getFullYear() + ':' + exifMonth + ':' + exifDay + ' ' +
        exifHour + ':' + exifMinutes + ':' + exifSeconds;

      // Core, but doesn't become the date taken viewable in Windows, file properties> details.
      zeroth[window.piexif.ImageIFD.DateTime] = exifDate;

      // In theory it is also possible to set an ImageIFD.TimeZoneOffset that represents the
      // difference between UTC and the time recorded, in hours.
      // And there's a Javascript method that returns something very similar,
      // getTimezoneOffset(), but in minutes.
      // Though TimeZoneOffset is not part of the core EXIF spec and
      // doesn't seem to be widely used at all, in fact the default EXIF
      // time standard seems to be that any time recorded is local to the
      // recorded location.
      // However, during BST UTC is an hour behind and piexifjs errors if
      // TimeZoneOffset is set to a negative number (positive numbers work OK)
      // which I suspect is a bug.
      // So, long story short, not bothering with TimeZoneOffset
      // (and I don't think a lot else bothers with it either!)
      // (It's possible that the ImageIFD.TimeZoneOffset is local time - UTC,
      // as against JS which is UTC - local time, and therefore the sign is reversed
      // and the error is caused by a difference between the offset and location
      // info, but this feels contrived, and
      // the ImageIFD.TimeZoneOffset is very poorly documented.
      // If I make that assumption but it's wrong I am risking building in
      // an obscure bug (app wouldn't work in time zones where local time is behind UTC
      // so the offset would again be negative).)

      // Core and the date that is viewable as the date taken through windows file properties> details.
      exif[window.piexif.ExifIFD.DateTimeOriginal] = exifDate;
      // Core and also viewable as the date taken through windows file properties> details.
      // I don't know which one of these two dates takes priority in Windows if they are different!
      exif[window.piexif.ExifIFD.DateTimeDigitized] = exifDate;

      // This is core and viewable as "comments" through windows file properties> details.
      exif[window.piexif.ExifIFD.UserComment] = notes + '\nAt location: ' +
        latitude + ' latitude and ' + longitude + ' longitude.'; // Core

      // Location
      gps[window.piexif.GPSIFD.GPSLatitudeRef] = latitude < 0 ? 'S' : 'N'; // Core
      gps[window.piexif.GPSIFD.GPSLatitude] = window.piexif.GPSHelper.degToDmsRational(latitude); // Core
      gps[window.piexif.GPSIFD.GPSLongitudeRef] = longitude < 0 ? 'W' : 'E'; // Core
      gps[window.piexif.GPSIFD.GPSLongitude] = window.piexif.GPSHelper.degToDmsRational(longitude); // Core

      let exifObj = { '0th': zeroth, Exif: exif, GPS: gps };
      var exifStr = window.piexif.dump(exifObj);
    } catch (e) {
      logError('Error attempting to generate EXIF metadata: ' + e);
      return photoasdataurl; // This is save to do as, at this point, this method hasn't touched the photo data.
    }

    // var enrichedphotoasdataurl = window.piexif.insert(exifStr, photoasdataurl);
    try {
      return window.piexif.insert(exifStr, photoasdataurl);
    } catch (e) {
      // If the error has occurred here the photo data may have been corrupted:
      // so the caller should catch this error and attmept to use the original photo data instead.
      logError('Error attempting to write EXIF metadata into the photo: ' + e);
      throw Error('Error attempting to write EXIF metadata into the photo: ' + e);
    }
  }

  async function handleError(errObject, severity) {
    /* Eventually, we might want to call this from a window.onerror and window.onunhandledrejection,
     in order to intercept all errors without needing to implement explicit error handling everywhere, but remember that
    the service workers have no access to the window object...
    We might also want to expand this function to make it fancier... e.g. alert messages to the user,
    enrich the error by say capturing info about the browser/user agent etc... but all for a later date...
    Severity is passed in because not all errors are errors! Consider wanrings for example... */

    /* Write to the standard JS console so that all relevant information is visible in one place when debugging,
    and so errors still get recorded even if somehting has gone wrong with indexeddb or the way we write to it! */
    console.log('Looks like there was a problem:', errObject);
    // If severity hasn't been passed in default to ERROR
    if (!severity) {
      severity = 'ERROR';
    }
    // Writing to the app log is very useful as the standard JS console won't be accessible when the app
    // is running on many devices, especially Apple ones...
    saveLogEntry(severity, errObject, 'unstructured');
  }

  function getAppLogLevel() {
    return appLogLevel;
  }

  function setAppLogLevel(newLogLevel) {
    appLogLevel = newLogLevel;
  }

  function getDefaultTitle() {
    return defaultTitle;
  }

  function setDefaultTitle(newDefaultTitle) {
    defaultTitle = newDefaultTitle;
  }

  /* Included for completeness and to allow direct logging of an error message, though, in practice
  you would most likely be calling the handleError method to take advantage of additional error handling steps
  such as possibly enriching the error message object with further information, alerting the user, also writing
  to the standard console etc... */
  function logError(message) {
    /* For this function we are going to assume that a console.log call has already been made to log
     the raw error object rather than the message. For the warning, info and debug functions
     we are going to assume that the info to log is a simple string and therefore nothing is ever likely
     to be lost by writing that string to console.log directly within each function. */
    saveLogEntry('ERROR', message, 'unstructured');
  }

  function logWarning(message) {
    if (mainModule.getAppLogLevel() <= 2) {
      console.log(message);
      saveLogEntry('WARNING', message, 'unstructured');
    }
  }

  function logInfo(message) {
    if (mainModule.getAppLogLevel() <= 1) {
      console.log(message);
      saveLogEntry('INFO', message, 'unstructured');
    }
  }

  function logDebug(message) {
    if (mainModule.getAppLogLevel() <= 0) {
      console.log(message);
      saveLogEntry('DEBUG', message, 'unstructured');
    }
  }

  /* Severity will be debug, info, warn and error */
  /* and messageStructure is the JSON "object type" of the message essentially...
  something that tells a program reading each log entry how to interpret each message */
  /* Consider placing this in a seperate module so it can more easily be used within other logging frameworks */
  async function saveLogEntry(severity, message, messageStructure) {
    await dbPromise.then(async function (db) {
      let tx = db.transaction('applog', 'readwrite');
      let store = tx.objectStore('applog');

      let datetime = new Date();

      /* It's only an array of one item, but the array is convenient as it allows the item
        to be passed into a child promise chain using Promises.all.
        Be very mindful of the fact that the Promises.all starts a child promise chain:
        it only inherits variables such as the tx transation variable because it is fully "enclosed"
        in its parent promise chain.
        Later steps on the SAME promise chain do not have access to the scope of variables
        declared within functions earlier in the promise chain! */

      let items = [
        {
          datetime: datetime,
          severity: severity,
          message: message,
          messageStructure: messageStructure
        }
      ];
      return await Promise.all(items.map(async function (item) {
        console.log('Adding item: ', item); // We can't use our standard logging functions here or we'll end up in an infinite regress!
        return await store.add(item);
      })
      ).then(function () {
        console.log('Application log entry created successfully!');
      }).catch(function (e) {
        console.log(e);
        window.alert('Unable to create a log entry. The error is' + e);
        tx.abort();
      }).finally(function () {
        console.log('Cleaning up');
      });
    });
  }


  /** To allow the index page, which is our starting page for the app, to bootstrap itself
   * into existence without first having to run some javascript to merge a fragment into a template
   * the index page IS the template and it, by default, is fully populated.
   * But that means the "page content" fragment for the index page is already
   * embedded in the index page.
   * We don't want to have to maintain that html twice, once in the index page and then once
   * as a seperate fragment to support transitions back to the index page.
   * Therefore, to support transitions back to the index page from another page
   * we have to do some special processing:
   * specifically, we fetch the whole index page, and then extract the page content section
   * of the index page as html, and then merge that html back into our current document/template
   * as the new page content.
   * And NB we can't do in this service worker, because service worker's are not allowed to
   * access the DOMParser!
   */
  function addSnap(postfunc) {
    window.fetch('index.html').then(function (response) {
      return response.text();
    }).then(function (content) {
      // Convert the HTML string into a document object
      let parser = new window.DOMParser();
      let indexDoc = parser.parseFromString(content, 'text/html');
      let indexPageContent = indexDoc.querySelectorAll('[id="pageContent"]')[0].innerHTML;

      let elems = document.querySelectorAll('[id="pageContent"]');

      for (let i = 0; i < elems.length; i++) {
        elems[i].innerHTML = indexPageContent;
      }

      /* Set the snap title on the index page */
      let titleElement = document.getElementById('title');
      if (titleElement) {
        titleElement.value = mainModule.getDefaultTitle();
      }

      if (postfunc) postfunc();
    }).catch(function (e) {
      handleError(e);
    });
  }

  function config() {
    mainModule.navigate('configfragment.html', mainModule.displayConfig);
  }

  function postSnaps() {
    clearText();
    mainModule.disablePostButtons();
    let fnserver;
    if (window.location.hostname.includes('heroku')) {
      fnserver = 'https://metasnapper-server.herokuapp.com/';
    } else {
      fnserver = 'http://localhost:5000/';
    }

    let snapsList = [];

    let batches = [];

    batches.push(snapsList); // Hoping this just adding a pointer and not just copying the content!

    const defaultBatchSize = '10';

    let batchSize = defaultBatchSize;

    let batchCount = 1;

    let snapsForThisBatch = 0;

    let batchFull = false;

    let snapsTotal = 0;

    let batchesPosted = 0;

    let batchesNotPosted = 0;

    let resultMessage = '';

    let appConfig;

    let batchErrored;

    const serverUnreachable = 'Cannot submit notes as the target server appears to be unreachable.';

    dbPromise.then(async function (db) {
      appConfig = await getConfig();
      if (appConfig && appConfig.batchSize !== defaultBatchSize && appConfig.batchSize >= 1 && appConfig.batchSize <= 100) {
        batchSize = appConfig.batchSize;
      }
      let tx = db.transaction('snaps', 'readonly');
      let store = tx.objectStore('snaps');
      return store.openCursor();
    }).then(function showSnaps(cursor) {
      if (!cursor) { return; }
      logDebug('Cursored at:' + cursor.value.title);

      snapsForThisBatch++; // so this will start at 1.
      snapsTotal++;

      if (batchFull) { // so we need to start a new batch
        // We need to create a new batch.
        batchCount++;
        snapsList = []; // repoint the snapsList closure at an empty array
        batches.push(snapsList); // add the new snapsList to the batches array
      }

      let snapRecord = {
        title: cursor.value.title,
        note: cursor.value.note,
        photoasdataurl: cursor.value.photoasdataurl,
        datetime: cursor.value.datetime,
        latitude: cursor.value.latitude,
        longitude: cursor.value.longitude
      };

      snapsList.push(snapRecord);

      // Have we now filled up the batch?
      // NB batches will fill up instantly if batch size is only 1
      if (snapsForThisBatch === parseInt(batchSize, 10)) {
        batchFull = true;
        snapsForThisBatch = 0; // We can't add any more snaps to this batch...any further snaps will have to count towards the next batch
      } else {
        batchFull = false;
      }

      return cursor.continue().then(showSnaps);
    }).then(async function () {
      if (snapsTotal > 0 && appConfig.mailTo) {
        for (let i = 0; i < batchCount; i++) {
          batchErrored = false; // Assume success unless told otherwise
          // NB If adding any CUSTOM headers ensure they are set within accept-headers in any receiving CORS enabled server!
          // NB DO NOT set a content-type header of application/json here, however tempting that might seem
          // as my cors server would not parse the json body with that set! Possibly the photos are not
          // compliant with application/json even when base 64 encoded.
          await window.fetch(fnserver, { // There's no harm here in the await, the JS will be single threaded anyway.
            method: 'POST',
            headers: { 'configured-mailto': appConfig.mailTo },
            body: JSON.stringify(batches[i])

          }).then(function (response) {
            if (response.url.search('offline.html') !== -1) {
              batchErrored = true;
              return serverUnreachable;
            } else if (!response.ok) {
              batchErrored = true;
              return response.text(); // We still want to try and resolve the response body as that may contain a specific error message.
            } else {
              // NB this is a asynchronous, promise generating call to get the response body.
              // In theory, at this point, it should contain a success message
              // but it could still fail if something is wrong with the response, which itself is most
              // likely to mean a problem with the server or network and we can't assume the batch was posted.
              return response.text();
            }
          }).then(function (messageAsText) {
            // Have to do this as response.text() returns yet another promise, to get the response body, that we have to resolve with a then
            resultMessage = messageAsText;
            if (!batchErrored) { // if have successfully reached here and haven't been told that the batch has already failed.
              batchesPosted++;
            } else {
              if (messageAsText === serverUnreachable) {
                logInfo(messageAsText);
              } else {
                logError(messageAsText);
              }
              batchesNotPosted++;
            }
          })
            .catch(function (e) {
              batchesNotPosted++;
              resultMessage = 'Error while attempting to post snaps: ' + e;
              handleError(e);
            });
        } // End of loop around the batches
        // Tell the user what's happened...
        mainModule.enablePostButtons();
        if (batchesPosted > 0 && batchesNotPosted > 0) {
          // SOME batches of snaps seem to have posted, but not all
          showText('Some snaps have posted but not all. Check the app log for more information.');
        } else {
          showText(resultMessage);
        }
      } else {
        mainModule.enablePostButtons();
        if (!(appConfig.mailTo)) {
          window.alert('Please set an email address to send the snaps to using the Configure App button on the Add More Snaps screen.');
        } else {
          window.alert('Nothing to post.');
        }
      }
    });
  }

  function disablePostButtons() {
    let elems = document.querySelectorAll('[id="post"]');

    for (var i = 0; i < elems.length; i++) {
      elems[i].disabled = true;
    }

    let spinners = document.querySelectorAll('[id="loader"]');

    for (i = 0; i < spinners.length; i++) {
      spinners[i].style.display = 'block';
    }
  }

  function enablePostButtons() {
    let elems = document.querySelectorAll('[id="post"]');

    for (var i = 0; i < elems.length; i++) {
      elems[i].disabled = false;
    }

    let spinners = document.querySelectorAll('[id="loader"]');

    for (i = 0; i < spinners.length; i++) {
      spinners[i].style.display = 'none';
    }

    /* var spinner = document.getElementById('loader');
    if (spinner !== null) {
      spinner.style.display = 'none';
    } */
  }

  var getConfig = async function getAllConfigItems() {
    let appConfig = { mailTo: '' };
    await dbPromise.then(function (db) {
      let tx = db.transaction('config', 'readonly');
      let store = tx.objectStore('config');
      // Just looping through a list of records, each one of which is just a name-value pair
      return store.openCursor();
    }).then(function stepThroughConfig(cursor) {
      if (!cursor) { return; }
      let fieldName = cursor.value.name;
      logDebug('Cursored at:' + fieldName);
      appConfig[fieldName] = cursor.value.value;

      return cursor.continue().then(stepThroughConfig);
    }).then(function () {
      return appConfig;
    });
    return appConfig;
  };


  function displaySnaps(snapStartPos, snapEndPos) {
    let s = '';
    let snapCount = 0;

    clearText();
    dbPromise.then(function (db) {
      let tx = db.transaction('snaps', 'readonly');
      let store = tx.objectStore('snaps');
      return store.openCursor();
    }).then(function showSnaps(cursor) {
      if (!cursor) { return; }
      snapCount++;
      logDebug('Cursored at:' + cursor.value.title);

      if (snapCount >= snapStartPos && snapCount <= snapEndPos) {
        s += '<span class="snap" id="' + cursor.value.id + '">';
        /* s += '<input type="hidden" id="snapId" value="' + cursor.value.id + '">'; */
        // s += '<h2 id="title">' + cursor.value.title + '</h2>';
        s += '<p><input type="text" id="editableTitle" size="25" maxlength="100" value="' + cursor.value.title + '"/></p>';
        s += '<p><textarea id="editableNote" rows="4" cols="30" maxlength="10000">' + cursor.value.note + '</textarea> </p>';
        // s += '<p id="note">' + cursor.value.note + '</p>';
        s += '<p>   <img src="' + cursor.value.photoasdataurl + '"/></p>';
        s += '<h3> Time and Space </h3>';
        s += '<p> Time:' + cursor.value.datetime + '</p>';
        s += '<p> Latitude:' + cursor.value.latitude + '</p>';
        s += '<p> Longitude:' + cursor.value.longitude + '</p>';
        if (cursor.value.latitude !== 'Unknown' && cursor.value.longitude !== 'Unknown') {
          s += '<p><a href="https://maps.google.com/maps/search/?api=1&query=' +
            cursor.value.latitude + ',' + cursor.value.longitude +
            '" target="_blank"> Show Location </a></p>';
        }
        s += '<p>  <button id="submit" class="itemButton" onclick="mainModule.deleteSnap(' +
          cursor.value.id + ')">Delete Snap</button> </p>';
        s += '</span>';
      }

      return cursor.continue().then(showSnaps);
    }).then(function () {
      if (s === '') { s = '<p>No results.</p>'; }
      document.getElementById('notes').innerHTML = s;
      document.getElementById('snapStartPos').innerHTML = snapStartPos;
      document.getElementById('snapEndPos').innerHTML = snapEndPos;
      let pageUpButton = document.getElementById('pageUp');
      let pageDownButton = document.getElementById('pageDown');

      if (snapStartPos <= 1) {
        pageUpButton.disabled = true;
      }
      else {
        pageUpButton.disabled = false;
      }

      if (snapEndPos >= snapCount) {
        pageDownButton.disabled = true;
      }
      else {
        pageDownButton.disabled = false;
      }

    }).catch(function (e) {
      handleError('Error when attempting to display snaps: ' + e);
    }); // Have to have error logging here as this function has started its own promise chain.;
  }

  function displayApplog() {
    let s = '';
    clearText();
    dbPromise.then(function (db) {
      let tx = db.transaction('applog', 'readonly');
      let store = tx.objectStore('applog');
      return store.openCursor();
    }).then(function showLog(cursor) {
      if (!cursor) { return; }
      logDebug('Cursored at:' + cursor.value.datetime);
      s += '<p><b>' + cursor.value.datetime + '</b></p>';
      s += '<p>' + cursor.value.severity + ': ';
      if (cursor.value.messageStructure === 'unstructured') {
        s += cursor.value.message + '</p>';
      }

      return cursor.continue().then(showLog);
    }).then(function () {
      if (s === '') { s = '<p>No results.</p>'; }
      document.getElementById('logentries').innerHTML = s;
    }).catch(function (e) {
      handleError('Error when attempting to display application log: ' + e);
    }); // Have to have error logging here as this function has started its own promise chain.;
  }

  function showText(responseAsText) {
    let elems = document.querySelectorAll('[id="message"]');

    for (let i = 0; i < elems.length; i++) {
      // elems[i].textContent = responseAsText;
      elems[i].innerHTML = responseAsText;
    }
  }

  function clearText() {
    let elems = document.querySelectorAll('[id="message"]');

    for (let i = 0; i < elems.length; i++) {
      elems[i].textContent = '';
    }
  }

  function displayConfig() {
    let fieldName = '';
    clearText();
    document.getElementById('appLogLevel').value = 1; // Default app logging level to 1...if it is set it'll get reset as we read back the config settings below
    document.getElementById('batchSize').value = 10; // Default batch size to 10...if it is set it'll get reset as we read back the config settings below
    document.getElementById('defaultTitle').value = mainModule.getDefaultTitle(); // Default the default title to "MetaSnap: " or whatever the current value is the mainModule namespace.
    dbPromise.then(function (db) {
      let tx = db.transaction('config', 'readonly');
      let store = tx.objectStore('config');
      // Just looping through a list of records, each one of which is just a name-value pair
      return store.openCursor();
    }).then(function showConfig(cursor) {
      if (!cursor) { return; }
      fieldName = cursor.value.name;
      logDebug('Cursored at:' + fieldName);
      /* Special handling for potentially multiple email addresses */
      if (fieldName === 'mailTo') {
        let addressList = document.getElementById('addressList');
        let addresses = cursor.value.value.split(';');

        for (let i = 0; i < addresses.length; i++) {
          if (i === 0) {
            // Handle the first email address
            document.getElementById('mailTo').value = addresses[0];
          } else { // the rest...
            let anEmail = createEmailAddressAtIndex(i + 1, addresses[i]);
            addressList.appendChild(anEmail);
          }
        }
      } else {
        // The convention we have adopted, to keep it simple, is that the id of html element
        // containing the config value is the same as the name of the config item.
        document.getElementById(fieldName).value = cursor.value.value;
      }

      return cursor.continue().then(showConfig);
    }).catch(function (e) {
      handleError('Error when attempting to display config: ' + e);
    }); // Have to have error logging here as this function has started its own promise chain.
  }

  function createEmailAddressAtIndex(newIndex, anAddress) {
    let anEmail = document.createElement('div');
    let attDivId = document.createAttribute('id');
    attDivId.value = 'anEmail' + newIndex;
    anEmail.setAttributeNode(attDivId);

    let newEmail = document.createElement('input');
    let attType = document.createAttribute('type');
    attType.value = 'email';
    newEmail.setAttributeNode(attType);
    let attId = document.createAttribute('id');
    attId.value = 'mailTo';
    newEmail.setAttributeNode(attId);
    let attSize = document.createAttribute('size');
    attSize.value = '44';
    newEmail.setAttributeNode(attSize);
    // Apparently the maximum allowed length of an email address is 320 characters
    let attMaxlength = document.createAttribute('maxlength');
    attMaxlength.value = '320';
    newEmail.setAttributeNode(attMaxlength);

    if (anAddress !== undefined) {
      newEmail.value = anAddress;
    }

    anEmail.appendChild(newEmail);

    let removeButton = document.createElement('button');
    let attClass = document.createAttribute('class');
    attClass.value = 'itemButton';
    removeButton.setAttributeNode(attClass);

    let attOnclick = document.createAttribute('onclick');
    attOnclick.value = "configModule.removeEmail('anEmail" + newIndex + "')";
    removeButton.setAttributeNode(attOnclick);
    let node = document.createTextNode('Remove');
    removeButton.appendChild(node);
    anEmail.appendChild(removeButton);

    return anEmail;
  }

  // Navigate in a Single Page App manner
  // As indexeddb use means that a lot of asynch processing
  // will be happening, and we don't want that being stopped
  // as we switch pages in a Multiple Page App!
  // htmlfragment is the path to the htmlfragment to fetch and
  // merge into the DOM.
  // postfunc is a function to run after navigation, usually
  // to merge data into the fragment...
  function navigate(htmlfragment, postfunc) {
    window.fetch(htmlfragment).then(function (response) {
      return response.text();
    }).then(function (content) {
      let elems = document.querySelectorAll('[id="pageContent"]');

      for (let i = 0; i < elems.length; i++) {
        elems[i].innerHTML = content;
      }

      if (postfunc) postfunc();
    }).catch(function (e) {
      handleError(e);
    });
  }


  return {
    getConfig: getConfig,
    dbPromise: dbPromise,
    clearText: (clearText),
    showText: (showText),
    deleteSnap: (deleteSnap),
    addSnap: (addSnap),
    displaySnaps: (displaySnaps),
    postSnaps: (postSnaps),
    displayConfig: (displayConfig),
    createEmailAddressAtIndex: (createEmailAddressAtIndex),
    disablePostButtons: (disablePostButtons),
    enablePostButtons: (enablePostButtons),
    config: (config),
    navigate: (navigate),
    handleError: (handleError),
    logDebug: (logDebug),
    logInfo: (logInfo),
    logWarning: (logWarning),
    logError: (logError),
    saveLogEntry: (saveLogEntry),
    displayApplog: (displayApplog),
    getAppLogLevel: (getAppLogLevel),
    setAppLogLevel: (setAppLogLevel),
    getDefaultTitle: (getDefaultTitle),
    setDefaultTitle: (setDefaultTitle),
    writeExifMetadata: (writeExifMetadata)
  };
})();
