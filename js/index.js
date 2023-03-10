var indexModule = (function () {
    'use strict';
    /* This function just ensures everything is set correctly when the app is re-opened. */
    /* Remember, this app is following a single page app pattern with the index page as
    the template, so, once the app has initially been opened, only the pageContent
    div content gets "reloaded": JS outside of that should only run when the page is intially
    loaded/the app opened. Subsequent revisits to the "Add Snap" index page shouldn't cause this javascript to
    re-run */
    async function reOpenApp() {
        let startingAppLogLevel = 1;
        let startingDefaultTitle = mainModule.getDefaultTitle();
        let appConfig;
        appConfig = await mainModule.getConfig();
        if (appConfig && appConfig.appLogLevel && (appConfig.appLogLevel >= 0 && appConfig.appLogLevel <= 3)) {
            startingAppLogLevel = appConfig.appLogLevel;
        }
        if (appConfig && (appConfig.defaultTitle || appConfig.defaultTitle === '')) {
            startingDefaultTitle = appConfig.defaultTitle;
        }
        mainModule.setAppLogLevel(startingAppLogLevel);
        mainModule.setDefaultTitle(startingDefaultTitle);

        /* Set the snap title on the index page */
        let titleElement = document.getElementById('title');
        if (titleElement) {
            titleElement.value = startingDefaultTitle;
        }
    }

    function processPageAndSave(postSaveFunc) {
        let thisSnap = {
            title: document.getElementById('title').value,
            notes: document.getElementById('notes').value,
            photoasdataurl: document.getElementById('thumbnail').src
        };

        getLocationThenSaveSnap(thisSnap, postSaveFunc);
    }

    async function getLocationThenSaveSnap(thisSnap, postSaveFunc) {
        let title = thisSnap.title;
        let notes = thisSnap.notes;
        let photoasdataurl = thisSnap.photoasdataurl;

        // The next few lines are needed as, if no photo as been added, then the src of the thumbnail is the url and the index page html becomes the "photo"
        if (photoasdataurl.substring(0, 5).toLowerCase() !== 'data:') {
            photoasdataurl = '';
        }

        let trimmedTitle = title.trim();
        // Skip save if the snap only comprises of a default title or a blank title and has no notes and no photo...
        if ((trimmedTitle.trim() === '' || trimmedTitle === mainModule.getDefaultTitle().trim()) &&
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
                mainModule.logDebug('Geolocation did the callback');
                await saveSnap(title, notes, photoasdataurl, location);
                if (postSaveFunc) postSaveFunc();
            }, async function () { await saveSnap(title, notes, photoasdataurl); if (postSaveFunc) postSaveFunc(); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }); // Second call is for no location
        } else {
            await saveSnap(title, notes, photoasdataurl);
            if (postSaveFunc) postSaveFunc();
        }
    }

    async function saveSnap(title, notes, photoasdataurl, location) {
        await mainModule.dbPromise.then(async function (db) {
            let tx = db.transaction('snaps', 'readwrite');
            let store = tx.objectStore('snaps');
            let latitude = 'Unknown';
            let longitude = 'Unknown';
            if (location) {
                latitude = location.coords.latitude;
                longitude = location.coords.longitude;
            }
            let datetime = new Date();

            try {
                var enrichedphotoasdataurl = mainModule.writeExifMetadata(title, notes, photoasdataurl, location.coords.latitude, location.coords.longitude, datetime);
            } catch (e) {
                // Error should have already been logged by the writeExifMEtadata method
                // We just need to restore the original photo metadata just in case...
                enrichedphotoasdataurl = photoasdataurl;
            }
            let items = [
                {
                    title: title,
                    note: notes,
                    photoasdataurl: enrichedphotoasdataurl,
                    datetime: datetime,
                    latitude: latitude,
                    longitude: longitude
                }
            ];
            return await Promise.all(items.map(async function (item) {
                mainModule.logDebug('Adding metasnap with title: ' + item.title);
                return await store.add(item);
            })
            ).then(function () {
                mainModule.logDebug('Snap added successfully!');
                document.getElementById('title').value = mainModule.getDefaultTitle();
                document.getElementById('notes').value = '';
                document.getElementById('thumbnail').src = '';
                document.getElementById('photo_preview').style.display = 'none';
            }).catch(function (e) {
                mainModule.handleError(e);
                window.alert('Unable to save snaps. The error is' + e);
                tx.abort();
            }).finally(function () {
                document.getElementById('save').disabled = false;
                document.getElementById('show').disabled = false;
            });
        });
    }

    function showSnapsAfterSave() {
        let postSaveFunc = function () {
            showSnaps();
        };
        indexModule.processPageAndSave(postSaveFunc);
    }

    function showSnaps() {
        mainModule.navigate('showsnapsfragment.html', mainModule.displaySnaps(1, 10));
    }

    function configAppAfterSave() {
        let postSaveFunc = function () {
            mainModule.config();
        };
        indexModule.processPageAndSave(postSaveFunc);
    }

    function postSnapsAfterSave() {
        mainModule.clearText();

        mainModule.disablePostButtons();

        let postAfterSave = function () {
            mainModule.postSnaps();
        };
        indexModule.processPageAndSave(postAfterSave);
    }

    function previewPhoto() {
        let preview = document.getElementById('thumbnail');
        let previewDiv = document.getElementById('photo_preview');
        let file = document.getElementById('photo').files[0];
        let reader = new window.FileReader();

        reader.addEventListener('load', function () {
            preview.src = reader.result;
            previewDiv.style.display = 'block';
        }, false);

        if (file) {
            reader.readAsDataURL(file);
        }
    }
    return {
        reOpenApp: (reOpenApp),
        processPageAndSave: (processPageAndSave),
        showSnapsAfterSave: (showSnapsAfterSave),
        postSnapsAfterSave: (postSnapsAfterSave),
        previewPhoto: (previewPhoto),
        configAppAfterSave: (configAppAfterSave),

    };
})();


