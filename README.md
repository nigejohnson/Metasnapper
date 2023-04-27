# Metasnapper

This is an example Progressive Web Application.
It is intended to demonstrate that it is possible to build a fully functional mobile application, which is also capable of working offline when there is no internet connection, using only JavaScript, HMTL and CSS, simply by conforming to Progressive Web Application approaches and standards.
The use case implemented is the adding of metadata to photos. Metadata is both bundled with the photos as a "metasnap" and also written into the JPEG of the photo itself, in accordance with JPEG standards, using a 3rd party JavaScript library. This use case enables the demonstration of the following application features:
-	Integration with hardware on the device: specifically, the camera (to take the photos) and GPS (to capture geolocation metadata).
-	Offline storage of data on the device itself, using indexedDB, specifically the photos and associated metadata.
-	Integration with a cloud-based web service, specifically an email sending service, to distribute the photos.
-	Graceful handling of situations where the email sending service is unavailable, e.g., due to lack of connectivity (*).
-   Use of local offline storage to store configuration settings and diagnostic logging for the application itself.
-   Simple integration with Google Maps, via a "Show Location" link, to prove the metasnaps contain correct locational data. 
> (* The email sending service is called Metasnapper-server, and the source code, built using the Node Express framework, is here: nigejohnson/Metasnapper-server (github.com). An alternative version, using the Node Hapi framework is here: nigejohnson/Hapi-metasnapper-server: A server for the "metasnapper" PWA proof of concept but written using the Hapi framework (github.com). ) 

## Prerequisites
A git install so that the repo can easily be cloned locally, e.g., https://git-scm.com/download/win.
To host this application locally a local web server of some form is needed.
To satisfy this pre-requisite during development, the node http-server package was used, and this is also the package assumed by the local start cmd scripts.
The recommended prerequisites are therefore as follows:
-	A node and node package manager (npm) install, e.g., https://nodejs.org/en.
-	An install of the http-server package: "npm install http-server -g" at a command prompt.

## Setup
Git clone the repo to a suitable local folder: git clone https://github.com/nigejohnson/Metasnapper.git

### Development
Install and use a suitable IDE. Visual Studio Code was used during the actual development.

### Test
To continue to work offline, a Progressive Web App needs to be cached by a local browser engine. The application therefore extensively caches itself locally. To see the effects of any changes you have made to the application, you must therefore do the following:
-	Add any new resources you have created to the list of "precacheResources" in the service-worker.js.
-	Update the "cacheName" in service-worker.js every time you want to test a change.
-	Ensure that the local web server hosting the application is running, so that it can redeploy the app to your browser.
-	Fully refresh the application in the browser (e.g., Ctrl-F5 twice).
-	To test that the application is functioning correctly offline, simply shutdown the local web server, and continue to test the application in the browser.

## Running in development
1.	Inspect the localstart.cmd, and make any edits necessary for your local environment (no edits should be necessary if you have installed the http-server package as your local web server).
2.	Open a command prompt in the root folder of the Metasnapper project, i.e., where the localstart.cmd file itself is located.
3.	Type localstart.cmd at the command line.
4.	Type http://localhost:8080 into a browser. The application should work in all modern, PWA complaint browsers such as Edge, Chrome, Safari/Webkit or Firefox. 
5.	If testing on a laptop rather than on a mobile device (such as a smartphone or an iPad) you won’t normally be able to take a photo, but you will be able to select an already existent image from your laptop instead.

## Running tests
There are currently no automated tests. Sorry: that just wasn't as interesting as the PWA features!

## Deploying to a device
Currently deployment is via the Back4App free tier (previously it was via the Heroku free tier until that was discontinued).
Back4App reads the code to deploy directly from the master branch of this github repo.
A simple dockerfile, included in the root of this folder, tells Back4App how to build and launch the app.
(NB, just as was the case with Heroku, Back4App doesn't support pure HMTL/CSS/JS apps, so the app has to be initially launched as PHP).
To install the latest version of the app (once it has been pushed to github) "Deploy the latest commit" in the Back4App applicaiton dashboard.
Then, on your target mobile device, navigate to the application url displayed in the Back4App application dashboard in a browser (Safari is recommended for an Apple device) and take the device specific steps to install the app on the device home screen. The app should then behave like any locally installed mobile app. 
Simplified deployment is one of the big advantages of the PWA model. 

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

>Contains public sector information licensed under the Open Government licence v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable information providers in the public sector to license the use and re-use of their information under a common open licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
