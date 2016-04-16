/* jshint node: true */
'use strict';

var bodyParser      = require('body-parser');
var csrf            = require('csurf');
var passport        = require('passport');
var router          = require('express').Router();
var crypto          = require('crypto');
var LocalStrategy   = require('passport-local').Strategy;
var _csrf           = csrf({ 'cookie': true });
var _bodyparser     = bodyParser.urlencoded({ 'extended': true });

var passwordUtil    = require('./password-util');
var formUtil        = require('./form-util');
var config          = require('../config');
var users           = require('../routes/admin/users');

var userRepository  = new config.UserRepository();
var agencyService  = new config.AgencyService( new config.AgencyRepository() );
var userService = new config.UserService( userRepository , agencyService);
var emailService = new config.EmailService();

var parseFormData = formUtil.parseFormData;
var FormError = formUtil.FormError;
var FERR = config.const.GFERR;
var FMSG = config.const.GFMSG;


passport.use( new LocalStrategy(
    function ( username, password, done ) {
        userService.authenticate( username, password )
        .then( function ( account ) {
            if ( account ) {

                    agencyService.getAgency(account.data.agency).then(function (agency) {
                        if (agency.data.isActive === true) {
                            return done(null, account);
                        }
                        else {
                            return done(null, false, {
                                'message': 'Agency has been Deactivated.Contact ' +
                                'your Root Administrator for more information..'
                            });
                        }
                    })

            }
            else {
                return done(null, false, {
                    'message': 'Invalid login credentials.'
                });
            }
        });
    }
));

passport.serializeUser( function ( user, done ) {
    done( null, user.id );
});

passport.deserializeUser( function ( id, done ) {
    userService.deserializeId( id )
    .then( function ( account ) {
        if ( account ) done( null, account );
    });
});


/*
 * GET /login
 *
 * Respond with the login page
 */
router.get( '/login',
    _csrf,
    function ( req, res, next ) {
        if ( req.isAuthenticated() ) {
            req.session.message = "Already logged in.";
            res.redirect( '/' );
        }
        next();
    },
    function ( req, res ) {
        res.render( 'login', {
            'loginToken': req.csrfToken(),
            'error': req.flash( 'error' ),
            'messages': req.flash( 'messages' )
        });
    });


/*
 * POST /login
 *
 * Process Username and Password for Login.
 */
router.post( '/login',
    _bodyparser, _csrf,
    passport.authenticate( 'local', {
        'failureRedirect': '/login',
        'failureFlash': true
    }),
    function ( req, res ) {
        var login_redirect = null;
        if ( req.session.login_redirect ) {
            login_redirect = req.session.login_redirect;
            req.session.login_redirect = null;
        }
        console.log("Session:" + login_redirect);
        res.redirect( '/bolo' || '/' );
    }
);


/*
 * GET /logout
 *
 * Destory any sessions belonging to the requesting client.
 */
router.get( '/logout',
    function ( req, res ) {
        req.logout();
        req.flash( 'messages', 'Successfully logged out.' );
        res.redirect( '/login' );
    });


router.get( '/forgotPassword',
    function ( req, res ) {
        res.render( 'forgot-password' );
    });

router.post( '/forgotPassword',
    function ( req, res ) {

      var email = req.body.email;
        crypto.randomBytes(20, function(err, buf) {

          if(err) {
            console.log("Error generating UUID.");
            req.flash( FERR, 'Error: Please try again. Contact administrator if error persists.');
            return res.redirect( 'back' );
          }

          userService.getByEmail(email).then(function(user){
            if(!user){
              req.flash( FERR, 'Error: Unregistered email address.');
              return res.redirect( 'back' );
            }

            var token = buf.toString('hex');
            console.log(token);
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 3600000;
            userService.updateUser(user.id, user);

            emailService.send({
                'to': email,
                'from': config.email.from,
                'fromName': config.email.fromName,
                'subject' : 'BOLO Alert: Reset password requested',
                'text': 'A password reset has been requested for the account registered to this email.\n'+
                  'To change your password, follow this link: \n\n' +
                  config.appURL + '/changepassword/' + token + '\n\n' +
                  'If you did not request to change your password, please contact a system administrator and immediately change your password.'
            }).then(function(json){
              req.flash( 'messages', 'Reset information successfully sent to %s.', email );
              res.redirect( 'login' );
             });

          });

        });

    });

  router.get( '/changepassword/:token',
      function ( req, res ) {
          userService.getByToken(req.params.token).then(function(user){
            if(!user || (user.resetPasswordExpires < Date.now())){
              req.flash( FERR, 'Error: Reset Token is invalid or may have expired.');
              return res.redirect( '/forgotPassword' );
            }
            res.render( 'change-password' , {userID: user.id, 'form_errors': req.flash( 'form-errors' )});
          });

      });

  router.post( '/changepassword/:userID',
      function ( req, res ) {
        var userID = req.params.userID;
        parseFormData( req ).then( function ( formDTO ) {
            var validationErrors = passwordUtil.validatePassword(
                formDTO.fields.password, formDTO.fields.confirm
            );

            if ( validationErrors ) {
                req.flash( 'form-errors', validationErrors );
                throw new FormError();
            }

            return userService.resetPassword( userID, formDTO.fields.password );
        }, function( error ) {
            console.error( 'Error at /users/:id/reset-password >>> ', error.message );
            req.flash( FERR, 'Error processing form, please try again.' );
            res.redirect( 'back' );
        })
        .then( function ( ) {
            req.flash( FMSG, 'Password reset successful.' );
            res.redirect( '/login' );
        })
        .catch( function ( error ) {
          var patt = new RegExp("matches previous");
          var res = patt.test(error.message);

          if ( res ) {
            req.flash( FERR, 'New password must not match previous.' );
            res.redirect( 'back' );
          }

          if ( 'FormError' !== error.name ) throw error;

          console.error( 'Error at /users/:id/reset-password >>> ', error.message );
          req.flash( FERR, 'Error occurred, please try again.' );
          res.redirect( 'back' );
        })
        .catch( function ( error ) {
            res.redirect( 'back' );
        });
      });

module.exports.passport = passport;
module.exports.router = router;
