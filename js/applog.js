var applogModule = (function () {
    'use strict';

    function clearAppLog() {
        mainModule.dbPromise.then(function (db) {
            let tx = db.transaction('applog', 'readwrite');
            let store = tx.objectStore('applog');
            store.clear();
        }).catch(function (e) {
            mainModule.handleError(e);
        }).then(function () {
            document.getElementById('logentries').innerHTML = '<p>No results.</p>';
        });
    }

    return {

        clearAppLog: (clearAppLog),

    };
})();
