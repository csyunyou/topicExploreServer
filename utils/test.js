var express = require('express');
var router = express.Router();
var readline = require('readline');
var fs = require('fs');
var parse = require('csv-parse/lib/sync');
var path = require('path');
var hCluster = require('../utils/hCluster');
var _ = require('lodash');

function getFileData(topicNum) {
    let filepath ='C:/Users/50809/Desktop/d3/deal-data/d3-all.csv'
    const fpath = filepath.replace(/\\/g, '\\\\')

    const text = fs.readFileSync(fpath, 'utf-8')
    let tmpTopicConItem
    let fileData = parse(text, {
        columns: true
    })
    // 用0来补充缺失值
    fileData.forEach(doc => {
        // let filename = path.join(__dirname, '../data', doc['filename'])
        // doc['filename'] = filename.replace(/\\/g, '\\\\')
        // tmpTopicContribution = []
        // doc['Topic_Contribution'] = JSON.parse(doc['Topic_Contribution'])
        // for (let num = 0; num < topicNum; num++) {
        //     tmpTopicConItem = doc['Topic_Contribution'].find(d => d[0] === num)
        //     if (!tmpTopicConItem) tmpTopicContribution.push({ topicId: num, percent: 0 })
        //     else tmpTopicContribution.push({ topicId: num, percent: tmpTopicConItem[1] })
        // }
        // doc['Topic_Contribution'] = tmpTopicContribution
        // doc['size'] = parseInt(doc['size'])
        // doc['func_Num'] = parseInt(doc['func_Num'])
        // doc['Perc_Contribution'] = Number(doc['Perc_Contribution'])
        doc['commentArr'] = JSON.parse(doc['commentArr'])
    })
    return fileData 
}

console.log(getFileData(18))
