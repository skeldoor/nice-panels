const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');
const sizeOf = require('image-size');
const fs = require('fs');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/screenshot', async (req, res) => {
    const bankState = req.body;

    if (!bankState) {
        return res.status(400).send('Bank state is required');
    }

    let browser;
    try {
        const dimensions = sizeOf(path.join(__dirname, 'Bank.png'));

        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });
        const page = await browser.newPage();

        await page.setViewport({
            width: dimensions.width,
            height: dimensions.height,
        });
        
        const htmlPath = path.join(__dirname, 'bankview', 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            // Set the base URL to resolve relative paths for images, etc.
            baseURL: `file://${path.join(__dirname, 'bankview')}/`
        });

        await page.evaluate((state) => {
            window.generateBank(state);
        }, bankState);

        await page.waitForTimeout(6000);

        const panel = await page.$('.bank-panel');
        if (panel) {
            const screenshot = await panel.screenshot({
                omitBackground: true
            });
            res.setHeader('Content-Type', 'image/png');
            res.send(screenshot);
        } else {
            res.status(404).send('Bank panel element not found');
        }
    } catch (error) {
        console.error('Error generating screenshot:', error);
        res.status(500).send('Error generating screenshot');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

module.exports = app;