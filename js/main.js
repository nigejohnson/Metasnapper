/*
"MetaSnapper" : A Progressive Web Application demonstrator.
*/
var idbApp = (function () {
  'use strict';

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
  var dbPromise = window.idb.open('metasnaps', 1, function (upgradeDb) {
    switch (upgradeDb.oldVersion) {
      case 0:
        console.log('Creating the snaps object store');
        upgradeDb.createObjectStore('snaps', { keyPath: 'id', autoIncrement: 'true' });
        console.log('Creating the config object store');
        upgradeDb.createObjectStore('config', { keyPath: 'name' });
        break;
      case 1:
        // So here would go the code to take an old version 1 db up to the latest version
        break;
    }
  });

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
    // A snap must at least have a title...
    if (title.trim() === '') {
      if (postSaveFunc) postSaveFunc();
      return;
    }
    document.getElementById('save').disabled = true;
    document.getElementById('show').disabled = true;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async function (location) {
        console.log('Geolocation did the callback');
        await idbApp.saveSnap(title, notes, photoasdataurl, location);
        if (postSaveFunc) postSaveFunc();
      }, async function () { await idbApp.saveSnap(title, notes, photoasdataurl); if (postSaveFunc) postSaveFunc(); }, { timeout: 5000 }); // Second call is for no location
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
      console.log(e);
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
        console.log('Adding item: ', item);
        return await store.add(item);
      })
      ).then(function () {
        console.log('Snap added successfully!');
        document.getElementById('title').value = '';
        document.getElementById('notes').value = '';
        document.getElementById('thumbnail').src = '';
        document.getElementById('photo_preview').style.display = 'none';
      }).catch(function (e) {
        console.log(e);
        window.alert('Unable to save snaps. The error is' + e);
        tx.abort();
      }).finally(function () {
        document.getElementById('save').disabled = false;
        document.getElementById('show').disabled = false;
      });
    });
  }

  function addSnap () {
    window.fetch('/app/index.html'); // Fetch to ensure fetched from web or cache appropriately by intercepting service wroker.
    window.location.href = 'index.html';
    document.getElementById('photo_preview').style.display = 'none';
  }

  function showSnaps () {
    if (document.getElementById('title').value.trim() !== '' || document.getElementById('notes').value.trim() !== '' ||
    document.getElementById('thumbnail').src.substring(0, 5).toLowerCase() === 'data:') {
      window.alert('Please clear or finish and save your snap before proceeding');
      return;
    }
    window.fetch('/app/showsnaps.html'); // Fetch to ensure fetched from web or cache appropriately by intercepting service worker.
    window.location.href = 'showsnaps.html';
  }

  function config () {
    if (document.getElementById('title').value.trim() !== '' || document.getElementById('notes').value.trim() !== '' ||
    document.getElementById('thumbnail').src.substring(0, 5).toLowerCase() === 'data:') {
      window.alert('Please clear or finish and save your snap before proceeding');
      return;
    }
    window.fetch('/app/config.html'); // Fetch to ensure fetched from web or cache appropriately by intercepting service worker.
    window.location.href = 'config.html';
  }

  function postSnapsAfterSave () {
    clearText();
    idbApp.disablePostButtons();

    var postAfterSave = function () {
      idbApp.postSnaps();
    };
    idbApp.processPageAndSave(postAfterSave);
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

    var notesList = [];

    dbPromise.then(function (db) {
      var tx = db.transaction('snaps', 'readonly');
      var store = tx.objectStore('snaps');
      return store.openCursor();
    }).then(function showRange (cursor) {
      if (!cursor) { return; }
      console.log('Cursored at:', cursor.value.title);

      var noteRecord = {
        title: cursor.value.title,
        note: cursor.value.note,
        photoasdataurl: cursor.value.photoasdataurl,
        datetime: cursor.value.datetime,
        latitude: cursor.value.latitude,
        longitude: cursor.value.longitude
      };

      notesList.push(noteRecord);

      return cursor.continue().then(showRange);
    }).then(getConfig).then(function (appConfig) {
      if (notesList.length > 0 && appConfig.mailTo) {
        // NB If adding any CUSTOM headers ensure they are set within accept-headers in any receiving CORS enabled server!
        // NB DO NOT set a content-type header of application/json here, however tempting that might seem
        // as my cors server would not parse the json body with that set! Possibly the photos are not
        // compliant with application/json even when base 64 encoded.
        window.fetch(fnserver, {
          method: 'POST',
          headers: { 'configured-mailto': appConfig.mailTo },
          body: JSON.stringify(notesList)

        })
          .then(validateResponse)
          .then(readSubmitResponseAsText)
          .then(showText)
          .catch(logError).finally(function () {
            idbApp.enablePostButtons();
          });
      } else {
        idbApp.enablePostButtons();
        if (!(appConfig.mailTo)) {
          window.alert('Please set an email address to send the snaps to using the Configure App button on the Add More Snaps screen.');
        } else {
          window.alert('Nothing to post.');
        }
      }
    }).catch(function () {
      idbApp.enablePostButtons();
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
      console.log('Cursored at:', fieldName);
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
    }).then(function showRange (cursor) {
      if (!cursor) { return; }
      console.log('Cursored at:', cursor.value.title);
      s += '<h2>' + cursor.value.title + '</h2>';
      s += '<p>' + cursor.value.note + '</p>';
      s += '<p>   <img src="' + cursor.value.photoasdataurl + '"/></p>';
      s += '<h3> Time and Space </h3>';
      s += '<p> Time:' + cursor.value.datetime + '</p>';
      s += '<p> Latitude:' + cursor.value.latitude + '</p>';
      s += '<p> Longitude:' + cursor.value.longitude + '</p>';
      if (cursor.value.latitude !== 'Unknown' && cursor.value.longitude !== 'Unknown') {
        s += '<p><a href="https://maps.google.com/maps?&z=15&q=' +
          cursor.value.latitude + '+' + cursor.value.longitude + '&ll=' +
          cursor.value.latitude + '+' + cursor.value.longitude +
          '" target="_blank"> Show Location </a></p>';
      }
      s += '<p>  <button id="submit" onclick="idbApp.deleteSnap(' +
         cursor.value.id + ')">Delete Snap</button> </p>';

      return cursor.continue().then(showRange);
    }).then(function () {
      if (s === '') { s = '<p>No results.</p>'; }
      document.getElementById('notes').innerHTML = s;
    });
  }

  function readSubmitResponseAsText (response) {
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
  }

  function showText (responseAsText) {
    var elems = document.querySelectorAll('[id="message"]');

    for (var i = 0; i < elems.length; i++) {
      elems[i].textContent = responseAsText;
    }
  }

  function clearText () {
    var elems = document.querySelectorAll('[id="message"]');

    for (var i = 0; i < elems.length; i++) {
      elems[i].textContent = '';
    }
  }

  function logError (error) {
    console.log('Looks like there was a problem:', error);
  }

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

  function processThenSaveConfig () {
    clearText();
    var mailTo = document.getElementById('mailTo').value;

    if (mailTo.trim() === '') {
      return;
    }

    var config = [
      {
        name: 'mailTo',
        value: mailTo
      }];

    document.getElementById('save').disabled = true;

    idbApp.saveConfig(config);
  }

  function saveConfig (config) {
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
        console.log('Adding config record: ', configRecord);
        return store.put(configRecord); // This should update using the name of the config field as a key, or add if the config field is not yet in the object store.
      })
      ).catch(function (e) {
        document.getElementById('save').disabled = false;
        tx.abort();
        console.log(e);
      }).then(function () {
        document.getElementById('save').disabled = false;
        console.log('Config saved successfully!');
        document.getElementById('message').textContent = 'Config saved successfully';
      });
    });
  }

  function displayConfig () {
    var fieldName = '';
    clearText();
    dbPromise.then(function (db) {
      var tx = db.transaction('config', 'readonly');
      var store = tx.objectStore('config');
      // Just looping through a list of records, each one of which is just a name-value pair
      return store.openCursor();
    }).then(function showRange (cursor) {
      if (!cursor) { return; }
      fieldName = cursor.value.name;
      console.log('Cursored at:', fieldName);
      document.getElementById(fieldName).value = cursor.value.value;

      return cursor.continue().then(showRange);
    });
  }

  function disablePostButtons () {
    var elems = document.querySelectorAll('[id="post"]');

    for (var i = 0; i < elems.length; i++) {
      elems[i].disabled = true;
    }
  }

  function enablePostButtons () {
    var elems = document.querySelectorAll('[id="post"]');

    for (var i = 0; i < elems.length; i++) {
      elems[i].disabled = false;
    }
  }

  return {
    processPageAndSave: (processPageAndSave),
    getLocationThenSaveSnap: (getLocationThenSaveSnap),
    deleteSnap: (deleteSnap),
    saveSnap: (saveSnap),
    showSnaps: (showSnaps),
    addSnap: (addSnap),
    displaySnaps: (displaySnaps),
    postSnaps: (postSnaps),
    postSnapsAfterSave: (postSnapsAfterSave),
    previewPhoto: (previewPhoto),
    processThenSaveConfig: (processThenSaveConfig),
    saveConfig: (saveConfig),
    displayConfig: (displayConfig),
    disablePostButtons: (disablePostButtons),
    enablePostButtons: (enablePostButtons),
    config: (config)
  };
})();
