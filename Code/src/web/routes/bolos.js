/* jshint node: true */
'use strict';

var _               = require('lodash');
var jade            = require('jade');
var moment          = require('moment');
var path            = require('path');
var Promise         = require('promise');
var router          = require('express').Router();
var util            = require('util');
var uuid            = require('node-uuid');
var PDFDocument     = require ('pdfkit');
var fs              = require('fs');
var bodyParser      = require('body-parser');
var _bodyparser     = bodyParser.urlencoded({ 'extended': true });

var config          = require('../config');

var agencyService   = new config.AgencyService( new config.AgencyRepository() );
var userService     = new config.UserService( new config.UserRepository(), agencyService);
var boloService     = new config.BoloService( new config.BoloRepository() );
var emailService    = config.EmailService;

var BoloAuthorize   = require('../lib/authorization.js').BoloAuthorize;

var formUtil        = require('../lib/form-util');

var GFERR           = config.const.GFERR;
var GFMSG           = config.const.GFMSG;

var parseFormData       = formUtil.parseFormData;
var cleanTemporaryFiles = formUtil.cleanTempFiles;

/**
 * Send email notification of a new bolo.
 */
function sendBoloNotificationEmail ( bolo, template ) {
    return userService.getAgencySubscribers( bolo.agency )
    .then( function ( users ) {
        var subscribers = users.map( function( user ) {
            return user.email;
        });

        var tmp = config.email.template_path + '/' + template + '.jade';
        var tdata = {
            'bolo': bolo,
            'app_url': config.appURL
        };
        /** @todo check if this is async **/
        var html = jade.renderFile( tmp, tdata );

        return emailService.send({
            'to': subscribers,
            'from': config.email.from,
            'fromName': config.email.fromName,
            'subject' : 'BOLO Alert: ' + bolo.category,
            'html': html
        });
    })
    .catch( function ( error ) {
        console.error(
            'Unknown error occurred while sending notifications to users' +
            'subscribed to agency id %s for BOLO %s\n %s',
            bolo.agency, bolo.id, error.message
        );
    });
}

/**
 * @todo an optimization could probably be made here by creating a view for
 * this type of data in Cloudant (if its still being used).
 */
function getAllBoloData ( id ) {
    var data = {};
console.log("called get all bolo data");
    return boloService.getBolo( id ).then( function ( bolo ) {
        data.bolo = bolo;

        return Promise.all([
            agencyService.getAgency( bolo.agency ),
            userService.getUser( bolo.author )
        ]);
    }).then( function ( responses ) {
        console.log(responses);
        data.agency = responses[0];
        data.author = responses[1];
        console.log("finishing get all bolo data");

        return data;
    });
}

function getAgencyData(id){
    var data = {};
    console.log("retrieving Agency data");

    return agencyService.getAgency(id).then( function(responses){
        console.log(responses);
        data.agency = responses;
        return data;
    });
}



function attachmentFilter ( fileDTO ) {
    return /image/i.test( fileDTO.content_type );
}

function renameFile ( dto, newname ) {
    dto.name = newname;
    return dto;
}

function createUUID () {
    return  uuid.v4().replace( /-/g, '' );
}

// list bolos at the root route
router.get( '/bolo', function ( req, res, next ) {
    var page = parseInt( req.query.page ) || 1;
    var limit = config.const.BOLOS_PER_PAGE;
    var skip = ( 1 <= page ) ? ( page - 1 ) * limit : 0;

    var data = {
        'paging': { 'first': 1, 'current': page },
        'agencies': []
    };

    boloService.getBolos( limit, skip ).then( function ( results ) {
        data.bolos = results.bolos;
        data.paging.last = Math.ceil( results.total / limit );

        agencyService.getAgencies().then( function ( agencies ) {
            data.agencies = agencies;
            res.render('bolo-list', data );
        });
    }).catch( function ( error ) {
        next( error );
    });
});

// list bolos by agency at the root route
router.get( '/bolo/agency/:id', function ( req, res, next ) {
    var agency = req.params.id;
    var page = parseInt( req.query.page ) || 1;
    var limit = config.const.BOLOS_PER_PAGE;
    var skip = ( 1 <= page ) ? ( page - 1 ) * limit : 0;

    var data = {
        'paging': { 'first': 1, 'current': page }
    };

    boloService.getBolosByAgency( agency, limit, skip ).then( function ( results ) {
        data.bolos = results.bolos;
        data.paging.last = Math.ceil( results.total / limit );

        agencyService.getAgencies().then( function ( agencies ) {
            data.agencies = agencies;
            res.render('bolo-list', data );
        });
    }).catch( function ( error ) {
        next( error );
    });
});

// list archived bolos
router.get( '/bolo/archive', function ( req, res, next ) {

    var page = parseInt( req.query.page ) || 1;
    var limit = config.const.BOLOS_PER_PAGE;
    var skip = ( 1 <= page ) ? ( page - 1 ) * limit : 0;

    var data = {
        'paging': { 'first': 1, 'current': page }
    };

    boloService.getArchiveBolos( limit, skip ).then( function ( results ) {
        data.bolos = results.bolos;
        data.paging.last = Math.ceil( results.total / limit );
        res.render( 'bolo-archive', data );
    }).catch( function ( error ) {
        next( error );
    });
});

router.post('/bolo/archive/purge',function(req,res) {

   // = req.body.bolo_data;
    var pass = req.body.password;
    var username = req.user.data.username;
    var range = req.body.range;

    var authorized = false;
    //2nd level of auth
    userService.authenticate(username, pass)
        .then(function (account) {
            var min_mins = 0;
            if (account)
            {
                //third level of auth
                var tier = req.user.roleName();
                if (tier === 'ROOT') {
                    authorized = true;
                    if (range == 1){
                        min_mins = 1051200;
                    }
                    else if(range == 2){

                        min_mins = 0;
                    }

                    var now  = moment().format( config.const.DATE_FORMAT);
                    var then = "";
                    boloService.getArchiveBolosForPurge().then(function(bolos){

                        var promises = [];
                        for(var i = 0; i < bolos.bolos.length;i++){
                            var curr = bolos.bolos[i];
                            then = curr.lastUpdatedOn;

                            var ms = moment(now,config.const.DATE_FORMAT).diff(moment(then,config.const.DATE_FORMAT));
                            var d = moment.duration(ms);
                            var minutes = parseInt(d.asMinutes());
                            if(minutes > min_mins){

                                 promises.push(boloService.removeBolo(curr.id));

                            }
                        }
                         Promise.all(promises).then(function (responses) {
                            if (responses.length >= 1) {
                                req.flash(GFMSG, 'Successfully purged '+ responses.length+ ' BOLOs.');

                            }
                            else {
                                req.flash(GFMSG, 'No BOLOs meet purge criteria.');
                            }
                             res.send({redirect: '/bolo/archive'});

                         })
                    });

                }
            }
            if(authorized === false) {
                req.flash(GFERR,
                    'You do not have permissions to purge BOLOs. Please ' +
                    'contact your agency\'s administrator ' +
                    'for access.');
                res.send({redirect: '/bolo/archive'});

            }

        }).catch(function(){
        req.flash(GFERR,"error in purge process, please try again");
        res.send({redirect: '/bolo/archive'});
    })

});

router.get( '/bolo/search/results', function ( req, res ) {


    console.log(req.query.bookmark );
    var query_string = req.query.valid;
    console.log(query_string);
    var data = {bookmark: req.query.bookmark || {} ,more:true ,query:query_string};
    // Do something with variable
    var limit = config.const.BOLOS_PER_PAGE;

    boloService.searchBolos(limit,query_string,data.bookmark).then( function ( results ) {
        data.paging = results.total > limit;

        if (results.returned < limit)
        {
            console.log('theres no more!!');
            data.more = false; //indicate that another page exists
        }


            data.previous_bookmark = data.bookmark || {};
            data.bookmark = results.bookmark;
            console.log("current: " + data.bookmark);
            console.log("previous: " + data.previous_bookmark);
        data.bolos = results.bolos;
        res.render( 'bolo-search-results', data );
    })
        .catch( function ( error ) {
        next( error );
    });

});

router.get( '/bolo/search', function ( req, res ) {
    var data = {
        'form_errors': req.flash( 'form-errors' )
    };

    res.render( 'bolo-search-form', data );
});

// process bolo search user form input
router.post( '/bolo/search', function ( req, res, next ) {

    parseFormData( req, attachmentFilter ).then( function ( formDTO )
    {

        var query_obj = formDTO.fields;
        var query_string = '';
        var key = '';
        var value = '';
        var MATCH_EXPR = ' OR ';
        var expression = false;

        if (query_obj['matchFields'] === "on")
        {
            MATCH_EXPR = ' AND ';
        }

        for (var i = 0; i < Object.keys(query_obj).length; i++) {
            key = Object.keys(query_obj)[i];
            value = query_obj[Object.keys(query_obj)[i]];
        console.log(key+':'+value);
            if (key !== "status" && key !== 'matchFields' && value !== "" ) {
                if(expression === true) {
                    query_string += MATCH_EXPR;
                    expression = false;
                }
                query_string += key + ':' + value;
                expression = true;
            }

        }

        //form was empty, return empty object
        if(query_string === '')
        {
            query_string = {};
        }
        return query_string;

    }).then( function ( query_string) {
        var string = encodeURIComponent(query_string);
        res.redirect('/bolo/search/results?valid=' + string);
    }).catch(function(error) {
        next( error );
    });
});

// render the bolo create form
router.get( '/bolo/create', function ( req, res ) {

    var data = {
        'form_errors': req.flash( 'form-errors' )
    };

    res.render( 'bolo-create-form', data );
});


// process bolo creation user form input
// if the user slected preview mode, a view of the current form is rendered.
router.post( '/bolo/create', _bodyparser, function ( req, res, next ) {

    parseFormData( req, attachmentFilter ).then( function ( formDTO ) {

        var boloDTO = boloService.formatDTO( formDTO.fields );
        var attDTOs = [];

        boloDTO.createdOn = moment().format( config.const.DATE_FORMAT);
        boloDTO.createdOn = boloDTO.createdOn.toString();
        console.log("BOLO created on:" + boloDTO.createdOn);
        boloDTO.lastUpdatedOn = boloDTO.createdOn;
        boloDTO.agency = req.user.agency;
        boloDTO.author = req.user.id;
        boloDTO.authorFName = req.user.fname;
        boloDTO.authorLName = req.user.lname;
        boloDTO.authorUName = req.user.username;
        boloDTO.lastUpdatedBy.firstName = req.user.fname;
        boloDTO.lastUpdatedBy.lastName = req.user.lname;
        boloDTO.agencyName = req.user.agencyName;

        if ( formDTO.fields.featured_image ) {
            var fi = formDTO.fields.featured_image;
            boloDTO.images.featured = fi.name;
            attDTOs.push(renameFile( fi, 'featured' ) );
        }

        if ( formDTO.fields['image_upload[]'] ) {
            formDTO.fields['image_upload[]'].forEach( function ( imgDTO ) {
                var id = createUUID();
                boloDTO.images[id] = imgDTO.name;
                attDTOs.push( renameFile( imgDTO, id ) );
            });
        }

        if(formDTO.fields.option === "preview"){
            var preview = {};
            var bolo = boloService.previewBolo(boloDTO);
            preview.bolo = bolo;
            preview.agency = bolo.agency;
            preview.image = fi.path;
            return Promise.all([preview, formDTO]);

        }

        if(formDTO.fields.option === "submit"){
            var result = boloService.createBolo( boloDTO, attDTOs );
            return Promise.all([result, formDTO]);
        }

    }).then( function ( pData ) {

        if(pData[1].fields.option === "submit"){
            if ( pData[1].files.length ) cleanTemporaryFiles( pData[1].files );
            sendBoloNotificationEmail( pData[0], 'new-bolo-notification' );
            req.flash( GFMSG, 'BOLO successfully created.' );
            res.redirect( '/bolo' );
        }
        else{
            agencyService.getAgency(pData[0].agency).then( function(response){
                pData[0].agency_name = response.data.name;
                pData[0].agency_address = response.data.address;
                pData[0].agency_city = response.data.city;
                pData[0].agency_zip = response.data.zip;
                pData[0].agency_state = response.data.state;
                pData[0].agency_phone = response.data.phone;

                var readFile = Promise.denodeify(fs.readFile);

                readFile(pData[0].image).then( function(buffer){
                    pData[0].buffer = buffer.toString('base64');
                    res.render( 'bolo-preview-details', pData[0] );
                });
            });
        }

    }).catch( function ( error ) {
         next( error );
       });

});

router.post( '/bolo/update/:id', function ( req, res, next ) {
    console.log("posted to bolo/update/:id");
    var bolo_id = req.params.id;
    var bolo_status = req.body.status;
    var data = {
        'form_errors': req.flash( 'form-errors' )
    };

    getAllBoloData( bolo_id ).then( function(boloData)   {

        _.extend(data, boloData);

        var auth = new BoloAuthorize( data.bolo, data.author, req.user );

        if ( auth.authorizedToEdit() ) {
            data.bolo.status = bolo_status;
            var temp = moment().format( config.const.DATE_FORMAT);
            data.bolo.lastUpdatedOn = temp.toString();
            console.log(data.bolo.lastUpdatedOn);
            var att = [];
            boloService.updateBolo(data.bolo, att).then(function(bolo){

                res.redirect('/bolo');


                }).catch( function ( error ) {
                    next( error );
                });

        }
    }).catch( function ( error ) {
        if ( ! /unauthorized/i.test( error.message ) ) throw error;

        req.flash( GFERR,
            'You do not have permissions to edit this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect( 'back' );
    }).catch( function ( error ) {
        next( error );
    });
});
// render the bolo edit form
router.get( '/bolo/edit/:id', function ( req, res, next ) {
    var data = {
        'form_errors': req.flash( 'form-errors' )
    };

    /** @todo car we trust that this is really an id? **/

    getAllBoloData( req.params.id ).then( function(boloData)   {

        _.extend(data, boloData);

        var auth = new BoloAuthorize( data.bolo, data.author, req.user );

        if ( auth.authorizedToEdit() ) {
            res.render( 'bolo-edit-form', data );
        }
    }).catch( function ( error ) {
        if ( ! /unauthorized/i.test( error.message ) ) throw error;

        req.flash( GFERR,
            'You do not have permissions to edit this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect( 'back' );
    }).catch( function ( error ) {
        next( error );
    });
});


// handle requests to process edits on a specific bolo
router.post( '/bolo/edit/:id', function ( req, res, next ) {
    /** @todo confirm that the request id and field id match **/

    parseFormData( req, attachmentFilter ).then( function ( formDTO ) {
        var boloDTO = boloService.formatDTO( formDTO.fields );
        var attDTOs = [];

        boloDTO.lastUpdatedOn = moment().format( config.const.DATE_FORMAT );
        boloDTO.lastUpdatedBy.firstName = req.user.fname;
        boloDTO.lastUpdatedBy.lastName = req.user.lname;

        if ( formDTO.fields.featured_image ) {
            var fi = formDTO.fields.featured_image;
            boloDTO.images.featured = fi.name;
            attDTOs.push( renameFile( fi, 'featured' ));
        }

        if ( formDTO.fields['image_upload[]'] ) {
            formDTO.fields['image_upload[]'].forEach( function ( imgDTO ) {
                var id = createUUID();
                boloDTO.images[id] = imgDTO.name;
                attDTOs.push( renameFile( imgDTO, id ) );
            });
        }

        if ( formDTO.fields['image_remove[]'] ) {
            boloDTO.images_deleted = formDTO.fields['image_remove[]'];
        }

        var result = boloService.updateBolo( boloDTO, attDTOs );
        return Promise.all( [ result, formDTO ] );
    }).then( function ( pData ) {
        if ( pData[1].files.length ) cleanTemporaryFiles( pData[1].files );
        sendBoloNotificationEmail( pData[0], 'update-bolo-notification' );
        req.flash( GFMSG, 'BOLO successfully updated.' );
        res.redirect( '/bolo' );
    }).catch( function ( error ) {
        next( error );
    });
});


// handle requests to inactivate a specific bolo
router.get( '/bolo/archive/:id', function ( req, res, next ) {
    var data = {};

    getAllBoloData( req.params.id ).then( function ( _data ) {
        _.extend( data, _data );
        var auth = new BoloAuthorize( data.bolo, data.author, req.user );
        if ( auth.authorizedToArchive() ) {
            boloService.activate( data.bolo.id, false );
        }
    }).then( function ( response ) {
        req.flash( GFMSG, 'Successfully archived BOLO.' );
        res.redirect( '/bolo/archive' );
    }).catch( function ( error ) {
        if ( ! /unauthorized/i.test( error.message ) ) throw error;

        req.flash( GFERR,
            'You do not have permissions to archive this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect( 'back' );
    }).catch(function ( error ) {
        next( error );
    });
});


/**
 * Process a request to restore a bolo from the archive.
 */
router.get( '/bolo/restore/:id', function ( req, res, next ) {
    var data = {};

    getAllBoloData( req.params.id ).then( function ( _data ) {
        _.extend( data, _data );
        var auth = new BoloAuthorize( data.bolo, data.author, req.user );
        if ( auth.authorizedToArchive() ) {
            boloService.activate( data.bolo.id, true );
        }
    }).then( function ( response ) {
        req.flash( GFMSG, 'Successfully restored BOLO.' );
        res.redirect( '/bolo' );
    }).catch( function ( error ) {
        if ( ! /unauthorized/i.test( error.message ) ) throw error;

        req.flash( GFERR,
            'You do not have permissions to restore this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect( 'back' );
    }).catch(function ( error ) {
        next( error );
    });
});


/**
 * Process a request delete a bolo with the provided id
 */
router.get( '/bolo/delete/:id', function ( req, res, next ) {

    getAllBoloData( req.params.id ).then( function ( data ) {
        var auth = new BoloAuthorize( data.bolo, data.author, req.user );
        if ( auth.authorizedToDelete() ) {
            return boloService.removeBolo( req.params.id );
        }
    }).then( function ( response ) {
        req.flash( GFMSG, 'Successfully deleted BOLO.' );
        res.redirect( 'back' );
    }).catch( function ( error ) {
        if ( ! /unauthorized/i.test( error.message ) ) throw error;

        req.flash( GFERR,
            'You do not have permissions to delete this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect( 'back' );
    }).catch(function ( error ) {
        next( error );
    });
});


// handle requests to view the details of a bolo
router.get( '/bolo/details/:id', function ( req, res, next ) {
    var data = {};
    console.log(req.params.id);


    boloService.getBolo( req.params.id ).then( function ( bolo ) {
        data.bolo = bolo;
    return agencyService.getAgency( bolo.agency );

    }).then( function ( agency ) {
        data.agency = agency;
        return userService.getByUsername(data.bolo.authorUName);

    }).then(function(user) {
        data.user = user;
        res.render( 'bolo-details', data );

    }).catch( function ( error ) {
        next( error );
    });
});

router.get('/bolo/details/pdf/:id', function ( req, res, next ) {
    var data = {};
    console.log(req.params.id);


    boloService.getBolo( req.params.id ).then( function ( bolo ) {
        data.bolo = bolo;
    return agencyService.getAgency( bolo.agency );

    }).then( function ( agency ) {
        data.agency = agency;
        return userService.getByUsername(data.bolo.authorUName);

    }).then(function(user) {
        data.user = user;
        generatePDF(data);
        res.render( 'bolo-pdf-suite', data );

    }).catch( function ( error ) {
        next( error );
    });
});

router.get('/bolo/details/pics/:id', function (req, res, next){
    var data = {
        'form_errors': req.flash( 'form-errors' )
    };
    boloService.getBolo(req.params.id).then( function (bolo){
        data.bolo = bolo;
        res.render('bolo-additional-pics', data);

    }).catch( function ( error ) {
        next( error );
    });
});
    /**
     * Generates PDF from bolo / agency information
     */
    function generatePDF(data) {
        var doc = new PDFDocument();
        var someData = {};
        doc.pipe(fs.createWriteStream('src/web/public/pdf/' + data.bolo.id + ".pdf"));
        doc.fontSize(8);
        doc.fillColor('red');
        doc.text("UNCLASSIFIED// FOR OFFICIAL USE ONLY// LAW ENFORCEMENT SENSITIVE", 120, 15)
            .moveDown(0.25);
        doc.fillColor('black');
        doc.text(data.agency.name)
            .moveDown(0.25);
        doc.text(data.agency.address)
            .moveDown(0.25);
        doc.text(data.agency.city + ", " + data.agency.state + ", " + data.agency.zip)
            .moveDown(0.25);
        doc.text(data.agency.phone)
            .moveDown(0.25);
        doc.fontSize(20);
        doc.fillColor('red');
        doc.text(data.bolo.category, 120, 115, {align: 'center'})
            .moveDown();


        doc.fillColor('black');
        doc.fontSize(11);
        doc.font('Times-Roman')
            .text("Name: " + data.bolo['firstName'] + " " + data.bolo['lastName'], 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("Race: " + data.bolo['race'], 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("DOB: " + data.bolo['dob'], 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("License#: " + data.bolo['dlNumber'], 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("Height: " + data.bolo['height'], 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("Weight: " + data.bolo['weight'] + "lbs", 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("Address: " + data.bolo['address'], 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("Sex: " + data.bolo['sex'], 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("Hair Color: " + data.bolo['hairColor'], 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("Tattoos/Scars: " + data.bolo['tattoos'], 350)
            .moveDown();
        doc.font('Times-Roman')
            .text("Additional: ", 15, 465)
            .moveDown(0.25);
        doc.font('Times-Roman')
            .text(data.bolo['additional'], {width: 200})
            .moveDown();
        doc.font('Times-Roman')
            .text("Summary: ", 15)
            .moveDown(0.25);
        doc.font('Times-Roman')
            .text(data.bolo['summary'], {width: 200})
            .moveDown(5);
        doc.font('Times-Roman')
            .text("Any Agency having questions regarding this document may contact: "
                + data.bolo.authorFName
                + " "
                + data.bolo.authorLName, 15);
        boloService.getAttachment(data.bolo.id, 'featured').then(function (attDTO) {
            someData.featured = attDTO.data;
            doc.image(someData.featured, 15, 150, {width: 300, height: 300});
            return agencyService.getAttachment(data.agency.data.id, 'logo')
        }).then(function (logoDTO) {
            someData.logo = logoDTO.data;
            doc.image(someData.logo, 15, 15, {height: 100});
            return agencyService.getAttachment(data.agency.data.id, 'shield')
        }).then(function (shieldDTO) {
            someData.shield = shieldDTO.data;
            doc.image(someData.shield, 500, 15, {height: 100});
            doc.end();
        })
    }

// handle requests for bolo attachments
function getAttachment ( req, res ) {
    boloService.getAttachment(req.params.boloid, req.params.attname)
        .then(function (attDTO) {
            res.type(attDTO.content_type);
            res.send(attDTO.data);
        });
}


    router.get('/bolo/asset/:boloid/:attname', getAttachment);
    router.getAttachment = getAttachment;
    module.exports = router;
