/* jshint node: true */
'use strict';



var MISSING_CREDENTIALS = 'No Cloudant credentials found';
var FAILED_CONNECTION = 'Cloudant connection failed';

/* Assume default credentials using dotenv */
var sgCredentials = {
  "pass"    : process.env.SENDGRID_API_KEY
};


for ( var key in dbCredentials ) {
    if ( ! dbCredentials[key] ) throw new Error( MISSING_CREDENTIALS );
}

var done = function ( error, cloudant ) {
    if ( error ) throw new Error( FAILED_CONNECTION + ': ' + error.message );
};

module.exports = sendgrid( dbCredentials, done );
