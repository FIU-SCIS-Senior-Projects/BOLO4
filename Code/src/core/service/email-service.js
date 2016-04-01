/* jshint node: true */
'use strict';
var _ = require('lodash');
var Promise = require('promise');
var dotenv = require('dotenv').config();

/*
* Assume this works
*/

if ( ! process.env.SENDGRID_API_KEY ) {
  throw new Error(
      'SendGrid API key not found: SENDGRID_API_KEY should be set.'
  );
}else{
console.log("I reached the SENDGRID ELSE");



var sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY);

function EmailService() {
}

EmailService.prototype.send = function( payload){
  var email = new sendgrid.Email( payload );
      return new Promise( function ( resolve, reject ) {
          sendgrid.send( payload, function ( err, json ) {
              if ( err ) reject( err );
              else resolve( json );
          });
      });
}


module.exports = EmailService;

}


//////////


// module.exports.send = function ( payload ) {
//     var email = new sendgrid.Email( payload );
//     return new Promise( function ( resolve, reject ) {
//         sendgrid.send( payload, function ( err, json ) {
//             if ( err ) reject( err );
//             else resolve( json );
//         });
//     });
// };
