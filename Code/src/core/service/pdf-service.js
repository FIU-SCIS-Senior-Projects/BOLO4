'use strict';
var _ = require('lodash');
var Promise = require('promise');

function PDFService(){
}

PDFService.prototype.genDetailsPdf = function(data){
  console.log("JUST CALLED genDetailsPdf() from PDFService ");
  var doc = new PDFDocument();
  var someData = {};
  doc.fontSize(8);
  doc.fillColor('red');
  doc.text("UNCLASSIFIED// FOR OFFICIAL USE ONLY// LAW ENFORCEMENT SENSITIVE", 120, 15)
      .moveDown(0.25);
  doc.fillColor('black');
  doc.text(data.agency.name + "Police Department")
      .moveDown(0.25);
  doc.text(data.agency.address)
      .moveDown(0.25);
  doc.text(data.agency.city + ", " + data.agency.state + ", " + data.agency.zip)
      .moveDown(0.25);
  doc.text(data.agency.phone)
      .moveDown(0.25);
  doc.fontSize(20);
  doc.fillColor('red');
  doc.text(data.bolo.category, 120, 115, {
          align: 'center'
      })
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
      .text(data.bolo['additional'], {
          width: 200
      })
      .moveDown();
  doc.font('Times-Roman')
      .text("Summary: ", 15)
      .moveDown(0.25);
  doc.font('Times-Roman')
      .text(data.bolo['summary'], {
          width: 200
      })
      .moveDown(5);
  doc.font('Times-Roman')
      .text("Any Agency having questions regarding this document may contact: " + data.bolo.authorFName + " " + data.bolo.authorLName, 15);

  boloService.getAttachment(data.bolo.id, 'featured').then(function(attDTO) {
      someData.featured = attDTO.data;
      doc.image(someData.featured, 15, 150, {
          width: 300,
          height: 300
      });
      return agencyService.getAttachment(data.agency.data.id, 'logo')
  }).then(function(logoDTO) {
      someData.logo = logoDTO.data;
      doc.image(someData.logo, 15, 15, {
          height: 100
      });
      return agencyService.getAttachment(data.agency.data.id, 'shield')
  }).then(function(shieldDTO) {
      someData.shield = shieldDTO.data;
      doc.image(someData.shield, 500, 15, {
          height: 100
      });
      doc.end();
      return doc;
  })
}

PDFService.prototype.genPreviewPDF = function(data){
  console.log("JUST CALLED genPreviewPDF() from PDFService ");
}
