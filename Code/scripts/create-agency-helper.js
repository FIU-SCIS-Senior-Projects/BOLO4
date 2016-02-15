/**
 * Created by Ed on 1/21/2016.
 */
/* jshint node:true */
'use strict';
var path        = require('path');
var Promise     = require('promise');

require('dotenv').config({ 'path': path.resolve( __dirname, '../.env' ) });

var core            = path.resolve( __dirname, '../src/core' );
var AgencyService     = require( path.join( core, 'service/agency-service' ) );
var AgencyRepository  = require( path.join( core, 'adapters/persistence/cloudant-agency-repository' ) );

/** This is the main module we will be using **/
var agencyService = new AgencyService( new AgencyRepository() );

/** Light sanity check **/
if ( process.argv.length != 5 ) {
    console.error(
        "Invalid number of arguments:\nUsage: node",
        path.basename( process.argv[1] ), "<agency_name> <city> <state>"
    );
    return;
}

/** These are the required fields per core/domain/user.js **/
var agencyDTO = agencyService.formatDTO({
    "name": process.argv[2],
    "city": process.argv[3],
    "state": process.argv[4],
    "isActive": true
});

console.log(
    "Attempting to create Agency with the following document properties: \n",
    JSON.stringify( agencyDTO, null, 4 )
);

/** Try to register the user **/
agencyService.createAgency( agencyDTO,[] ).then( function ( response ) {
    console.log( "Created Agency -- Cloudant Response is: \n", response );
}).catch( function ( error ) {
    console.error( "An error occurred -- Cloudant Response Error: \n", error );
});
