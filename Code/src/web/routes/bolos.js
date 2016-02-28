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
var PDFDocument     = require('pdfkit');

var fs              = require('fs');


var config          = require('../config');

var userService     = new config.UserService( new config.UserRepository() );
var boloService     = new config.BoloService( new config.BoloRepository() );
var agencyService   = new config.AgencyService( new config.AgencyRepository() );
var emailService    = config.EmailService;

var BoloAuthorize   = require('../lib/authorization.js').BoloAuthorize;

var formUtil        = require('../lib/form-util');

var GFERR           = config.const.GFERR;
var GFMSG           = config.const.GFMSG;

var parseFormData       = formUtil.parseFormData;
var cleanTemporaryFiles = formUtil.cleanTempFiles;


function alertHi(){
alert("weeeeeee");
console.log('hiiii');
}
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
        'paging': { 'first': 1, 'current': page }
    };

    boloService.getBolos( limit, skip ).then( function ( results ) {
        data.bolos = results.bolos;
        data.paging.last = Math.ceil( results.total / limit );
        res.render( 'bolo-list', data );
    }).catch( function ( error ) {
        next( error );
    });
});

// list archive bolos
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
            var min_hours = 0;
            if (account)
            {
                //third level of auth
                var tier = req.user.roleName();
                if (tier === 'ADMINISTRATOR') {
                    authorized = true;
                    if (range == 1){
                        min_hours = 8760;
                    }
                    else if(range == 2){

                        min_hours = 744;
                    }
                    else if(range == 3){

                        min_hours = 168;
                    }
                    else if(range == 4){

                        min_hours = 24;
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
                            var hours = parseInt(d.asHours());
                            if(hours > min_hours){

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
        console.log(formDTO.fields);
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
router.post( '/bolo/create', function ( req, res, next ) {

    parseFormData( req, attachmentFilter ).then( function ( formDTO ) {
        console.log(formDTO.fields);
        var boloDTO = boloService.formatDTO( formDTO.fields );
        var attDTOs = [];

        boloDTO.createdOn = moment().format( config.const.DATE_FORMAT);
        boloDTO.createdOn = boloDTO.createdOn.toString();
        console.log(boloDTO.createdOn);
        boloDTO.lastUpdatedOn = boloDTO.createdOn;

        boloDTO.agency = req.user.agency;

        boloDTO.author = req.user.id;
        boloDTO.authorFName = req.user.fname;
        boloDTO.authorLName = req.user.lname;
        boloDTO.authorUName = req.user.username;

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

        var result = boloService.createBolo( boloDTO, attDTOs );
        return Promise.all([result, formDTO]);
    }).then( function ( pData ) {
        if ( pData[1].files.length ) cleanTemporaryFiles( pData[1].files );
        sendBoloNotificationEmail( pData[0], 'new-bolo-notification' );
        req.flash( GFMSG, 'BOLO successfully created.' );
        res.redirect( '/bolo' );
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
    }).then(setTimeout(function ( response ){
        req.flash( GFMSG, 'Successfully archived BOLO.' );
        res.redirect( 'back' );
    },1000)).catch( function ( error ) {
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
       // generatePDF(data.bolo.data);
        res.render( 'bolo-details', data );
    }).catch( function ( error ) {
        next( error );
    });


});


// handle requests for bolo attachments
function getAttachment ( req, res ) {
    boloService.getAttachment(req.params.boloid, req.params.attname)
        .then(function (attDTO) {
            res.type(attDTO.content_type);
            res.send(attDTO.data);
        });
}

router.post('/bolo/viewPDF/:id', function ( req, res) {
    var data = req.body.bolo_data;
    var w = window.open('bolo/pdf/'+req.id, 'windowname');
    w.document.write(data);
    w.document.close();
  URL.toBlob()
});

    router.get('/bolo/asset/:boloid/:attname', getAttachment);
    router.getAttachment = getAttachment;

    module.exports = router;
