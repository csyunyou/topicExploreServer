var express = require('express');
var router = express.Router();
var fs = require('fs');
var parse = require('csv-parse')
var path = require('path')

/* GET home page. */
router.get('/getAllDocs', function (req, res, next) {
    const text = fs.readFileSync('/Users/wendahuang/Desktop/data/vue-all-versions-topic.csv', 'utf-8')
    parse(text, {
        columns: true
    }, (err, data) => {
        res.send({
            files: data,
            versions: getVersions()
        })
    })
});

function getVersions() {
    const vueSrc = '/Users/wendahuang/Desktop/vue-all-versions',
        files = fs.readdirSync(vueSrc)
    let fpath = null
    let verReg = /vue-(\d*\.\d*\.\d*)/
    let versions = []
    for (let i = 0, len = files.length; i < len; i++) {
        fpath = path.resolve(vueSrc, files[i])
        let stat = fs.statSync(fpath)
        stat.isDirectory() && (versions.push(fpath.match(verReg)[1]))
    }
    versions.sort((a, b) => {
        let arr = a.split('.').map(d => parseInt(d)), brr = b.split('.').map(d => parseInt(d))
        for (let i = 0, len = arr.length; i < len; i++) {
            if (arr[i] < brr[i])
                return -1
            else if (arr[i] > brr[i])
                return 1
        }
    })
    return versions
}
module.exports = router;