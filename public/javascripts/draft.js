/**
 * @description 草稿本
 * 什么呀
 */
const _ =require('lodash')
const fs = require('fs');
const path =require('path')
let arr=[{name:'tom',age:11},{name:'tom',age:12}]
console.log(_.intersectionBy(arr,d=>d.name))
console.log(Array.isArray([]))
// console.log(arr.sort((a,b)=>(b-a))) 耶耶耶
// sfsdfsdf
const str1 = ['a', 'c="10"']
const str4 = JSON.stringify(str1)
console.log(str4)
const fpath=path.resolve(__dirname,'../data/testJson')
// fs.writeFileSync(path.resolve(__dirname,'../data/testJson'), str4)
const code = fs.readFileSync(fpath, 'utf-8')
console.log(code)
console.log('[" @flow "," the ssr codegen is essentially extending the default codegen to handle"," ssr-optimizable nodes and turn them into string render fns. in cases where"," a node is not optimizable it simply falls back to the default codegen."," segment types"," stringify whole tree"," stringify self and check children"," generate self as vnode and stringify children"," generate self as vnode and check children"," bail whole tree"," v-for / v-if"," attrs"," domprops"," v-bind=\"object\""," v-bind.prop=\"object\""," class"," style & v-show"," _scopedid"]')
console.log(JSON.parse(code))