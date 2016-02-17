/**
 * Created by Ed on 1/21/2016.
 */
/* jshint node:true */
'use strict';

var path        = require('path');
var Promise     = require('promise');

require('dotenv').config({ 'path': path.resolve( __dirname, '../.env' ) });

var core            = path.resolve( __dirname, '../src/core' );
var UserService     = require( path.join( core, 'service/user-service' ) );
var UserRepository  = require( path.join( core, 'adapters/persistence/cloudant-user-repository' ) );
var AgencyService     = require( path.join( core, 'service/agency-service' ) );
var AgencyRepository  = require( path.join( core, 'adapters/persistence/cloudant-agency-repository' ) );
/** This is the main module we will be using **/
var userService = new UserService( new UserRepository() );
var agencyService = new AgencyService( new AgencyRepository() );


/** Light sanity check **/
if ( process.argv.length != 4 ) {
    console.error(
        "Invalid number of arguments:\nUsage: node",
        path.basename( process.argv[1] ), "<username> <password>"
    );
    return;
}

agencyService.searchAgencies("name:Pinecrest").then( function ( results ) {
        var agencies = results.agencies;
        var userDTO = userService.formatDTO({
            "username": process.argv[2],
            "password": process.argv[3],
            "email": process.argv[2] + "@example.com",
            "tier": 3,
            "agency": agencies[0].id
        });

        console.log(
            "Attempting to create user with the following document properties: \n",
            JSON.stringify( userDTO, null, 4 )
        );

        /** Try to register the user **/
        userService.registerUser( userDTO ).then( function ( response ) {
            console.log( "Created user -- Cloudant Response is: \n", response );
        }).catch( function ( error ) {
            console.error( "An error occurred -- Cloudant Response Error: \n", error );
        });

    })
    .catch( function ( error ) {
        next( error );
    });

/** These are the required fields per core/domain/user.js **/
