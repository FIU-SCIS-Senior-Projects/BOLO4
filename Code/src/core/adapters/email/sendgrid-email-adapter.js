  var dotenv = require('dotenv').config();
  var PDFDocument = require('pdfkit');


/*
* functions
*/
  function getSubscribers(){
    return ['alexhenao.001@gmail.com'];
  }

  function newPreparePayload(somePayload){
    var email     = new sendgrid.Email(payload);
    return email;
  }

  function send(preparedPayload){
    sendgrid.send(preparedPayload, function(err, json) {
      if (err) { return console.error(err); }
      console.log(json);
    });
  }

/*
* check for API key
*/

if ( ! process.env.SENDGRID_API_KEY ) {
    throw new Error(
        'SendGrid API key not found: SENDGRID_API_KEY should be set.'
    );
}else{
  var sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY);
  var doc = new PDFDocument();

  doc.fontSize(8);
  doc.fillColor('red');
  doc.text("UNCLASSIFIED// FOR OFFICIAL USE ONLY// LAW ENFORCEMENT SENSITIVE", 120,15)
    .moveDown(0.25);
  doc.end();

  var payload   = {
    to      : getSubscribers(),
    from    : 'Alex_at_Sendgrid@yourMoms.com',
    subject : 'Check the PDF ATTACHMENT',
    text    : 'This email should have a working attachment. Attachment content was sent as a buffer',
    files   : [
                 {
                    filename: 'secret2.pdf',
                    contentType: 'application/pdf',
                    content:  doc
                 }
              ]
  };

  /*
  * calling the send()
  */
  send(newPreparePayload(payload));

  }

/**
 * Send an email (payload) via the SendGrid service.
 *
 * @param {Object} - an object containing email details {to, from, fromName,
 * subject, text, html}
 * @returns {Promise|Object} the response object
 */
// module.exports.send = function ( payload ) {
//     var email = new sendgrid.Email( payload );
//     return new Promise( function ( resolve, reject ) {
//         sendgrid.send( payload, function ( err, json ) {
//             if ( err ) reject( err );
//             else resolve( json );
//         });
//     });
// };
