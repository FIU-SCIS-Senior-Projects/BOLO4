/* jshint node: true */
'use strict';
var _ = require('lodash');
var Promise = require('promise');
var fs = require('fs');
var gm = require('gm').subClass({imageMagick: true});
var path = require('path');


function ImageService() {
}


ImageService.prototype.createImageFromBuffer = function (file) {

    console.log('copying image');
    // A buffer can be passed instead of a filepath as well
    if (!file.content_type)
        throw new Error('no file content specified');

    var img_type = file.content_type.substring(file.content_type.lastIndexOf("/") + 1);

    if (img_type === 'jpeg')
        img_type = 'jpg';

    var img_buffer = file.data;

    gm(img_buffer).write('C:/Users/Ed/WebstormProjects/BOLO4-Dev/Code/src/core/Images/' + file.name + '.' + img_type, function (err) {
        if (!err) console.log('done');
        else console.log(err);
    });


};

ImageService.prototype.compressImageFromBuffer = function (attDTOs) {

    if (!attDTOs.data) {
        throw new Error('Invalid Image Data');
    }
      return compress(attDTOs).then(function(content){

          attDTOs.data = content;
          return attDTOs;

      });


};
var compress = function(file) {

    return new Promise(function (resolve, reject) {


        console.log('compressing');
        // A buffer can be passed instead of a filepath as well
        if (!file.content_type)
            throw new Error('no file content specified');

        var img_type = file.content_type.substring(file.content_type.lastIndexOf("/") + 1);
        console.log(img_type);

        var compression = img_type.toUpperCase();
        if (img_type === 'jpeg')
            img_type = 'jpg';


        var img_buffer = file.data;
        var img_name = file.name;
console.log("original image length is " + img_buffer.length + " for image: " +img_name);
         gm(img_buffer, img_name + '.' + img_type).quality(50).compress(compression)
         .toBuffer(function (err, buffer) {

             if (err) {
                 console.log(err);
                 reject(new Error(err));
             }

             else
             {
             console.log("length after compression is " + buffer.length);
             resolve(buffer);
             }
         });

             /*console.log(buffer);
         if(buffer.length) {
         console.log("length after compression is " + buffer.length);
             resolve(buffer);

         }
         else reject(err);

         });*/



    });

};

ImageService.prototype.compressImageFromBufferOutToFile = function (file) {

    console.log('compressing');
    // A buffer can be passed instead of a filepath as well
    if (!file.content_type)
        throw new Error('no file content specified');

    var img_type = file.content_type.substring(file.content_type.lastIndexOf("/") + 1);
    console.log(img_type);

    var compression = img_type.toUpperCase();
    if (img_type === 'jpeg')
        img_type = 'jpg';


    var img_buffer = file.data;
    var img_name = file.name;


    gm(img_buffer, img_name + '.' + img_type).quality(25).compress(compression)
        .write('C:/Users/Ed/WebstormProjects/BOLO4-Dev/Code/src/core/Images/Compressed/' + img_name + '_compressed.' + img_type
            , function (err) {
                if (!err) {
                    console.log("compressed image!!")
                }
                else console.log(err);

            });


};

module.exports = ImageService;
