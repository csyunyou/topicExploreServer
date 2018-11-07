/**
 * @description 草稿本
 */
const stringify = require('csv-stringify')
const data=[{a:1,b:2},{a:2,b:3}]
stringify(data,(err,d)=>{
    console.log(d)
})