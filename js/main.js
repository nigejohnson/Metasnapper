/*
"MetaSnapper" : A Progressive Web Application demonstrator.
*/
var idbApp = (function () {
  'use strict';

  var appLogLevel = 1;
  var defaultTitle = 'MetaSnap: ';

  // Check for support
  if (!('indexedDB' in window)) {
    console.log('This browser doesn\'t support IndexedDB');
    return;
  }

  /*
  * NB this creates the local indexedDB at version 1, i.e. the "version" is the second parameter
  * of window.idb.open.
  * The "oldVersion" is the version of the database detected when the JavaScript runs: i.e. the
  * existing version.
  * (oldVersion is part of the upgradeDb object passed into the callback function, that is
  * the third parameter of the idb.open call, by the idb.open library code itself)
  * You can use the case statement below to update the structure of any detected old version
  * up to that of the current database (meaning the version with the number passed in as
  * the second parameter of idb.open).
  */
  var dbPromise = window.idb.open('metasnaps', 2, function (upgradeDb) {
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

  /* This function just ensures everything is set correctly when the app is re-opened. */
  /* Remember, this app is following a single page app pattern with the index page as
  the template, so, once the app has initially been opened, only the pageContent
  div content gets "reloaded": JS outside of that should only run when the page is intially
  loaded/the app opened. Subsequent revisits to the "Add Snap" index page shouldn't cause this javascript to
  re-run */
  async function reOpenApp () {
    var startingAppLogLevel = 1;
    var startingDefaultTitle = defaultTitle;
    var appConfig;
    appConfig = await getConfig();
    if (appConfig && appConfig.appLogLevel && (appConfig.appLogLevel >= 0 && appConfig.appLogLevel <= 3)) {
      startingAppLogLevel = appConfig.appLogLevel;
    }
    if (appConfig && (appConfig.defaultTitle || appConfig.defaultTitle === '')) {
      startingDefaultTitle = appConfig.defaultTitle;
    }
    idbApp.setAppLogLevel(startingAppLogLevel);
    idbApp.setDefaultTitle(startingDefaultTitle);

    /* Set the snap title on the index page */
    var titleElement = document.getElementById('title');
    if (titleElement) {
      titleElement.value = startingDefaultTitle;
    }
  }

  function processPageAndSave (postSaveFunc) {
    var thisSnap = {
      title: document.getElementById('title').value,
      notes: document.getElementById('notes').value,
      photoasdataurl: document.getElementById('thumbnail').src
    };

    getLocationThenSaveSnap(thisSnap, postSaveFunc);
  }

  async function getLocationThenSaveSnap (thisSnap, postSaveFunc) {
    var title = thisSnap.title;
    var notes = thisSnap.notes;
    var photoasdataurl = thisSnap.photoasdataurl;

    // The next few lines are needed as, if no photo as been added, then the src of the thumbnail is the url and the index page html becomes the "photo"
    if (photoasdataurl.substring(0, 5).toLowerCase() !== 'data:') {
      photoasdataurl = '';
    }

    var trimmedTitle = title.trim();
    // Skip save if the snap only comprises of a default title or a blank title and has no notes and no photo...
    if ((trimmedTitle.trim() === '' || trimmedTitle === idbApp.getDefaultTitle().trim()) &&
    notes.trim() === '' && photoasdataurl === '') {
      if (postSaveFunc) postSaveFunc();
      return;
    }
    document.getElementById('save').disabled = true;
    document.getElementById('show').disabled = true;

    // Not the "options" object passed into the call to geolocation below:
    // GPS location can be quite slow (even more than a minute!) so geolocation defaults to
    // a setting of enableHighAccuracy: false, which is pretty useless in rural areas with no wifi
    // and poor mobile signals, as it means the app will very likely not use GPS location data at all.
    // As for the other settings, timeout (in milliseconds) is self-explanatory, and I increased that to 15 seconds
    // from 5 seconds when I increased the accuracy.
    // The final property, maximumAge (in millisceonds), is how long the app should retain a location setting before
    // trying to geolocate anew.
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async function (location) {
        logDebug('Geolocation did the callback');
        await idbApp.saveSnap(title, notes, photoasdataurl, location);
        if (postSaveFunc) postSaveFunc();
      }, async function () { await idbApp.saveSnap(title, notes, photoasdataurl); if (postSaveFunc) postSaveFunc(); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }); // Second call is for no location
    } else {
      await idbApp.saveSnap(title, notes, photoasdataurl);
      if (postSaveFunc) postSaveFunc();
    }
  }

  function deleteSnap (id) {
    dbPromise.then(function (db) {
      var tx = db.transaction('snaps', 'readwrite');
      var store = tx.objectStore('snaps');
      store.delete(id);
      idbApp.displaySnaps();
    }).catch(function (e) {
      handleError(e);
    });
  }

  async function saveSnap (title, notes, photoasdataurl, location) {
    await dbPromise.then(async function (db) {
      var tx = db.transaction('snaps', 'readwrite');
      var store = tx.objectStore('snaps');
      var latitude = 'Unknown';
      var longitude = 'Unknown';
      if (location) {
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }
      var datetime = new Date();
      var items = [
        {
          title: title,
          note: notes,
          photoasdataurl: photoasdataurl,
          datetime: datetime,
          latitude: latitude,
          longitude: longitude
        }
      ];
      return await Promise.all(items.map(async function (item) {
        logDebug('Adding metasnap with title: ' + item.title);
        return await store.add(item);
      })
      ).then(function () {
        logDebug('Snap added successfully!');
        document.getElementById('title').value = idbApp.getDefaultTitle();
        document.getElementById('notes').value = '';
        document.getElementById('thumbnail').src = '';
        document.getElementById('photo_preview').style.display = 'none';
      }).catch(function (e) {
        handleError(e);
        window.alert('Unable to save snaps. The error is' + e);
        tx.abort();
      }).finally(function () {
        document.getElementById('save').disabled = false;
        document.getElementById('show').disabled = false;
      });
    });
  }

  async function handleError (errObject, severity) {
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

  function getAppLogLevel () {
    return appLogLevel;
  }

  function setAppLogLevel (newLogLevel) {
    appLogLevel = newLogLevel;
  }

  function getDefaultTitle () {
    return defaultTitle;
  }

  function setDefaultTitle (newDefaultTitle) {
    defaultTitle = newDefaultTitle;
  }

  /* Included for completeness and to allow direct logging of an error message, though, in practice
  you would most likely be calling the handleError method to take advantage of additional error handling steps
  such as possibly enriching the error message object with further information, alerting the user, also writing
  to the standard console etc... */
  function logError (message) {
    /* For this function we are going to assume that a console.log call has already been made to log
     the raw error object rather than the message. For the warning, info and debug functions
     we are going to assume that the info to log is a simple string and therefore nothing is ever likely
     to be lost by writing that string to console.log directly within each function. */
    saveLogEntry('ERROR', message, 'unstructured');
  }

  function logWarning (message) {
    if (idbApp.getAppLogLevel() <= 2) {
      console.log(message);
      saveLogEntry('WARNING', message, 'unstructured');
    }
  }

  function logInfo (message) {
    if (idbApp.getAppLogLevel() <= 1) {
      console.log(message);
      saveLogEntry('INFO', message, 'unstructured');
    }
  }

  function logDebug (message) {
    if (idbApp.getAppLogLevel() <= 0) {
      console.log(message);
      saveLogEntry('DEBUG', message, 'unstructured');
    }
  }

  /* Severity will be debug, info, warn and error */
  /* and messageStructure is the JSON "object type" of the message essentially...
  something that tells a program reading each log entry how to interpret each message */
  /* Consider placing this in a seperate module so it can more easily be used within other logging frameworks */
  async function saveLogEntry (severity, message, messageStructure) {
    await dbPromise.then(async function (db) {
      var tx = db.transaction('applog', 'readwrite');
      var store = tx.objectStore('applog');

      var datetime = new Date();

      /* It's only an array of one item, but the array is convenient as it allows the item
        to be passed into a child promise chain using Promises.all.
        Be very mindful of the fact that the Promises.all starts a child promise chain:
        it only inherits variables such as the tx transation variable because it is fully "enclosed"
        in its parent promise chain.
        Later steps on the SAME promise chain do not have access to the scope of variables
        declared within functions earlier in the promise chain! */

      var items = [
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

  function clearAppLog () {
    dbPromise.then(function (db) {
      var tx = db.transaction('applog', 'readwrite');
      var store = tx.objectStore('applog');
      store.clear();
    }).catch(function (e) {
      handleError(e);
    }).then(function () {
      document.getElementById('logentries').innerHTML = '<p>No results.</p>';
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
  function addSnap (postfunc) {
    window.fetch('index.html').then(function (response) {
      return response.text();
    }).then(function (content) {
      // Convert the HTML string into a document object
      var parser = new window.DOMParser();
      var indexDoc = parser.parseFromString(content, 'text/html');
      var indexPageContent = indexDoc.querySelectorAll('[id="pageContent"]')[0].innerHTML;

      var elems = document.querySelectorAll('[id="pageContent"]');

      for (var i = 0; i < elems.length; i++) {
        elems[i].innerHTML = indexPageContent;
      }

      /* Set the snap title on the index page */
      var titleElement = document.getElementById('title');
      if (titleElement) {
        titleElement.value = idbApp.getDefaultTitle();
      }

      if (postfunc) postfunc();
    }).catch(function (e) {
      handleError(e);
    });
  }

  function showSnaps () {
    idbApp.navigate('showsnapsfragment.html', idbApp.displaySnaps);
  }

  function showSnapsAfterSave () {
    var postSaveFunc = function () {
      idbApp.showSnaps();
    };
    idbApp.processPageAndSave(postSaveFunc);
  }

  function config () {
    idbApp.navigate('configfragment.html', idbApp.displayConfig);
  }

  function configAppAfterSave () {
    var postSaveFunc = function () {
      idbApp.config();
    };
    idbApp.processPageAndSave(postSaveFunc);
  }

  function applog () {
    idbApp.navigate('applogfragment.html', idbApp.displayApplog);
  }

  function applogAfterSave () {
    var postSaveFunc = function () {
      idbApp.applog();
    };
    idbApp.processThenSaveConfig(postSaveFunc);
  }

  function postSnapsAfterSave () {
    clearText();

    idbApp.disablePostButtons();

    var postAfterSave = function () {
      idbApp.postSnaps();
    };
    idbApp.processPageAndSave(postAfterSave);
  }

  function editSnaps () {
    clearText();
    /* Iterate around the snaps on the page creating a map of the snaps keyed by id */
    var snaps = document.getElementsByClassName('snap');
    var snapsMap = new Map();
    var snapId;
    var snapTitle;
    var snapNote;
    var s = '';
    var editsHaveErrored = false;

    for (var i = 0; i < snaps.length; i++) {
      snapId = snaps[i].id;

      /* This should find the relevant info from within the first element of the given id:
      at any level within the snap, so should be resistant to be being broken by any
      extra formatting */
      snapTitle = snaps[i].querySelector('#editableTitle').value;
      snapNote = snaps[i].querySelector('#editableNote').value;

      snapsMap.set(snapId, { title: snapTitle, note: snapNote });
    }

    /* Now we have the snap map loop around a cursor loop making any changes */

    dbPromise.then(function (db) {
      var tx = db.transaction('snaps', 'readwrite');
      var store = tx.objectStore('snaps');
      return store.openCursor();
    }).then(async function editSnaps (cursor) {
      if (!cursor) { return; }
      const updateData = cursor.value;

      logDebug('Cursored at:' + updateData.title);

      var thisSnap = snapsMap.get('' + updateData.id);
      var dataChanged = false;

      if (updateData.title !== thisSnap.title) {
        updateData.title = thisSnap.title;
        dataChanged = true;
      }

      if (updateData.note !== thisSnap.note) {
        updateData.note = thisSnap.note;
        dataChanged = true;
      }

      /* This function is running in background anyway, but JavaScript is single threaded.
      I want to know when all the snap updates have finished, so I'm just going to wait for them
      and not complicate things by pretending that each indiviudal snap update is somehow happening
      in parallel (they aren't). */

      if (dataChanged) {
        await cursor.update(updateData).then(function (updateResult) {
          logDebug('Successfully updated a snap with id ' + updateResult + '.');
        }).catch(function (e) {
          editsHaveErrored = true;
          handleError('Error when attempting to update snaps: ' + e);
        });
      }

      return cursor.continue().then(editSnaps);
    }).then(function () {
      if (!editsHaveErrored) {
        s = 'Edited snaps saved.';
      } else {
        s = 'Some snaps edits have failed. Please see the app log.';
      }
      showText(s);
    }).catch(function (e) {
      s = 'Error when attempting to save edited snaps';
      handleError(s + ': ' + e);
      showText(s + '.');
    });
  }

  function postSnaps () {
    clearText();
    idbApp.disablePostButtons();
    var fnserver;
    if (window.location.hostname.includes('heroku')) {
      fnserver = 'https://metasnapper-server.herokuapp.com/';
    } else {
      fnserver = 'http://localhost:5000/';
    }

    var snapsList = [];

    var batches = [];

    batches.push(snapsList); // Hoping this just adding a pointer and not just copying the content!

    const defaultBatchSize = '10';

    var batchSize = defaultBatchSize;

    var batchCount = 1;

    var snapsForThisBatch = 0;

    var batchFull = false;

    var snapsTotal = 0;

    var batchesPosted = 0;

    var batchesNotPosted = 0;

    var resultMessage = '';

    var appConfig;

    var batchErrored;

    const serverUnreachable = 'Cannot submit notes as the target server appears to be unreachable.';

    dbPromise.then(async function (db) {
      appConfig = await getConfig();
      if (appConfig && appConfig.batchSize !== defaultBatchSize && appConfig.batchSize >= 1 && appConfig.batchSize <= 100) {
        batchSize = appConfig.batchSize;
      }
      var tx = db.transaction('snaps', 'readonly');
      var store = tx.objectStore('snaps');
      return store.openCursor();
    }).then(function showSnaps (cursor) {
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

      var snapRecord = {
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
        for (var i = 0; i < batchCount; i++) {
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
        idbApp.enablePostButtons();
        if (batchesPosted > 0 && batchesNotPosted > 0) {
          // SOME batches of snaps seem to have posted, but not all
          showText('Some snaps have posted but not all. Check the app log for more information.');
        } else {
          showText(resultMessage);
        }
      } else {
        idbApp.enablePostButtons();
        if (!(appConfig.mailTo)) {
          window.alert('Please set an email address to send the snaps to using the Configure App button on the Add More Snaps screen.');
        } else {
          window.alert('Nothing to post.');
        }
      }
    });
  }

  var getConfig = async function getAllConfigItems () {
    var appConfig = { mailTo: '' };
    await dbPromise.then(function (db) {
      var tx = db.transaction('config', 'readonly');
      var store = tx.objectStore('config');
      // Just looping through a list of records, each one of which is just a name-value pair
      return store.openCursor();
    }).then(function stepThroughConfig (cursor) {
      if (!cursor) { return; }
      var fieldName = cursor.value.name;
      logDebug('Cursored at:' + fieldName);
      appConfig[fieldName] = cursor.value.value;

      return cursor.continue().then(stepThroughConfig);
    }).then(function () {
      return appConfig;
    });
    return appConfig;
  };

  function displaySnaps () {
    var s = '';
    clearText();
    dbPromise.then(function (db) {
      var tx = db.transaction('snaps', 'readonly');
      var store = tx.objectStore('snaps');
      return store.openCursor();
    }).then(function showSnaps (cursor) {
      if (!cursor) { return; }
      logDebug('Cursored at:' + cursor.value.title);
      /* <h2>Title</h2>
  <input type="text" id="title" size="30" maxlength="100"/> </br>
  <h2>Notes</h2>
  <textarea id="notes" rows="4" cols="38" maxlength="10000"> </textarea> </br> */
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
      s += '<p>  <button id="submit" class="itemButton" onclick="idbApp.deleteSnap(' +
         cursor.value.id + ')">Delete Snap</button> </p>';
      s += '</span>';

      return cursor.continue().then(showSnaps);
    }).then(function () {
      if (s === '') { s = '<p>No results.</p>'; }
      document.getElementById('notes').innerHTML = s;
    }).catch(function (e) {
      handleError('Error when attempting to display snaps: ' + e);
    }); // Have to have error logging here as this function has started its own promise chain.;
  }

  function displayApplog () {
    var s = '';
    clearText();
    dbPromise.then(function (db) {
      var tx = db.transaction('applog', 'readonly');
      var store = tx.objectStore('applog');
      return store.openCursor();
    }).then(function showLog (cursor) {
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

  /* function readSubmitResponseAsText (response) {
    if (response.url.search('offline.html') !== -1) {
      return 'Cannot submit notes as the target server appears to be unreachable.';
    }
    return response.text();
  }

  function validateResponse (response) {
    if (!response.ok) {
      // No point throwing an error as on the iPad you can't even get to the console without connecting to a Mac: throw Error(response.statusText);
      // Allow the response text to be shown instead...
    }
    return response;
  } */

  function showText (responseAsText) {
    var elems = document.querySelectorAll('[id="message"]');

    for (var i = 0; i < elems.length; i++) {
      // elems[i].textContent = responseAsText;
      elems[i].innerHTML = responseAsText;
    }
  }

  function clearText () {
    var elems = document.querySelectorAll('[id="message"]');

    for (var i = 0; i < elems.length; i++) {
      elems[i].textContent = '';
    }
  }

  /* Now superseded by handleError
  function logError (error) {
    console.log('Looks like there was a problem:', error);
  } */

  function previewPhoto () {
    var preview = document.getElementById('thumbnail');
    var previewDiv = document.getElementById('photo_preview');
    var file = document.getElementById('photo').files[0];
    var reader = new window.FileReader();

    reader.addEventListener('load', function () {
      preview.src = reader.result;
      previewDiv.style.display = 'block';
    }, false);

    if (file) {
      reader.readAsDataURL(file);
    }
  }

  async function processThenSaveConfig (postSaveFunc) {
    clearText();
    // The convention we have adopted, to keep it simple, is that the id of html element
    // containing the config value is the same as the name of the config item.
    var mailTo = getAddressList(); // Though there is a bit of special processing around email addresses.
    var appLogLevel = document.getElementById('appLogLevel').value;
    var defaultTitle = document.getElementById('defaultTitle').value;
    var batchSize = document.getElementById('batchSize').value;

    var config = [
      {
        name: 'mailTo',
        value: mailTo
      },
      {
        name: 'appLogLevel',
        value: appLogLevel
      },
      {
        name: 'defaultTitle',
        value: defaultTitle
      },
      {
        name: 'batchSize',
        value: batchSize
      }
    ];

    document.getElementById('save').disabled = true;

    await idbApp.saveConfig(config);

    if (postSaveFunc) postSaveFunc();
  }

  function getAddressList () {
    var addressList = '';
    var elems = document.querySelectorAll('[id="mailTo"]');

    for (var i = 0; i < elems.length; i++) {
      if (elems[i].value === '') continue; // Ignore any blank addresses
      if (addressList === '') {
        addressList += elems[i].value;
      } else { addressList += ';' + elems[i].value; }
    }
    logDebug('Email address list: ' + addressList);
    return addressList;
  }

  async function saveConfig (config) {
    dbPromise.then(function (db) {
      var tx = db.transaction('config', 'readwrite');
      var store = tx.objectStore('config');

      // It needs to be an update... not just adding things to a stack...
      // The config is just a JSON object, with each record comprising of name-value pairs...
      /* Config has the following structure
      var config = [
        {
          name: 'the name of the config item, e.g. mailTo',
          value: 'the value of the config ite,, e.g. myemail@mywebmail.com'
        }
      ]; */

      // Each config record is just a name-value pair.
      return Promise.all(config.map(function (configRecord) {
        logDebug('Adding config record for setting: ' + configRecord.name);
        if (configRecord.name === 'appLogLevel') {
          // Instantly set the value "in memory", so the app can use without having to retrieve from indexeddb.
          idbApp.setAppLogLevel(configRecord.value);
        }
        if (configRecord.name === 'defaultTitle') {
          // Instantly set the value "in memory", so the app can use without having to retrieve from indexeddb.
          idbApp.setDefaultTitle(configRecord.value);
        }
        return store.put(configRecord); // This should update using the name of the config field as a key, or add if the config field is not yet in the object store.
      })
      ).catch(function (e) {
        document.getElementById('save').disabled = false;
        tx.abort();
        handleError(e);
      }).then(function () {
        document.getElementById('save').disabled = false;
        logDebug('Config saved successfully!');
        document.getElementById('message').textContent = 'Config saved successfully';
      });
    });
  }

  function displayConfig () {
    var fieldName = '';
    clearText();
    document.getElementById('appLogLevel').value = 1; // Default app logging level to 1...if it is set it'll get reset as we read back the config settings below
    document.getElementById('batchSize').value = 10; // Default batch size to 10...if it is set it'll get reset as we read back the config settings below
    document.getElementById('defaultTitle').value = idbApp.getDefaultTitle(); // Default the default title to "MetaSnap: " or whatever the current value is the idbApp namespace.
    dbPromise.then(function (db) {
      var tx = db.transaction('config', 'readonly');
      var store = tx.objectStore('config');
      // Just looping through a list of records, each one of which is just a name-value pair
      return store.openCursor();
    }).then(function showConfig (cursor) {
      if (!cursor) { return; }
      fieldName = cursor.value.name;
      logDebug('Cursored at:' + fieldName);
      /* Special handling for potentially multiple email addresses */
      if (fieldName === 'mailTo') {
        var addressList = document.getElementById('addressList');
        var addresses = cursor.value.value.split(';');

        for (var i = 0; i < addresses.length; i++) {
          if (i === 0) {
            // Handle the first email address
            document.getElementById('mailTo').value = addresses[0];
          } else { // the rest...
            var anEmail = createEmailAddressAtIndex(i + 1, addresses[i]);
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

  function disablePostButtons () {
    var elems = document.querySelectorAll('[id="post"]');

    for (var i = 0; i < elems.length; i++) {
      elems[i].disabled = true;
    }

    var spinners = document.querySelectorAll('[id="loader"]');

    for (i = 0; i < spinners.length; i++) {
      spinners[i].style.display = 'block';
    }
  }

  function enablePostButtons () {
    var elems = document.querySelectorAll('[id="post"]');

    for (var i = 0; i < elems.length; i++) {
      elems[i].disabled = false;
    }

    var spinners = document.querySelectorAll('[id="loader"]');

    for (i = 0; i < spinners.length; i++) {
      spinners[i].style.display = 'none';
    }

    /* var spinner = document.getElementById('loader');
    if (spinner !== null) {
      spinner.style.display = 'none';
    } */
  }

  // Navigate in a Single Page App manner
  // As indexeddb use means that a lot of asynch processing
  // will be happening, and we don't want that being stopped
  // as we switch pages in a Multiple Page App!
  // htmlfragment is the path to the htmlfragment to fetch and
  // merge into the DOM.
  // postfunc is a function to run after navigation, usually
  // to merge data into the fragment...
  function navigate (htmlfragment, postfunc) {
    window.fetch(htmlfragment).then(function (response) {
      return response.text();
    }).then(function (content) {
      var elems = document.querySelectorAll('[id="pageContent"]');

      for (var i = 0; i < elems.length; i++) {
        elems[i].innerHTML = content;
      }

      if (postfunc) postfunc();
    }).catch(function (e) {
      handleError(e);
    });
  }

  function addEmail () {
    var addressList = document.getElementById('addressList');
    var addressCount = addressList.childElementCount;
    var newIndex = addressCount + 1;
    var anEmail = createEmailAddressAtIndex(newIndex);

    addressList.appendChild(anEmail);
  }

  function createEmailAddressAtIndex (newIndex, anAddress) {
    var anEmail = document.createElement('div');
    var attDivId = document.createAttribute('id');
    attDivId.value = 'anEmail' + newIndex;
    anEmail.setAttributeNode(attDivId);

    var newEmail = document.createElement('input');
    var attType = document.createAttribute('type');
    attType.value = 'email';
    newEmail.setAttributeNode(attType);
    var attId = document.createAttribute('id');
    attId.value = 'mailTo';
    newEmail.setAttributeNode(attId);
    var attSize = document.createAttribute('size');
    attSize.value = '44';
    newEmail.setAttributeNode(attSize);
    // Apparently the maximum allowed length of an email address is 320 characters
    var attMaxlength = document.createAttribute('maxlength');
    attMaxlength.value = '320';
    newEmail.setAttributeNode(attMaxlength);

    if (anAddress !== undefined) {
      newEmail.value = anAddress;
    }

    anEmail.appendChild(newEmail);

    var removeButton = document.createElement('button');
    var attClass = document.createAttribute('class');
    attClass.value = 'itemButton';
    removeButton.setAttributeNode(attClass);

    var attOnclick = document.createAttribute('onclick');
    attOnclick.value = "idbApp.removeEmail('anEmail" + newIndex + "')";
    removeButton.setAttributeNode(attOnclick);
    var node = document.createTextNode('Remove');
    removeButton.appendChild(node);
    anEmail.appendChild(removeButton);

    return anEmail;
  }

  function removeEmail (id) {
    var anEmail = document.getElementById(id);
    anEmail.remove();
  }

  return {
    reOpenApp: (reOpenApp),
    processPageAndSave: (processPageAndSave),
    getLocationThenSaveSnap: (getLocationThenSaveSnap),
    deleteSnap: (deleteSnap),
    saveSnap: (saveSnap),
    showSnaps: (showSnaps),
    showSnapsAfterSave: (showSnapsAfterSave),
    addSnap: (addSnap),
    displaySnaps: (displaySnaps),
    editSnaps: (editSnaps),
    postSnaps: (postSnaps),
    postSnapsAfterSave: (postSnapsAfterSave),
    previewPhoto: (previewPhoto),
    processThenSaveConfig: (processThenSaveConfig),
    saveConfig: (saveConfig),
    configAppAfterSave: (configAppAfterSave),
    displayConfig: (displayConfig),
    disablePostButtons: (disablePostButtons),
    enablePostButtons: (enablePostButtons),
    config: (config),
    navigate: (navigate),
    addEmail: (addEmail),
    removeEmail: (removeEmail),
    handleError: (handleError),
    logDebug: (logDebug),
    logInfo: (logInfo),
    logWarning: (logWarning),
    logError: (logError),
    saveLogEntry: (saveLogEntry),
    applogAfterSave: (applogAfterSave),
    clearAppLog: (clearAppLog),
    displayApplog: (displayApplog),
    applog: (applog),
    getAppLogLevel: (getAppLogLevel),
    setAppLogLevel: (setAppLogLevel),
    getDefaultTitle: (getDefaultTitle),
    setDefaultTitle: (setDefaultTitle)
  };
})();
