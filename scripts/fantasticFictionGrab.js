function grabSeries(selector) {
    const outArr = document.querySelector(selector)
        .innerText
        .split("\n")
        .map(s => {
            const regex = /(\d+\.(?:\d+\.+)?)\s+([\w\s,']+)\((\d{4})\)/;
            const matched = s.match(regex);
            if (!matched) return null;
            return {
                number: matched[1].replace(/\.$/, ""),
                title:  matched[2].trim().replace(/^the /i, "").replace(/^a /i, ""),
                pubDate: matched[3]
            };
        }).filter(r => !!r);
    console.log(outArr.map(r => JSON.stringify(r)).join(",\n"));
}


function grabStandalone(selector) {
    const outArr = document.querySelector(selector)
        .innerText
        .split("\n")
        .map(s => {
            const regex = /([\w\s,']+)\((\d{4})\)/;
            const matched = s.match(regex);
            if (!matched) return null;
            return {
                title:  matched[1].trim().replace(/^the /i, "").replace(/^a /i, ""),
                pubDate: matched[2]
            };
        }).filter(r => !!r);
    console.log(outArr.map(r => JSON.stringify(r)).join(",\n"));
}
