/* jshint node: true */
'use strict';

var _ = require('lodash');
var jade = require('jade');
var moment = require('moment');
var path = require('path');
var Promise = require('promise');
var router = require('express').Router();
var util = require('util');
var uuid = require('node-uuid');
var PDFDocument = require('pdfkit');
var blobStream = require('blob-stream'); // added blobstream dependency
var iframe = require('iframe');
var fs = require('fs');
var bodyParser = require('body-parser');
var _bodyparser = bodyParser.urlencoded({
    'extended': true
});

var config = require('../config');

var agencyService = new config.AgencyService(new config.AgencyRepository());
var userService = new config.UserService(new config.UserRepository(), agencyService);
var boloService = new config.BoloService(new config.BoloRepository());
var emailService = new config.EmailService();
var pdfService = new config.PDFService();

var BoloAuthorize = require('../lib/authorization.js').BoloAuthorize;

var formUtil = require('../lib/form-util');

var GFERR = config.const.GFERR;
var GFMSG = config.const.GFMSG;

var parseFormData = formUtil.parseFormData;
var cleanTemporaryFiles = formUtil.cleanTempFiles;

/**
 * Send email notification of a new bolo.
 */

/**
 * Send email notification of a new bolo.
 */
function sendBoloNotificationEmail(bolo, template) {
    var data = {};
    var someData = {};
    var sort = 'username';

    var doc = new PDFDocument();

    boloService.getAttachment(bolo.id, 'featured').then(function(attDTO) {
        someData.featured = attDTO.data;
        return boloService.getBolo(bolo.id);
    }).then(function(bolo) {
        data.bolo = bolo;
        return agencyService.getAgency(bolo.agency);
    }).then(function(agency) {
        data.agency = agency;
        return agencyService.getAttachment(agency.id, 'logo')
    }).then(function(logo) {
        someData.logo = logo.data;
        return agencyService.getAttachment(data.agency.id, 'shield')
    }).then(function(shield) {
        someData.shield = shield.data;
        return userService.getByUsername(bolo.authorUName);
    }).then(function(user) {
        data.user = user;
        pdfService.genDetailsPdf(doc, data);
        doc.image(someData.featured, 15, 155, {
            fit: [260, 200]
        });
        doc.image(someData.logo, 15, 15, {
            height: 100
        });
        doc.image(someData.shield, 500, 15, {
            height: 100
        });
        doc.end();

    })

    return userService.getUsers(sort)
        .then(function(users) {
            // filters out users and pushes their emails into array
            var subscribers = users.filter(function(user) {
                var flag = false;
                if (user.notifications) {
                    var notificationLength = user.notifications.length;
                    for (var i = 0; i < notificationLength; i++) {
                        if (bolo.agencyName === user.notifications[i]) {
                            flag = true;
                        }
                    }
                }
                return flag;
            }).map(function(user) {
                return user.email;
            });

            var tmp = config.email.template_path + '/' + template + '.jade';
            var tdata = {
                'bolo': bolo,
                'app_url': config.appURL
            };

            /** @todo check if this is async **/
            var html = jade.renderFile(tmp, tdata);
            console.log("SENDING EMAIL SUCCESSFULLY");
            return emailService.send({
                'to': subscribers,
                'from': config.email.from,
                'fromName': config.email.fromName,
                'subject': 'BOLO Alert: ' + bolo.category,
                'html': html,
                'files': [{
                    filename: tdata.bolo.id + '.pdf', // required only if file.content is used.
                    contentType: 'application/pdf', // optional
                    content: doc
                }]
            });

        })
        .catch(function(error) {
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
function getAllBoloData(id) {
    var data = {};
    console.log("called get all bolo data");
    return boloService.getBolo(id).then(function(bolo) {
        data.bolo = bolo;

        return Promise.all([
            agencyService.getAgency(bolo.agency),
            userService.getUser(bolo.author)
        ]);

    }, function(reason) {
        throw new Error('Error retrieving all BOLO info.');
    }).then(function(responses) {

        console.log(responses);
        data.agency = responses[0];
        data.author = responses[1];
        console.log("finishing get all bolo data");

        return data;
    });
}

function getAgencyData(id) {
    var data = {};
    console.log("retrieving Agency data");

    return agencyService.getAgency(id).then(function(responses) {
        console.log(responses);
        data.agency = responses;
        return data;
    });
}



function attachmentFilter(fileDTO) {
    return /image/i.test(fileDTO.content_type);
}

function renameFile(dto, newname) {
    dto.name = newname;
    return dto;
}

function createUUID() {
    return uuid.v4().replace(/-/g, '');
}

// list bolos at the root route
router.get('/bolo', function(req, res, next) {
    var page = parseInt(req.query.page) || 1;
    var limit = config.const.BOLOS_PER_PAGE;
    var skip = (1 <= page) ? (page - 1) * limit : 0;
    var data = {
        'paging': {
            'first': 1,
            'current': page
        },
        'agencies': []
    };

    boloService.getBolos(limit, skip).then(function(results) {
        data.bolos = results.bolos;
        var now = moment().format(config.const.DATE_FORMAT);
        var then = "";
        var minutes_in_week = 10080;
        for (var i in data.bolos) {
            var curr = data.bolos[i];
            if (curr.data.status === 'New') {
                then = curr.data.lastUpdatedOn;
                var ms = moment(now, config.const.DATE_FORMAT).diff(moment(then, config.const.DATE_FORMAT));
                var d = moment.duration(ms);
                var minutes = parseInt(d.asMinutes());
                console.log(minutes);
                if (minutes > minutes_in_week) {
                    curr.data.status = 'Ongoing';

                }
            }
        }
        data.paging.last = Math.ceil(results.total / limit);

        agencyService.getAgencies().then(function(agencies) {
            data.agencies = agencies;
            res.render('bolo-list', data);
        });
    }).catch(function(error) {
        next(error);
    });
});

// list bolos by agency at the root route
router.get('/bolo/agency/:id', function(req, res, next) {
    var agency = req.params.id;
    var page = parseInt(req.query.page) || 1;
    var limit = config.const.BOLOS_PER_PAGE;
    var skip = (1 <= page) ? (page - 1) * limit : 0;

    var data = {
        'paging': {
            'first': 1,
            'current': page
        }
    };

    boloService.getBolosByAgency(agency, limit, skip).then(function(results) {
        data.bolos = results.bolos;
        data.paging.last = Math.ceil(results.total / limit);

        agencyService.getAgencies().then(function(agencies) {
            data.agencies = agencies;
            res.render('bolo-list', data);
        });
    }).catch(function(error) {
        next(error);
    });
});

// list archived bolos
router.get('/bolo/archive', function(req, res, next) {

    var page = parseInt(req.query.page) || 1;
    var limit = config.const.BOLOS_PER_PAGE;
    var skip = (1 <= page) ? (page - 1) * limit : 0;

    var data = {
        'paging': {
            'first': 1,
            'current': page
        }
    };

    boloService.getArchiveBolos(limit, skip).then(function(results) {
        data.bolos = results.bolos;
        data.paging.last = Math.ceil(results.total / limit);
        res.render('bolo-archive', data);
    }).catch(function(error) {
        next(error);
    });
});

router.post('/bolo/archive/purge', function(req, res) {

    var pass = req.body.password;
    var username = req.user.data.username;
    var range = req.body.range;
    var authorized = false;

    //2nd level of auth
    userService.authenticate(username, pass)
        .then(function(account) {
            var min_mins = 0;
            if (account) {
                //third level of auth
                var tier = req.user.roleName();

                if (tier === 'ROOT') {
                    authorized = true;
                    if (range == 1) {
                        min_mins = 1051200;
                    } else if (range == 2) {

                        min_mins = 0;
                    }

                    var now = moment().format(config.const.DATE_FORMAT);
                    var then = "";
                    boloService.getArchiveBolosForPurge().then(function(bolos) {

                        var promises = [];
                        for (var i = 0; i < bolos.bolos.length; i++) {
                            var curr = bolos.bolos[i];
                            then = curr.lastUpdatedOn;

                            var ms = moment(now, config.const.DATE_FORMAT).diff(moment(then, config.const.DATE_FORMAT));
                            var d = moment.duration(ms);
                            var minutes = parseInt(d.asMinutes());

                            if (minutes > min_mins) {
                                promises.push(boloService.removeBolo(curr.id));
                            }
                        }

                        Promise.all(promises).then(function(responses) {
                            if (responses.length >= 1) {
                                req.flash(GFMSG, 'Successfully purged ' + responses.length + ' BOLOs.');
                            } else {
                                req.flash(GFMSG, 'No BOLOs meet purge criteria.');
                            }
                            res.send({
                                redirect: '/bolo/archive'
                            });
                        });

                    });

                }
            }
            if (authorized === false) {
                req.flash(GFERR,
                    'You do not have permissions to purge BOLOs. Please ' +
                    'contact your agency\'s administrator ' +
                    'for access.');
                res.send({
                    redirect: '/bolo/archive'
                });
            }
        }).catch(function() {
        req.flash(GFERR, "error in purge process, please try again");
        res.send({
            redirect: '/bolo/archive'
        });
    });
});

router.get('/bolo/search/results', function(req, res) {


    console.log(req.query.bookmark);
    var query_string = req.query.valid;
    console.log(query_string);
    var data = {
        bookmark: req.query.bookmark || {},
        more: true,
        query: query_string
    };
    // Do something with variable
    var limit = config.const.BOLOS_PER_PAGE;

    boloService.searchBolos(limit, query_string, data.bookmark).then(function(results) {
        data.paging = results.total > limit;

        if (results.returned < limit) {
            console.log('theres no more!!');
            data.more = false; //indicate that another page exists
        }

        data.previous_bookmark = data.bookmark || {};
        data.bookmark = results.bookmark;
        console.log("current: " + data.bookmark);
        console.log("previous: " + data.previous_bookmark);

        data.bolos = results.bolos;
        res.render('bolo-search-results', data);
    }).catch(function(error) {
        next(error);
    });
});

router.get('/bolo/search', function(req, res) {
    var data = {
        'form_errors': req.flash('form-errors')
    };
    data.agencies = ['N/A'];
    agencyService.getAgencies().then(function(agencies) {
        for (var i in agencies) {
            var agency = agencies[i];
            data.agencies.push(agency.data.name);
        }

        res.render('bolo-search-form', data);
    });
});

// process bolo search user form input
router.post('/bolo/search', function(req, res, next) {

    parseFormData(req, attachmentFilter).then(function(formDTO) {

        var query_obj = formDTO.fields;
        console.log(query_obj);
        var query_string = '( ';
        var key = '';
        var value = '';
        var MATCH_EXPR = ' OR ';
        var expression = false;

        if (query_obj['matchFields'] === "on") {
            MATCH_EXPR = ' AND ';
        }

        for (var i = 0; i < Object.keys(query_obj).length; i++) {
            key = Object.keys(query_obj)[i];
            value = query_obj[Object.keys(query_obj)[i]];
            console.log(key + ':' + value);

            if (key !== "status" && key !== 'matchFields' && value !== "" && value != 'N/A') {
                if (expression === true) {
                    query_string += MATCH_EXPR;
                    expression = false;
                }
                query_string += key + ':' + value;
                expression = true;
            }

        }
        if (query_string !== '( ')
            query_string += ') AND Type:bolo';
        //form was empty, return empty object
        else
            query_string = {};

        return query_string;

    }).then(function(query_string) {
        var string = encodeURIComponent(query_string);
        res.redirect('/bolo/search/results?valid=' + string);
    }).catch(function(error) {
        next(error);
    });
});

// render the bolo create form
router.get('/bolo/create', function(req, res) {

    var data = {
        'form_errors': req.flash('form-errors')
    };

    res.render('bolo-create-form', data);
});


// process bolo creation user form input
// if the user slected preview mode, a view of the current form is rendered.
router.post('/bolo/create', _bodyparser, function(req, res, next) {

    parseFormData(req, attachmentFilter).then(function(formDTO) {

        var boloDTO = boloService.formatDTO(formDTO.fields);
        var attDTOs = [];
        var fi = {};
        boloDTO.createdOn = moment().format(config.const.DATE_FORMAT);
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
        boloDTO.status = 'New';

        if (formDTO.fields.featured_image) {
            fi = formDTO.fields.featured_image;
        }
        else {
            var file_path = path.resolve('src/web/public/img/nopic.png');
            fi = {
                'name': 'nopic.png',
                'content_type': 'image/png',
                'path': file_path
            };
        }
        boloDTO.images.featured = fi.name;
        attDTOs.push(renameFile(fi, 'featured'));

        if (formDTO.fields['image_upload[]']) {
            formDTO.fields['image_upload[]'].forEach(function(imgDTO) {
                var id = createUUID();
                boloDTO.images[id] = imgDTO.name;
                attDTOs.push(renameFile(imgDTO, id));
            });
        }

        if (formDTO.fields.option === "preview") {
            var preview = {};
            var bolo = boloService.previewBolo(boloDTO); // this runs isValid()
            preview.bolo = bolo;
            preview.agency = bolo.agency;
            preview.image = "none";
            preview.ranktitle = req.user.ranktitle;
            preview.sectunit = req.user.sectunit;
            preview.image = fi.path;

            return Promise.all([preview, formDTO]);
        }

        if (formDTO.fields.option === "submit") {
            var result = boloService.createBolo(boloDTO, attDTOs);
            return Promise.all([result, formDTO]);
        }

        if (formDTO.fields.option === "pdf") {
            var data = {};
            var bolo = boloService.previewBolo(boloDTO);
            data.bolo = bolo;
            data.agency = bolo.agency;
            data.image = "none";
            data.ranktitle = req.user.ranktitle;
            data.sectunit = req.user.sectunit;
            data.authName = req.user.fname + " " + req.user.lname;
            data.image = fi.path;

            return Promise.all([data, formDTO]);
        }
    }).then(function(pData) {

        if (pData[1].fields.option === "submit") {
            if (pData[1].files.length) cleanTemporaryFiles(pData[1].files);
            sendBoloNotificationEmail(pData[0], 'new-bolo-notification');
            req.flash(GFMSG, 'BOLO successfully created.');
            res.redirect('/bolo');
        }
        if (pData[1].fields.option === "pdf") {
            agencyService.getAgency(pData[0].agency).then(function(response) {

                pData[0].agency_name = response.data.name;
                pData[0].agency_address = response.data.address;
                pData[0].agency_city = response.data.city;
                pData[0].agency_zip = response.data.zip;
                pData[0].agency_state = response.data.state;
                pData[0].agency_phone = response.data.phone;

                var doc = new PDFDocument();
                var someData = {};
                pdfService.genPreviewPDF(doc, pData[0]);

                /** @todo must handle when featured image is empty **/
                if (pData[0].image === "none") {

                    doc.image("src/web/public/img/nopic.png", 15, 150, {
                        height: 200
                    });
                } else {
                    someData.featured = pData[0].image;
                    doc.image(someData.featured, 15, 150, {
                        fit: [260, 200]
                    });
                }

                agencyService.getAttachment(pData[0].agency, 'logo').then(function(logoDTO) {
                    someData.logo = logoDTO.data;
                    doc.image(someData.logo, 15, 15, {
                        height: 100
                    });
                    return agencyService.getAttachment(pData[0].agency, 'shield')
                }).then(function(shieldDTO) {
                    someData.shield = shieldDTO.data;
                    doc.image(someData.shield, 500, 15, {
                        height: 100
                    });
                    doc.end();
                    res.contentType("application/pdf");
                    doc.pipe(res);
                });

            });
        }

        if (pData[1].fields.option === "preview") {
            agencyService.getAgency(pData[0].agency).then(function(response) {
                pData[0].agency_name = response.data.name;
                pData[0].agency_address = response.data.address;
                pData[0].agency_city = response.data.city;
                pData[0].agency_zip = response.data.zip;
                pData[0].agency_state = response.data.state;
                pData[0].agency_phone = response.data.phone;

                var readFile = Promise.denodeify(fs.readFile);

                if (pData[0].image === "none") {
                    pData[0].buffer;
                    res.render('bolo-preview-details', pData[0]);
                } else {
                    readFile(pData[0].image).then(function(buffer) {
                        pData[0].buffer = buffer.toString('base64');
                        res.render('bolo-preview-details', pData[0]);
                    });
                }
            });
        } // end of preview
    }).catch(function(error) {
        next(error);
    });
});

//update bolo status through thumbnail select menu
router.post( '/bolo/update/:id', function ( req, res, next ) {
    var bolo_id = req.params.id;
    var bolo_status = req.body.status;
    var fname = req.user.fname;
    var lname = req.user.lname;
    var agency = req.user.agencyName;

    var data = {
        'form_errors': req.flash('form-errors')
    };

    getAllBoloData(bolo_id).then(function(boloData) {

        _.extend(data, boloData);

        var auth = new BoloAuthorize(data.bolo, data.author, req.user);

        if (auth.authorizedToEdit()) {
            data.bolo.status = bolo_status;
            var temp = moment().format(config.const.DATE_FORMAT);
            data.bolo.lastUpdatedOn = temp.toString();
            data.bolo.agencyName = req.user.agencyName;
            var att = [];

            data.bolo.record = data.bolo.record + 'Updated to "' + bolo_status + '" on ' + temp + '\nBy ' + fname + ' ' + lname + '\n' + 'From ' + agency + '\n\n';

            boloService.updateBolo(data.bolo, att).then(function(bolo) {

                res.redirect('/bolo');

            }).catch(function(error) {
                next(error);
            });

        }

    }, function(reason) {
        req.flash(GFERR,
            'The BOLO you were trying to edit does not exist.'
        );
        res.redirect('/bolo');
    }).catch(function(error) {
        req.flash(GFERR,
            'You do not have permissions to edit this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect('back');
    }).catch(function(error) {
        next(error);
    });
});

// render the bolo edit form
router.get('/bolo/edit/:id', function(req, res, next) {
    var data = {
        'form_errors': req.flash('form-errors'),
    };

    getAllBoloData(req.params.id).then(function(boloData) {
            _.extend(data, boloData);
            var auth = new BoloAuthorize(data.bolo, data.author, req.user);

            if (auth.authorizedToEdit()) {
                res.render('bolo-edit-form', data);
            }

        },
        function(reason) {
            req.flash(GFERR,
                'The BOLO you were trying to edit does not exist.'
            );
            res.redirect('/bolo');
        }
    ).catch(function(error) {
        req.flash(GFERR,
            'You do not have permissions to edit this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect('/bolo');
    }).catch(function(error) {
        next(error);
    });
});


// handle requests to process edits on a specific bolo
router.post('/bolo/edit/:id', function(req, res, next) {
    parseFormData(req, attachmentFilter).then(function(formDTO) {
        var boloDTO = boloService.formatDTO(formDTO.fields);
        var attDTOs = [];

        if (formDTO.fields.status === '') {
            boloDTO.status = 'Updated';
        }
        boloDTO.lastUpdatedOn = moment().format(config.const.DATE_FORMAT);
        boloDTO.lastUpdatedBy.firstName = req.user.fname;
        boloDTO.lastUpdatedBy.lastName = req.user.lname;
        boloDTO.agencyName = req.user.agencyName;


        boloDTO.record = boloDTO.record + 'Edited on ' + boloDTO.lastUpdatedOn + '\nBy ' + req.user.fname + ' ' + req.user.lname + '\nFrom ' + req.user.agencyName + '\n\n';

        if (formDTO.fields.featured_image) {
            var fi = formDTO.fields.featured_image;
            boloDTO.images.featured = fi.name;
            attDTOs.push(renameFile(fi, 'featured'));
        }

        if (formDTO.fields['image_upload[]']) {
            formDTO.fields['image_upload[]'].forEach(function(imgDTO) {
                var id = createUUID();
                boloDTO.images[id] = imgDTO.name;
                attDTOs.push(renameFile(imgDTO, id));
            });
        }

        if (formDTO.fields['image_remove[]']) {
            boloDTO.images_deleted = formDTO.fields['image_remove[]'];
        }

        console.log("asda", boloDTO);
        var result = boloService.updateBolo(boloDTO, attDTOs);
        return Promise.all([result, formDTO]);
    }).then(function(pData) {
        if (pData[1].files.length) cleanTemporaryFiles(pData[1].files);
        sendBoloNotificationEmail(pData[0], 'update-bolo-notification');
        req.flash(GFMSG, 'BOLO successfully updated.');
        res.redirect('/bolo');
    }).catch(function(error) {
        next(error);
    });
});



// handle requests to inactivate a specific bolo
router.get('/bolo/archive/:id', function(req, res, next) {
    var data = {};

    getAllBoloData(req.params.id).then(function(_data) {
        _.extend(data, _data);
        var auth = new BoloAuthorize(data.bolo, data.author, req.user);
        if (auth.authorizedToArchive()) {
            boloService.activate(data.bolo.id, false);
        }
    }).then(function(response) {
        req.flash(GFMSG, 'Successfully archived BOLO.');
        setTimeout(function () {
            res.redirect('/bolo')}, 3000);
    }).catch(function(error) {
        if (!/unauthorized/i.test(error.message)) throw error;

        req.flash(GFERR,
            'You do not have permissions to archive this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect('back');
    }).catch(function(error) {
        next(error);
    });
});


/**
 * Process a request to restore a bolo from the archive.
 */
router.get('/bolo/restore/:id', function(req, res, next) {
    var data = {};

    getAllBoloData(req.params.id).then(function(_data) {
        _.extend(data, _data);
        var auth = new BoloAuthorize(data.bolo, data.author, req.user);
        if (auth.authorizedToArchive()) {
            boloService.activate(data.bolo.id, true);
        }
    }).then(function(response) {
        req.flash(GFMSG, 'Successfully restored BOLO.');
        setTimeout(function () {
            res.redirect('/bolo/archive')}, 3000);
    }).catch(function(error) {
        if (!/unauthorized/i.test(error.message)) throw error;

        req.flash(GFERR,
            'You do not have permissions to restore this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect('back');
    }).catch(function(error) {
        next(error);
    });
});


/**
 * Process a request delete a bolo with the provided id
 */
router.get('/bolo/delete/:id', function(req, res, next) {

    getAllBoloData(req.params.id).then(function(data) {
        var auth = new BoloAuthorize(data.bolo, data.author, req.user);
        if (auth.authorizedToDelete()) {
            return boloService.removeBolo(req.params.id);
        }
    }).then(function(response) {
        req.flash(GFMSG, 'Successfully deleted BOLO.');
        res.redirect('back');
    }).catch(function(error) {
        if (!/unauthorized/i.test(error.message)) throw error;

        req.flash(GFERR,
            'You do not have permissions to delete this BOLO. Please ' +
            'contact your agency\'s supervisor or administrator ' +
            'for access.'
        );
        res.redirect('back');
    }).catch(function(error) {
        next(error);
    });
});


// handle requests to view the details of a bolo
router.get('/bolo/details/:id', function(req, res, next) {
    var data = {};
    data.tier = req.user.tier;

    boloService.getBolo(req.params.id).then(function(bolo) {
        data.bolo = bolo;
        return agencyService.getAgency(bolo.agency);

    }).then(function(agency) {
        data.agency = agency;
        return userService.getByUsername(data.bolo.authorUName);

    }).then(function(user) {
        data.user = user;
        res.render('bolo-details', data);

    }).catch(function(error) {
        next(error);
    });
});

router.get('/bolo/details/pdf/:id' + '.pdf', function(req, res, next) {
    var data = {};
    var someData = {};

    var doc = new PDFDocument();

    boloService.getAttachment(req.params.id, 'featured').then(function(attDTO) {
        someData.featured = attDTO.data;
        return boloService.getBolo(req.params.id);
    }).then(function(bolo) {
        data.bolo = bolo;
        return agencyService.getAgency(bolo.agency);
    }).then(function(agency) {
        data.agency = agency;
        return agencyService.getAttachment(agency.id, 'logo')
    }).then(function(logo) {
        someData.logo = logo.data;
        return agencyService.getAttachment(data.agency.id, 'shield')
    }).then(function(shield) {
        someData.shield = shield.data;
        return userService.getByUsername(data.bolo.authorUName);
    }).then(function(user) {
        data.user = user;
        pdfService.genDetailsPdf(doc, data);

        doc.image(someData.featured, 15, 155, {
            fit: [260, 200]
        });
        doc.image(someData.logo, 15, 15, {
            height: 100
        });
        console.log(someData.shield.content_type);
        doc.image(someData.shield, 500, 15, {
            height: 100
        });
        doc.end();

        res.contentType("application/pdf");
        doc.pipe(res);

    }).catch(function(error) {
        next(error);
    });
});

router.get('/bolo/details/pics/:id', function(req, res, next) {
    var data = {
        'form_errors': req.flash('form-errors')
    };
    boloService.getBolo(req.params.id).then(function(bolo) {
        data.bolo = bolo;
        res.render('bolo-additional-pics', data);

    }).catch(function(error) {
        next(error);
    });
});

router.get('/bolo/details/record/:id', function(req, res, next) {
    var data = {
        'form_errors': req.flash('form-errors')
    };
    boloService.getBolo(req.params.id).then(function(bolo) {
        data.record = bolo.record;
        res.render('bolo-record-tracking', data);

    }).catch(function(error) {
        next(error);
    });
});


// handle requests for bolo attachments
function getAttachment(req, res) {
    boloService.getAttachment(req.params.boloid, req.params.attname)
        .then(function(attDTO) {
            res.type(attDTO.content_type);
            res.send(attDTO.data);
        });
}

router.get('/bolo/asset/:boloid/:attname', getAttachment);
router.getAttachment = getAttachment;
module.exports = router;
