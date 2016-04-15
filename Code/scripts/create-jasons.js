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
var agencyService = new AgencyService( new AgencyRepository() );
var userService = new UserService( new UserRepository(), agencyService );



// /** Light sanity check **/
// if ( process.argv.length != 4 ) {
//     console.error(
//         "Invalid number of arguments:\nUsage: node",
//         path.basename( process.argv[1] ), "<username> <password>"
//     );
//     return;
// }

agencyService.searchAgencies("name:Pinecrest").then( function ( response ) {
        var agencies = response.agencies;
        var rootDTO = userService.formatDTO({
            "username": "jason4",
            "password": "Jasoncohen4",
            "fname" : "Jason",
            "lname" : "Cohen",
            "email": "jasoncohen4@example.com",
            "tier": 4,
            "agency": agencies[0].id,
            "agencyName" : agencies[0].name,
            "badge"     : "officerBadge",
            "sectunit"  : "officerUnit",
            "ranktitle" : "officerRank"
        });

        var adminDTO = userService.formatDTO({
          "username": "jason3",
          "password": "Jasoncohen3",
          "fname" : "Jason",
          "lname" : "Cohen",
          "email": "jasoncohen3@example.com",
          "tier": 3,
          "agency": agencies[0].id,
          "agencyName" : agencies[0].name,
          "badge"     : "officerBadge",
          "sectunit"  : "officerUnit",
          "ranktitle" : "officerRank"
        });

        var superDTO = userService.formatDTO({
          "username": "jason2",
          "password": "Jasoncohen2",
          "fname" : "Jason",
          "lname" : "Cohen",
          "email": "jasoncohen2@example.com",
          "tier": 2,
          "agency": agencies[0].id,
          "agencyName" : agencies[0].name,
          "badge"     : "officerBadge",
          "sectunit"  : "officerUnit",
          "ranktitle" : "officerRank"
        });

        var officerDTO = userService.formatDTO({
          "username": "jason1",
          "password": "Jasoncohen1",
          "fname" : "Jason",
          "lname" : "Cohen",
          "email": "jasoncohen1@example.com",
          "tier": 1,
          "agency": agencies[0].id,
          "agencyName" : agencies[0].name,
          "badge"     : "officerBadge",
          "sectunit"  : "officerUnit",
          "ranktitle" : "officerRank"
        });
        console.log(
            "Attempting to create users..."
        );

        /** Try to register the users **/
        userService.registerUser( rootDTO ).then( function ( response ) {
            console.log( "Created user -- Cloudant Response is: \n", response );
        }).catch( function ( error ) {
            console.error( "An error occurred -- Cloudant Response Error: \n", error );
        });

        userService.registerUser( adminDTO ).then( function ( response ) {
            console.log( "Created user -- Cloudant Response is: \n", response );
        }).catch( function ( error ) {
            console.error( "An error occurred -- Cloudant Response Error: \n", error );
        });

        userService.registerUser( superDTO ).then( function ( response ) {
            console.log( "Created user -- Cloudant Response is: \n", response );
        }).catch( function ( error ) {
            console.error( "An error occurred -- Cloudant Response Error: \n", error );
        });

        userService.registerUser( officerDTO ).then( function ( response ) {
            console.log( "Created user -- Cloudant Response is: \n", response );
        }).catch( function ( error ) {
            console.error( "An error occurred -- Cloudant Response Error: \n", error );
        });

    })
    .catch( function ( error ) {
        console.log(error);
        next( error );
    });

/** These are the required fields per core/domain/user.js **/
