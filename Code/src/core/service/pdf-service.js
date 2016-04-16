'use strict';
var _ = require('lodash');
var Promise = require('promise');

function PDFService() {

}

PDFService.prototype.genDetailsPdf = function(doc, data) {
    console.log("JUST CALLED genDetailsPdf() from PDFService ");

    doc.fontSize(8);
    doc.fillColor('red');
    doc.text("UNCLASSIFIED// FOR OFFICIAL USE ONLY// LAW ENFORCEMENT SENSITIVE", 120, 15)
        .moveDown(0.25);
    doc.fillColor('black');
    doc.text(data.agency.name + " Police Department")
        .moveDown(0.25);
    doc.text(data.agency.address)
        .moveDown(0.25);
    doc.text(data.agency.city + ", " + data.agency.state + ", " + data.agency.zip)
        .moveDown(0.25);
    doc.text(data.agency.phone)
        .moveDown(0.25);
    doc.fontSize(20);
    doc.fillColor('red');
    doc.text(data.bolo.category, 0, 115, {
            align: 'center'
        })
        .moveDown();
    doc.fontSize(11);
    doc.fillColor('red');
    doc.text(data.bolo.status, 100, 140, {
            align: 'left'
        })
        .moveDown();
    doc.fillColor('black');
    doc.fontSize(11);
    doc.font('Times-Roman')
        .text("Bolo ID: " + data.bolo.id, 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Name: " + data.bolo.firstName + " " + data.bolo.lastName, 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Race: " + data.bolo['race'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("DOB: " + data.bolo['dob'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("License#: " + data.bolo['dlNumber'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Height: " + data.bolo['height'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Weight: " + data.bolo['weight'] + " lbs", 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Sex: " + data.bolo['sex'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Hair Color: " + data.bolo['hairColor'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Tattoos/Scars: " + data.bolo['tattoos'], 300)
        .moveDown();
    doc.font('Times-Bold')
        .text("Created: " + data.bolo.createdOn, 15, 360)
        .moveDown(4.15);
    doc.font('Times-Bold')
        .text("Additional: ", 15)
        .moveDown(0.25);
    doc.font('Times-Roman')
        .text(data.bolo['additional'], {
            width: 300
        })
        .moveDown();
    doc.font('Times-Bold')
        .text("Summary: ", 15)
        .moveDown(0.25);
    doc.font('Times-Roman')
        .text(data.bolo['summary'], {
            width: 300
        })
        .moveDown(4);
    doc.font('Times-Bold')
        .text("This BOLO was created by: " + data.user.sectunit + " " + data.user.ranktitle + " " + data.bolo.authorFName + " " + data.bolo.authorLName, 15)
        .moveDown(0.25);
    doc.font('Times-Bold')
        .text("Please contact the agency should clarification be required.");

    return doc;
}


/**
 * This is used to handle the data for the pdfPreview in Create Bolo View
 **/
PDFService.prototype.genPreviewPDF = function(doc, data) {

    doc.fontSize(8);
    doc.fillColor('red');
    doc.text("UNCLASSIFIED// FOR OFFICIAL USE ONLY// LAW ENFORCEMENT SENSITIVE", 120, 15)
        .moveDown(0.25);
    doc.fillColor('black');
    doc.text(data.agency_name + " Police Department")
        .moveDown(0.25);
    doc.text(data.agency_address)
        .moveDown(0.25);
    doc.text(data.agency_city + ", " + data.agency_state + ", " + data.agency_zip)
        .moveDown(0.25);
    doc.text(data.agency_phone)
        .moveDown(0.25);
    doc.fontSize(20);
    doc.fillColor('red');
    doc.text(data.bolo.category, 0, 115, {
            align: 'center'
        })
        .moveDown();
    doc.fontSize(11);
    doc.fillColor('red');
    doc.text(data.bolo.status, 100, 140, {
            align: 'left'
        })
        .moveDown();
    doc.fillColor('black');
    doc.fontSize(11);
    if (data.bolo.id === null) {
        doc.font('Times-Roman')
            .text("Bolo ID: " + "NO ID AVAILABLE", 300)
            .moveDown();
    } else {
        doc.font('Times-Roman')
            .text("Bolo ID: " + data.bolo.id, 300)
            .moveDown();
    }
    doc.font('Times-Roman')
        .text("Name: " + data.bolo.firstName + " " + data.bolo.lastName, 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Race: " + data.bolo['race'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("DOB: " + data.bolo['dob'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("License#: " + data.bolo['dlNumber'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Height: " + data.bolo['height'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Weight: " + data.bolo['weight'] + " lbs", 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Sex: " + data.bolo['sex'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Hair Color: " + data.bolo['hairColor'], 300)
        .moveDown();
    doc.font('Times-Roman')
        .text("Tattoos/Scars: " + data.bolo['tattoos'], 300)
        .moveDown();
    doc.font('Times-Bold')
        .text("Created: " + data.bolo.createdOn, 15, 360)
        .moveDown(4.15);
    doc.font('Times-Bold')
        .text("Additional: ", 15)
        .moveDown(0.25);
    doc.font('Times-Roman')
        .text(data.bolo['additional'], {
            width: 300
        })
        .moveDown();
    doc.font('Times-Bold')
        .text("Summary: ", 15)
        .moveDown(0.25);
    doc.font('Times-Roman')
        .text(data.bolo['summary'], {
            width: 300
        })
        .moveDown(4);
    doc.font('Times-Bold')
        .text("This BOLO was created by: " + data.sectunit + " " + data.ranktitle + " " + data.authName, 15)
        .moveDown(0.25);
    doc.font('Times-Bold')
        .text("Please contact the agency should clarification be required.");

    return doc;
}


module.exports = PDFService;
