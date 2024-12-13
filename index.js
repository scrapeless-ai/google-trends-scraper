import puppeteer from 'puppeteer-core';
import dotenv from 'dotenv';
import * as fs from "node:fs";

dotenv.config();

const API_KEY = process.env.API_KEY
const host = 'wss://browser.scrapeless.com';

const query = new URLSearchParams({
    token: API_KEY,
    session_ttl: '180',
    proxy_country: 'US',
}).toString();

// Google Trends URL parameters
const TRENDS_URL = 'https://trends.google.com/trends/explore';
const QUERY_PARAMS = new URLSearchParams({
    date: 'now 7-d',
    geo: 'US',
    q: 'Youtube,X',
    hl: 'en-US',
}).toString();

async function getTrends() {
    {
        const browser = await puppeteer.connect({
            browserWSEndpoint: `${host}/browser?${query}`,
            defaultViewport: null,
        });
        // load cookies from json file
        if (fs.existsSync('./data/cookies.json')) {
            const cookies = JSON.parse(fs.readFileSync('./data/cookies.json', 'utf-8'));
            await browser.setCookie(...cookies);
            console.log('cookies loaded from cookies.json');
        }

        const page = await browser.newPage();
        const url = `${TRENDS_URL}?${QUERY_PARAMS}`;
        console.log(url);
        await page.goto(url, {waitUntil: 'domcontentloaded'});

        // if 429 error, try to reload the page
        await page.reload({waitUntil: 'domcontentloaded'});

        // wait for the response with the data
        for (let i = 0; i < 10; i++) {
            page.reload({waitUntil: 'domcontentloaded'}).then()
            const response = await page.waitForResponse(response => {
                if (response.url().includes('trends/api/widgetdata/multiline')) {
                    return true;
                }
            });
            const data = await response.buffer()
            const trendResp = data.subarray(6).toString()
            const trendData = parseTrendsData(trendResp);
            if (trendResp.includes('Error 429 (Bad Request)') || trendData?.default?.timelineData?.length <= 0) {
                console.log('Error 429 (Bad Request), reloading page...')
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue
            }

            if (trendData?.default) {
                fs.writeFileSync('./data/trends.json', JSON.stringify(trendData, null, 2));
                break
            }
        }

        await page.screenshot({path: './screenshots/trends.png', fullPage: true});
        //
        // const cookies = await browser.cookies()
        // // save cookies to json file
        // fs.writeFileSync('./data/cookies.json', JSON.stringify(cookies, null, 2));
        // console.log('cookies saved to cookies.json');

        await page.close();
        await browser.close();
    }
}

const parseTrendsData = (trendResp) => {
    try {
        return JSON.parse(trendResp);
    } catch {
        return {}
    }
}
getTrends().then()
