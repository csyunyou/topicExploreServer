var express = require('express');
var router = express.Router();
var fs = require('fs');
var parse=require('csv-parse')

/* GET home page. */
router.get('/getAllDocs', function(req, res, next) {
    const text=fs.readFileSync('/Users/wendahuang/Desktop/data/vue-all-versions-topic.csv', 'utf-8')
    parse(text,{
        columns:true
    },(err,data)=>{
        res.send(data)
    })
});

module.exports = router;