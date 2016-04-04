/* jshint node: true, mocha: true, expr: true */
'use strict';

var expect = require('chai').expect;
var sinon = require('sinon');

var _ = require('lodash');
var path = require('path');
var Promise = require('promise');

var src = path.resolve( __dirname, '../../src' );
var Agency = require( path.join( src, 'core/domain/agency' ) );
var AgencyService = require( path.join( src, 'core/service/agency-service' ) );
var AgencyFixture = require( '../lib/agency-entity-fixture' );


describe( 'agency service module', function () {

    var agencyService;
    var mockAgencyRepo;
    var agency;
    var attachments;
    var agencies;

    var defaultStubMethod = function () {
        throw new Error( 'Stub behavior undefined' );
    };

    before( function () {
    });

    beforeEach( function () {
        mockAgencyRepo = {
            'insert': defaultStubMethod,
            'update': defaultStubMethod,
            'getAgency': defaultStubMethod,
            'getAgencies': defaultStubMethod,
            'findAgencyById': defaultStubMethod
        };
        agencyService = new AgencyService( mockAgencyRepo );
        agency = AgencyFixture.create();
        attachments = [];
        agencies = [];
    });

    describe( 'creates an agency in the database', function () {
        it( 'promises an Agency object for valid agency data and attachments', function () {
            /* arrange */
            // agencies.push(agency);
            mockAgencyRepo.insert = sinon.stub()
              .withArgs(agency, attachments)
              .returns(Promise.resolve(agency));

            mockAgencyRepo.getAgencies = sinon.stub()
              .returns(Promise.resolve(agencies));

            mockAgencyRepo.findAgencyById = sinon.stub()
              .withArgs(agency.id, agency.name)
              .returns(Promise.resolve(0));

            /* act */
            var response = agencyService.createAgency( agency, attachments );

            /* assert */
            return response
                .then( function ( agencyResp ) {
                    expect( agencyResp ).to.equal( agency );
                });
        });

        it( 'promises an agency will not be created if agency id already exists', function () {
            /* arrange */
            // agencies.push(agency);
            mockAgencyRepo.insert = sinon.stub()
              .withArgs(agency, attachments)
              .returns(Promise.resolve(agency));

            mockAgencyRepo.getAgencies = sinon.stub()
              .returns(Promise.resolve(agencies));

            mockAgencyRepo.findAgencyById = sinon.stub()
              .withArgs(agency.id, agency.name)
              .returns(Promise.resolve(1));

            /* act */
            var response = agencyService.createAgency( agency, attachments );

            /* assert */
            return response
            .then(function ( agencyResp ) {
                expect( agencyResp ).to.be.undefined;
            }, function ( agencyResp ) {
                expect( agencyResp ).to.be.instanceOf( Error )
                .and.to.match( /already registered/ );
            });
        });

        it( 'promises an agency will not be created if agency name already exists', function () {
            /* arrange */
            agencies.push(agency);
            mockAgencyRepo.insert = sinon.stub()
              .withArgs(agency, attachments)
              .returns(Promise.resolve(agency));

            mockAgencyRepo.getAgencies = sinon.stub()
              .returns(Promise.resolve(agencies));

            mockAgencyRepo.findAgencyById = sinon.stub()
              .withArgs(agency.id, agency.name)
              .returns(Promise.resolve(0));

            /* act */
            var response = agencyService.createAgency( agency, attachments );

            /* assert */
            return response
            .then(function ( agencyResp ) {
              console.log(agencyResp);
                expect( agencyResp ).to.be.undefined;
            }, function ( agencyResp ) {
                expect( agencyResp ).to.be.instanceOf( Error )
                .and.to.match( /already registered/ );
            });
        });


      }); /* end describe: agency creation*/

      describe( 'updates an agency in the database', function () {
        it( 'promises an agency will be updated if agency exists', function () {
            /* arrange */
            agencies.push(agency);
            mockAgencyRepo.update = sinon.stub()
              .withArgs(agency, attachments)
              .returns(Promise.resolve(agency));

            mockAgencyRepo.getAgencies = sinon.stub()
              .returns(Promise.resolve(agencies));

            mockAgencyRepo.getAgency = sinon.stub()
              .withArgs(agency.id)
              .returns(Promise.resolve(agency));

            /* act */
            var response = agencyService.updateAgency( agency, attachments );

            /* assert */
            return response
                .then( function ( agencyResp ) {
                    expect( agencyResp ).to.equal( agency );
                });
        });
      });

      it( 'promises an agency will not be updated if agency does not exist', function () {
          /* arrange */
          agencies.push(agency);
          mockAgencyRepo.update = sinon.stub()
            .withArgs(agency, attachments)
            .returns(Promise.resolve(agency));

          mockAgencyRepo.getAgencies = sinon.stub()
            .returns(Promise.resolve(agencies));

          mockAgencyRepo.getAgency = sinon.stub()
            .withArgs(agency.id)
            .returns(Promise.reject(agency));

          /* act */
          var response = agencyService.updateAgency( agency, attachments );

          /* assert */
          return response
          .then(function ( agencyResp ) {
              expect( agencyResp ).to.be.undefined;
          }, function ( agencyResp ) {
              expect( agencyResp ).to.be.instanceOf( Error )
              .and.to.match( /does not exist/ );
          });
      });

});
