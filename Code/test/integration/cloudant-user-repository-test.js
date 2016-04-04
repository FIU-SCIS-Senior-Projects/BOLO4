/* jshint node: true, mocha: true, expr: true */
'use strict';

var expect = require('chai').expect;

var path = require('path');
var Promise = require('promise');

var src = path.resolve( __dirname, '../../src' );
var UserFixture = require('../lib/user-entity-fixture');
var AdapterFactory = require( path.join( src, 'core/adapters' ) );

require('dotenv').config({ path: path.resolve( __dirname, '../../.env' ) });

describe( 'Cloudant User Repository', function () {
    var userRepository, agencyRepository;
    var user, agency, cache, insertedUserID;

    this.timeout( 5000 );

    before( function () {
        userRepository = AdapterFactory.create( 'persistence', 'cloudant-user-repository' );
        cache = {};
    });

    afterEach( function () {
        return Promise.all(Object.keys( cache ).map( userRepository.remove ));
    });

    beforeEach( function () {
      user = UserFixture.create();
    });

  describe( '#insert repository method', function () {
    it( 'inserts a user', function () {
        /* act */
        var userPromise = userRepository.insert( user );

        /* assert */
        return userPromise.then( function ( newuser ) {
            cache[newuser.id] = newuser;
            expect( newuser ).to.not.equal( user );
            expect( newuser.diff( user ) ).to.be.length( 1 )
                .and.to.contain( 'id' );
        });


    });
  });
  describe( '#getAll repository method', function () {
    it( 'gets all users', function () {
        /* arrange */
        var other = UserFixture.create();
        other.data.username = 'otherman';

        var dataFixtures = [ user, other ];
        var setupPromise = Promise.all( dataFixtures.map( function ( aUser ) {
            return userRepository.insert( aUser );
        }));

        /* act */
        var userPromise = setupPromise.then( function ( response ) {
            response.forEach(function(fixture){
              cache[fixture.data.id] = fixture;
            });
            return userRepository.getAll();
        });

        /* assert */
        return userPromise.then( function ( list ) {
            expect( list ).to.have.length.of.at.least( 2 );
        });
    });
  });
  describe( '#getById repository method', function () {
    it( 'gets a single user by id', function () {
        /* arrange */
        var setupPromise = userRepository.insert( user );
        /* act */
        var userPromise = setupPromise.then(function(response){
            cache[response.data.id] = response;
            return userRepository.getById( response.data.id );
        });
        /* assert */
        return userPromise
            .then( function ( found ) {
              expect(found.data.username).to.equal(user.data.username);
              expect(found.data.email).to.equal(user.data.email);
              expect(found.data.agency).to.equal(user.data.agency);
            });
    });
  });

  describe( '#getByUsername repository method', function () {
    /*
     * Assumption: usernames are unique.
     *
     * This may be an issue when trying to deal with usernames for
     * different agencies that 'might' need to preserve uesrnames from
     * other systems.
     */
    it( 'queries by username', function () {
        var setupPromise = userRepository.insert( user );
        /* act */
        var userPromise = setupPromise.then(function(response){
          cache[response.data.id] = response;
          return userRepository.getByUsername( response.data.username );
        });
        /* assert */
        return userPromise
            .then( function ( found ) {
              expect(found.data.username).to.equal(user.data.username);
              expect(found.data.email).to.equal(user.data.email);
              expect(found.data.agency).to.equal(user.data.agency);
            });
    });
  });
  describe( '#remove repository method', function () {
    it( 'removes a user', function () {
        /* arrange */
        var setupPromise = userRepository.insert( user );
        var storedUserID;

        /* act */
        var responsePromise = setupPromise.then(function(response){
          cache[response.data.id] = response;
          storedUserID = response.data.id;
          return userRepository.remove( response.data.id );
        });

        /* assert */
        return responsePromise
            .then( function ( response ) {
                expect( response.ok ).to.be.true;
                expect(response.id ).to.equal(storedUserID);
            });
    });
  });
  describe( '#getByEmail repository method', function () {
   it( 'returns a valid user called with a registered email', function () {
        /* arrange */
       var setupPromise = userRepository.insert( user );

       /* act */
       var userPromise = setupPromise.then(function(response){
         cache[response.data.id] = response;
         return userRepository.getByEmail( response.data.email );
       });
       /* assert */
       return userPromise
           .then( function ( found ) {
               expect( found.data.username ).to.equal( user.data.username );
               expect( found.data.email ).to.equal( user.data.email );
           });
   });

   it( 'returns a null if getByEmail is called with a unregistered email', function () {
      /* arrange */
      var setupPromise = userRepository.insert( user );

       /* act */
       var userPromise = setupPromise.then(function(response){
         cache[response.data.id] = response;
         return userRepository.getByEmail( "nonRegisteredEmail" );
       });

       /* assert */
       return userPromise
           .then( function ( found ) {
               expect( found ).to.equal( null );
           });
   });
 });
 describe( '#getByToken repository method', function () {
   it( 'returns a valid user if getByToken is called with a registered resetPasswordToken', function () {
        /* arrange */
       var setupPromise = userRepository.insert( user );

       /* act */
       var userPromise = setupPromise.then(function(response){
         cache[response.data.id] = response;
         return userRepository.getByToken( response.data.resetPasswordToken );
       });
       /* assert */
       return userPromise
           .then( function ( found ) {
               expect( found.data.username ).to.equal( user.data.username );
               expect( found.data.email ).to.equal( user.data.email );
               expect( found.data.resetPasswordToken ).to.equal( user.data.resetPasswordToken );
           });
   });

   it( 'returns a null if getByToken is called with a unregistered resetPasswordToken', function () {
      /* arrange */
      var setupPromise = userRepository.insert( user );

       /* act */
       var userPromise = setupPromise.then(function(response){
         cache[response.data.id] = response;
         return userRepository.getByToken( "nonRegisteredToken" );
       });

       /* assert */
       return userPromise
           .then( function ( found ) {
               expect( found ).to.equal( null );
           });
   });
 });

});
