var showsnapsModule = (function () {
    'use strict';

    function pageDown() {
        let snapEndPos = 0;
        let endPosEl = document.getElementById('snapEndPos');
        if (endPosEl) { snapEndPos = parseInt(endPosEl.innerHTML) };
        let snapStartPos = snapEndPos + 1;
        //snapEndPos = snapStartPos + 10; // the plus here is actually page size -1 because the range is inclusive
        snapEndPos = snapEndPos + 10;
        mainModule.displaySnaps(snapStartPos, snapEndPos);
    }

    function pageUp() {
        let snapStartPos = 0;
        let startPosEl = document.getElementById('snapStartPos');
        if (startPosEl) { snapStartPos = parseInt(startPosEl.innerHTML) };
        if (snapStartPos == 1) return; // Do nothing, we are already paged to the top
        let snapEndPos = snapStartPos - 1; //If this line is reachable, and snapStartPos < 1 are never written to the page, snapStartPos must >= 2
        snapStartPos = snapStartPos - 10;
        if (snapStartPos < 0) snapStartPos = 1; // Bit of defensive coding
        mainModule.displaySnaps(snapStartPos, snapEndPos);
    }

    function processPageAndPageUp() {
        let actionFunc = function () {
            pageUp();
        };
        editSnaps(actionFunc);
    }

    function processPageAndPageDown() {
        let actionFunc = function () {
            pageDown();
        };
        editSnaps(actionFunc);
    }

    function editSnaps(actionFunc) {
        mainModule.clearText();
        /* Iterate around the snaps on the page creating a map of the snaps keyed by id */
        let snaps = document.getElementsByClassName('snap');
        let snapsMap = new Map();
        let snapId;
        let snapTitle;
        let snapNote;
        let s = '';
        let editsHaveErrored = false;

        for (let i = 0; i < snaps.length; i++) {
            snapId = snaps[i].id;

            /* This should find the relevant info from within the first element of the given id:
            at any level within the snap, so should be resistant to be being broken by any
            extra formatting */
            snapTitle = snaps[i].querySelector('#editableTitle').value;
            snapNote = snaps[i].querySelector('#editableNote').value;

            snapsMap.set(snapId, { title: snapTitle, note: snapNote });
        }

        /* We now have the snapsMap to process, i.e. we've grabbed what we need from the current
        page... therefore we can now page up or down while the changes are saved into indexeddb in background...
        OR will that cause contention or race conditions...giving that the page up or down is going to read back data...
        mind you, it won't be displaying the current page's data any more, so not pulling back something you just changed
        shouldn't be possible... */

        if (actionFunc) actionFunc();

        /* Now we have the snap map loop around a cursor loop making any changes */

        mainModule.dbPromise.then(function (db) {
            let tx = db.transaction('snaps', 'readwrite');
            let store = tx.objectStore('snaps');
            return store.openCursor();
        }).then(async function editSnaps(cursor) {
            if (!cursor) { return; }
            const updateData = cursor.value;

            mainModule.logDebug('Cursored at:' + updateData.title);

            let thisSnap = snapsMap.get('' + updateData.id);
            if (thisSnap) { // if the snap in the cursor can be found in the map... it won't be if pagination has taken the snap out of range!
                let dataChanged = false;

                if (updateData.title !== thisSnap.title) {
                    updateData.title = thisSnap.title;
                    dataChanged = true;
                }

                if (updateData.note !== thisSnap.note) {
                    updateData.note = thisSnap.note;
                    dataChanged = true;
                }

                // If either the title or the note has changed you need to edit the exif metadata here
                if (dataChanged) {
                    try {
                        updateData.photoasdataurl = writeExifMetadata(thisSnap.title, thisSnap.note, updateData.photoasdataurl, updateData.latitude, updateData.longitude, updateData.datetime);
                    } catch (e) {
                        // Error should already have been logged by the writeExifMetadata method
                        // Don't update the photo data...
                    }
                }

                /* This function is running in background anyway, but JavaScript is single threaded.
                I want to know when all the snap updates have finished, so I'm just going to wait for them
                and not complicate things by pretending that each indiviudal snap update is somehow happening
                in parallel (they aren't). */

                if (dataChanged) {
                    await cursor.update(updateData).then(function (updateResult) {
                        mainModule.logDebug('Successfully updated a snap with id ' + updateResult + '.');
                    }).catch(function (e) {
                        editsHaveErrored = true;
                        mainModule.handleError('Error when attempting to update snaps: ' + e);
                    });
                }
            }

            return cursor.continue().then(editSnaps);
        }).then(function () {
            if (!editsHaveErrored) {
                s = 'Any edited snaps saved.';
            } else {
                s = 'Some snaps edits have failed. Please see the app log.';
            }
            mainModule.showText(s);
        }).catch(function (e) {
            s = 'Error when attempting to save edited snaps';
            mainModule.handleError(s + ': ' + e);
            mainModule.showText(s + '.');
        });
    }
    return {
        processPageAndPageUp: (processPageAndPageUp),
        processPageAndPageDown: (processPageAndPageDown),
        editSnaps: (editSnaps),

    };
})();
