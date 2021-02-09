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

  /* function addSnap () {
    window.fetch('index.html'); // Fetch to ensure fetched from web or cache appropriately by intercepting service wroker.
    window.location.href = 'index.html';
    document.getElementById('photo_preview').style.display = 'none';
  } */

  /** To allow the index page, which is our starting page for the app, to bootstrap itself
   * into existence without first having to run some javascript to merge a fragement into a template
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

      if (postfunc) postfunc();
    }).catch(function (e) {
      console.log(e);
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
      s += '<p>  <button id="submit" class="itemButton" onclick="idbApp.deleteSnap(' +
         cursor.value.id + ')">Delete Snap</button> </p>';

      return cursor.continue().then(showRange);
    }).then(function () {
      if (s === '') { s = '<p>No results.</p>'; }
      document.getElementById('notes').innerHTML = s;
    }).catch(function (e) {
      console.log('Error when attempting to display snaps: ' + e);
    }); // Have to have error logging here as this function has started its own promise chain.;
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
    // var mailTo = document.getElementById('mailTo').value;

    var mailTo = getAddressList();

    /* Allow the user to blank all values should they so choose...
    if (mailTo.trim() === '') {
      return;
    } */

    var config = [
      {
        name: 'mailTo',
        value: mailTo
      }];

    document.getElementById('save').disabled = true;

    idbApp.saveConfig(config);
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
    console.log(addressList);
    return addressList;
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
        document.getElementById(fieldName).value = cursor.value.value;
      }

      return cursor.continue().then(showRange);
    }).catch(function (e) {
      console.log('Error when attempting to display config: ' + e);
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
      console.log(e);
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
    processPageAndSave: (processPageAndSave),
    getLocationThenSaveSnap: (getLocationThenSaveSnap),
    deleteSnap: (deleteSnap),
    saveSnap: (saveSnap),
    showSnaps: (showSnaps),
    showSnapsAfterSave: (showSnapsAfterSave),
    addSnap: (addSnap),
    displaySnaps: (displaySnaps),
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
    removeEmail: (removeEmail)
  };
})();
