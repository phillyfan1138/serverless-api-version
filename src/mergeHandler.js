const request=require('request')
const {promisify} = require("es6-promisify");
const fs=require('fs-extra')

const mkdir=promisify(fs.mkdir)
const get=promisify(request.get)
const username = require('git-username').sync()
const reponame = require('git-repo-name').sync()
const url=`https://api.github.com/repos/${username}/${reponame}/releases`


const options=url=>({
    url,
    headers: {
        'User-Agent': reponame
    }
})

module.exports.httpOptions=options
const makeExecutable=(path, resolve, reject)=>()=>{
    fs.chmod(path, 0755, err=>{
        if(err){
            reject(err)
        }
        else{
            resolve()
        }
    })
}
const pipeResponse=(url, tag_name, name)=>new Promise((resolve, reject)=>{
    const path=`./releases/${tag_name}/${name}`
    request.get(options(url)).on('error', reject).pipe(fs.createWriteStream(path)).on('finish', makeExecutable(path, resolve, reject))
})

const getAssets=({assets, tag_name})=>mkdir(`./releases/${tag_name}`).then(()=>Promise.all(
    assets.map(({browser_download_url, name})=>pipeResponse(browser_download_url, tag_name, name))
))
let numV=0
module.exports.retrieveAssets=existingYmlAsJson=>fs.remove('./releases', ()=>{
    get(options(url)).then(response=>{
        const releases=JSON.parse(response.body)
        if(Array.isArray(releases)){
            numV=releases.length+1
            return mkdir('./releases').then(()=>Promise.all(
                releases.map(getAssets)
            ))
        }
        else{
            numV=1
            return Promise.resolve()
        }
    })
    .then(()=>Promise.all(
        ((existingYmlAsJson.package||{}).include||[]).map(files=>fs.copy(files, `./releases/v${numV}/${files}`))
    ))
    .catch(err=>{
        console.log(err)
    })
})