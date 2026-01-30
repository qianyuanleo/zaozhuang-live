import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let browser = null;
    
    try {
        const { id = '1' } = req.query;
        
        // 频道配置（基于您的文档）
        const channels = {
            '1': { name: '枣庄新闻', url: 'https://app.zzxwcm.cn/application/tenma01ds_tvradio/view/web/#/?id=1' },
            '6': { name: '枣庄经济', url: 'https://app.zzxwcm.cn/application/tenma01ds_tvradio/view/web/#/?id=6' },
            '7': { name: '枣庄公共', url: 'https://app.zzxwcm.cn/application/tenma01ds_tvradio/view/web/#/?id=7' }
        };

        const channel = channels[id];
        if (!channel) {
            return res.status(400).json({ 
                success: false, 
                error: '无效频道ID。支持: 1(新闻), 6(经济), 7(公共)' 
            });
        }

        console.log(`开始抓取: ${channel.name}`);

        // 启动浏览器
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        
        // 监控网络请求
        const capturedUrls = [];
        page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8') && url.includes('sign=') && url.includes('t=')) {
                console.log('捕获m3u8地址:', url);
                capturedUrls.push(url);
            }
        });

        // 加载页面
        await page.goto(channel.url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // 等待播放
        await page.waitForTimeout(8000);

        // 获取播放地址
        const m3u8Url = await page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.src : null;
        });

        await browser.close();

        if (m3u8Url) {
            res.status(200).json({
                success: true,
                channel: channel.name,
                m3u8Url: m3u8Url,
                timestamp: Date.now()
            });
        } else {
            res.status(404).json({
                success: false,
                error: '未找到播放地址',
                capturedUrls: capturedUrls
            });
        }

    } catch (error) {
        console.error('抓取失败:', error);
        if (browser) await browser.close();
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}