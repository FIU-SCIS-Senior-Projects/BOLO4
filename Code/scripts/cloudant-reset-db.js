/* jshint node:true */
'use strict';

var path = require('path');
var Promise = require('promise');
var util = require('util');

require('dotenv').config({'path': path.resolve(__dirname, '../.env')});

var cloudant = require('./cloudant-connection.js');


var bolo_indexer = function (doc) {

    index("default", doc._id);

    if (typeof(doc.agency) !== 'undefined') {
        index("agency", doc.agency);
    }

    if (typeof(doc.createdOn) !== 'undefined') {
        index("createdOn", doc.createdOn);
    }
    if (typeof(doc.lastUpdatedOn) !== 'undefined') {
        index("lastUpdatedOn", doc.lastUpdatedOn);
    }
    if (typeof(doc.author) !== 'undefined') {
        index("author", doc.author);
    }
    if (typeof(doc.category) !== 'undefined') {
        index("category", doc.category);
    }
    if (typeof(doc.firstName) !== 'undefined') {
        index("firstName", doc.firstName);
    }
    if (typeof(doc.lastName) !== 'undefined') {
        index("lastName", doc.lastName);
    }
    if (typeof(doc.dob) !== 'undefined') {
        index("dob", doc.dob);
    }
    if (typeof(doc.dlNumber) !== 'undefined') {
        index("dlNumber", doc.dlNumber);
    }
    if (typeof(doc.race) !== 'undefined') {
        index("race", doc.race);
    }
    if (typeof(doc.sex) !== 'undefined') {
        index("sex", doc.sex);
    }
    if (typeof(doc.height) !== 'undefined') {
        index("height", doc.height);
    }
    if (typeof(doc.weight) !== 'undefined') {
        index("weight", doc.weight);
    }
    if (typeof(doc.hairColor) !== 'undefined') {
        index("hairColor", doc.hairColor);
    }

};


var agency_indexer = function (doc) {

    index("default", doc._id);
    if (typeof(doc.name) !== 'undefined') {
        index("name", doc.name );
    }
    if (typeof(doc.address) !== 'undefined') {
        index("address", doc.address );
    }
    if (typeof(doc.city) !== 'undefined') {
        index("city", doc.city);
    }
    if (typeof(doc.state) !== 'undefined') {
        index("state", doc.state );
    }
    if (typeof(doc.zip) !== 'undefined') {
        index("zip", doc.zip );
    }
    if (typeof(doc.phone) !== 'undefined') {
        index("phone", doc.phone );
    }
    if (typeof(doc.isActive) !== 'undefined') {
        index("isActive", doc.isActive );
    }

};

var user_indexer = function (doc) {

    index("default", doc._id);
    if (typeof(doc.username) !== 'undefined') {
        index("username", doc.username );
    }
    if (typeof(doc.email) !== 'undefined') {
        index("email", doc.email );
    }
    if (typeof(doc.fname) !== 'undefined') {
        index("fname", doc.fname );
    }
    if (typeof(doc.lname) !== 'undefined') {
        index("lname", doc.lname );
    }
    if (typeof(doc.tier) !== 'undefined') {
        index("tier", doc.tier );
    }
    if (typeof(doc.agency) !== 'undefined') {
        index("agency", doc.agency);
    }

    if (typeof(doc.badge) !== 'undefined') {
        index("badge", doc.badge );
    }
    if (typeof(doc.sectunit) !== 'undefined') {
        index("sectunit", doc.sectunit );
    }
    if (typeof(doc.ranktitle) !== 'undefined') {
        index("ranktitle", doc.ranktitle );
    }

};

var BOLO_DB = 'bolo';

var BOLO_DESIGN_DOC = {
    "views": {
        "all_active": {
            "map": "function (doc) { if ( 'bolo' === doc.Type && true === doc.isActive ) emit( doc.lastUpdatedOn, 1 ); }"
        },
        "all_archive": {
            "map": "function (doc) { if ( 'bolo' === doc.Type && false === doc.isActive ) emit( doc.lastUpdatedOn, 1 ); }"
        },
        "all": {
            "map": "function (doc) { if ( 'bolo' === doc.Type ) emit( doc.createdOn, 1 ); }"
        },
        "revs": {
            "map": "function (doc) { if ( 'bolo' === doc.Type ) emit( null, doc._rev ); }"
        }
    },
    indexes: {
        bolos: {
            analyzer: {name: 'standard'},
            index: bolo_indexer
        }
    }
};

var USERS_DESIGN_DOC = {
    "views": {
        "by_username": {
            "map": "function ( doc ) { if ( 'user' === doc.Type ) emit( doc.username, null ); }"
        },
        "all": {
            "map": "function ( doc ) { if ( 'user' === doc.Type ) emit( doc._id, 1 ); }"
        },
        "revs": {
            "map": "function (doc) { if ( 'user' === doc.Type ) emit( null, doc._rev ); }"
        },
        "notifications": {
            "map": "function (doc) { if ( 'user' === doc.Type ) { for ( var i = 0; i < doc.notifications.length; i++ ) { emit( doc.notifications[i], doc.email ); } } }"
        }
    },

    indexes: {
        users: {
            analyzer: {name: 'standard'},
            index: user_indexer
        }
    }
};

var AGENCY_DESIGN_DOC = {
    "views": {
        "by_agency": {
            "map": "function ( doc ) { if ( 'agency' === doc.Type ) emit( doc.name, null ); }"
        },
        "all_active": {
            "map": "function ( doc ) { if ( 'agency' === doc.Type ) emit( doc.name, null ); }"
        },
        "revs": {
            "map": "function ( doc ) { if ( 'agency' === doc.Type ) emit( null, doc._rev ); }"
        }
    },

    indexes: {
        agencies: {
            analyzer: {name: 'standard'},
            index: agency_indexer
        }
    }
};


function destroyDB(dbname) {
    return new Promise(function (resolve, reject) {
        cloudant.db.destroy(dbname, function (err, body) {
            if (err) reject(err);
            resolve(body);
        });
    });
}

function createDB(name) {
    return new Promise(function (resolve, reject) {
        cloudant.db.create(name, function (err, body) {
            if (err) reject(err);
            resolve(body);
        });
    });
}

function createDesign(dbname, designname, doc) {
    return new Promise(function (resolve, reject) {
        var db = cloudant.db.use(dbname);
        db.insert(doc, '_design/' + designname, function (err, body) {
            if (err) reject(err);
            resolve(body);
        });
    });
}

function createDoc(dbname, doc) {
    return new Promise(function (resolve, reject) {
        var db = cloudant.db.use(dbname);
        db.insert(doc, function (err, body) {
        });
    });
}

function createIndex(dbname){
    return new Promise(function (resolve, reject) {

        var agency_id = {name:'agency_id_indexer', type:'json', index:{fields:['agency_id']}}

        var db = cloudant.db.use(dbname);

    db.index(agency_id, function (err, body) {
        if (err) reject(err);
        resolve(body);
    });
    });
}

function resetDB() {
    return destroyDB(BOLO_DB)
        .then(function (response) {
            console.log('> Old database destroyed.');
            return createDB(BOLO_DB);
        }, function (error) {
            if (!error.reason.match(/does not exist/i)) {
                throw new Error(error.reason);
            }
            console.log('> No database to destroy, moving on.');
            return createDB(BOLO_DB);
        })
        .then(function (response) {
            console.log('> Database created.');
            var ad = createDesign(BOLO_DB, 'agency', AGENCY_DESIGN_DOC);
            var bd = createDesign(BOLO_DB, 'bolo', BOLO_DESIGN_DOC);
            var ud = createDesign(BOLO_DB, 'users', USERS_DESIGN_DOC);

            return Promise.all([ad, bd, ud]);
        })
        .then(function (responses) {
            console.log('> Design documents created. ');

            return createIndex(BOLO_DB);

        })
        .then(function(response){
            console.log('agency id index created with response: ' + response.result);

        })

        .catch(function (error) {
            console.error('Error: ', error.message);
        });
}

function authorizeReset() {
    process.stdout.write(
        ' This script will destroy the "' + BOLO_DB + '" database and set it' +
        ' up to a default state.\n\n CONTINUE?  [y/n]  '
    );

    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', function (text) {
        if (text.match(/^y(es)?\s+$/i)) {
            resetDB().then(process.exit);
        } else {
            console.log('> Cancelled.');
            process.exit();
        }
    });
}

/** Start the script **/
authorizeReset();
