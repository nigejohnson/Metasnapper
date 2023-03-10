var configModule = (function () {
    'use strict';

    function addEmail() {
        let addressList = document.getElementById('addressList');
        let addressCount = addressList.childElementCount;
        let newIndex = addressCount + 1;
        let anEmail = mainModule.createEmailAddressAtIndex(newIndex);

        addressList.appendChild(anEmail);
    }

    function removeEmail(id) {
        let anEmail = document.getElementById(id);
        anEmail.remove();
    }

    function applogAfterSave() {
        let postSaveFunc = function () {
            applog();
        };
        configModule.processThenSaveConfig(postSaveFunc);
    }

    function applog() {
        mainModule.navigate('applogfragment.html', mainModule.displayApplog);
    }

    function getAddressList() {
        let addressList = '';
        let elems = document.querySelectorAll('[id="mailTo"]');

        for (let i = 0; i < elems.length; i++) {
            if (elems[i].value === '') continue; // Ignore any blank addresses
            if (addressList === '') {
                addressList += elems[i].value;
            } else { addressList += ';' + elems[i].value; }
        }
        mainModule.logDebug('Email address list: ' + addressList);
        return addressList;
    }

    async function processThenSaveConfig(postSaveFunc) {
        mainModule.clearText();
        // The convention we have adopted, to keep it simple, is that the id of html element
        // containing the config value is the same as the name of the config item.
        let mailTo = getAddressList(); // Though there is a bit of special processing around email addresses.
        let appLogLevel = document.getElementById('appLogLevel').value;
        let defaultTitle = document.getElementById('defaultTitle').value;
        let batchSize = document.getElementById('batchSize').value;

        let config = [
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

        await saveConfig(config);

        if (postSaveFunc) postSaveFunc();
    }

    async function saveConfig(config) {
        mainModule.dbPromise.then(function (db) {
            let tx = db.transaction('config', 'readwrite');
            let store = tx.objectStore('config');

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
                mainModule.logDebug('Adding config record for setting: ' + configRecord.name);
                if (configRecord.name === 'appLogLevel') {
                    // Instantly set the value "in memory", so the app can use without having to retrieve from indexeddb.
                    mainModule.setAppLogLevel(configRecord.value);
                }
                if (configRecord.name === 'defaultTitle') {
                    // Instantly set the value "in memory", so the app can use without having to retrieve from indexeddb.
                    mainModule.setDefaultTitle(configRecord.value);
                }
                return store.put(configRecord); // This should update using the name of the config field as a key, or add if the config field is not yet in the object store.
            })
            ).catch(function (e) {
                document.getElementById('save').disabled = false;
                tx.abort();
                mainModule.handleError(e);
            }).then(function () {
                document.getElementById('save').disabled = false;
                mainModule.logDebug('Config saved successfully!');
                document.getElementById('message').textContent = 'Config saved successfully';
            });
        });
    }
    return {
        processThenSaveConfig: (processThenSaveConfig),
        addEmail: (addEmail),
        removeEmail: (removeEmail),
        applogAfterSave: (applogAfterSave),
    };
})();
