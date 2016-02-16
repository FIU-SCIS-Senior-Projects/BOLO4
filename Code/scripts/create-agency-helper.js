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
console.log(process.argv.length);

/** Light sanity check **/
if ( process.argv.length != 3 ) {
    console.error(
        "Invalid number of arguments:\nUsage: node",
        path.basename( process.argv[1] ), "<agency_id>"
    );
    return;
}

/** These are the required fields per core/domain/user.js **/
var agencyDTO = agencyService.formatDTO({
    "name": "Pinecrest",
    "agency_id": process.argv[2],
    "city": "Miami",
    "state": "Florida",
    "isActive": true
});

console.log(
    "Attempting to create Agency with the following document properties: \n",
    JSON.stringify( agencyDTO, null, 4 )
);

/** Try to register the user **/
agencyService.createAgency( agencyDTO,[] ).then( function (response,error ) {
    if(error) {
        console.log( "Created Agency -- Cloudant Response is: \n", response );

    }
    else
       throw error;


    console.log("error creating agency " + error);
}).catch( function ( error ) {
    console.error( "An error occurred -- Cloudant Response Error: \n", error );
});
