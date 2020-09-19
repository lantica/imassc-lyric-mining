(async () => {
    const ppt = require('puppeteer');
    const { promises: fs } = require('fs');
    const browser = await ppt.launch();
    const scList = await getSongList(browser, "ul.wsp-music_shinys-list");
    console.log('shiny color song list getL: ', scList)

    const lyricSearchPages = new Array(4).fill(undefined);
    await new Promise(rsov => {
        lyricSearchPages.forEach(async (elem, idx, array) => {
            lyricSearchPages[idx] = { page: await browser.newPage(), idle: true };
            if (idx === array.length - 1) rsov('done');
        });
    });
    console.log(lyricSearchPages.length, 'pages is opened for searching lyric');

    console.log('going to search lyrics');

    scList.songs.forEach(async ( { name }, idx) => {
        try {
            const lyric = await getLyric(name, lyricSearchPages);
            console.log(idx, name, "is writing");
            await fs.writeFile(`./lyrics/${name}.txt`, lyric ? lyric: '');
        } catch (e) { console.log(e) }

    })


    async function getSongList(browser, className) {
        const songPage = await browser.newPage();
        await songPage.goto("https://fujiwarahaji.me/sitemap/musiclist");
        const SongList = await songPage.$eval(className, async elem => {
            const songs = []
            for (let idx = 0; idx < elem.children.length; idx++) {
                songs.push({
                    name: elem.children[idx].innerText,
                });
            }
            return {
                length: elem.children.length,
                songs,
            }
        });
        songPage.close();
        return SongList
    }

    async function getLyric(name, lyricSearchPages) {
        const page = await getIdlePage(lyricSearchPages);
        const { page: currentPage } = page;
        await currentPage.goto("http://j-lyric.net/");
        await currentPage.type("#keyword", name);
        await Promise.all([
            currentPage.$eval('form', async form => {
                form.submit();
            }),
            await currentPage.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        await currentPage.screenshot({
            path: "./screenshot.jpg",
            type: "jpeg",
            fullPage: true
        });
        const bdys = await currentPage.$$("div.bdy")

        if (bdys.length > 0) {
            let href;
            for (let i = 0; i < bdys.length; i++) {
                try {
                    const p = await bdys[i].$(".mid");
                    const title = await p.$eval("a", elem => {
                        return elem.getAttribute('title');
                    });
                    if (title.includes(`${name} 歌詞`)) {
                        href = await p.$eval("a", elem => {
                            return elem.getAttribute('href');
                        });
                        break
                    }
                } catch { console.error; break }
            }
            if (href) {
                await currentPage.goto(href);
                const lyrics = await currentPage.$eval("p#Lyric", elem => elem.innerText);
                page.idle = true;
                return lyrics;
            } else {
                page.idle = true;
                throw new Error('No result found');
            }
        }
        else {
            page.idle = true;
            throw new Error('No result found');
        }

    };
    async function getIdlePage(lyricSearchPages) {
        const idlePage = await new Promise(rsov => {
            const timer = setInterval(() => {
                const page = lyricSearchPages.find(elem => elem.idle);
                if (page) {
                    page.idle = false;
                    clearInterval(timer);
                    rsov(page);
                }
            }, 2000);
        });
        return idlePage;
    };
})().catch(console.error);
