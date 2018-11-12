var express = require('express');
var router = express.Router();
var fs = require('fs');
var parse = require('csv-parse/lib/sync')
var path = require('path')
const fileData = getFileData(),topicData=getTopicData()

/* GET home page. */
router.get('/getAllDocs', function (req, res, next) {
    res.send({
        files: fileData,
        versions: getVersions()
    })
});

/**
 * @description 获取主题的关键词
 */
router.get('/getTopicData',function(req,res,next){
    res.send(topicData)
})

/**
 * @description 根据版本号获取主题在文件中的分布
 */
router.get('/getTopicDisByVersion', function (req, res, next) {
    const verReg = /vue-(\d*\.\d*\.\d*)/
    const version = req.query.version,
        filteredTopicData = fileData.filter(d => d.filename.match(verReg)[1] === version)
    let directory = path.resolve('/Users/wendahuang/Desktop/vue-all-versions', `vue-${version}`, 'src'),
        root = {
            name: directory,
            type: 'dir',
            children: []
        },
        blackList = ['.DS_Store']
    readDirSync(directory, root)
    res.send(root)

    function readDirSync(rootPath, root) {
        var pa = fs.readdirSync(rootPath);
        pa.forEach(function (ele, index) {
            // console.log(ele)
            if (blackList.indexOf(ele) !== -1) return
            var curPath = path.resolve(rootPath, ele),
                info = fs.statSync(curPath)
            if (info.isDirectory()) {
                // console.log("dir: "+ele)
                let tmpdir = { name: curPath, children: [], type: 'dir' }
                root.children.push(tmpdir)
                readDirSync(curPath, tmpdir);
            } else {
                root.children.push({
                    name: curPath,
                    type: 'file',
                    topic: filteredTopicData.find(d => d.filename === curPath)['Dominant_Topic']
                })
                // console.log("file: "+ele)
            }
        })
    }
})

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

function getFileData() {
    const text = fs.readFileSync('/Users/wendahuang/Desktop/data/vue-all-versions-topic.csv', 'utf-8')
    return parse(text, {
        columns: true
    })
}

function getTopicData(){
    return Array(10).fill(null)
}
module.exports = router;