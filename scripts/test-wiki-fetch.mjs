import https from 'https';
import { writeFileSync } from 'fs';

function fetchWikiPage(factionName) {
    return new Promise((resolve, reject) => {
        const url = `https://smashup.fandom.com/wiki/${factionName}`;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive'
            }
        };

        https.get(url, options, (res) => {
            console.log('Status Code:', res.statusCode);
            console.log('Headers:', res.headers);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Content length:', data.length);
                resolve(data);
            });
        }).on('error', reject);
    });
}

async function main() {
    try {
        const html = await fetchWikiPage('Ninjas');
        writeFileSync('wiki-sample.html', html);
        console.log('\n✅ HTML 已保存到 wiki-sample.html');
        console.log('前 500 字符:');
        console.log(html.substring(0, 500));
    } catch (error) {
        console.error('错误:', error.message);
    }
}

main();
