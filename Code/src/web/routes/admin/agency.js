/* jshint node: true */
'use strict';

var _                   = require('lodash');
var multiparty          = require('multiparty');
var Promise             = require('promise');

var config              = require('../../config');
var agencyRepository    = new config.AgencyRepository();
var agencyService       = new config.AgencyService( agencyRepository );
var userService         = new config.UserService( new config.UserRepository(), agencyService);

var formUtil            = require('../../lib/form-util');

var GFERR               = config.const.GFERR;
var GFMSG               = config.const.GFMSG;

var parseFormData       = formUtil.parseFormData;
var cleanTemporaryFiles = formUtil.cleanTempFiles;

function isImage ( fileDTO ) {
    return /image/.test( fileDTO.content_type );
}

/**
 * Custom handling of agency attachments. Agencies should only have two
 * attachments. One for the logo and one for the shield.
 */
function getAgencyAttachments ( fields ) {
    var result = [];
    var fileDTO;
    var validateShield = false;
    var validateLogo = false;

    if ( fields.logo_upload && isImage( fields.logo_upload  ) ) {
        fileDTO = _.assign( {}, fields.logo_upload );
        fileDTO.name = 'logo';
        result.push( fileDTO );
        validateLogo = true;
    }

    if ( fields.shield_upload && isImage( fields.shield_upload ) ) {
        fileDTO = _.assign( {}, fields.shield_upload );
        fileDTO.name = 'shield';
        result.push( fileDTO );
        validateShield = true;
    }

    return ( result.length ) ? result : null;
}

/**
 * Validating whther or not the fields in the form have been left empty.
 * If one of the fields has been left empty, validateFields will return false.
 */
function validateFields (fields){
  var fieldValidator = true;

  if(fields.name == ""){
    fieldValidator = false;
  }
  if(fields.address == ""){
    fieldValidator = false;
  }
  if(fields.city == ""){
    fieldValidator = false;
  }
  if(fields.zip == ""){
    fieldValidator = false;
  }
  if(fields.phone == ""){
    fieldValidator = false;
  }

  return fieldValidator;
}


/**
 * Respond with a list
 */
module.exports.getList = function ( req, res ) {
    agencyService.getAgencies()
    .then(function (agencies) {
        res.render('agency-list-admin', {
            agencies: agencies
        });
    });
};

module.exports.activationAgency = function(req, res){

    var agency = req.body.agency;
    if(req.user.data.agencyName === agency.data.name){
        req.flash(GFERR,"Error in agency deactivation: Root Administrator cannot deactivate his/her own agency ");
        res.send({redirect: '/admin/agency'});
    }
    else
    {
        if (agency.data.isActive === 'true') {
            agency.data.isActive = true;

        }
        else
            agency.data.isActive = false;
        agency.data.isActive = !(agency.data.isActive);
        console.log(agency.data.isActive);
        agencyService.updateAgency(agency, []).then(function (pData) {
            if (agency.data.isActive === true) {
                req.flash(GFMSG, 'Agency Activation successful.');
            }
            else {
                req.flash(GFMSG, 'Agency Deactivation successful.');
            }
            res.send({redirect: '/admin/agency'});

        }).catch(function (error) {
            req.flash(GFERR, "Error in agency deactivation:" + error);
            res.send({redirect: '/admin/agency'});
        })
    }
};
/**
 * Respond with a form to create an agency.
 */
module.exports.getCreateForm = function (req, res) {
    res.render('agency-create-form');
};


/**
 * Process a form to create an agency.
 */
module.exports.postCreateForm = function ( req, res, next ) {
    parseFormData( req ).then( function ( formDTO ) {
        var agencyDTO = agencyService.formatDTO( formDTO.fields );
        var atts = getAgencyAttachments( formDTO.fields );
        var formFields = validateFields(formDTO.fields);
        
        if(formFields == false){
          req.flash(GFERR, 'No field can be left empty. This information is required');
          res.redirect('back');
          throw new FormError();
        }
        if(atts == null){
          req.flash(GFERR, 'Images not uploaded. Logo and Shield are required');
          res.redirect('back');
          throw new FormError();
        }
        var atts = getAgencyAttachments( formDTO.fields );
        var result = agencyService.createAgency( agencyDTO, atts );
        return Promise.all( [ result, formDTO ] );
    })
    .then(function (pData,error) {
        if(error)
        throw error;

        else {
            if (pData[1].files.length) cleanTemporaryFiles(pData[1].files);
            req.flash(GFMSG, 'Agency registration successful.');
            res.redirect('/admin/agency');
        }
    }).catch( function ( error ) {
        req.flash(GFERR, 'Agency Creation unsuccessful ' + error);
        res.redirect('back');
        throw new FormError();
    });
};


/**
 * Respond with a form to edit agency details
 */
module.exports.getEditForm = function ( req, res, next ) {
    agencyService.getAgency( req.params.id ).then( function ( agency ) {
        res.render( 'agency-edit-form', { agency: agency } );
    }).catch( function ( error ) {
        next( error );
    });
};


/**
 * Process a form to edit/update agency details.
 */
module.exports.postEditForm = function ( req, res, next ) {
    parseFormData( req ).then( function ( formDTO ) {
        var agencyDTO = agencyService.formatDTO( formDTO.fields );
        var atts = getAgencyAttachments( formDTO.fields );
        var formFields = validateFields(formDTO.fields);
        
        if(formFields == false){
          req.flash(GFERR, 'No field can be left empty. This information is required');
          res.redirect('back');
          throw new FormError();
        }

        var result = agencyService.updateAgency( agencyDTO, atts );
        return Promise.all([ result, formDTO ]);
    }).then( function ( pData ) {
        if ( pData[1].files.length ) cleanTemporaryFiles( pData[1].files );
        req.flash( GFMSG, 'Agency details update successful.' );
        res.redirect( '/admin/agency' );
    }).catch( function ( error ) {
        req.flash(GFERR, 'Agency Creation unsuccessful ' + error);
        res.redirect('back');
        next( error );
    });
};


/**
 * Get an attachment associated with the agency id.
 */
module.exports.getAttachment = function ( req, res ) {
    agencyService.getAttachment( req.params.id , req.params.attname )
    .then( function ( attDTO ) {
        res.type( attDTO.content_type );
        res.send( attDTO.data );
    });
};
