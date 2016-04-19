/* jshint node:true */
'use strict';

var router  = require('express').Router();
var users   = require('./users');
var agency  = require('./agency');

var config  = require('../../config');
var User    = require('../../../core/domain/user');

var GFERR   = config.const.GFERR;
var GFMSG   = config.const.GFMSG;


module.exports = router;


router.use( '/admin/agency', function ( req, res, next ) {
    if ( req.user.tier === User.ROOT ) {
        next();
    } else {
        res.render( 'unauthorized' );
    }
});

router.use( '/admin/users', function ( req, res, next ) {
    if ( req.user.tier === User.ROOT || req.user.tier === User.ADMINISTRATOR) {
        next();
    } else {
        res.render( 'unauthorized' );
    }
});


var pre = '/admin/users';
router.use( SETNAV( 'admin-users' ) );
router.get(  pre                            , users.getList );
router.get(  pre + '/sorted/:id'            , users.getSortedList);
router.get(  pre + '/create'                , users.getCreateForm );
router.post( pre + '/create'                , users.postCreateForm );
router.get(  pre + '/:id'                   , users.getDetails );
router.get(  pre + '/:id/reset-password'    , users.getPasswordReset );
router.post( pre + '/:id/reset-password'    , users.postPasswordReset );
router.get(  pre + '/:id/edit-details'      , users.getEditDetails );
router.post( pre + '/:id/edit-details'      , users.postEditDetails );
router.get(  pre + '/:id/delete'            , users.getDelete );


pre = '/admin/agency';
router.use( SETNAV( 'admin-agency' ) );
router.get(  pre                            , agency.getList );
router.post( pre + '/activation'            , agency.activationAgency);
router.get(  pre + '/create'                , agency.getCreateForm );
router.post( pre + '/create'                , agency.postCreateForm );
router.get(  pre + '/edit/:id'              , agency.getEditForm );
router.post( pre + '/edit/:id'              , agency.postEditForm );
router.get(  pre + '/asset/:id/:attname'    , agency.getAttachment );


router.use( SETNAV( 'admin-index' ) );
router.get( '/admin', getIndex );


function SETNAV ( title ) {
    return function ( req, res, next ) {
        res.locals.admin_nav = title;
        next();
    };
}

function getIndex ( req, res ) {
  if ( req.user.tier === User.ROOT || req.user.tier === User.ADMINISTRATOR) {
      res.render( 'admin' );
  } else {
      res.render( 'unauthorized' );
  }

}
