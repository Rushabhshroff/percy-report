//@ts-nocheck
global.fetch = require('node-fetch')
const fs = require('fs')
const token = "9c4085f1215b2acac26017f0b78d2eb0f782c01fda05e04672e51d7d2b85bc4f"
const buildId = "16448729"


fetch(`https://percy.io/api/v1/snapshots?build_id=${buildId}`, {
    headers: {
        "Authorization": `Token ${token}`
    }
}).then(async (res) => {
    let dir = `./Reports/${buildId}`
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    CreateReportFromResponse(await res.json(), dir)
}).catch(err => console.error(err))

async function CreateReportFromResponse(json, dir) {
    let snapshots = json["data"]
    let resources = {}
    json["included"].forEach((next) => {
        if (resources[next.type]) {
            resources[next.type].push(next)
        } else {
            resources[next.type] = [next]
        }
    })
    let browsers = {}
    resources['browsers'].forEach((browser) => {
        let id = browser.id
        let browserName = resources['browser-families'].find((bm) => {
            return bm.id == browser.relationships['browser-family'].data.id
        }).attributes.name
        browsers[id] = browserName
    })
    function getComparison(comparison) {
        let resource = resources['comparisons'].find((item) => item.id == comparison.id)
        if (!resource) return undefined;
        return {
            width: resource.attributes.width,
            browser: browsers[resource.relationships.browser.data.id],
            images: {
                remote: {
                    baseline: resource.relationships['base-screenshot'].data ? getScreenshotUrl(resource.relationships['base-screenshot'].data.id) : "",
                    head: getScreenshotUrl(resource.relationships['head-screenshot'].data.id),
                    diff: resource.relationships['diff-image'].data?getImageUrl(resource.relationships['diff-image'].data.id) : ""
                },
                local: {
                    baseline: "",
                    head: "",
                    diff: ""
                }
            }
        }
    }
    function getScreenshotUrl(screenshotId) {
        if (!screenshotId) return ""
        let screenshot = resources['screenshots'].find((ss) => ss.id === screenshotId);
        return getImageUrl(screenshot.relationships.image.data.id)
    }
    function getImageUrl(imageId) {
        if (!imageId) return ""
        let image = resources['images'].find((i) => i.id === imageId);
        if (!image) return ""
        return image.attributes.url
    }
    async function downloadImagesFromReport() {
        for (let i = 0; i < report.length; i++) {
            if(!report[i])continue;
            for (let j = 0; j < report[i].comparisons.length; j++) {
                if (!report[i].comparisons[j]) continue;
                for (let key in report[i].comparisons[j].images.remote) {
                    if (!report[i].comparisons[j]) continue;
                    let browser = report[i].comparisons[j].browser
                    let width = report[i].comparisons[j].width
                    let name = report[i].snapshotName
                    if(!fs.existsSync(`${dir}/${key}`)){
                        fs.mkdirSync(`${dir}/${key}`,{recursive:true})
                    }
                    let filePath = `${dir}/${key}/${name}-${browser}-${width}.png`
                    let imageUrl = report[i].comparisons[j].images.remote[key]
                    if(!imageUrl) continue;
                    await downloadImage(report[i].comparisons[j].images.remote[key],filePath);
                    report[i].comparisons[j].images.local[key] = `./${key}/${name}-${browser}-${width}.png`
                }
            }
        }
    }
    async function downloadImage(url, path) {
        await fetch(url).then(async (res)=>{
            let data = Buffer.from(await res.arrayBuffer())
            fs.writeFileSync(path,data)
        })
    }
    let report = []
    snapshots.forEach((snapshot) => {
        report.push({
            snapshotName: snapshot.attributes.name,
            status: snapshot.attributes['review-state'],
            comparisons: snapshot.relationships.comparisons.data.map((comparison) => getComparison(comparison))
        })
    })
    await downloadImagesFromReport();
    fs.writeFileSync(`${dir}/report.json`,JSON.stringify(report,undefined,2))
}

